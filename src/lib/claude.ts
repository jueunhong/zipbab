import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { NutritionSchema, RecipeOutputSchema, type Recipe, type RecipeRequest } from "./types";

const client = new Anthropic();

const SYSTEM_PROMPT = `당신은 자취생과 집밥 초보를 돕는 영양 균형 레시피 코치입니다.

레시피를 추천할 때 지킬 원칙:
- 건강: 한 끼 안에서 탄수화물·단백질·지방이 고르게 들어가야 합니다. 대략 탄수화물 45~55%, 단백질 20~30%, 지방 20~30% 칼로리 비율을 목표로 하고, 채소를 꼭 포함하세요.
- 간단함: 일반 가정 주방(프라이팬, 냄비, 전자레인지)과 동네 마트에서 구할 수 있는 재료만 사용합니다. 조리 단계는 가능하면 6단계 이하로 유지합니다.
- 맛: 한국인 입맛에 맞고 다시 해먹고 싶은 맛이어야 합니다. 간을 맞추는 요령을 팁에 적어주세요.

영양 수치는 1인분 기준 추정치로 계산하고, balanceNote에 탄·단·지 균형이 어떻게 맞춰졌는지 한두 문장으로 설명하세요.
searchKeyword에는 이 요리의 완성 사진을 이미지 검색할 때 쓸 짧은 대표 요리 이름 하나를 적으세요 (예: "김치참치볶음밥과 반숙 계란후라이" → "김치참치볶음밥"). 수식어나 곁들임은 빼세요.
모든 텍스트는 한국어로 작성합니다.`;

function buildUserPrompt(req: RecipeRequest): string {
  const lines = ["오늘 해먹을 집밥 레시피 하나를 추천해 주세요."];
  if (req.ingredients?.trim()) {
    lines.push(`- 참고: 집에 이런 재료가 있어요: ${req.ingredients.trim()}`);
    lines.push(
      `  이 재료들은 참고용이에요. 다 쓸 필요도, 꼭 하나라도 쓸 필요도 없어요. 맛있고 균형 잡힌 메뉴가 우선이고, 자연스럽게 어울리는 재료만 골라 쓰고 필요한 재료는 새로 사도 괜찮아요. 어울리지 않는 재료를 억지로 넣지 마세요.`,
    );
    lines.push(`  유통기한이 임박한 재료(D-day, D-1 등)는 메뉴에 잘 어울린다면 먼저 써 주세요. 유통기한이 지난 재료는 사용하지 마세요.`);
  }
  if (req.seasonings?.trim()) lines.push(`- 참고: 집에 있는 양념: ${req.seasonings.trim()} (있는 양념을 쓰면 좋지만, 필요하면 다른 양념을 써도 괜찮아요)`);
  if (req.maxMinutes) lines.push(`- 조리 시간: ${req.maxMinutes}분 이내`);
  lines.push(`- 인분: ${req.servings ?? 1}인분`);
  if (req.notes?.trim()) lines.push(`- 추가 요청: ${req.notes.trim()}`);
  if (req.avoid?.length) lines.push(`- 이미 추천받은 메뉴(${req.avoid.join(", ")})와는 주재료나 조리법이 확실히 다른 요리로 추천해 주세요.`);
  return lines.join("\n");
}

export class RecipeRefusedError extends Error {}

/** 시스템 프롬프트(레시피 원칙) + 사용자 요청으로 레시피 하나를 받는다 */
async function generateRecipe(userContent: string): Promise<Recipe> {
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      // Opus 5.5 기본값은 medium(약 30초). 레시피 추천은 low 로도 품질이 충분하고 2배 이상 빠르다(약 14초)
      effort: "low",
      format: betaZodOutputFormat(RecipeOutputSchema),
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  if (response.stop_reason === "refusal") {
    throw new RecipeRefusedError("이 요청에는 레시피를 추천할 수 없어요. 요청 내용을 바꿔서 다시 시도해 주세요.");
  }
  if (!response.parsed_output) {
    throw new Error(`레시피 응답을 해석하지 못했어요 (stop_reason: ${response.stop_reason})`);
  }
  return response.parsed_output;
}

export async function recommendRecipe(req: RecipeRequest): Promise<Recipe> {
  return generateRecipe(buildUserPrompt(req));
}

/** 추천받은 레시피를 사용자 요청대로 고친다 (예: "두부 대신 닭가슴살로", "더 맵게") */
export async function reviseRecipe(recipe: Recipe, instruction: string): Promise<Recipe> {
  return generateRecipe(
    [
      "아래 레시피를 사용자의 요청대로 고쳐 주세요.",
      "- 요청한 부분만 바꾸고, 나머지(요리 콘셉트, 조리 순서, 분량)는 최대한 그대로 두세요.",
      "- 재료가 바뀌면 그에 맞게 조리 단계·조리 시간·팁도 자연스럽게 고치고, 1인분 영양 수치와 balanceNote를 다시 계산하세요.",
      "- 요청 때문에 탄·단·지 균형이 크게 깨지면, 요청은 지키되 균형을 맞출 방법을 팁에 한 줄 적어 주세요.",
      "- 요리가 달라졌다면 title과 searchKeyword도 그에 맞게 바꾸세요.",
      "",
      `사용자 요청: ${instruction}`,
      "",
      "현재 레시피(JSON):",
      JSON.stringify(recipe),
    ].join("\n"),
  );
}

const NutritionEstimateSchema = NutritionSchema.extend({
  // 계산 근거를 한두 문장으로 (예: "두부 150g, 밥 200g 기준으로 계산했어요")
  note: z.string(),
});

export type NutritionEstimate = z.infer<typeof NutritionEstimateSchema>;

/** 내가 만든 레시피의 재료로 1인분 영양 성분을 추정한다 */
export async function estimateNutrition(input: {
  title: string;
  servings: number;
  ingredients: { name: string; amount: string }[];
}): Promise<NutritionEstimate> {
  const list = input.ingredients.map((i) => `- ${i.name}${i.amount ? ` ${i.amount}` : ""}`).join("\n");
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(NutritionEstimateSchema) },
    system:
      "당신은 한국 가정식 영양 성분을 추정하는 영양사입니다. 재료 목록과 분량으로 1인분 기준 칼로리(kcal)와 탄수화물·단백질·지방(g)을 추정하세요. 분량이 없거나 모호하면 한국 가정식에서 흔한 양으로 가정하고, note에 어떤 가정을 했는지 한두 문장으로 한국어로 적으세요.",
    messages: [{ role: "user", content: `요리: ${input.title}\n총 ${input.servings}인분\n재료:\n${list}` }],
  });

  if (response.stop_reason === "refusal") {
    throw new RecipeRefusedError("이 재료로는 영양 성분을 계산할 수 없어요.");
  }
  if (!response.parsed_output) {
    throw new Error(`영양 계산 응답을 해석하지 못했어요 (stop_reason: ${response.stop_reason})`);
  }
  return response.parsed_output;
}
