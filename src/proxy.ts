import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/login", "/auth/callback"];

// 매 요청마다 Supabase 세션을 확인하고(만료됐으면 갱신해서 쿠키에 다시 써준다),
// 로그인하지 않았으면 페이지는 /login 으로, API 는 401 로 돌려보낸다.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return new Response("Supabase 설정이 없어요. .env.local에 SUPABASE_URL과 SUPABASE_PUBLISHABLE_KEY를 넣어 주세요.", { status: 500 });
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // getClaims 는 토큰 서명을 검증한다. 이 호출과 위 createServerClient 사이에 다른 코드를 넣지 말 것.
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);

  const { pathname, search } = request.nextUrl;
  // 초대 링크 페이지는 카카오톡 등이 미리보기(로고·제목)를 읽을 수 있게 로그인 없이 연다.
  // 화면에서 초대 정보를 불러오는 API 는 로그인이 필요해서, 로그인 전이면 화면이 로그인으로 보낸다
  const isInvitePage = /^\/invite\/[a-z0-9]+$/.test(pathname);
  if (loggedIn || PUBLIC_PATHS.includes(pathname) || isInvitePage) {
    if (loggedIn && pathname === "/login") return NextResponse.redirect(new URL("/", request.url));
    return response;
  }

  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // 정적 파일(_next, 파비콘, public 이미지, 홈 화면용 manifest 등)은 잠그지 않는다.
  // manifest 는 브라우저가 로그인 쿠키 없이 가져가므로 꼭 열어 둬야 홈 화면 아이콘이 적용된다.
  // 단, 사용자 사진(/api/photos/....jpg)은 확장자가 붙어 있어도 로그인 확인·세션 갱신을 거쳐야 한다
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)", "/api/photos/:path*"],
};
