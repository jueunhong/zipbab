"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 상단 메뉴 링크. 지금 보고 있는 페이지면 메인 색으로 표시한다 */
export default function NavLink({ href, match = [], children }: { href: string; match?: string[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : [href, ...match].some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative whitespace-nowrap py-1 transition-colors hover:text-accent ${active ? "text-accent" : "text-foreground/80"}`}
    >
      {children}
      {active && <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />}
    </Link>
  );
}
