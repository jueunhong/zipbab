-- 집밥 앱 스키마. Supabase 대시보드 → SQL Editor 에 붙여넣고 Run 하세요.
-- 앱은 서버(Next.js API)에서만 secret 키로 접근합니다.
-- RLS를 켜고 정책을 두지 않아서, 브라우저용 publishable 키로는 아무것도 읽거나 쓸 수 없습니다.

create table if not exists public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  category text not null check (category in ('냉장', '냉동', '실온', '양념')),
  expires_on date,
  added_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  memo text not null default '',
  date date not null,
  photo_path text not null,
  recipe jsonb,
  created_at timestamptz not null default now()
);

create index if not exists meals_date_idx on public.meals (date desc, created_at desc);

alter table public.pantry_items enable row level security;
alter table public.meals enable row level security;

-- 요리 사진 저장소 (비공개 버킷, 서명된 URL로만 열람)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;
