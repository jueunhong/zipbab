import { withErrors } from "@/lib/api";
import { setMealRating } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

/** 이 기록에 내 별점 남기기·바꾸기 ({ rating: 1~6 }) 또는 지우기 ({ rating: null }) */
export const PUT = withErrors(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const { rating } = (await request.json()) as { rating?: number | null };
  if (rating !== null && !(Number.isInteger(rating) && rating! >= 1 && rating! <= 6)) {
    return Response.json({ error: "별점은 1~6점이에요." }, { status: 400 });
  }
  await setMealRating(id, rating ?? null);
  return Response.json({ ok: true });
});
