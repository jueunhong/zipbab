import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { currentUser, supabase } from "@/lib/supabase";
import "./globals.css";

export const metadata: Metadata = {
  title: "집밥",
  description: "건강하고 간단한 집밥 레시피 추천과 요리 기록",
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await headerUser();

  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-surface/80 backdrop-blur sticky top-0 z-10">
          <nav className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between gap-3">
            <Link href="/" className="font-bold text-lg shrink-0">
              🍚 집밥
            </Link>
            {user && (
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
            )}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl px-4 py-8 flex-1">{children}</main>
      </body>
    </html>
  );
}
