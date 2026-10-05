"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RecipeCard from "@/components/RecipeCard";
import AddToPlanButton from "@/components/AddToPlanButton";
import SaveButton from "@/components/SaveButton";
import { shortLabel } from "@/lib/dates";
import { dDayLabel, daysLeft, sortByExpiry } from "@/lib/pantry";
import type { PantryItem, Recipe, SavedRecipe } from "@/lib/types";

function describe(item: PantryItem): string {
  const days = daysLeft(item);
  return days === null ? item.name : `${item.name}(유통기한 ${dDayLabel(days)})`;
}

// 추천 결과와 입력값을 브라우저에 저장해 두고, 다른 페이지에 갔다 와도 그대로 복원한다
const DRAFT_KEY = "zipbab:recommendDraft";

type Draft = {
  recipe: Recipe | null;
  seenTitles: string[];
  ingredients: string;
  maxMinutes: number;
  notes: string;
  excluded: string[];
};

const EMPTY_DRAFT: Draft = { recipe: null, seenTitles: [], ingredients: "", maxMinutes: 20, notes: "", excluded: [] };

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY_DRAFT, ...JSON.parse(raw) } : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT;
  }
}

function storeDraft(draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // 사생활 보호 모드 등에서 저장이 막혀도 화면은 정상 동작한다
  }
}

