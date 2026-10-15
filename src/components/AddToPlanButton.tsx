"use client";

import { useState } from "react";
import Link from "next/link";
import PlanCalendar from "@/components/PlanCalendar";
import { shortLabel, today } from "@/lib/dates";
import { MEAL_SLOTS, type MealSlot, type Recipe } from "@/lib/types";

/** "📅 식단에 추가" — 누르면 날짜·끼니를 고르는 칸이 펼쳐진다 */
export default function AddToPlanButton({
  recipe,
  defaultDate,
  className = "",
}: {
  recipe: Recipe;
  defaultDate?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<MealSlot>("저녁");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<{ date: string; slot: MealSlot } | null>(null);

  function toggle() {
    if (!open) {
      setDate(defaultDate ?? today());
      setAdded(null);
      setError("");
    }
    setOpen(!open);
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, slot, recipe }),
    });
    const data = await res.json().catch(() => ({ error: "저장하지 못했어요." }));
    setSaving(false);
    if (!res.ok) return setError(data.error);
    setAdded({ date, slot });
    setOpen(false);
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        className={`w-full rounded-lg border px-4 py-2 text-sm ${open ? "border-accent text-accent" : "border-line"}`}
      >
        📅 식단에 추가
      </button>

      {added && !open && (
        <p className="mt-2 text-center text-xs text-muted">
          {shortLabel(added.date)} {added.slot}에 추가했어요 ·{" "}
          <Link href={`/plan?week=${added.date}`} className="text-accent underline">
            식단 보기
          </Link>
        </p>
      )}

      {open && (
        <div className="card mt-2 space-y-3 !p-4">
          <div className="flex gap-1.5">
            {MEAL_SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlot(s)}
                className={`flex-1 rounded-lg py-1.5 text-sm ${slot === s ? "bg-accent text-white" : "border border-line"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <PlanCalendar value={date} onChange={setDate} slot={slot} />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="button" onClick={save} disabled={saving || !date} className="btn w-full">
            {saving ? "저장 중…" : `${date ? shortLabel(date) : ""} ${slot}으로 저장`}
          </button>
        </div>
      )}
    </div>
  );
}
