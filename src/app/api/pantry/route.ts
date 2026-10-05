import { withErrors } from "@/lib/api";
import { addPantryItem, listPantry, removePantryItem } from "@/lib/store";
import { PANTRY_CATEGORIES, type PantryCategory, type PantryItem } from "@/lib/types";

export const GET = withErrors(async () => {
  return Response.json({ items: await listPantry() });
});

export const POST = withErrors(async (request: Request) => {
  const body = (await request.json()) as Partial<PantryItem>;
  const name = body.name?.trim();
  if (!name) {
    return Response.json({ error: "재료 이름을 입력해 주세요." }, { status: 400 });
  }

  const item = await addPantryItem({
    name,
    category: PANTRY_CATEGORIES.includes(body.category as PantryCategory) ? (body.category as PantryCategory) : "냉장",
    expiresOn: body.expiresOn || undefined,
  });
  return Response.json({ item }, { status: 201 });
});

export const DELETE = withErrors(async (request: Request) => {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id가 필요해요." }, { status: 400 });
  await removePantryItem(id);
  return new Response(null, { status: 204 });
});
