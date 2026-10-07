"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QuickAddPlan from "@/components/QuickAddPlan";
import RecipeCard from "@/components/RecipeCard";
import { addDays, shortLabel, today, weekStart, weekdayLabel } from "@/lib/dates";
import { MEAL_SLOTS, type Meal, type MealPlan, type MealSlot } from "@/lib/types";

const SLOT_ICON: Record<MealSlot, string> = { 아침: "🌅", 점심: "☀️", 저녁: "🌙" };

type WeekData = { start: string; plans: MealPlan[]; meals: Meal[] };

function initialWeek(): string {
  const w = new URLSearchParams(location.search).get("week");
  return weekStart(w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : today());
}

const PREV_WEEK = "drop:prev-week";
const NEXT_WEEK = "drop:next-week";

/** 식단 메뉴 카드 모양 (드래그 기능 없음 — 끄는 동안 따라다니는 카드에도 쓴다) */
function PlanChipView({ plan, meal, lifted = false }: { plan: MealPlan; meal?: Meal; lifted?: boolean }) {
  return (
    <div
      className={`w-full overflow-hidden rounded-lg border bg-surface text-left text-xs ${meal ? "border-fat" : "border-line"} ${
        lifted ? "rotate-2 shadow-xl ring-2 ring-accent" : ""
      }`}
    >
      {meal && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meal.photoUrl} alt={meal.title} draggable={false} className="pointer-events-none aspect-[4/3] w-full object-cover" />
      )}
      <div className="flex items-start gap-1 p-1.5">
        <span title={plan.slot}>{SLOT_ICON[plan.slot]}</span>
        <span className="line-clamp-2 flex-1">{plan.title}</span>
        {meal && <span title="만들어 먹었어요">✅</span>}
      </div>
    </div>
  );
}

/** 끌어서 다른 날짜(또는 지난주/다음 주 버튼)에 놓을 수 있는 식단 메뉴. 짧게 누르면 상세 보기 */
function DraggablePlan({ plan, meal, onOpen }: { plan: MealPlan; meal?: Meal; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: plan.id });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      // 휴대폰에서 꾹 누를 때 글자 선택·미리보기 메뉴가 뜨지 않게
      style={{ WebkitTouchCallout: "none" }}
      className={`block w-full select-none rounded-lg text-left hover:ring-1 hover:ring-accent ${isDragging ? "opacity-30" : ""}`}
    >
      <PlanChipView plan={plan} meal={meal} />
    </button>
  );
}

