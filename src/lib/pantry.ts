import { daysBetween, today } from "./dates";
import type { PantryItem } from "./types";

/** 유통기한까지 남은 일수 (오늘이면 0, 지났으면 음수). 유통기한이 없으면 null. */
export function daysLeft(item: PantryItem): number | null {
  if (!item.expiresOn) return null;
  return daysBetween(today(), item.expiresOn);
}

export function dDayLabel(days: number): string {
  if (days < 0) return `${-days}일 지남`;
  if (days === 0) return "D-day";
  return `D-${days}`;
}

/** 유통기한 임박한 것부터, 유통기한 없는 것은 뒤로 */
export function sortByExpiry(items: PantryItem[]): PantryItem[] {
  return [...items].sort((a, b) => (daysLeft(a) ?? Infinity) - (daysLeft(b) ?? Infinity));
}
