-- 006: 식단에 "내 레시피"를 바로 넣을 수 있게
-- 005 다음에 실행하세요. Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.

alter table public.meal_plans
  add column if not exists my_recipe_id uuid references public.my_recipes (id) on delete set null;

-- API(PostgREST)가 새 컬럼을 바로 인식하도록 스키마 캐시 새로고침
notify pgrst, 'reload schema';
