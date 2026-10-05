"use client";

import { useEffect, useState } from "react";
import type { RecipeImage } from "@/lib/naver";

/** 요리 이름으로 네이버 이미지 검색 결과를 보여준다. 키가 없거나 결과가 없으면 아무것도 그리지 않는다. */
export default function RecipeImages({ query }: { query: string }) {
  const [result, setResult] = useState<{ query: string; images: RecipeImage[] } | null>(null);
  const [index, setIndex] = useState(0);
  // 원본 링크가 막히면 썸네일로, 썸네일도 막히면 그 사진을 목록에서 뺀다
  const [failed, setFailed] = useState<Record<string, "original" | "both">>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/recipe-image?q=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : { images: [] }))
      .then((data: { images?: RecipeImage[] }) => {
        if (cancelled) return;
        setResult({ query, images: data.images ?? [] });
        setIndex(0);
        setFailed({});
      })
      .catch(() => !cancelled && setResult({ query, images: [] }));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const loading = !result || result.query !== query;
  const images = loading ? [] : result.images.filter((img) => failed[img.url] !== "both");

  if (loading) return <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-line" />;
  if (images.length === 0) return null;

  const current = images[Math.min(index, images.length - 1)];
  const src = failed[current.url] === "original" ? current.thumbnail : current.url;
  const go = (step: number) => setIndex((i) => (i + step + images.length) % images.length);

  return (
    <figure className="space-y-1.5">
      <div className="relative overflow-hidden rounded-2xl bg-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={src}
          src={src}
          alt={`${query} 참고 이미지`}
          referrerPolicy="no-referrer"
          className="aspect-[4/3] w-full object-cover"
          onError={() => setFailed((prev) => ({ ...prev, [current.url]: prev[current.url] === "original" ? "both" : "original" }))}
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="이전 사진"
              className="absolute left-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="다음 사진"
              className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60"
            >
              ›
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
              {Math.min(index, images.length - 1) + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      <figcaption className="text-xs text-muted">
        참고 이미지 · 네이버 검색 결과예요. 실제 레시피와 모양이 다를 수 있어요.{" "}
        <a href={current.url} target="_blank" rel="noreferrer" className="underline">
          원본 보기
        </a>
      </figcaption>
    </figure>
  );
}
