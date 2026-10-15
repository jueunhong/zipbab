import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { currentUser, supabase } from "@/lib/supabase";
import "./globals.css";

export const metadata: Metadata = {
  title: "집밥",
  description: "건강하고 간단한 집밥 레시피 추천과 요리 기록",
};

// 페이지가 그려지기 전에도 브라우저가 앱 배경색을 쓰도록 (밝은/어두운 모드)
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#181614" },
  ],
};

// 상단 메뉴용 로그인 정보. Supabase 설정이 없을 때(빌드 중 등)도 화면이 깨지지 않도록 로그아웃 상태로 본다.
// 실제 접근 차단은 proxy.ts 가 한다.
async function headerUser() {
  // 로그인 상태는 요청마다 다르므로, 빌드 때 미리 만들어 두지 않고 항상 요청 시점에 그린다
  await connection();
  try {
    return await currentUser(await supabase());
  } catch {
    return null;
  }
}

/** 로그인한 사용자용 메뉴. 로그인 확인을 기다리는 동안에도 나머지 화면은 먼저 보이도록 Suspense 안에서 그린다 */
async function NavLinks() {
  const user = await headerUser();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2.5 text-sm sm:gap-4">
      <Link href="/" className="hover:text-accent">추천</Link>
      <Link href="/plan" className="hover:text-accent">식단</Link>
      <Link href="/pantry" className="hover:text-accent">재료</Link>
      <Link href="/saved" className="hover:text-accent">레시피북</Link>
      <Link href="/journal" className="hover:text-accent">기록</Link>
      <form action="/auth/logout" method="post">
        <button className="flex items-center gap-1.5 text-muted hover:text-accent" title={`${user.email ?? ""} 로그아웃`}>
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
          ) : null}
          <span className="hidden sm:inline">로그아웃</span>
        </button>
      </form>
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-surface/80 backdrop-blur sticky top-0 z-10">
          <nav className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between gap-3">
            <Link href="/" className="font-bold text-lg shrink-0">
              🍚 집밥
            </Link>
            <Suspense fallback={<div className="h-5 w-48 animate-pulse rounded bg-line" />}>
              <NavLinks />
            </Suspense>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl px-4 py-8 flex-1">{children}</main>
      </body>
    </html>
  );
}
