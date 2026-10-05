import { aiErrorResponse, consumeAiQuota } from "@/lib/api";
import { estimateNutrition } from "@/lib/claude";
import { MyRecipeInputSchema } from "@/lib/types";

export const maxDuration = 60;

const NutritionRequestSchema = MyRecipeInputSchema.pick({ title: true, servings: true, ingredients: true });

export async function POST(request: Request) {
  const parsed = NutritionRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않아요." }, { status: 400 });
  }
  if (parsed.data.ingredients.length === 0) {
    return Response.json({ error: "재료를 하나 이상 입력해 주세요." }, { status: 400 });
  }

  try {
    const blocked = await consumeAiQuota();
    if (blocked) return blocked;
    return Response.json({ nutrition: await estimateNutrition(parsed.data) });
  } catch (err) {
    return aiErrorResponse(err, "영양 성분을 계산하지 못했어요.");
  }
}
