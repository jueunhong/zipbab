import type { Meal } from "./types";

/** 내 별점을 바꾼 결과를 화면의 기록에 바로 반영한다 (평균·멤버별 목록 다시 계산) */
export function withMyRating(meal: Meal, me: string, rating: number | null): Meal {
  const ratings = meal.ratings.filter((r) => r.userId !== me);
  if (rating !== null) ratings.push({ userId: me, rating });
  const average = ratings.length ? Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 10) / 10 : null;
  return { ...meal, ratings, rating: average, myRating: rating };
}
