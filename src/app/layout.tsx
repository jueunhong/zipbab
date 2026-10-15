import type { Metadata, Viewport } from "next";
import { Gowun_Dodum } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { currentUser, supabase } from "@/lib/supabase";
import NavLink from "@/components/NavLink";
import logoHorizontal from "../../public/brand/logo-horizontal.png";
import "./globals.css";

// 글꼴: 고운돋움 하나로 통일 (부드럽고 둥글어 로고와 어울리고, 작은 글씨도 잘 읽힘)
const body = Gowun_Dodum({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-body" });

// 링크 미리보기(카카오톡 등)의 이미지는 app/opengraph-image.png (로고). 절대 주소가 필요해서 배포 주소를 기준으로 한다
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Zipbab 집밥",
  description: "건강하고 간단한 집밥 레시피 추천과 요리 기록",
  appleWebApp: { title: "Zipbab", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    siteName: "Zipbab",
    locale: "ko_KR",
    title: "Zipbab 집밥",
    description: "건강하고 간단한 집밥 레시피를 추천받고, 같이 만들어 먹은 요리를 기록해요.",
  },
  twitter: { card: "summary_large_image" },
};

// 페이지가 그려지기 전에도 브라우저가 앱 배경색(크림)을 쓰도록
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#fcf8ed",
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
    <div className="flex items-center gap-2 font-display text-sm sm:gap-4 sm:text-[15px]">
      <NavLink href="/">추천</NavLink>
      <NavLink href="/plan">식단</NavLink>
      <NavLink href="/pantry">재료</NavLink>
      <NavLink href="/saved" match={["/my-recipes"]}>레시피북</NavLink>
      <NavLink href="/journal">기록</NavLink>
      {/* 프로필 사진 → 우리집(멤버·초대·로그아웃) */}
      <Link href="/household" className="flex items-center gap-1.5 text-foreground/80 hover:text-accent" title={`${user.email ?? ""} · 우리집`}>
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="우리집" className="h-6 w-6 rounded-full ring-2 ring-accent/20 sm:h-7 sm:w-7" referrerPolicy="no-referrer" />
        ) : (
          <span aria-label="우리집">🏠</span>
        )}
        <span className="hidden sm:inline">우리집</span>
      </Link>
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`h-full antialiased ${body.variable}`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-line bg-background/85 backdrop-blur">
          <nav className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between gap-3">
            <Link href="/" className="shrink-0" aria-label="Zipbab 홈">
              <Image src={logoHorizontal} alt="Zipbab" priority sizes="140px" className="h-6 w-auto sm:h-8" />
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
