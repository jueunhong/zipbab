import { createHash } from "crypto";

// 임시 진단용: 배포 환경 변수가 로컬과 같은지 비교하기 위한 "지문"만 보여준다 (값 자체는 노출하지 않음)
function fingerprint(value: string | undefined) {
  if (!value) return null;
  return {
    prefix: value.slice(0, 15),
    length: value.length,
    sha256: createHash("sha256").update(value).digest("hex").slice(0, 10),
    hasWhitespaceOrQuotes: /^\s|\s$|^["']|["']$|\n/.test(value),
  };
}

export function GET() {
  return Response.json({
    supabaseUrl: process.env.SUPABASE_URL ?? null,
    publishableKey: fingerprint(process.env.SUPABASE_PUBLISHABLE_KEY),
    anthropicKeySet: Boolean(process.env.ANTHROPIC_API_KEY),
    naverKeysSet: Boolean(process.env.NCP_API_HUB_CLIENT_ID && process.env.NCP_API_HUB_CLIENT_SECRET),
  });
}
