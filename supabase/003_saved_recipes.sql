-- 003: 레시피 찜하기
-- 002_users.sql 다음에 실행하세요. Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.

create table if not exists public.saved_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  recipe jsonb not null,
  created_at timestamptz not null default now(),
  -- 같은 이름의 레시피를 두 번 찜하지 않도록
  unique (user_id, title)
);

create index if not exists saved_recipes_user_time_idx on public.saved_recipes (user_id, created_at desc);
alter table public.saved_recipes enable row level security;

drop policy if exists "own saved recipes" on public.saved_recipes;
create policy "own saved recipes" on public.saved_recipes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- API(PostgREST)가 새 테이블을 바로 인식하도록 스키마 캐시 새로고침
notify pgrst, 'reload schema';
