import { NextResponse } from "next/server";
import { safeNext } from "@/lib/redirect";
import { supabase } from "@/lib/supabase";

// 구글 로그인을 마치고 돌아오는 곳. 받은 code 를 세션으로 바꿔 쿠키에 저장한다.
// 처음 로그인하는 구글 계정이면 Supabase 가 이때 자동으로 회원가입시킨다.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // 구글·Supabase 쪽에서 실패하면 code 대신 error_description 이 붙어서 온다
  let reason = searchParams.get("error_description") ?? searchParams.get("error") ?? "";
  if (code) {
    const { error } = await (await supabase()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth/callback]", error);
    reason = error.code ?? error.message;
  } else if (!reason) {
    reason = "no_code";
  }

  const params = new URLSearchParams({ error: "callback", reason: reason.slice(0, 200) });
  return NextResponse.redirect(`${origin}/login?${params}`);
}
