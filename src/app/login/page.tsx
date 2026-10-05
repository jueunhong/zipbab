import { safeNext } from "@/lib/redirect";

const ERRORS: Record<string, string> = {
  start: "구글 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.",
  callback: "로그인을 마무리하지 못했어요. 다시 시도해 주세요.",
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

export default async function Login({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="card space-y-5 text-center">
        <div>
          <div className="text-4xl">🍚</div>
          <h1 className="mt-2 text-xl font-bold">집밥</h1>
          <p className="mt-1 text-sm text-muted">건강하고 간단한 집밥 레시피를 추천받고, 내가 만든 요리를 기록해요.</p>
        </div>
        <a
          href={`/auth/login?next=${encodeURIComponent(next)}`}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-surface py-3 text-sm font-semibold hover:bg-background"
        >
          <GoogleIcon />
          구글로 계속하기
        </a>
        <p className="text-xs text-muted">처음이면 자동으로 가입돼요.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
