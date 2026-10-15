-- 010: 집밥 기록 별점을 사람마다 따로 (같은 집 멤버 모두 별점을 남길 수 있게)
-- 009 다음에 실행하세요. Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.

create table if not exists public.meal_ratings (
  meal_id uuid not null references public.meals (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 6),
  updated_at timestamptz not null default now(),
  primary key (meal_id, user_id) -- 한 사람은 한 기록에 별점 하나
);

-- 지금까지 기록에 매긴 별점(meals.rating)은 올린 사람의 별점으로 옮긴다
insert into public.meal_ratings (meal_id, user_id, rating)
select id, user_id, rating from public.meals where rating is not null
on conflict (meal_id, user_id) do nothing;

alter table public.meal_ratings enable row level security;

-- 같은 집 기록의 별점은 모두 볼 수 있고, 내 별점만 남기고 고치고 지울 수 있다
drop policy if exists "read household meal ratings" on public.meal_ratings;
create policy "read household meal ratings" on public.meal_ratings for select to authenticated
  using (exists (select 1 from public.meals m where m.id = meal_id and m.household_id = (select public.my_household_id())));

drop policy if exists "write my meal ratings" on public.meal_ratings;
create policy "write my meal ratings" on public.meal_ratings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.meals m where m.id = meal_id and m.household_id = (select public.my_household_id()))
  );

notify pgrst, 'reload schema';
