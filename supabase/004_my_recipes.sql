-- 004: 내가 직접 만든 레시피
-- 003 다음에 실행하세요. Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.

create table if not exists public.my_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '',
  servings int not null default 1 check (servings between 1 and 20),
  cook_time_minutes int check (cook_time_minutes between 1 and 600),
  ingredients jsonb not null default '[]',  -- [{ "name": "두부", "amount": "1/2모" }]
  steps jsonb not null default '[]',        -- ["두부를 깍둑썰기 한다", ...]
  tips text not null default '',
  photo_path text,
  nutrition jsonb,                          -- 1인분 { calories, carbsG, proteinG, fatG } (선택)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists my_recipes_user_time_idx on public.my_recipes (user_id, updated_at desc);
alter table public.my_recipes enable row level security;

drop policy if exists "own my recipes" on public.my_recipes;
create policy "own my recipes" on public.my_recipes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- API(PostgREST)가 새 테이블을 바로 인식하도록 스키마 캐시 새로고침
notify pgrst, 'reload schema';
