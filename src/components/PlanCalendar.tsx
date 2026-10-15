"use client";

import { useEffect, useState } from "react";
import { addDays, addMonths, monthEnd, monthLabel, monthStart, shortLabel, today, weekStart } from "@/lib/dates";
import type { MealPlan, MealSlot } from "@/lib/types";

const SLOT_ICON: Record<MealSlot, string> = { 아침: "🌅", 점심: "☀️", 저녁: "🌙" };
const WEEKDAY_HEADER = ["월", "화", "수", "목", "금", "토", "일"];

/**
 * 날짜를 고르는 한 달 달력. 날짜마다 이미 잡힌 식단을 점으로 보여주고,
 * 고른 날의 식단 목록과 (slot 을 주면) 같은 끼니에 이미 있는 메뉴를 알려준다.
 * movingPlanId: 지금 옮기는 식단 — 원래 자리에 흐리게 표시하고 "이미 있음" 계산에서 뺀다.
 */
export default function PlanCalendar({
  value,
  onChange,
  slot,
  movingPlanId,
}: {
  value: string;
  onChange: (date: string) => void;
  slot?: MealSlot;
  movingPlanId?: string;
}) {
  const [month, setMonth] = useState(() => monthStart(value || today()));
  const [plans, setPlans] = useState<{ month: string; list: MealPlan[] } | null>(null);

  const first = weekStart(month);
  const last = addDays(weekStart(monthEnd(month)), 6);
  const days: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/plans?from=${first}&to=${last}`)
      .then((res) => (res.ok ? res.json() : { plans: [] }))
      .then((data: { plans?: MealPlan[] }) => !cancelled && setPlans({ month, list: data.plans ?? [] }));
    return () => {
      cancelled = true;
    };
  }, [month, first, last]);

  const loading = plans?.month !== month;
  const list = loading ? [] : plans.list;
  const byDate = new Map<string, MealPlan[]>();
  for (const p of list) byDate.set(p.date, [...(byDate.get(p.date) ?? []), p]);

  const todayStr = today();
  const selectedPlans = (byDate.get(value) ?? []).filter((p) => p.id !== movingPlanId);
  const clash = slot ? selectedPlans.filter((p) => p.slot === slot) : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setMonth(addMonths(month, -1))} className="h-8 w-8 rounded-lg border border-line" aria-label="이전 달">
          ‹
        </button>
        <span className="text-sm font-semibold">{monthLabel(month)}</span>
        <button type="button" onClick={() => setMonth(addMonths(month, 1))} className="h-8 w-8 rounded-lg border border-line" aria-label="다음 달">
          ›
        </button>
      </div>

      <div className={`grid grid-cols-7 gap-1 text-center ${loading ? "opacity-60" : ""}`}>
        {WEEKDAY_HEADER.map((w, i) => (
          <span key={w} className={`pb-1 text-[11px] ${i === 6 ? "text-red-500" : i === 5 ? "text-blue-500" : "text-muted"}`}>
            {w}
          </span>
        ))}
        {days.map((d) => {
          const inMonth = d.slice(0, 7) === month.slice(0, 7);
          const dayPlans = byDate.get(d) ?? [];
          const selected = d === value;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onChange(d)}
              aria-label={`${shortLabel(d)}${dayPlans.length ? `, 식단 ${dayPlans.length}개` : ""}`}
              aria-pressed={selected}
              className={`flex h-11 flex-col items-center justify-start rounded-lg pt-1 text-sm ${
                selected ? "bg-accent font-semibold text-white" : d === todayStr ? "border border-accent" : "hover:bg-line"
              } ${inMonth ? "" : "opacity-35"}`}
            >
              <span className="leading-none">{Number(d.slice(8))}</span>
              {/* 식단 하나당 점 하나 (만들어 먹은 건 초록, 옮기는 중인 건 흐리게), 최대 3개 */}
              <span className="mt-1 flex h-1.5 gap-0.5">
                {dayPlans.slice(0, 3).map((p) => (
                  <span
                    key={p.id}
                    className={`h-1.5 w-1.5 rounded-full ${selected ? "bg-white" : p.mealId ? "bg-fat" : "bg-accent"} ${p.id === movingPlanId ? "opacity-40" : ""}`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {value && (
        <div className="rounded-lg bg-background px-3 py-2 text-xs">
          <p className="mb-1 font-semibold">{shortLabel(value)} 식단</p>
          {selectedPlans.length === 0 ? (
            <p className="text-muted">아직 식단이 없어요.</p>
          ) : (
            <ul className="space-y-0.5">
              {selectedPlans.map((p) => (
                <li key={p.id} className={slot && p.slot === slot ? "font-semibold text-accent" : ""}>
                  {SLOT_ICON[p.slot]} {p.slot} · {p.title}
                  {p.mealId && " ✅"}
                </li>
              ))}
            </ul>
          )}
          {clash.length > 0 && (
            <p className="mt-1 text-accent">⚠️ {slot}에 이미 식단이 있어요. 그래도 같이 넣을 수 있어요.</p>
          )}
        </div>
      )}
    </div>
  );
}
