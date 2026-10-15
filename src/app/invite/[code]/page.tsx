"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { InviteInfo } from "@/lib/types";

/** 초대 링크로 들어온 화면. 로그인 전이면 proxy 가 로그인 화면으로 보냈다가 여기로 다시 돌려보낸다 */
export default function InvitePage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/invite/${code}`)
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => (ok ? setInfo(data.invite) : setError(data.error)));
  }, [code]);

  async function join() {
    setJoining(true);
    setError("");
    const res = await fetch(`/api/invite/${code}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setJoining(false);
      return setError(data.error ?? "참여하지 못했어요.");
    }
    router.replace("/household");
    router.refresh();
  }

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="card space-y-5 text-center">
        <div className="text-5xl">🏠</div>
        {!info && !error && <p className="text-sm text-muted">초대 정보를 불러오는 중…</p>}

        {error && !info && (
          <>
            <p className="text-sm text-red-600">{error}</p>
            <Link href="/" className="btn block">
              홈으로
            </Link>
          </>
        )}

        {info && (
          <>
            <div>
              <h1 className="text-xl">
                {info.inviterName}님이
                <br />‘{info.householdName}’에 초대했어요
              </h1>
              <p className="mt-1 text-sm text-muted">지금 {info.memberCount}명이 함께 쓰고 있어요.</p>
            </div>

            {info.alreadyMember ? (
              <>
                <p className="text-sm">이미 이 집 멤버예요 🙂</p>
                <Link href="/household" className="btn block">
                  우리집 보기
                </Link>
              </>
            ) : info.expired ? (
              <p className="text-sm text-red-600">기간이 지난 초대 링크예요. {info.inviterName}님에게 새 링크를 받아 주세요.</p>
            ) : (
              <>
                <div className="rounded-lg bg-background px-3 py-2 text-left text-xs text-muted">
                  참여하면 재료·식단·집밥 기록·레시피북을 함께 보고 고칠 수 있어요.
                  <br />
                  {info.iAmAlone
                    ? "지금까지 내가 기록한 재료·식단·기록·레시피도 함께 가져가요."
                    : "지금 함께 쓰는 집에서는 나오게 돼요. 그 집 데이터는 그대로 남아요."}
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button onClick={join} disabled={joining} className="btn w-full !py-3">
                  {joining ? "참여하는 중…" : "참여하기"}
                </button>
                <Link href="/" className="block text-sm text-muted">
                  다음에 할게요
                </Link>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
