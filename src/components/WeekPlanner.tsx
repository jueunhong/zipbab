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
import { CookBadge, CookSection } from "@/components/CookPicker";
import MealRatings from "@/components/MealRatings";
import PlanCalendar from "@/components/PlanCalendar";
import QuickAddPlan from "@/components/QuickAddPlan";
import RecipeCard from "@/components/RecipeCard";
import StarRating from "@/components/StarRating";
import { addDays, shortLabel, today, weekStart, weekdayLabel } from "@/lib/dates";
import { withMyRating } from "@/lib/ratings";
import { MEAL_SLOTS, type HouseholdMember, type Meal, type MealPlan, type MealSlot } from "@/lib/types";

const SLOT_ICON: Record<MealSlot, string> = { 아침: "🌅", 점심: "☀️", 저녁: "🌙" };

type WeekData = { start: string; plans: MealPlan[]; meals: Meal[] };

function initialWeek(): string {
  const w = new URLSearchParams(location.search).get("week");
  return weekStart(w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : today());
}

const PREV_WEEK = "drop:prev-week";
const NEXT_WEEK = "drop:next-week";

/** 식단 메뉴 카드 모양 (드래그 기능 없음 — 끄는 동안 따라다니는 카드에도 쓴다) */
function PlanChipView({ plan, meal, cook, lifted = false }: { plan: MealPlan; meal?: Meal; cook?: HouseholdMember; lifted?: boolean }) {
  return (
    <div
      className={`flex w-full gap-2 overflow-hidden rounded-lg border bg-surface p-1.5 text-left text-xs md:block md:p-0 ${meal ? "border-fat" : "border-line"} ${
        lifted ? "rotate-2 shadow-xl ring-2 ring-accent" : ""
      }`}
    >
      {meal && <MealThumb meal={meal} />}
      <div className="min-w-0 flex-1 md:p-1.5">
        <div className="flex items-start gap-1">
          <span title={plan.slot}>{SLOT_ICON[plan.slot]}</span>
          <span className="line-clamp-2 flex-1">{plan.title}</span>
          {meal && <span title="만들어 먹었어요">✅</span>}
        </div>
        {/* 제목 아래: 요리사 한 줄, 그 아래 별점 한 줄 */}
        <CookBadge member={cook} block />
        {meal?.rating ? (
          <div>
            <StarRating value={meal.rating} size="sm" showNumber={meal.ratings.length > 1} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 식단 칸의 사진: 휴대폰(세로 목록)은 칸 너비의 절반(왼쪽), 컴퓨터(좁은 7칸)는 칸 너비에 맞춘 사진 */
function MealThumb({ meal }: { meal: Meal }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={meal.thumbUrl}
      alt={meal.title}
      draggable={false}
      loading="lazy"
      decoding="async"
      className="pointer-events-none aspect-[4/3] w-1/2 shrink-0 rounded-md bg-line object-cover md:w-full md:rounded-none"
    />
  );
}

/** 끌어서 다른 날짜(또는 지난주/다음 주 버튼)에 놓을 수 있는 식단 메뉴. 짧게 누르면 상세 보기 */
function DraggablePlan({ plan, meal, cook, onOpen }: { plan: MealPlan; meal?: Meal; cook?: HouseholdMember; onOpen: () => void }) {
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
      <PlanChipView plan={plan} meal={meal} cook={cook} />
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
  // 같은 집 멤버 — 기록 상세에서 멤버별 별점에 이름을 붙이고, 내 별점을 구분한다
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/household")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!d) return;
        setMembers(d.household.members);
        setMe(d.household.me);
      });
  }, []);

  const memberById = new Map(members.map((m) => [m.userId, m]));
  /** 식단에 보일 요리사: 만들어 먹었으면 실제 요리한 사람, 아니면 요리하기로 한 사람 */
  const cookOf = (plan: MealPlan, meal?: Meal) => memberById.get((meal?.cookId ?? plan.cookId) || "");

  /** 식단의 요리사 바꾸기 (미정 = null) */
  async function setPlanCook(planId: string, cookId: string | null) {
    const res = await fetch(`/api/plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookId }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "요리사를 바꾸지 못했어요.");
    setData((d) => d && { ...d, plans: d.plans.map((p) => (p.id === planId ? { ...p, cookId } : p)) });
    setOpenPlan((p) => (p && p.id === planId ? { ...p, cookId } : p));
  }

  /** 기록(실제로 만든 요리)의 요리사 바꾸기 */
  async function setMealCook(mealId: string, cookId: string | null) {
    const res = await fetch(`/api/meals/${mealId}/cook`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookId }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "요리사를 바꾸지 못했어요.");
    setData((d) => d && { ...d, meals: d.meals.map((m) => (m.id === mealId ? { ...m, cookId } : m)) });
    setOpenMeal((m) => (m && m.id === mealId ? { ...m, cookId } : m));
  }

  /** 내 별점을 바꾸면 캘린더·상세 화면에 바로 반영 */
  function applyMyRating(mealId: string, rating: number | null) {
    if (!me) return;
    setData((d) => d && { ...d, meals: d.meals.map((m) => (m.id === mealId ? withMyRating(m, me, rating) : m)) });
    setOpenMeal((m) => (m && m.id === mealId ? withMyRating(m, me, rating) : m));
  }
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
    sessionStorage.setItem("zipbab:pendingPlan", JSON.stringify({ planId: plan.id, date: plan.date, title: plan.title, cookId: plan.cookId }));
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
            <h1 className="text-2xl">주간 식단</h1>
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
                className={`flex flex-col gap-1.5 rounded-xl border bg-surface p-2 transition md:min-h-36 ${isToday ? "border-accent" : "border-line"} ${past ? "opacity-80" : ""}`}
                overClassName="!border-accent bg-accent/10 ring-2 ring-accent"
              >
                <header className="flex items-center justify-between gap-1 px-0.5">
                  <span className="flex items-baseline gap-1">
                    <span
                      className={`font-display text-[15px] ${
                        isToday ? "text-accent" : weekdayLabel(day) === "일" ? "text-red-500" : weekdayLabel(day) === "토" ? "text-blue-500" : ""
                      }`}
                    >
                      {weekdayLabel(day)} {Number(day.slice(8))}
                    </span>
                    {isToday && <span className="rounded-full bg-accent px-1.5 text-[10px] leading-4 text-white md:hidden">오늘</span>}
                  </span>
                  <button
                    onClick={() => setAddingDate(day)}
                    aria-label={`${shortLabel(day)} 식단 추가`}
                    className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-muted hover:border-accent hover:text-accent"
                  >
                    +<span className="md:hidden"> 추가</span>
                  </button>
                </header>

                {dayPlans.map((plan) => (
                  <DraggablePlan
                    key={plan.id}
                    plan={plan}
                    meal={plan.mealId ? mealById.get(plan.mealId) : undefined}
                    cook={cookOf(plan, plan.mealId ? mealById.get(plan.mealId) : undefined)}
                    onOpen={() => setOpenPlan(plan)}
                  />
                ))}

                {extraMeals.map((meal) => (
                  <button
                    key={meal.id}
                    onClick={() => setOpenMeal(meal)}
                    className="flex gap-2 overflow-hidden rounded-lg border border-line p-1.5 text-left text-xs md:block md:p-0"
                  >
                    <MealThumb meal={meal} />
                    <div className="min-w-0 flex-1 md:p-1.5">
                      <p className="truncate">📸 {meal.title}</p>
                      <CookBadge member={memberById.get(meal.cookId ?? "")} block />
                      <div>
                        <StarRating value={meal.rating} size="sm" showNumber={meal.ratings.length > 1} />
                      </div>
                    </div>
                  </button>
                ))}

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
            members={members}
            me={me}
            onRated={applyMyRating}
            onPlanCook={(id) => setPlanCook(openPlan.id, id)}
            onMealCook={setMealCook}
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
              <img
                src={openMeal.photoUrl}
                alt={openMeal.title}
                decoding="async"
                className="max-h-[60vh] w-full rounded-2xl bg-line object-cover"
                style={{ backgroundImage: `url(${openMeal.thumbUrl})`, backgroundSize: "cover" }}
              />
              <div className="card">
                <div className="flex justify-between">
                  <h2 className="text-lg">{openMeal.title}</h2>
                  <span className="text-sm text-muted">{shortLabel(openMeal.date)}</span>
                </div>
                {openMeal.rating ? (
                  <div className="mt-1">
                    <StarRating value={openMeal.rating} showNumber count={openMeal.ratings.length} />
                  </div>
                ) : null}
                {openMeal.memo && <p className="mt-2 whitespace-pre-wrap text-sm">{openMeal.memo}</p>}
                {members.length > 0 && (
                  <CookSection label="요리한 사람" members={members} value={openMeal.cookId} allowNone={false} onChange={(id) => setMealCook(openMeal.id, id)} />
                )}
                <div className="mt-3">
                  <MealRatings meal={openMeal} members={members} me={me} onChanged={(r) => applyMyRating(openMeal.id, r)} />
                </div>
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
        {dragging && (
          <PlanChipView
            plan={dragging}
            meal={dragging.mealId ? mealById.get(dragging.mealId) : undefined}
            cook={cookOf(dragging, dragging.mealId ? mealById.get(dragging.mealId) : undefined)}
            lifted
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function PlanDetail({
  plan,
  meal,
  members,
  me,
  onClose,
  onCooked,
  onRated,
  onPlanCook,
  onMealCook,
  onChanged,
}: {
  plan: MealPlan;
  meal?: Meal;
  members: HouseholdMember[];
  me: string | null;
  onClose: () => void;
  onCooked: () => void;
  onRated: (mealId: string, rating: number | null) => void;
  onPlanCook: (cookId: string | null) => Promise<void>;
  onMealCook: (mealId: string, cookId: string | null) => Promise<void>;
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
          <h2 className="text-lg">{plan.title}</h2>
          {/* 제목 바로 아래: 멤버 별점 평균 */}
          {meal?.rating ? <StarRating value={meal.rating} showNumber count={meal.ratings.length} /> : null}
          {meal && <p className="text-sm text-fat">✅ {shortLabel(meal.date)}에 만들어 먹었어요</p>}
          {meal?.memo && <p className="whitespace-pre-wrap text-sm">{meal.memo}</p>}
          {members.length > 0 &&
            (meal ? (
              <CookSection label="요리한 사람" members={members} value={meal.cookId} allowNone={false} onChange={(id) => onMealCook(meal.id, id)} />
            ) : (
              <CookSection label="누가 요리할까요?" members={members} value={plan.cookId} onChange={onPlanCook} />
            ))}
          {meal && (
            <div className="pt-2">
              <MealRatings meal={meal} members={members} me={me} onChanged={(r) => onRated(meal.id, r)} />
            </div>
          )}
        </div>

        {meal && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meal.photoUrl}
            alt={meal.title}
            decoding="async"
            className="max-h-[60vh] w-full rounded-2xl bg-line object-cover"
            style={{ backgroundImage: `url(${meal.thumbUrl})`, backgroundSize: "cover" }}
          />
        )}

        <div className="card space-y-2 !p-3">
          {!meal && (
            <button onClick={onCooked} className="btn w-full !py-3">
              📸 만들었어요! 사진 기록하기
            </button>
          )}
          {moving ? (
            <div className="space-y-3">
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
              <PlanCalendar value={date} onChange={setDate} slot={slot} movingPlanId={plan.id} />
              <div className="flex gap-2">
                <button
                  onClick={() => request("PATCH", { date, slot })}
                  disabled={busy || !date || (date === plan.date && slot === plan.slot)}
                  className="btn flex-1"
                >
                  {shortLabel(date)} {slot}으로 옮기기
                </button>
                <button type="button" onClick={() => setMoving(false)} className="rounded-lg border border-line px-4 text-sm">
                  취소
                </button>
              </div>
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

