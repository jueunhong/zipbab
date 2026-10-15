import { withErrors } from "@/lib/api";
import { getInviteInfo, joinHousehold } from "@/lib/store";

type Ctx = { params: Promise<{ code: string }> };

const CODE = /^[a-z0-9]{6,32}$/;

/** 초대 링크 미리보기 */
export const GET = withErrors(async (_request: Request, { params }: Ctx) => {
  const { code } = await params;
  if (!CODE.test(code)) return Response.json({ error: "잘못된 초대 링크예요." }, { status: 400 });
  const info = await getInviteInfo(code);
  if (!info) return Response.json({ error: "없는 초대 링크예요. 링크를 다시 확인해 주세요." }, { status: 404 });
  return Response.json({ invite: info });
});

/** 초대받은 집에 참여하기 */
export const POST = withErrors(async (_request: Request, { params }: Ctx) => {
  const { code } = await params;
  if (!CODE.test(code)) return Response.json({ error: "잘못된 초대 링크예요." }, { status: 400 });
  await joinHousehold(code);
  return Response.json({ ok: true });
});
