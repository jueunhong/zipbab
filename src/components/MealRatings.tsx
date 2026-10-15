"use client";

import { useState } from "react";
import StarRating from "@/components/StarRating";
import type { HouseholdMember, Meal } from "@/lib/types";

/**
 * 기록 상세의 별점 칸: 평균, 멤버별 별점, 그리고 내 별점 매기기.
 * 같은 집 멤버는 누가 올린 기록이든 각자 별점을 남길 수 있다.
 */
export default function MealRatings({
  meal,
  members,
  me,
  onChanged,
}: {
  meal: Meal;
  members: HouseholdMember[];
  me: string | null;
  onChanged: (myRating: number | null) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nameOf = (userId: string) => members.find((m) => m.userId === userId)?.name ?? "예전 멤버";
  const others = meal.ratings.filter((r) => r.userId !== me);

  async function rate(rating: number | null) {
    if (saving) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/meals/${meal.id}/rating`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
    setSaving(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "별점을 저장하지 못했어요.");
    onChanged(rating);
  }

  return (
    <div className="space-y-2 rounded-xl bg-background px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm">별점</span>
        {meal.rating ? <StarRating value={meal.rating} size="sm" showNumber count={meal.ratings.length} /> : <span className="text-xs text-muted">아직 없어요</span>}
      </div>

      {others.length > 0 && (
        <ul className="space-y-1 text-sm">
          {others.map((r) => (
            <li key={r.userId} className="flex items-center justify-between gap-2">
              <span className="truncate text-muted">{nameOf(r.userId)}</span>
              <StarRating value={r.rating} size="sm" />
            </li>
          ))}
        </ul>
      )}

      <div className={`flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 ${saving ? "opacity-60" : ""}`}>
        <span className="text-sm">내 별점</span>
        <StarRating value={meal.myRating} onChange={rate} />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
