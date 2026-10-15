-- 009: 관리자와 같은 집 멤버는 AI 사용 횟수 제한 없이
-- 008 다음에 실행하세요. Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.
--
-- 앱이 ADMIN_EMAILS(환경 변수)를 넘겨주면, 내 집 멤버 중에 그 이메일인 사람이 있는지만 알려준다.
-- 이메일 자체는 돌려주지 않고, 내 집이 아닌 사람은 검사하지 않는다.

create or replace function public.household_has_email(emails text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.household_members m
    join auth.users u on u.id = m.user_id
    where m.household_id = public.my_household_id()
      and lower(u.email) = any (select lower(e) from unnest(emails) as e)
  )
$$;
revoke execute on function public.household_has_email(text[]) from public, anon;
grant execute on function public.household_has_email(text[]) to authenticated;

notify pgrst, 'reload schema';
