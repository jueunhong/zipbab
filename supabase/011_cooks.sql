-- 011: 요리사 지정 (식단: 누가 요리할지 / 기록: 누가 요리했는지)
-- 010 다음에 실행하세요. Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.

alter table public.meal_plans
  add column if not exists cook_id uuid references auth.users (id) on delete set null;

alter table public.meals
  add column if not exists cook_id uuid references auth.users (id) on delete set null;

-- 지금까지의 기록은 올린 사람이 요리한 것으로 본다
update public.meals set cook_id = user_id where cook_id is null;

-- 요리사는 같은 집 멤버만 지정할 수 있다 (다른 집 사람 id 를 넣는 것을 막음)
create or replace function public.check_cook_in_household() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cook_id is not null and not exists (
    select 1 from public.household_members where user_id = new.cook_id and household_id = new.household_id
  ) then
    raise exception 'cook_not_in_household';
  end if;
  return new;
end $$;

drop trigger if exists meal_plans_check_cook on public.meal_plans;
create trigger meal_plans_check_cook before insert or update of cook_id on public.meal_plans
  for each row execute function public.check_cook_in_household();

drop trigger if exists meals_check_cook on public.meals;
create trigger meals_check_cook before insert or update of cook_id on public.meals
  for each row execute function public.check_cook_in_household();

notify pgrst, 'reload schema';
