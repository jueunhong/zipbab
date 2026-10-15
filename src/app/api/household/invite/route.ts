import { withErrors } from "@/lib/api";
import { createInvite } from "@/lib/store";

/** 초대 링크 만들기 (7일 동안 유효, 여러 명이 같은 링크로 들어올 수 있음) */
export const POST = withErrors(async () => {
  return Response.json({ invite: await createInvite() }, { status: 201 });
});
