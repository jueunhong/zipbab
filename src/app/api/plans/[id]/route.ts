import { withErrors } from "@/lib/api";
import { deletePlan, updatePlan } from "@/lib/store";
import { PlanUpdateSchema } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** 다른 날짜·끼니로 옮기기 */
export const PATCH = withErrors(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const parsed = PlanUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않아요." }, { status: 400 });
  }
  await updatePlan(id, parsed.data);
  return Response.json({ ok: true });
});

export const DELETE = withErrors(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  await deletePlan(id);
  return new Response(null, { status: 204 });
});
