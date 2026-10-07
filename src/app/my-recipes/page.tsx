"use client";

import { useCallback, useEffect, useState } from "react";
import MyRecipeForm from "@/components/MyRecipeForm";
import RecipeBookTabs from "@/components/RecipeBookTabs";
import { MacroBar } from "@/components/RecipeCard";
import type { MyRecipe, MyRecipeInput } from "@/lib/types";

function MyRecipeView({ recipe }: { recipe: MyRecipe }) {
  return (
    <article className="card space-y-5">
      {recipe.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={recipe.photoUrl} alt={recipe.title} className="aspect-[4/3] w-full rounded-xl object-cover" />
      )}
      <div>
        <h2 className="text-xl font-bold">{recipe.title}</h2>
        {recipe.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{recipe.description}</p>}
        <div className="mt-2 flex gap-2 text-xs">
          {recipe.cookTimeMinutes && <span className="rounded-full border border-line px-2 py-0.5">⏱ {recipe.cookTimeMinutes}분</span>}
          <span className="rounded-full border border-line px-2 py-0.5">{recipe.servings}인분</span>
        </div>
      </div>

      {recipe.nutrition && <MacroBar nutrition={recipe.nutrition} />}

      {recipe.ingredients.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">재료</h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex justify-between border-b border-line py-1">
                <span>{ing.name}</span>
                <span className="text-muted">{ing.amount}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recipe.steps.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">만드는 법</h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {recipe.steps.map((step, i) => (
              <li key={i} className="whitespace-pre-wrap">{step}</li>
            ))}
          </ol>
        </section>
      )}

      {recipe.tips && (
        <section>
          <h3 className="mb-2 font-semibold">팁·메모</h3>
          <p className="whitespace-pre-wrap text-sm text-muted">{recipe.tips}</p>
        </section>
      )}
    </article>
  );
}

export default function MyRecipes() {
  const [recipes, setRecipes] = useState<MyRecipe[] | null>(null);
  const [error, setError] = useState("");
  // null: 목록, "new": 새로 쓰기, MyRecipe: 그 레시피 수정
  const [editing, setEditing] = useState<MyRecipe | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // 추천 화면에서 "직접 고쳐서 내 레시피로"로 왔을 때 채워 둘 내용
  const [draft, setDraft] = useState<MyRecipeInput | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/my-recipes");
    const data = await res.json();
    if (res.ok) setRecipes(data.recipes);
    else setError(data.error);
  }, []);

  useEffect(() => {
    fetch("/api/my-recipes")
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!ok) return setError(data.error);
        setRecipes(data.recipes);
        // 식단에서 "내 레시피에서 보기"로 왔으면 그 레시피를 펼친다 (/my-recipes?open=id)
        const params = new URLSearchParams(location.search);
        const open = params.get("open");
        if (open) setOpenId(open);
        const stored = sessionStorage.getItem("zipbab:myRecipeDraft");
        if (params.get("new") && stored) {
          setDraft(JSON.parse(stored));
          setEditing("new");
        }
      });
  }, []);

  function clearDraft() {
    sessionStorage.removeItem("zipbab:myRecipeDraft");
    setDraft(null);
  }

  async function remove(recipe: MyRecipe) {
    if (!confirm(`'${recipe.title}' 레시피를 삭제할까요? 되돌릴 수 없어요.`)) return;
    const res = await fetch(`/api/my-recipes/${recipe.id}`, { method: "DELETE" });
    if (!res.ok) return setError((await res.json()).error);
    setOpenId(null);
    load();
  }

  if (editing) {
    return (
      <div className="space-y-6">
        <RecipeBookTabs active="mine" />
        <MyRecipeForm
          editing={editing === "new" ? undefined : editing}
          initial={editing === "new" ? (draft ?? undefined) : undefined}
          onCancel={() => {
            clearDraft();
            setEditing(null);
          }}
          onSaved={() => {
            clearDraft();
            setEditing(null);
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RecipeBookTabs active="mine" />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">내 레시피</h1>
          <p className="mt-1 text-sm text-muted">{recipes ? `직접 만든 레시피 ${recipes.length}개` : "불러오는 중…"}</p>
        </div>
        <button className="btn" onClick={() => { clearDraft(); setEditing("new"); }}>
          + 새 레시피
        </button>
      </div>

      {error && <div className="card text-sm text-red-600">{error}</div>}

      {recipes?.length === 0 && (
        <div className="card text-center text-sm text-muted">
          아직 기록한 레시피가 없어요. 나만의 비법 레시피를 남겨 보세요!
        </div>
      )}

      <ul className="space-y-3">
        {recipes?.map((recipe) => {
          const open = openId === recipe.id;
          return (
            <li key={recipe.id} className="space-y-3">
              <button
                onClick={() => setOpenId(open ? null : recipe.id)}
                className="card flex w-full items-center gap-3 !p-3 text-left hover:border-accent"
              >
                {recipe.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={recipe.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-line text-2xl">🍳</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{recipe.title}</p>
                  <p className="truncate text-sm text-muted">{recipe.description || `재료 ${recipe.ingredients.length}개 · ${recipe.steps.length}단계`}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-muted">
                  {recipe.cookTimeMinutes && <p>⏱ {recipe.cookTimeMinutes}분</p>}
                  {recipe.nutrition && <p>{Math.round(recipe.nutrition.calories)} kcal</p>}
                </div>
              </button>

              {open && (
                <div className="space-y-3">
                  <MyRecipeView recipe={recipe} />
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(recipe)} className="btn flex-1">
                      ✏️ 수정
                    </button>
                    <button onClick={() => remove(recipe)} className="rounded-lg border border-line px-4 py-2 text-sm text-red-600">
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
