"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PhotoPicker, { usePhoto } from "@/components/PhotoPicker";
import RecipeCard from "@/components/RecipeCard";
import { today } from "@/lib/dates";
import { compressImage } from "@/lib/image";
import type { Meal, Recipe } from "@/lib/types";

export default function Journal() {
  const router = useRouter();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [pendingRecipe, setPendingRecipe] = useState<Recipe | null>(null);
  // 식단에서 "만들었어요"로 온 경우: 그 식단 칸과 날짜
  const [pendingPlan, setPendingPlan] = useState<{ planId: string; date: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const photo = usePhoto();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Meal | null>(null);
  const [loadError, setLoadError] = useState("");

  function pickPhoto(file: File | null) {
    photo.pick(file);
    if (file) setError("");
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/meals");
    const data = await res.json();
    if (res.ok) setMeals(data.meals);
  }, []);

  useEffect(() => {
    fetch("/api/meals")
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (ok) setMeals(data.meals);
        else setLoadError(data.error);
        // 추천 페이지에서 "만들었어요"로 넘어온 경우 레시피와 함께 기록 폼을 연다
        const stored = sessionStorage.getItem("zipbab:pendingRecipe");
        if (stored) setPendingRecipe(JSON.parse(stored));
        const plan = sessionStorage.getItem("zipbab:pendingPlan");
        if (plan) setPendingPlan(JSON.parse(plan));
        if (stored || new URLSearchParams(location.search).get("new")) setShowForm(true);
      });
  }, []);

  function clearPending() {
    sessionStorage.removeItem("zipbab:pendingRecipe");
    sessionStorage.removeItem("zipbab:pendingPlan");
    setPendingRecipe(null);
    setPendingPlan(null);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    if (!photo.file) {
      setSaving(false);
      return setError("사진을 찍거나 갤러리에서 골라 주세요.");
    }
    const form = new FormData(e.currentTarget);
    form.set("photo", await compressImage(photo.file));
    if (pendingRecipe) form.set("recipe", JSON.stringify(pendingRecipe));
    if (pendingPlan) form.set("planId", pendingPlan.planId);
    const res = await fetch("/api/meals", { method: "POST", body: form });
    const data = await res.json().catch(() => ({ error: "업로드에 실패했어요." }));
    setSaving(false);
    if (!res.ok) return setError(data.error);

    clearPending();
    pickPhoto(null);
    setShowForm(false);
    // 식단에서 왔으면 사진이 붙은 식단 화면으로 돌아간다
    if (pendingPlan) return router.push(`/plan?week=${form.get("date")}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">나의 집밥 기록</h1>
          <p className="mt-1 text-sm text-muted">지금까지 {meals.length}끼를 직접 해먹었어요.</p>
        </div>
        {!showForm && (
          <button className="btn" onClick={() => setShowForm(true)}>+ 기록하기</button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="card space-y-4">
          {pendingRecipe && <p className="text-sm">🍳 <b>{pendingRecipe.title}</b> 레시피와 함께 저장돼요.</p>}
          <PhotoPicker preview={photo.preview} onPick={pickPhoto} />
          <div className="grid grid-cols-2 gap-3">
            <input name="title" className="input" placeholder="요리 이름" defaultValue={pendingRecipe?.title ?? ""} />
            <input name="date" type="date" className="input" defaultValue={pendingPlan?.date ?? today()} />
          </div>
          <textarea name="memo" className="input min-h-20" placeholder="맛은 어땠나요? 다음엔 뭘 바꿔볼까요?" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button className="btn flex-1" disabled={saving}>{saving ? "저장 중…" : "저장"}</button>
            <button type="button" className="rounded-lg border border-line px-4 py-2 text-sm" onClick={() => { pickPhoto(null); clearPending(); setError(""); setShowForm(false); }}>
              취소
            </button>
          </div>
        </form>
      )}

      {loadError && <div className="card text-sm text-red-600">{loadError}</div>}

      {loadError ? null : meals.length === 0 && !showForm ? (
        <div className="card text-center text-sm text-muted">아직 기록이 없어요. 첫 집밥을 기록해 보세요!</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {meals.map((meal) => (
            <button key={meal.id} onClick={() => setSelected(meal)} className="group overflow-hidden rounded-xl border border-line bg-surface text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={meal.photoUrl} alt={meal.title} className="aspect-square w-full object-cover transition group-hover:scale-105" />
              <div className="p-2">
                <p className="truncate text-sm font-medium">{meal.title}</p>
                <p className="text-xs text-muted">{meal.date}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-20 overflow-y-auto bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="mx-auto max-w-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.photoUrl} alt={selected.title} className="w-full rounded-2xl" />
            <div className="card">
              <div className="flex justify-between">
                <h2 className="text-lg font-bold">{selected.title}</h2>
                <span className="text-sm text-muted">{selected.date}</span>
              </div>
              {selected.memo && <p className="mt-2 whitespace-pre-wrap text-sm">{selected.memo}</p>}
            </div>
            {selected.recipe && <RecipeCard recipe={selected.recipe} />}
            <button className="w-full rounded-lg bg-surface py-2 text-sm" onClick={() => setSelected(null)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
