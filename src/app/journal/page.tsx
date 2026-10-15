"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PhotoPicker, { usePhoto } from "@/components/PhotoPicker";
import RecipeCard from "@/components/RecipeCard";
import MealRatings from "@/components/MealRatings";
import StarRating from "@/components/StarRating";
import { withMyRating } from "@/lib/ratings";
import { today } from "@/lib/dates";
import { compressImage, makeThumbnail } from "@/lib/image";
import type { HouseholdMember, Meal, Recipe } from "@/lib/types";

export default function Journal() {
  const router = useRouter();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [pendingRecipe, setPendingRecipe] = useState<Recipe | null>(null);
  // 식단에서 "만들었어요"로 온 경우: 그 식단 칸과 날짜
  const [pendingPlan, setPendingPlan] = useState<{ planId: string; date: string; title?: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const photo = usePhoto();
  const [rating, setRating] = useState<number | null>(null);
  // 사진 목록 보기: 2열(제목·별점 함께) / 3열(사진 위주). 고른 보기는 이 기기에 기억한다
  const [cols, setCols] = useState<2 | 3>(2);
  // 같은 집 멤버 — 여럿이 함께 쓸 때 누가 올린 기록인지 보여준다
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [me, setMe] = useState<string | null>(null);

  function changeCols(next: 2 | 3) {
    setCols(next);
    try {
      localStorage.setItem("zipbab:journalCols", String(next));
    } catch {
      // 저장이 막혀도 이번 화면에서는 바뀐 보기로 보인다
    }
  }
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
        fetch("/api/household")
          .then((res) => (res.ok ? res.json() : null))
          .then((d) => {
            if (!d) return;
            setMembers(d.household.members);
            setMe(d.household.me);
          });
        try {
          if (localStorage.getItem("zipbab:journalCols") === "3") setCols(3);
        } catch {
          // 기본 2열
        }
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
    const [full, thumb] = await Promise.all([compressImage(photo.file), makeThumbnail(photo.file)]);
    form.set("photo", full);
    form.set("thumb", thumb);
    if (pendingRecipe) form.set("recipe", JSON.stringify(pendingRecipe));
    if (pendingPlan) form.set("planId", pendingPlan.planId);
    if (rating) form.set("rating", String(rating));
    const res = await fetch("/api/meals", { method: "POST", body: form });
    const data = await res.json().catch(() => ({ error: "업로드에 실패했어요." }));
    setSaving(false);
    if (!res.ok) return setError(data.error);

    clearPending();
    pickPhoto(null);
    setRating(null);
    setShowForm(false);
    // 식단에서 왔으면 사진이 붙은 식단 화면으로 돌아간다
    if (pendingPlan) return router.push(`/plan?week=${form.get("date")}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl">나의 집밥 기록</h1>
          <p className="mt-1 text-sm text-muted">지금까지 {meals.length}끼를 직접 해먹었어요.</p>
          {meals.length > 0 && (
            <div className="mt-2 inline-flex rounded-lg border border-line p-0.5 text-xs" role="group" aria-label="사진 보기">
              {([2, 3] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => changeCols(n)}
                  aria-pressed={cols === n}
                  className={`rounded-md px-2.5 py-1 ${cols === n ? "bg-accent text-white" : "text-muted"}`}
                >
                  {n}열
                </button>
              ))}
            </div>
          )}
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
            <input name="title" className="input" placeholder="요리 이름" defaultValue={pendingRecipe?.title ?? pendingPlan?.title ?? ""} />
            <input name="date" type="date" className="input" defaultValue={pendingPlan?.date ?? today()} />
          </div>
          <div className="rounded-lg border border-line px-3 py-2.5">
            <p className="mb-1 text-xs text-muted">오늘 요리는 몇 점인가요?</p>
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>
          <textarea name="memo" className="input min-h-20" placeholder="맛은 어땠나요? 다음엔 뭘 바꿔볼까요?" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button className="btn flex-1" disabled={saving}>{saving ? "저장 중…" : "저장"}</button>
            <button type="button" className="rounded-lg border border-line px-4 py-2 text-sm" onClick={() => { pickPhoto(null); setRating(null); clearPending(); setError(""); setShowForm(false); }}>
              취소
            </button>
          </div>
        </form>
      )}

      {loadError && <div className="card text-sm text-red-600">{loadError}</div>}

      {loadError ? null : meals.length === 0 && !showForm ? (
        <div className="card text-center text-sm text-muted">아직 기록이 없어요. 첫 집밥을 기록해 보세요!</div>
      ) : (
        <div className={cols === 3 ? "grid grid-cols-3 gap-1 sm:grid-cols-4" : "grid grid-cols-2 gap-3 sm:grid-cols-3"}>
          {meals.map((meal) =>
            cols === 3 ? (
              // 3열: 사진 위주. 별점만 사진 위에 작게
              <button key={meal.id} onClick={() => setSelected(meal)} className="group relative overflow-hidden rounded-md bg-line" aria-label={`${meal.title} ${meal.date}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={meal.thumbUrl} alt={meal.title} loading="lazy" decoding="async" className="aspect-square w-full object-cover transition group-hover:scale-105" />
                {meal.rating ? (
                  <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[10px] leading-4 text-carbs">★{Number.isInteger(meal.rating) ? meal.rating : meal.rating.toFixed(1)}</span>
                ) : null}
              </button>
            ) : (
              <button key={meal.id} onClick={() => setSelected(meal)} className="group overflow-hidden rounded-xl border border-line bg-surface text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={meal.thumbUrl} alt={meal.title} loading="lazy" decoding="async" className="aspect-square w-full bg-line object-cover transition group-hover:scale-105" />
                <div className="p-2">
                  <p className="truncate text-sm font-medium">{meal.title}</p>
                  <StarRating value={meal.rating} size="sm" showNumber={meal.ratings.length > 1} />
                  <p className="text-xs text-muted">{meal.date}</p>
                </div>
              </button>
            ),
          )}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-20 overflow-y-auto bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="mx-auto max-w-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.photoUrl} alt={selected.title} decoding="async" className="w-full rounded-2xl bg-line" style={{ backgroundImage: `url(${selected.thumbUrl})`, backgroundSize: "cover" }} />
            <div className="card">
              <div className="flex justify-between">
                <h2 className="text-lg">{selected.title}</h2>
                <span className="text-sm text-muted">{selected.date}</span>
              </div>
              {members.length > 1 && (
                <p className="mt-0.5 text-xs text-muted">
                  👤 {members.find((m) => m.userId === selected.userId)?.name ?? "예전 멤버"}님의 기록
                </p>
              )}
              {selected.memo && <p className="mt-2 whitespace-pre-wrap text-sm">{selected.memo}</p>}
              <div className="mt-3">
                <MealRatings
                  meal={selected}
                  members={members}
                  me={me}
                  onChanged={(rating) => {
                    if (!me) return;
                    const updated = withMyRating(selected, me, rating);
                    setSelected(updated);
                    setMeals((list) => list.map((m) => (m.id === updated.id ? updated : m)));
                  }}
                />
              </div>
            </div>
            {selected.recipe && <RecipeCard recipe={selected.recipe} />}
            <button className="w-full rounded-lg bg-surface py-2 text-sm" onClick={() => setSelected(null)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
