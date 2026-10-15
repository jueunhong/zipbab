"use client";

export const MAX_RATING = 6;

/**
 * 6점 만점 별점. onChange 를 주면 고를 수 있고(같은 별을 다시 누르면 지움), 없으면 보여주기만 한다.
 * 보여주기만 할 때 value 는 평균(예: 4.5)일 수 있다 — 별은 반올림해서 칠하고, showNumber 면 숫자도 붙인다.
 */
export default function StarRating({
  value,
  onChange,
  size = "md",
  showNumber = false,
  count,
}: {
  value: number | null;
  onChange?: (value: number | null) => void;
  size?: "sm" | "md" | "lg";
  showNumber?: boolean;
  count?: number; // 별점을 남긴 사람 수 (2명 이상일 때 표시)
}) {
  const textSize = { sm: "text-xs", md: "text-base", lg: "text-3xl" }[size];
  const stars = Array.from({ length: MAX_RATING }, (_, i) => i + 1);

  if (!onChange) {
    if (!value) return null;
    const filled = Math.min(MAX_RATING, Math.max(0, Math.round(value)));
    return (
      <span className={`${textSize} inline-flex items-baseline gap-1 whitespace-nowrap`} aria-label={`별점 ${value}점 (${MAX_RATING}점 만점)`}>
        <span className="text-carbs">
          {"★".repeat(filled)}
          <span className="text-line">{"★".repeat(MAX_RATING - filled)}</span>
        </span>
        {showNumber && <span className="text-muted">{Number.isInteger(value) ? value : value.toFixed(1)}</span>}
        {count !== undefined && count > 1 && <span className="text-muted">({count}명)</span>}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={`별점 (${MAX_RATING}점 만점)`}>
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n}점`}
          onClick={() => onChange(value === n ? null : n)}
          className={`${textSize} leading-none transition-transform active:scale-90 ${value && n <= value ? "text-carbs" : "text-line"}`}
        >
          ★
        </button>
      ))}
      <span className="ml-2 text-sm text-muted">{value ? `${value} / ${MAX_RATING}` : "별점 (선택)"}</span>
    </div>
  );
}
