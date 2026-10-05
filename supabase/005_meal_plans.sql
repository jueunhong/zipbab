-- 005: 주간 식단 계획
-- 004 다음에 실행하세요. Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_date date not null,
  slot text not null default '저녁' check (slot in ('아침', '점심', '저녁')),
  title text not null,
  recipe jsonb,                                                   -- 추천·찜 레시피 내용 (계획한 시점 그대로)
  meal_id uuid references public.meals (id) on delete set null,  -- 실제로 만들어 먹고 기록한 사진
  created_at timestamptz not null default now()
);

create index if not exists meal_plans_user_date_idx on public.meal_plans (user_id, plan_date);
alter table public.meal_plans enable row level security;

drop policy if exists "own meal plans" on public.meal_plans;
create policy "own meal plans" on public.meal_plans
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- API(PostgREST)가 새 테이블을 바로 인식하도록 스키마 캐시 새로고침
notify pgrst, 'reload schema';
