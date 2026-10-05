import Anthropic from "@anthropic-ai/sdk";
import { RecipeRefusedError } from "./claude";
import { countRecipeUsageToday, recordRecipeUsage } from "./store";
import { currentUser, supabase } from "./supabase";

/** 라우트 핸들러에서 던진 오류를 { error } JSON 응답으로 바꿔준다 */
export function withErrors<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "서버 오류가 발생했어요.";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

// Vercel 함수 요청 본문 한도(4.5MB)보다 작게 — 브라우저에서 압축해서 보내므로 보통 0.5MB 이하
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/** 업로드된 사진이 올바르면 null, 아니면 오류 메시지 */
export function photoError(photo: FormDataEntryValue | null, { required }: { required: boolean }): string | null {
  if (!(photo instanceof File) || photo.size === 0) return required ? "사진을 선택해 주세요." : null;
  if (!photo.type.startsWith("image/")) return "이미지 파일만 올릴 수 있어요.";
  if (photo.size > MAX_PHOTO_BYTES) return "사진이 너무 커요 (4MB 이하).";
  return null;
}

// 누구나 가입할 수 있으므로 한 사람이 API 요금을 과하게 쓰지 못하게 막는다 (레시피 추천 + 영양 계산 합산)
const DAILY_AI_LIMIT = Number(process.env.RECIPE_DAILY_LIMIT) || 10;

// 관리자(사이트 주인)는 횟수 제한 없음. ADMIN_EMAILS=a@x.com,b@y.com
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

async function isAdmin(): Promise<boolean> {
  if (ADMIN_EMAILS.size === 0) return false;
  const user = await currentUser(await supabase());
  return Boolean(user?.email && ADMIN_EMAILS.has(user.email.toLowerCase()));
}

/** Claude 를 부르기 전에 호출. 오늘 한도를 넘었거나 키가 없으면 돌려줄 응답을, 괜찮으면 null 을 준다 (그리고 사용 1회 기록) */
export async function consumeAiQuota(): Promise<Response | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "API 키가 설정되지 않았어요. .env.local에 ANTHROPIC_API_KEY를 넣고 서버를 다시 시작해 주세요." }, { status: 500 });
  }
  if (!(await isAdmin()) && (await countRecipeUsageToday()) >= DAILY_AI_LIMIT) {
    return Response.json(
      { error: `오늘은 AI 기능(레시피 추천·영양 계산)을 ${DAILY_AI_LIMIT}번 모두 사용했어요. 내일 다시 이용해 주세요.` },
      { status: 429 },
    );
  }
  await recordRecipeUsage(); // 관리자도 사용량은 기록한다
  return null;
}

/** Claude 호출 중 난 오류를 사용자에게 보여줄 응답으로 바꾼다 */
export function aiErrorResponse(err: unknown, fallback: string): Response {
  if (err instanceof RecipeRefusedError) {
    return Response.json({ error: err.message }, { status: 422 });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return Response.json({ error: "API 키가 없거나 잘못됐어요. .env.local의 ANTHROPIC_API_KEY를 확인해 주세요." }, { status: 500 });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return Response.json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }
  if (err instanceof Anthropic.APIError) {
    return Response.json({ error: `Claude API 오류: ${err.message}` }, { status: 502 });
  }
  console.error(err);
  return Response.json({ error: fallback }, { status: 500 });
}
