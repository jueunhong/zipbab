import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const PHOTO_BUCKET = "photos";

export function supabaseConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase 설정이 없어요. .env.local에 SUPABASE_URL과 SUPABASE_PUBLISHABLE_KEY를 넣고 서버를 다시 시작해 주세요.");
  }
  return { url, key };
}

/**
 * 로그인한 사용자의 세션(쿠키)으로 동작하는 서버용 클라이언트.
 * RLS 정책 때문에 이 클라이언트로는 그 사용자의 데이터만 읽고 쓸 수 있다.
 * 요청마다 새로 만들어야 한다 — 요청 간에 공유하지 말 것.
 */
export async function supabase(): Promise<SupabaseClient> {
  const { url, key } = supabaseConfig();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 서버 컴포넌트 렌더 중에는 쿠키를 쓸 수 없다. 세션 갱신은 proxy.ts 가 처리하므로 무시해도 된다.
        }
      },
    },
  });
}

/** 현재 로그인한 사용자. 토큰 서명을 검증한 claims 기준. */
export async function currentUser(client: SupabaseClient): Promise<{ id: string; email?: string; name?: string; avatarUrl?: string } | null> {
  const { data } = await client.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  const meta = (claims.user_metadata ?? {}) as Record<string, string | undefined>;
  return { id: claims.sub, email: claims.email, name: meta.full_name ?? meta.name, avatarUrl: meta.avatar_url ?? meta.picture };
}
