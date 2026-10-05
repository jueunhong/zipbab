-- 002: 사용자별 데이터 분리 (Supabase 로그인)
-- schema.sql 다음에 실행하세요. Supabase 대시보드 → SQL Editor 에 붙여넣고 Run.
-- 여러 번 실행해도 안전합니다.
--
-- 앱은 로그인한 사용자의 세션으로 Supabase에 접근하고, RLS 정책이 "내 데이터만" 보이게 막는다.

-- 1) 각 테이블에 주인(user_id) 컬럼 추가. insert 할 때 비워두면 로그인한 사용자 id가 자동으로 들어간다.
--    (주인이 없는 기존 행은 not null 에 걸리므로, user_id 컬럼을 처음 추가할 때만 비운다 — 지금은 테스트 데이터만 있었음)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pantry_items' and column_name = 'user_id') then
    delete from public.pantry_items;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'meals' and column_name = 'user_id') then
    delete from public.meals;
  end if;
end $$;

alter table public.pantry_items
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade;
alter table public.meals
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade;

create index if not exists pantry_items_user_idx on public.pantry_items (user_id);
drop index if exists meals_date_idx;
create index if not exists meals_user_date_idx on public.meals (user_id, date desc, created_at desc);

-- 2) 내 행만 읽고 쓰기
drop policy if exists "own pantry" on public.pantry_items;
create policy "own pantry" on public.pantry_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own meals" on public.meals;
create policy "own meals" on public.meals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 3) 레시피 추천 사용 기록 (사용자별 하루 횟수 제한용). 지우기 정책이 없어서 사용자가 기록을 지울 수 없다.
create table if not exists public.recipe_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists recipe_usage_user_time_idx on public.recipe_usage (user_id, created_at desc);
alter table public.recipe_usage enable row level security;

drop policy if exists "read own usage" on public.recipe_usage;
create policy "read own usage" on public.recipe_usage
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "insert own usage" on public.recipe_usage;
create policy "insert own usage" on public.recipe_usage
  for insert to authenticated with check (user_id = (select auth.uid()));

-- 4) 사진: photos 버킷 안에서 "{내 user_id}/..." 폴더만 접근 가능

drop policy if exists "read own photos" on storage.objects;
create policy "read own photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "upload own photos" on storage.objects;
create policy "upload own photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "delete own photos" on storage.objects;
create policy "delete own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
