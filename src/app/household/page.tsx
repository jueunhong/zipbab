"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Household } from "@/lib/types";

function expiresLabel(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return days <= 1 ? "오늘까지" : `${days}일 남음`;
}

export default function HouseholdPage() {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [error, setError] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/household");
    const data = await res.json();
    if (res.ok) setHousehold(data.household);
    else setError(data.error);
  }, []);

  useEffect(() => {
    fetch("/api/household")
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => (ok ? setHousehold(data.household) : setError(data.error)));
  }, []);

  const invite = household?.invites[0];
  const inviteUrl = invite ? `${location.origin}/invite/${invite.code}` : "";

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError("");
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "처리하지 못했어요.");
      return false;
    }
    return true;
  }

  async function saveName() {
    const ok = await call("/api/household", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (ok) {
      setEditingName(false);
      load();
    }
  }

  async function makeInvite() {
    if (await call("/api/household/invite", { method: "POST" })) load();
  }

  async function shareInvite() {
    const text = `${household?.name ?? "우리집"}에서 같이 집밥 해먹어요! 아래 링크로 들어와 주세요 🍚`;
    // 휴대폰은 카톡 등으로 바로 보낼 수 있는 공유 창, 안 되면 링크 복사
    if (navigator.share) {
      try {
        await navigator.share({ title: "집밥 초대", text, url: inviteUrl });
        return;
      } catch {
        // 공유 창을 닫은 경우 — 아무것도 안 함
        return;
      }
    }
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function leave() {
    if (!confirm(`'${household?.name}'에서 나갈까요?\n함께 쓰던 재료·식단·기록은 이 집에 그대로 남고, 나는 새로 혼자 쓰는 집으로 옮겨져요.`)) return;
    if (await call("/api/household/leave", { method: "POST" })) {
      router.replace("/");
      router.refresh();
    }
  }

  if (!household) {
    return error ? <div className="card text-sm text-red-600">{error}</div> : <p className="text-sm text-muted">불러오는 중…</p>;
  }

  const shared = household.members.length > 1;

  return (
    <div className="space-y-6">
      <div>
        {editingName ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveName();
            }}
            className="flex gap-2"
          >
            <input className="input !text-lg font-bold" value={name} maxLength={30} autoFocus onChange={(e) => setName(e.target.value)} />
            <button className="btn shrink-0" disabled={busy || !name.trim()}>저장</button>
            <button type="button" className="shrink-0 text-sm text-muted" onClick={() => setEditingName(false)}>
              취소
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-2xl">🏠 {household.name}</h1>
            <button
              onClick={() => {
                setName(household.name);
                setEditingName(true);
              }}
              className="text-xs text-muted underline"
            >
              이름 바꾸기
            </button>
          </div>
        )}
        <p className="mt-1 text-sm text-muted">
          {shared
            ? `${household.members.length}명이 재료·식단·기록·레시피북을 함께 쓰고 있어요.`
            : "친구나 가족을 초대하면 재료·식단·기록·레시피북을 함께 쓸 수 있어요."}
        </p>
      </div>

      {error && <div className="card text-sm text-red-600">{error}</div>}

      <section className="card space-y-3">
        <h2 className="">멤버</h2>
        <ul className="space-y-2">
          {household.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3">
              {m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full bg-line" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-line">🙂</div>
              )}
              <span className="text-sm">
                {m.name}
                {m.userId === household.me && <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent">나</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="">친구 초대하기</h2>
        {invite ? (
          <>
            <div className="flex gap-2">
              <input readOnly value={inviteUrl} className="input text-xs" onFocus={(e) => e.target.select()} />
              <button onClick={copyInvite} className="shrink-0 rounded-lg border border-line px-3 text-sm">
                {copied ? "복사됨!" : "복사"}
              </button>
            </div>
            <button onClick={shareInvite} className="btn w-full !py-3">
              📤 초대 링크 보내기
            </button>
            <p className="text-xs text-muted">
              링크를 받은 사람이 구글로 로그인하고 참여하면 이 집 멤버가 돼요. 이 링크는 {expiresLabel(invite.expiresAt)}이에요.{" "}
              <button onClick={makeInvite} disabled={busy} className="underline">
                새 링크 만들기
              </button>
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">초대 링크를 만들어 카카오톡 등으로 보내 주세요. 링크는 7일 동안 쓸 수 있어요.</p>
            <button onClick={makeInvite} disabled={busy} className="btn w-full !py-3">
              🔗 초대 링크 만들기
            </button>
          </>
        )}
      </section>

      <section className="space-y-2">
        {shared && (
          <button onClick={leave} disabled={busy} className="w-full rounded-lg border border-line py-2.5 text-sm text-red-600">
            이 집에서 나가기
          </button>
        )}
        <form action="/auth/logout" method="post">
          <button className="w-full rounded-lg border border-line py-2.5 text-sm text-muted">로그아웃</button>
        </form>
      </section>
    </div>
  );
}
