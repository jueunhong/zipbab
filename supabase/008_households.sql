-- 008: 한 집 공유 (우리집 + 초대)
-- 007 다음에 실행하세요. Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
--
-- 데이터의 주인이 "사람(user_id)"에서 "집(household_id)"으로 바뀝니다.
-- 같은 집 멤버는 재료·식단·기록·찜·내 레시피·사진을 함께 보고 고칠 수 있습니다.
-- 한 사람은 한 집에만 속하고, 가입하면 혼자 쓰는 "우리집"이 자동으로 생깁니다.
-- user_id 컬럼은 "누가 올렸는지" 기록용으로 그대로 남습니다. 하루 AI 사용 횟수(recipe_usage)는 계속 사람별입니다.

-- 1) 집, 멤버, 초대 ------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default '우리집' check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade, -- 한 사람은 한 집에만
  display_name text,
  avatar_url text,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.household_invites (
  code text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

-- 2) 도우미 함수 -----------------------------------------------------------------
-- 내가 속한 집. RLS 정책과 insert 기본값에서 쓴다 (security definer 라서 멤버 테이블 RLS 를 다시 타지 않음)
create or replace function public.my_household_id() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.household_members where user_id = auth.uid()
$$;

-- 혼자 쓰는 집 만들기 (가입·나가기·기존 사용자 이전에 사용). 앱에서 직접 부를 수는 없다
create or replace function public.create_personal_household(uid uuid, dname text, avatar text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  insert into public.households (name) values ('우리집') returning id into hid;
  insert into public.household_members (household_id, user_id, display_name, avatar_url) values (hid, uid, dname, avatar);
  return hid;
end $$;
revoke execute on function public.create_personal_household(uuid, text, text) from public, anon, authenticated;

-- 가입하면 혼자 쓰는 집을 자동으로 만든다
create or replace function public.handle_new_user_household() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.create_personal_household(
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created_household on auth.users;
create trigger on_auth_user_created_household
  after insert on auth.users
  for each row execute function public.handle_new_user_household();

-- 이미 가입한 사람들에게도 집을 만들어 준다
do $$
declare u record;
begin
  for u in
    select id, email, raw_user_meta_data as m from auth.users
    where id not in (select user_id from public.household_members)
  loop
    perform public.create_personal_household(
      u.id,
      coalesce(u.m ->> 'full_name', u.m ->> 'name', split_part(u.email, '@', 1)),
      coalesce(u.m ->> 'avatar_url', u.m ->> 'picture')
    );
  end loop;
end $$;

-- 3) 데이터 테이블에 household_id 추가 + 기존 데이터는 올린 사람의 집으로 ---------------
do $$
declare t text;
begin
  foreach t in array array['pantry_items', 'meals', 'meal_plans', 'saved_recipes', 'my_recipes'] loop
    execute format('alter table public.%I add column if not exists household_id uuid references public.households (id) on delete cascade', t);
    execute format(
      'update public.%I d set household_id = m.household_id from public.household_members m where d.household_id is null and m.user_id = d.user_id', t);
    execute format('alter table public.%I alter column household_id set default public.my_household_id()', t);
    execute format('alter table public.%I alter column household_id set not null', t);
    execute format('create index if not exists %I on public.%I (household_id)', t || '_household_idx', t);
  end loop;
end $$;

-- 찜 중복 방지는 사람별 → 집별
alter table public.saved_recipes drop constraint if exists saved_recipes_user_id_title_key;
create unique index if not exists saved_recipes_household_title_key on public.saved_recipes (household_id, title);

-- 4) RLS: 같은 집 데이터만 -------------------------------------------------------
drop policy if exists "own pantry" on public.pantry_items;
drop policy if exists "household pantry" on public.pantry_items;
create policy "household pantry" on public.pantry_items for all to authenticated
  using (household_id = (select public.my_household_id())) with check (household_id = (select public.my_household_id()));

drop policy if exists "own meals" on public.meals;
drop policy if exists "household meals" on public.meals;
create policy "household meals" on public.meals for all to authenticated
  using (household_id = (select public.my_household_id())) with check (household_id = (select public.my_household_id()));

drop policy if exists "own meal plans" on public.meal_plans;
drop policy if exists "household meal plans" on public.meal_plans;
create policy "household meal plans" on public.meal_plans for all to authenticated
  using (household_id = (select public.my_household_id())) with check (household_id = (select public.my_household_id()));

drop policy if exists "own saved recipes" on public.saved_recipes;
drop policy if exists "household saved recipes" on public.saved_recipes;
create policy "household saved recipes" on public.saved_recipes for all to authenticated
  using (household_id = (select public.my_household_id())) with check (household_id = (select public.my_household_id()));

drop policy if exists "own my recipes" on public.my_recipes;
drop policy if exists "household my recipes" on public.my_recipes;
create policy "household my recipes" on public.my_recipes for all to authenticated
  using (household_id = (select public.my_household_id())) with check (household_id = (select public.my_household_id()));

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

