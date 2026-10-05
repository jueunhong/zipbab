import { withErrors } from "@/lib/api";
import { listSavedRecipes, saveRecipe, unsaveRecipe } from "@/lib/store";
import { RecipeSchema } from "@/lib/types";

export const GET = withErrors(async () => {
  return Response.json({ saved: await listSavedRecipes() });
});

export const POST = withErrors(async (request: Request) => {
  const parsed = RecipeSchema.safeParse((await request.json()).recipe);
  if (!parsed.success) {
    return Response.json({ error: "레시피 형식이 올바르지 않아요." }, { status: 400 });
  }
  return Response.json({ saved: await saveRecipe(parsed.data) }, { status: 201 });
});

export const DELETE = withErrors(async (request: Request) => {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id가 필요해요." }, { status: 400 });
  await unsaveRecipe(id);
  return new Response(null, { status: 204 });
});
