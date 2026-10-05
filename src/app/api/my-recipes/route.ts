import { withErrors } from "@/lib/api";
import { createMyRecipe, listMyRecipes, savePhoto } from "@/lib/store";
import { readMyRecipeForm } from "./form";

export const GET = withErrors(async () => {
  return Response.json({ recipes: await listMyRecipes() });
});

export const POST = withErrors(async (request: Request) => {
  const form = await readMyRecipeForm(request);
  if ("error" in form) return Response.json({ error: form.error }, { status: 400 });

  await createMyRecipe(form.input, form.photo ? await savePhoto(form.photo) : null);
  return Response.json({ ok: true }, { status: 201 });
});
