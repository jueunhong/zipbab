"use client";

export const MAX_RATING = 6;

/**
 * 6점 만점 별점. onChange 를 주면 고를 수 있고(같은 별을 다시 누르면 지움), 없으면 보여주기만 한다.
 */
export default function StarRating({
  value,
  onChange,
  size = "md",
}: {
  value: number | null;
  onChange?: (value: number | null) => void;
  size?: "sm" | "md" | "lg";
}) {
  const textSize = { sm: "text-xs", md: "text-base", lg: "text-3xl" }[size];
  const stars = Array.from({ length: MAX_RATING }, (_, i) => i + 1);

  if (!onChange) {
    if (!value) return null;
    return (
      <span className={`${textSize} whitespace-nowrap text-carbs`} aria-label={`별점 ${value}점 (${MAX_RATING}점 만점)`}>
        {"★".repeat(value)}
        <span className="text-line">{"★".repeat(MAX_RATING - value)}</span>
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