/** 메뉴를 놓을 수 있는 칸 (날짜 칸, 지난주/다음 주 버튼) */
function DropZone({ id, className, overClassName, children }: { id: string; className: string; overClassName: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? overClassName : ""}`}>
      {children}
    </div>
  );
}

/** 브라우저에서만 렌더된다 (app/plan/page.tsx 에서 ssr: false) — "오늘"을 사용자 시간대로 계산하기 위해 */
export default function WeekPlanner() {
  const router = useRouter();
  const [start, setStart] = useState(initialWeek);
  const [data, setData] = useState<WeekData | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [openPlan, setOpenPlan] = useState<MealPlan | null>(null);
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [dragging, setDragging] = useState<MealPlan | null>(null);
  // 방금 옮긴 메뉴 — "되돌리기" 안내용
  const [moved, setMoved] = useState<{ plan: MealPlan; from: string; to: string } | null>(null);

  // 마우스는 6px 이상 끌면, 터치는 0.25초 꾹 누르면 드래그 시작 (짧게 탭하면 상세 보기, 스와이프는 스크롤)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const todayStr = today();

  useEffect(() => {
    let cancelled = false;
    history.replaceState(null, "", `/plan?week=${start}`);
    fetch(`/api/plans?from=${start}&to=${addDays(start, 6)}`)
      .then(async (res) => ({ ok: res.ok, body: await res.json() }))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (ok) {
          setData({ start, plans: body.plans, meals: body.meals });
          setError("");
        } else setError(body.error);
      });
    return () => {
      cancelled = true;
    };
  }, [start, reload]);

  const loading = !data || data.start !== start;
  const plans = loading ? [] : data.plans;
  const meals = loading ? [] : data.meals;
  const mealById = new Map(meals.map((m) => [m.id, m]));
  const linkedMealIds = new Set(plans.map((p) => p.mealId).filter(Boolean));

  const planned = plans.length;
  const cooked = plans.filter((p) => p.mealId && mealById.has(p.mealId)).length;

  /** 식단을 다른 날짜로 옮긴다 (화면 먼저 바꾸고 저장, 실패하면 원래대로) */
  async function movePlan(plan: MealPlan, to: string, { remember = true } = {}) {
    if (to === plan.date) return;
    const from = plan.date;
    const setDate = (date: string) =>
      setData((d) => d && { ...d, plans: d.plans.map((p) => (p.id === plan.id ? { ...p, date } : p)) });
    setDate(to);
    setMoved(remember ? { plan, from, to } : null);
    const res = await fetch(`/api/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: to }),
    });
    if (!res.ok) {
      setDate(from);
      setMoved(null);
      setError((await res.json().catch(() => ({}))).error ?? "옮기지 못했어요.");
    }
  }

  function undoMove() {
    if (!moved) return;
    const { plan, from, to } = moved;
    // 다른 주로 옮겼던 경우 화면에 없으니 다시 불러온다
    if (to < start || to > end) {
      setMoved(null);
      fetch(`/api/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: from }),
      }).then(() => setReload((n) => n + 1));
      return;
    }
    movePlan({ ...plan, date: to }, from, { remember: false });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setDragging(null);
    const plan = plans.find((p) => p.id === active.id);
    if (!plan || !over) return;
    const target = String(over.id);
    if (target === PREV_WEEK) movePlan(plan, addDays(plan.date, -7));
    else if (target === NEXT_WEEK) movePlan(plan, addDays(plan.date, 7));
    else movePlan(plan, target);
  }

  function cookedIt(plan: MealPlan) {
    if (plan.recipe) sessionStorage.setItem("zipbab:pendingRecipe", JSON.stringify(plan.recipe));
    else sessionStorage.removeItem("zipbab:pendingRecipe");
    sessionStorage.setItem("zipbab:pendingPlan", JSON.stringify({ planId: plan.id, date: plan.date, title: plan.title }));
    router.push("/journal?new=1");
  }

  return (
    <DndContext
      sensors={sensors}
      autoScroll
      onDragStart={({ active }) => {
        setDragging(plans.find((p) => p.id === active.id) ?? null);
        setMoved(null);
        navigator.vibrate?.(20);
      }}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">주간 식단</h1>
            <p className="mt-1 text-sm text-muted">
              {shortLabel(start)} ~ {shortLabel(end)}
              {!loading && planned > 0 && ` · ${planned}끼 계획, ${cooked}끼 완료`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <DropZone id={PREV_WEEK} className="rounded-lg" overClassName="ring-2 ring-accent">
              <button onClick={() => setStart(addDays(start, -7))} className="h-9 w-9 rounded-lg border border-line" aria-label="지난주">
                ‹
              </button>
            </DropZone>
            <button
              onClick={() => setStart(weekStart(todayStr))}
              disabled={start === weekStart(todayStr)}
              className="h-9 rounded-lg border border-line px-3 text-sm disabled:opacity-40"
            >
              이번 주
            </button>
            <DropZone id={NEXT_WEEK} className="rounded-lg" overClassName="ring-2 ring-accent">
              <button onClick={() => setStart(addDays(start, 7))} className="h-9 w-9 rounded-lg border border-line" aria-label="다음 주">
                ›
              </button>
            </DropZone>
          </div>
        </div>

        {dragging && (
          <p className="sticky top-16 z-10 rounded-lg bg-accent px-3 py-2 text-center text-sm text-white shadow">
            옮길 날짜 칸에 놓으세요 · ‹ › 위에 놓으면 지난주/다음 주 같은 요일로
          </p>
        )}

        {moved && !dragging && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-accent/10 px-3 py-2 text-sm">
            <span className="min-w-0 truncate">
              &lsquo;{moved.plan.title}&rsquo;을(를) {shortLabel(moved.to)}로 옮겼어요
            </span>
            <button onClick={undoMove} className="shrink-0 text-xs text-accent underline">
              되돌리기
            </button>
          </div>
        )}

        {error && <div className="card text-sm text-red-600">{error}</div>}

        <div className={`grid gap-2 md:grid-cols-7 ${loading ? "animate-pulse opacity-60" : ""}`}>
          {days.map((day) => {
            const dayPlans = plans.filter((p) => p.date === day);
            // 식단과 연결되지 않은 그날의 기록 사진도 보여준다
            const extraMeals = meals.filter((m) => m.date === day && !linkedMealIds.has(m.id));
            const isToday = day === todayStr;
            const past = day < todayStr;
            return (
              <DropZone
                key={day}
                id={day}
                className={`flex min-h-28 flex-col gap-1.5 rounded-xl border bg-surface p-2 transition ${isToday ? "border-accent" : "border-line"} ${past ? "opacity-80" : ""}`}
                overClassName="!border-accent bg-accent/10 ring-2 ring-accent"
              >
                <header className="flex items-baseline justify-between px-0.5">
                  <span className={`text-sm font-semibold ${isToday ? "text-accent" : ""}`}>
                    {weekdayLabel(day)} <span className="font-normal">{Number(day.slice(8))}</span>
                  </span>
                  {isToday && <span className="text-[10px] text-accent">오늘</span>}
                </header>

                {dayPlans.map((plan) => (
                  <DraggablePlan
                    key={plan.id}
                    plan={plan}
                    meal={plan.mealId ? mealById.get(plan.mealId) : undefined}
                    onOpen={() => setOpenPlan(plan)}
                  />
                ))}

                {extraMeals.map((meal) => (
                  <button key={meal.id} onClick={() => setOpenMeal(meal)} className="overflow-hidden rounded-lg border border-line text-left text-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={meal.photoUrl} alt={meal.title} className="aspect-[4/3] w-full object-cover" />
                    <p className="truncate p-1.5">📸 {meal.title}</p>
                  </button>
                ))}

                <button
                  onClick={() => setAddingDate(day)}
                  className="mt-auto rounded-lg border border-dashed border-line py-1.5 text-center text-xs text-muted hover:border-accent hover:text-accent"
                >
                  + 추가
                </button>
              </DropZone>
            );
          })}
        </div>

        <p className="text-xs text-muted">
          메뉴를 끌어서 다른 날짜로 옮길 수 있어요(휴대폰은 꾹 누른 채로 끌기). 날짜 칸의 <b>+ 추가</b>로 메뉴를 바로 넣거나, 추천·찜한 레시피에서 <b>📅 식단에 추가</b>를 눌러도 돼요. 식단을 누르고 <b>만들었어요</b>로 사진을 남기면 그 칸에 사진이 떠요.
        </p>

        {addingDate && (
          <QuickAddPlan
            date={addingDate}
            onClose={() => setAddingDate(null)}
            onAdded={() => {
              setAddingDate(null);
              setReload((n) => n + 1);
            }}
          />
        )}

        {openPlan && (
          <PlanDetail
            plan={openPlan}
            meal={openPlan.mealId ? mealById.get(openPlan.mealId) : undefined}
            onClose={() => setOpenPlan(null)}
            onCooked={() => cookedIt(openPlan)}
            onChanged={() => {
              setOpenPlan(null);
              setReload((n) => n + 1);
            }}
          />
        )}

        {openMeal && (
          <div className="fixed inset-0 z-20 overflow-y-auto bg-black/60 p-4" onClick={() => setOpenMeal(null)}>
            <div className="mx-auto max-w-xl space-y-3" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={openMeal.photoUrl} alt={openMeal.title} className="w-full rounded-2xl" />
              <div className="card">
                <div className="flex justify-between">
                  <h2 className="text-lg font-bold">{openMeal.title}</h2>
                  <span className="text-sm text-muted">{shortLabel(openMeal.date)}</span>
                </div>
                {openMeal.memo && <p className="mt-2 whitespace-pre-wrap text-sm">{openMeal.memo}</p>}
              </div>
              {openMeal.recipe && <RecipeCard recipe={openMeal.recipe} />}
              <button className="w-full rounded-lg bg-surface py-2 text-sm" onClick={() => setOpenMeal(null)}>
                닫기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 끄는 동안 손가락·마우스를 따라다니는 카드 */}
      <DragOverlay>
        {dragging && <PlanChipView plan={dragging} meal={dragging.mealId ? mealById.get(dragging.mealId) : undefined} lifted />}
      </DragOverlay>
    </DndContext>
  );
}

function PlanDetail({
  plan,
  meal,
  onClose,
  onCooked,
  onChanged,
}: {
  plan: MealPlan;
  meal?: Meal;
  onClose: () => void;
  onCooked: () => void;
  onChanged: () => void;
}) {
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(plan.date);
  const [slot, setSlot] = useState<MealSlot>(plan.slot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function request(method: "PATCH" | "DELETE", body?: object) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/plans/${plan.id}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "처리하지 못했어요.");
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-20 overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="mx-auto max-w-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="card space-y-1">
          <p className="text-sm text-muted">
            {shortLabel(plan.date)} · {SLOT_ICON[plan.slot]} {plan.slot}
          </p>
          <h2 className="text-lg font-bold">{plan.title}</h2>
          {meal && <p className="text-sm text-fat">✅ {shortLabel(meal.date)}에 만들어 먹었어요</p>}
        </div>

        {meal && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meal.photoUrl} alt={meal.title} className="w-full rounded-2xl" />
        )}

        <div className="card space-y-2 !p-3">
          {!meal && (
            <button onClick={onCooked} className="btn w-full !py-3">
              📸 만들었어요! 사진 기록하기
            </button>
          )}
          {moving ? (
            <div className="space-y-2">
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
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
              <button onClick={() => request("PATCH", { date, slot })} disabled={busy || !date} className="btn w-full">
                {shortLabel(date)} {slot}으로 옮기기
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setMoving(true)} className="flex-1 rounded-lg border border-line py-2 text-sm">
                📅 다른 날로 옮기기
              </button>
              <button
                onClick={() => confirm(`'${plan.title}'을(를) 식단에서 뺄까요?`) && request("DELETE")}
                disabled={busy}
                className="rounded-lg border border-line px-4 py-2 text-sm text-red-600"
              >
                식단에서 빼기
              </button>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {plan.recipe && <RecipeCard recipe={plan.recipe} withImage={!meal} />}
        {plan.myRecipeId && (
          <Link href={`/my-recipes?open=${plan.myRecipeId}`} className="card block text-center text-sm text-accent">
            ✍️ 내 레시피에서 만드는 법 보기 →
          </Link>
        )}

        <button className="w-full rounded-lg bg-surface py-2 text-sm" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
