/** 로그인 후 돌아갈 경로. 외부 사이트로 튕겨나가지 않도록 같은 사이트의 경로만 허용한다. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
