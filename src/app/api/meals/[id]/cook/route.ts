import { withErrors } from "@/lib/api";
import { setMealCook } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

/** 기록의 요리사 바꾸기 ({ cookId: 멤버 id | null }) */
export const PUT = withErrors(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const { cookId } = (await request.json()) as { cookId?: string | null };
  if (cookId !== null && !(typeof cookId === "string" && /^[0-9a-f-]{36}$/.test(cookId))) {
    return Response.json({ error: "요리사를 다시 골라 주세요." }, { status: 400 });
  }
  await setMealCook(id, cookId ?? null);
  return Response.json({ ok: true });
});