/** 브라우저에서만 렌더된다 (app/page.tsx 에서 ssr: false 로 불러옴) — 그래서 첫 렌더부터 저장된 값을 쓸 수 있다 */
export default function Recommender() {
  const router = useRouter();
  const [initial] = useState(loadDraft);
  // 식단 화면의 빈 날짜에서 "추천받기"로 왔으면 그 날짜 (/?planDate=YYYY-MM-DD)
  const [planDate] = useState(() => {
    const d = new URLSearchParams(location.search).get("planDate");
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
  });
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  // 선택 해제한 재료만 기억한다 — 기본은 우리집 재료 전부 사용
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set(initial.excluded));
  const [ingredients, setIngredients] = useState(initial.ingredients);
  const [maxMinutes, setMaxMinutes] = useState(initial.maxMinutes);
  const [notes, setNotes] = useState(initial.notes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(initial.recipe);
  // 같은 조건에서 이미 추천받은 메뉴들 — "다른 레시피" 요청 시 겹치지 않게 제외한다
  const [seenTitles, setSeenTitles] = useState<string[]>(initial.seenTitles);

  useEffect(() => {
    storeDraft({ recipe, seenTitles, ingredients, maxMinutes, notes, excluded: [...excluded] });
  }, [recipe, seenTitles, ingredients, maxMinutes, notes, excluded]);

  function reset() {
    storeDraft(null);
    setRecipe(null);
    setSeenTitles([]);
    setIngredients("");
    setMaxMinutes(EMPTY_DRAFT.maxMinutes);
    setNotes("");
    setExcluded(new Set());
    setError("");
  }
  // 레시피 이름 → 찜 id. 추천받은 레시피가 이미 찜한 것인지 표시하는 데 쓴다
  const [savedIds, setSavedIds] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/pantry")
      .then((res) => res.json())
      .then((data) => setPantry(sortByExpiry(data.items ?? [])));
    fetch("/api/saved")
      .then((res) => res.json())
      .then((data: { saved?: SavedRecipe[] }) =>
        setSavedIds(Object.fromEntries((data.saved ?? []).map((s) => [s.recipe.title, s.id]))),
      );
  }, []);

  function setSaved(title: string, id: string | null) {
    setSavedIds((prev) => {
      const next = { ...prev };
      if (id) next[title] = id;
      else delete next[title];
      return next;
    });
  }

  const foods = pantry.filter((item) => item.category !== "양념");
  const seasonings = pantry.filter((item) => item.category === "양념");

  function toggle(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function recommend(e: React.SyntheticEvent, { another = false } = {}) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const avoid = another ? seenTitles : [];
    const selected = (items: PantryItem[]) => items.filter((item) => !excluded.has(item.id));
    const allIngredients = [...selected(foods).map(describe), ingredients.trim()].filter(Boolean).join(", ");
    try {
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: allIngredients,
          seasonings: selected(seasonings).map((item) => item.name).join(", "),
          maxMinutes,
          notes,
          servings: 1,
          avoid,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const nextSeen = [...avoid, data.recipe.title];
      // 기다리는 동안 다른 페이지로 이동했어도 결과가 남도록 바로 저장한다
      storeDraft({ ...loadDraft(), recipe: data.recipe, seenTitles: nextSeen });
      setRecipe(data.recipe);
      setSeenTitles(nextSeen);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  function cookedIt() {
    if (!recipe) return;
    sessionStorage.setItem("zipbab:pendingRecipe", JSON.stringify(recipe));
    sessionStorage.removeItem("zipbab:pendingPlan");
    router.push("/journal?new=1");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{planDate ? `${shortLabel(planDate)} 뭐 해먹지?` : "오늘 뭐 해먹지?"}</h1>
          <p className="mt-1 text-sm text-muted">탄·단·지 균형 잡힌, 간단하고 맛있는 집밥을 추천해 드려요.</p>
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={loading}
          title="추천 결과와 입력한 내용을 지우고 처음부터"
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent disabled:opacity-50"
        >
          ↻ 새로고침
        </button>
      </div>

      <form onSubmit={recommend} className="card space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">우리집 재료</span>
            <Link href="/pantry" className="text-xs text-muted hover:text-accent">재료 관리 →</Link>
          </div>
          {pantry.length === 0 ? (
            <p className="text-xs text-muted">
              저장된 재료가 없어요. <Link href="/pantry" className="underline">우리집 재료</Link>에 냉장고 속 재료를 저장해 두면 여기서 바로 골라 쓸 수 있어요.
            </p>
          ) : (
            <>
              {[foods, seasonings].map((group, i) =>
                group.length > 0 ? (
                  <div key={i} className="flex flex-wrap gap-1.5">
                    {group.map((item) => {
                      const on = !excluded.has(item.id);
                      const days = daysLeft(item);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggle(item.id)}
                          className={`rounded-full px-2.5 py-1 text-xs ${on ? "bg-accent text-white" : "border border-line text-muted line-through"}`}
                        >
                          {item.name}
                          {days !== null && days <= 3 && ` · ${dDayLabel(days)}`}
                        </button>
                      );
                    })}
                  </div>
                ) : null,
              )}
              <p className="text-xs text-muted">참고용이에요. 어울리는 재료만 골라 쓰고, 다 쓰지 않아도 돼요. 누르면 이번 추천에서 아예 뺄 수 있어요.</p>
            </>
          )}
          <input className="input" placeholder="그 밖에 쓰고 싶은 재료 (선택)" value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">조리 시간: {maxMinutes}분 이내</span>
          <input type="range" min={10} max={60} step={5} value={maxMinutes} onChange={(e) => setMaxMinutes(Number(e.target.value))} className="w-full accent-accent" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">추가 요청 (선택)</span>
          <input className="input" placeholder="예: 매콤한 거, 다이어트 중, 국물 요리" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button className="btn w-full" disabled={loading}>
          {loading ? "레시피 고르는 중… (최대 1분 정도 걸려요)" : "레시피 추천받기"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {recipe && (
        <div className="space-y-3">
          <div className={loading ? "pointer-events-none animate-pulse opacity-40" : ""}>
            <RecipeCard recipe={recipe} withImage />
          </div>
          <button onClick={cookedIt} className="btn w-full !py-3" disabled={loading}>📸 만들었어요! 사진 기록하기</button>
          <div className="flex gap-2">
            <SaveButton
              recipe={recipe}
              savedId={savedIds[recipe.title] ?? null}
              onChange={(id) => setSaved(recipe.title, id)}
              className="flex-1"
            />
            <button
              onClick={(e) => recommend(e, { another: true })}
              className="flex-1 rounded-lg border border-line px-4 py-2 text-sm disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "다른 메뉴 찾는 중…" : "다른 레시피"}
            </button>
          </div>
          <AddToPlanButton key={recipe.title} recipe={recipe} defaultDate={planDate} />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
