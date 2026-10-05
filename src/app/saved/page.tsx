"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddToPlanButton from "@/components/AddToPlanButton";
import RecipeBookTabs from "@/components/RecipeBookTabs";
import RecipeCard from "@/components/RecipeCard";
import type { SavedRecipe } from "@/lib/types";

export default function Saved() {
  const router = useRouter();
  const [saved, setSaved] = useState<SavedRecipe[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/saved")
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => (ok ? setSaved(data.saved) : setError(data.error)));
  }, []);

  async function unsave(item: SavedRecipe) {
    if (!confirm(`'${item.recipe.title}' 찜을 해제할까요?`)) return;
    const before = saved;
    setSaved((prev) => prev?.filter((s) => s.id !== item.id) ?? null);
    const res = await fetch(`/api/saved?id=${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      setSaved(before);
      setError((await res.json()).error);
    }
  }

  function cookedIt(item: SavedRecipe) {
    sessionStorage.setItem("zipbab:pendingRecipe", JSON.stringify(item.recipe));
    sessionStorage.removeItem("zipbab:pendingPlan");
    router.push("/journal?new=1");
  }

  return (
    <div className="space-y-6">
      <RecipeBookTabs active="saved" />
      <div>
        <h1 className="text-2xl font-bold">찜한 레시피</h1>
        <p className="mt-1 text-sm text-muted">
          {saved ? `${saved.length}개의 레시피를 찜했어요.` : "불러오는 중…"}
        </p>
      </div>

      {error && <div className="card text-sm text-red-600">{error}</div>}

      {saved?.length === 0 && (
        <div className="card text-center text-sm text-muted">
          아직 찜한 레시피가 없어요. <Link href="/" className="underline">레시피를 추천받고</Link> ♡ 찜하기를 눌러 보세요.
        </div>
      )}

      <ul className="space-y-3">
        {saved?.map((item) => {
          const { recipe } = item;
          const open = openId === item.id;
          return (
            <li key={item.id} className="space-y-3">
              <button
                onClick={() => setOpenId(open ? null : item.id)}
                className="card flex w-full items-center justify-between gap-3 text-left hover:border-accent"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{recipe.title}</p>
                  <p className="truncate text-sm text-muted">{recipe.summary}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-muted">
                  <p>⏱ {recipe.cookTimeMinutes}분</p>
                  <p>{Math.round(recipe.nutritionPerServing.calories)} kcal</p>
                </div>
              </button>

              {open && (
                <div className="space-y-3">
                  <RecipeCard recipe={recipe} withImage />
                  <div className="flex gap-2">
                    <button onClick={() => cookedIt(item)} className="btn flex-1 !py-3">📸 만들었어요! 사진 기록하기</button>
                    <button onClick={() => unsave(item)} className="rounded-lg border border-line px-4 py-2 text-sm text-muted">
                      찜 해제
                    </button>
                  </div>
                  <AddToPlanButton recipe={recipe} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
