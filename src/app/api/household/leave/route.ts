import { withErrors } from "@/lib/api";
import { leaveHousehold } from "@/lib/store";

/** 지금 집에서 나가기 — 데이터는 그 집에 남고, 나는 새로 혼자 쓰는 집으로 */
export const POST = withErrors(async () => {
  await leaveHousehold();
  return Response.json({ ok: true });
});
