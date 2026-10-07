"use client";

import { useState } from "react";
import type { Recipe } from "@/lib/types";

const QUICK_REQUESTS = ["더 맵게", "더 간단하게", "단백질 더 많이", "채소 더 많이", "칼로리 낮게", "고기 없이"];

/** 추천받은 레시피를 AI 에게 고쳐 달라고 요청한다 (예: "두부 대신 닭가슴살로") */
export default function RecipeReviser({
  recipe,
  disabled,
  onRevised,
}: {
  recipe: Recipe;
  disabled?: boolean;
  onRevised: (next: Recipe, instruction: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function revise(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/recipe/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe, instruction: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onRevised(data.recipe, trimmed);
      setInstruction("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "레시피를 고치지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full rounded-lg border border-line px-4 py-2 text-sm disabled:opacity-50"
      >
        ✏️ 레시피 수정 요청
      </button>
    );
  }

  return (
    <div className="card space-y-3 !p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">✏️ 어떻게 바꿀까요?</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted" aria-label="닫기">
          접기
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_REQUESTS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={busy || disabled}
            onClick={() => revise(q)}
            className="rounded-full border border-line px-2.5 py-1 text-xs hover:border-accent disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          revise(instruction);
        }}
        className="flex gap-2"
      >
        <input
          className="input"
          placeholder="예: 두부 대신 닭가슴살로, 양파 빼줘"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          maxLength={300}
        />
        <button className="btn shrink-0" disabled={busy || disabled || !instruction.trim()}>
          {busy ? "고치는 중…" : "수정"}
        </button>
      </form>
      {busy && <p className="text-xs text-muted">요청한 부분을 바꾸고 영양 성분을 다시 계산하고 있어요… (10~20초)</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
