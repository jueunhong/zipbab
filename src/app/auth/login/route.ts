import { NextResponse } from "next/server";
import { safeNext } from "@/lib/redirect";
import { supabase } from "@/lib/supabase";

// "구글로 계속하기" → 구글 로그인 화면으로 보낸다. 로그인이 끝나면 구글이 /auth/callback 으로 돌려보낸다.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));

  const { data, error } = await (await supabase()).auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) {
    console.error(error);
    return NextResponse.redirect(`${origin}/login?error=start`);
  }
  return NextResponse.redirect(data.url);
}
