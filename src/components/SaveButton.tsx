"use client";

import { useState } from "react";
import type { Recipe } from "@/lib/types";

/** 찜하기 토글. savedId 가 있으면 찜한 상태. */
export default function SaveButton({
  recipe,
  savedId,
  onChange,
  className = "",
}: {
  recipe: Recipe;
  savedId: string | null;
  onChange: (savedId: string | null) => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      if (savedId) {
        const res = await fetch(`/api/saved?id=${savedId}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error);
        onChange(null);
      } else {
        const res = await fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipe }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        onChange(data.saved.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "찜하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={error || (savedId ? "찜 해제" : "찜하기")}
      className={`rounded-lg border px-4 py-2 text-sm disabled:opacity-60 ${
        savedId ? "border-accent text-accent" : "border-line"
      } ${error ? "border-red-600 text-red-600" : ""} ${className}`}
    >
      {error ? "다시 시도" : savedId ? "♥ 찜함" : "♡ 찜하기"}
    </button>
  );
}
