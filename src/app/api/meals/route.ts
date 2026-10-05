import { photoError, withErrors } from "@/lib/api";
import { todayIn } from "@/lib/dates";
import { addMeal, listMeals, savePhoto, updatePlan } from "@/lib/store";
import { RecipeSchema } from "@/lib/types";

export const GET = withErrors(async () => {
  return Response.json({ meals: await listMeals() });
});

export const POST = withErrors(async (request: Request) => {
  const form = await request.formData();
  const photo = form.get("photo");
  const invalid = photoError(photo, { required: true });
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  const recipeRaw = form.get("recipe");
  const recipe = typeof recipeRaw === "string" && recipeRaw ? RecipeSchema.safeParse(JSON.parse(recipeRaw)).data : undefined;

  const mealId = await addMeal({
    title: String(form.get("title") || recipe?.title || "오늘의 집밥"),
    memo: String(form.get("memo") || ""),
    date: String(form.get("date") || todayIn("Asia/Seoul")),
    photoPath: await savePhoto(photo as File),
    recipe,
  });

  // 식단에서 "만들었어요"로 기록한 경우, 그 식단 칸에 이 사진을 연결한다
  const planId = form.get("planId");
  if (typeof planId === "string" && planId) await updatePlan(planId, { mealId });

  return Response.json({ ok: true }, { status: 201 });
});
