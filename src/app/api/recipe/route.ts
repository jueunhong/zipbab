import { aiErrorResponse, consumeAiQuota } from "@/lib/api";
import { recommendRecipe } from "@/lib/claude";
import type { RecipeRequest } from "@/lib/types";

export const maxDuration = 120;

const MAX_TEXT = 500;

function clip(text: unknown): string | undefined {
  return typeof text === "string" ? text.slice(0, MAX_TEXT) : undefined;
}

export async function POST(request: Request) {
  const raw = (await request.json()) as RecipeRequest;
  const body: RecipeRequest = {
    ingredients: clip(raw.ingredients),
    seasonings: clip(raw.seasonings),
    notes: clip(raw.notes),
    maxMinutes: Math.min(Math.max(Number(raw.maxMinutes) || 20, 5), 120),
    servings: Math.min(Math.max(Number(raw.servings) || 1, 1), 6),
    avoid: Array.isArray(raw.avoid) ? raw.avoid.slice(-10).map((t) => String(t).slice(0, 50)) : [],
  };

  try {
    const blocked = await consumeAiQuota();
    if (blocked) return blocked;
    return Response.json({ recipe: await recommendRecipe(body) });
  } catch (err) {
    return aiErrorResponse(err, "레시피를 가져오지 못했어요.");
  }
}
