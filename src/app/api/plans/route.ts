import { withErrors } from "@/lib/api";
import { addPlan, listMeals, listPlans } from "@/lib/store";
import { PlanInputSchema } from "@/lib/types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/plans?from=YYYY-MM-DD&to=YYYY-MM-DD → 그 기간의 식단과, 그 기간에 기록한 집밥 사진 */
export const GET = withErrors(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!DATE.test(from) || !DATE.test(to)) {
    return Response.json({ error: "from, to 날짜가 필요해요." }, { status: 400 });
  }
  const [plans, meals] = await Promise.all([listPlans({ from, to }), listMeals({ from, to })]);
  return Response.json({ plans, meals });
});

export const POST = withErrors(async (request: Request) => {
  const parsed = PlanInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않아요." }, { status: 400 });
  }
  return Response.json({ plan: await addPlan(parsed.data) }, { status: 201 });
});
