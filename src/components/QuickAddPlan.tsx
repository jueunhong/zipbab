"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { shortLabel } from "@/lib/dates";
import { MEAL_SLOTS, type MealSlot, type MyRecipe, type PlanInput, type SavedRecipe } from "@/lib/types";

type Tab = "direct" | "saved" | "mine";

/** 식단 날짜 칸의 "+ 추가" — 메뉴 이름 직접 입력, 찜한 레시피, 내 레시피 중에서 바로 넣는다 */
export default function QuickAddPlan({ date, onClose, onAdded }: { date: string; onClose: () => void; onAdded: () => void }) {
  const [tab, setTab] = useState<Tab>("direct");
  const [slot, setSlot] = useState<MealSlot>("저녁");
  const [title, setTitle] = useState("");
  const [saved, setSaved] = useState<SavedRecipe[] | null>(null);
  const [mine, setMine] = useState<MyRecipe[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 탭을 처음 열 때 한 번만 불러온다
  useEffect(() => {
    if (tab === "saved" && !saved) {
      fetch("/api/saved")
        .then((res) => res.json())
        .then((data) => setSaved(data.saved ?? []));
    }
    if (tab === "mine" && !mine) {
      fetch("/api/my-recipes")
        .then((res) => res.json())
        .then((data) => setMine(data.recipes ?? []));
    }
  }, [tab, saved, mine]);

  async function add(input: Omit<PlanInput, "date" | "slot">) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, slot, ...input }),
    });
    const data = await res.json().catch(() => ({ error: "추가하지 못했어요." }));
    setBusy(false);
    if (!res.ok) return setError(data.error);
    onAdded();
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "direct", label: "✏️ 직접 입력" },
    { key: "saved", label: "♥ 찜한 레시피" },
    { key: "mine", label: "✍️ 내 레시피" },
  ];

  const listClass = "max-h-72 space-y-1.5 overflow-y-auto";
  const itemClass = "flex w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-accent disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div className="card w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{shortLabel(date)} 식단 추가</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-full text-muted hover:bg-line" aria-label="닫기">
            ×
          </button>
        </div>

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

        <div className="flex gap-1 rounded-xl border border-line p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-lg py-1.5 text-xs ${tab === t.key ? "bg-accent font-semibold text-white" : "text-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "direct" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) add({ title: title.trim() });
            }}
            className="flex gap-2"
          >
            <input autoFocus className="input !py-2.5 !text-base" placeholder="메뉴 이름 (예: 김치찌개)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button className="btn shrink-0" disabled={busy || !title.trim()}>
              추가
            </button>
          </form>
        )}

        {tab === "saved" &&
          (saved === null ? (
            <p className="text-sm text-muted">불러오는 중…</p>
          ) : saved.length === 0 ? (
            <p className="text-sm text-muted">찜한 레시피가 없어요.</p>
          ) : (
            <ul className={listClass}>
              {saved.map((s) => (
                <li key={s.id}>
                  <button disabled={busy} onClick={() => add({ recipe: s.recipe })} className={itemClass}>
                    <span className="truncate">{s.recipe.title}</span>
                    <span className="shrink-0 text-xs text-muted">⏱ {s.recipe.cookTimeMinutes}분</span>
                  </button>
                </li>
              ))}
            </ul>
          ))}

        {tab === "mine" &&
          (mine === null ? (
            <p className="text-sm text-muted">불러오는 중…</p>
          ) : mine.length === 0 ? (
            <p className="text-sm text-muted">
              아직 내 레시피가 없어요. <Link href="/my-recipes" className="underline">레시피북</Link>에서 만들어 보세요.
            </p>
          ) : (
            <ul className={listClass}>
              {mine.map((r) => (
                <li key={r.id}>
                  <button disabled={busy} onClick={() => add({ title: r.title, myRecipeId: r.id })} className={itemClass}>
                    <span className="truncate">{r.title}</span>
                    {r.cookTimeMinutes && <span className="shrink-0 text-xs text-muted">⏱ {r.cookTimeMinutes}분</span>}
                  </button>
                </li>
              ))}
            </ul>
          ))}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Link
          href={`/?planDate=${date}`}
          className="block rounded-lg border border-dashed border-line py-2 text-center text-sm text-muted hover:border-accent hover:text-accent"
        >
          ✨ 무엇을 먹을지 모르겠다면 AI 추천받기
        </Link>
      </div>
    </div>
  );
}
