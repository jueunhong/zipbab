// "YYYY-MM-DD" 날짜 문자열 도우미. 모두 사용자의 현지 시간 기준(UTC 변환 없음).

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function parse(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const pad = (n: number) => String(n).padStart(2, "0");

// toLocaleDateString("sv-SE") 는 환경(ICU)에 따라 "2026-10-5"처럼 0을 빼먹어서 직접 만든다
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 이 기기 시간대 기준 오늘 */
export function today(): string {
  return toDateString(new Date());
}

/** 특정 시간대 기준 오늘 (서버에서 한국 날짜가 필요할 때: todayIn("Asia/Seoul")) */
export function todayIn(timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** b - a 일수 (같은 날 0) */
export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = parse(date);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/** 그 날짜가 속한 주의 월요일 */
export function weekStart(date: string): string {
  const day = parse(date).getDay(); // 0=일
  return addDays(date, day === 0 ? -6 : 1 - day);
}

export function weekdayLabel(date: string): string {
  return WEEKDAYS[parse(date).getDay()];
}

/** "10/7(화)" */
export function shortLabel(date: string): string {
  const d = parse(date);
  return `${d.getMonth() + 1}/${d.getDate()}(${weekdayLabel(date)})`;
}
