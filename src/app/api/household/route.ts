import { withErrors } from "@/lib/api";
import { getHousehold, renameHousehold } from "@/lib/store";

export const GET = withErrors(async () => {
  return Response.json({ household: await getHousehold() });
});

/** 집 이름 바꾸기 */
export const PATCH = withErrors(async (request: Request) => {
  const { name } = (await request.json()) as { name?: string };
  const trimmed = name?.trim() ?? "";
  if (trimmed.length < 1 || trimmed.length > 30) {
    return Response.json({ error: "이름은 1~30자로 정해 주세요." }, { status: 400 });
  }
  await renameHousehold(trimmed);
  return Response.json({ ok: true });
});
