import { z } from "zod";
import { aiErrorResponse, consumeAiQuota } from "@/lib/api";
import { reviseRecipe } from "@/lib/claude";
import { RecipeSchema } from "@/lib/types";

export const maxDuration = 120;

const ReviseSchema = z.object({
  recipe: RecipeSchema,
  instruction: z.string().trim().min(1, "어떻게 바꿀지 적어 주세요.").max(300),
});

export async function POST(request: Request) {
  const parsed = ReviseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않아요." }, { status: 400 });
  }

  try {
    const blocked = await consumeAiQuota();
    if (blocked) return blocked;
    return Response.json({ recipe: await reviseRecipe(parsed.data.recipe, parsed.data.instruction) });
  } catch (err) {
    return aiErrorResponse(err, "레시피를 고치지 못했어요.");
  }
}
