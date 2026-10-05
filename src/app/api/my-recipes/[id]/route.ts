import { withErrors } from "@/lib/api";
import { deleteMyRecipe, savePhoto, updateMyRecipe } from "@/lib/store";
import { readMyRecipeForm } from "../form";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrors(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const form = await readMyRecipeForm(request);
  if ("error" in form) return Response.json({ error: form.error }, { status: 400 });

  await updateMyRecipe(id, form.input, {
    newPhotoPath: form.photo ? await savePhoto(form.photo) : null,
    removePhoto: form.removePhoto,
  });
  return Response.json({ ok: true });
});

export const DELETE = withErrors(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  await deleteMyRecipe(id);
  return new Response(null, { status: 204 });
});