drop policy if exists "my household" on public.households;
create policy "my household" on public.households for select to authenticated using (id = (select public.my_household_id()));
drop policy if exists "rename my household" on public.households;
create policy "rename my household" on public.households for update to authenticated
  using (id = (select public.my_household_id())) with check (id = (select public.my_household_id()));

drop policy if exists "my household members" on public.household_members;
create policy "my household members" on public.household_members for select to authenticated
  using (household_id = (select public.my_household_id()));

drop policy if exists "my household invites" on public.household_invites;
create policy "my household invites" on public.household_invites for select to authenticated
  using (household_id = (select public.my_household_id()));
drop policy if exists "create household invites" on public.household_invites;
create policy "create household invites" on public.household_invites for insert to authenticated
  with check (household_id = (select public.my_household_id()) and created_by = (select auth.uid()));
drop policy if exists "delete household invites" on public.household_invites;
create policy "delete household invites" on public.household_invites for delete to authenticated
  using (household_id = (select public.my_household_id()));

-- 5) 사진: 같은 집 멤버의 폴더도 보고 지울 수 있게 (올리기는 계속 내 폴더에만) ------------
drop policy if exists "read own photos" on storage.objects;
drop policy if exists "read household photos" on storage.objects;
create policy "read household photos" on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] in (
      select user_id::text from public.household_members where household_id = (select public.my_household_id())
    )
  );

drop policy if exists "delete own photos" on storage.objects;
drop policy if exists "delete household photos" on storage.objects;
create policy "delete household photos" on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] in (
      select user_id::text from public.household_members where household_id = (select public.my_household_id())
    )
  );

-- 6) 초대 확인 · 참여 · 나가기 (앱에서 호출) ------------------------------------------
-- 초대 링크 미리보기: 로그인했지만 아직 멤버가 아닌 사람도 볼 수 있어야 해서 security definer
create or replace function public.invite_info(invite_code text)
returns table (household_name text, inviter_name text, member_count int, expired boolean, already_member boolean, i_am_alone boolean)
language sql stable security definer set search_path = public as $$
  select
    h.name,
    (select display_name from public.household_members where user_id = i.created_by),
    (select count(*)::int from public.household_members where household_id = h.id),
    i.expires_at < now(),
    h.id = public.my_household_id(),
    (select count(*) = 1 from public.household_members where household_id = public.my_household_id())
  from public.household_invites i
  join public.households h on h.id = i.household_id
  where i.code = invite_code
$$;
revoke execute on function public.invite_info(text) from public, anon;
grant execute on function public.invite_info(text) to authenticated;

-- 초대받은 집으로 들어간다. 혼자 쓰던 집이면 데이터를 가져오고 빈 집은 지운다
create or replace function public.join_household(invite_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target uuid;
  old uuid;
  dname text;
  avatar text;
  alone boolean;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  select household_id into target from public.household_invites where code = invite_code and expires_at > now();
  if target is null then raise exception 'invalid_invite'; end if;

  select household_id, display_name, avatar_url into old, dname, avatar from public.household_members where user_id = me;
  if old = target then return target; end if;
  select count(*) = 1 into alone from public.household_members where household_id = old;

  delete from public.household_members where user_id = me;
  insert into public.household_members (household_id, user_id, display_name, avatar_url) values (target, me, dname, avatar);

  if alone then
    update public.pantry_items set household_id = target where household_id = old;
    update public.meals set household_id = target where household_id = old;
    update public.meal_plans set household_id = target where household_id = old;
    update public.my_recipes set household_id = target where household_id = old;
    -- 찜은 새 집에 같은 이름이 없는 것만 가져온다
    update public.saved_recipes s set household_id = target
      where s.household_id = old
        and not exists (select 1 from public.saved_recipes t where t.household_id = target and t.title = s.title);
    delete from public.households where id = old;
  end if;
  return target;
end $$;
revoke execute on function public.join_household(text) from public, anon;
grant execute on function public.join_household(text) to authenticated;

-- 집에서 나간다 (데이터는 원래 집에 남고, 나는 새로 혼자 쓰는 집으로)
create or replace function public.leave_household() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  old uuid;
  dname text;
  avatar text;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  select household_id, display_name, avatar_url into old, dname, avatar from public.household_members where user_id = me;
  if (select count(*) from public.household_members where household_id = old) <= 1 then
    raise exception 'alone';
  end if;
  delete from public.household_members where user_id = me;
  return public.create_personal_household(me, dname, avatar);
end $$;
revoke execute on function public.leave_household() from public, anon;
grant execute on function public.leave_household() to authenticated;

-- API(PostgREST)가 새 테이블·함수를 바로 인식하도록 스키마 캐시 새로고침
notify pgrst, 'reload schema';
