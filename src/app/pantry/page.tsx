"use client";

import { useEffect, useRef, useState } from "react";
import { dDayLabel, daysLeft, sortByExpiry } from "@/lib/pantry";
import { PANTRY_CATEGORIES, type PantryCategory, type PantryItem } from "@/lib/types";

const CATEGORY_ICON: Record<PantryCategory, string> = { 냉장: "🧊", 냉동: "❄️", 실온: "🧺", 양념: "🧂" };

function ExpiryBadge({ item }: { item: PantryItem }) {
  const days = daysLeft(item);
  if (days === null) return null;
  const color = days < 0 ? "bg-red-600 text-white" : days <= 3 ? "bg-accent text-white" : "border border-line text-muted";
  return <span className={`rounded-full px-1.5 py-px text-[11px] ${color}`}>{dDayLabel(days)}</span>;
}

export default function Pantry() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PantryCategory>("냉장");
  const [expiresOn, setExpiresOn] = useState("");
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/pantry")
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => (ok ? setItems(data.items) : setError(data.error)));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/pantry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, expiresOn }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setItems((prev) => [...prev, data.item]);
    // 같은 칸의 재료를 연달아 넣기 쉽도록 보관 위치는 유지하고 이름·유통기한만 비운다
    setName("");
    setExpiresOn("");
    nameRef.current?.focus();
  }

  async function remove(id: string) {
    const before = items;
    setItems((prev) => prev.filter((item) => item.id !== id));
    const res = await fetch(`/api/pantry?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setItems(before);
      setError((await res.json()).error);
    }
  }

  const expiringSoon = items.filter((item) => {
    const days = daysLeft(item);
    return days !== null && days <= 3;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">우리집 재료</h1>
        <p className="mt-1 text-sm text-muted">저장해 둔 재료로 레시피를 추천받을 수 있어요. 유통기한이 임박한 재료를 먼저 써요.</p>
      </div>

      <form onSubmit={add} className="card space-y-3">
        <div className="flex gap-2">
          {PANTRY_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-sm ${category === c ? "bg-accent text-white" : "border border-line"}`}
            >
              {CATEGORY_ICON[c]} {c}
            </button>
          ))}
        </div>
        <input
          ref={nameRef}
          className="input !px-4 !py-3 !text-base"
          placeholder="재료 이름 (예: 두부)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <label className="flex flex-1 items-center gap-2 text-sm text-muted">
            <span className="shrink-0">유통기한</span>
            <input type="date" className="input" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
          </label>
          <button className="btn shrink-0 !px-6" disabled={!name.trim()}>추가</button>
        </div>
        <p className="text-xs text-muted">유통기한은 선택이에요. 입력하면 임박한 재료부터 레시피에 활용해요.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {expiringSoon.length > 0 && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          ⏰ 빨리 먹어야 해요: {sortByExpiry(expiringSoon).map((item) => item.name).join(", ")}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card text-center text-sm text-muted">아직 저장된 재료가 없어요. 냉장고를 열어보고 하나씩 추가해 보세요!</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {PANTRY_CATEGORIES.map((c) => {
            const group = sortByExpiry(items.filter((item) => item.category === c));
            if (group.length === 0) return null;
            return (
              <section key={c} className="card">
                <h2 className="mb-3 font-semibold">
                  {CATEGORY_ICON[c]} {c} <span className="text-sm font-normal text-muted">{group.length}</span>
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {group.map((item) => (
                    <li key={item.id} className="flex items-center gap-1.5 rounded-full border border-line py-1 pl-3 pr-1.5 text-sm">
                      {item.name}
                      <ExpiryBadge item={item} />
                      <button onClick={() => remove(item.id)} className="h-5 w-5 rounded-full text-muted hover:bg-line" aria-label={`${item.name} 삭제`}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
