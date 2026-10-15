"use client";

import { useState } from "react";
import Link from "next/link";
import type { HouseholdMember } from "@/lib/types";

/** 멤버 프로필 사진 (없으면 이름 첫 글자) */
export function MemberAvatar({ member, size = 20 }: { member: HouseholdMember | undefined; size?: number }) {
  const style = { width: size, height: size };
  if (member?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={member.avatarUrl} alt="" referrerPolicy="no-referrer" style={style} className="shrink-0 rounded-full bg-line object-cover" />
    );
  }
  return (
    <span style={{ ...style, fontSize: size * 0.5 }} className="flex shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
      {member?.name.slice(0, 1) ?? "?"}
    </span>
  );
}

/** "👩‍🍳 홍주은" — 요리사 표시 (지정 안 됐으면 아무것도 안 그림) */
export function CookBadge({ member, size = "sm" }: { member: HouseholdMember | undefined; size?: "sm" | "md" }) {
  if (!member) return null;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${size === "sm" ? "text-[11px]" : "text-sm"} text-muted`}>
      <span aria-hidden>👩‍🍳</span>
      <MemberAvatar member={member} size={size === "sm" ? 14 : 18} />
      <span className="truncate">{member.name}</span>
    </span>
  );
}

/** 요리사 고르기: 같은 집 멤버 중 한 명, 또는 미정 */
export default function CookPicker({
  members,
  value,
  onChange,
  allowNone = true,
  disabled = false,
}: {
  members: HouseholdMember[];
  value: string | null;
  onChange: (cookId: string | null) => void;
  allowNone?: boolean;
  disabled?: boolean;
}) {
  const chip = (active: boolean) =>
    `flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition ${
      active ? "border-accent bg-accent/10 text-accent" : "border-line bg-surface text-foreground/80 hover:border-accent/50"
    } disabled:opacity-50`;

  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="요리사">
      {members.map((m) => (
        <button key={m.userId} type="button" role="radio" aria-checked={value === m.userId} disabled={disabled} onClick={() => onChange(m.userId)} className={chip(value === m.userId)}>
          <MemberAvatar member={m} size={18} />
          {m.name}
        </button>
      ))}
      {allowNone && (
        <button type="button" role="radio" aria-checked={value === null} disabled={disabled} onClick={() => onChange(null)} className={chip(value === null)}>
          미정
        </button>
      )}
    </div>
  );
}

/** 상세 화면의 요리사 칸: 지금 요리사 + 바꾸기 */
export function CookSection({
  label,
  members,
  value,
  onChange,
  allowNone = true,
}: {
  label: string;
  members: HouseholdMember[];
  value: string | null;
  onChange: (cookId: string | null) => Promise<void>;
  allowNone?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="mt-2 space-y-1.5 rounded-xl bg-background px-3 py-2.5">
      <p className="font-display text-sm">👩‍🍳 {label}</p>
      <CookPicker
        members={members}
        value={value}
        allowNone={allowNone}
        disabled={busy}
        onChange={async (id) => {
          if (id === value) return;
          setBusy(true);
          setError("");
          try {
            await onChange(id);
          } catch (e) {
            setError(e instanceof Error ? e.message : "요리사를 바꾸지 못했어요.");
          } finally {
            setBusy(false);
          }
        }}
      />
      {members.length === 1 && <InviteHint />}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** 혼자 쓸 때: 친구를 초대하면 요리사로 고를 수 있다는 안내 */
export function InviteHint() {
  return (
    <p className="text-xs text-muted">
      친구를 초대하면 요리사로 고를 수 있어요.{" "}
      <Link href="/household" className="text-accent underline">
        초대하기
      </Link>
    </p>
  );
}
