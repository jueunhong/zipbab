-- 007: 집밥 기록에 별점 (6점 만점, 선택)
-- 006 다음에 실행하세요. Supabase 대시보드 → SQL Editor 에 붙여넣고 Run. 여러 번 실행해도 안전합니다.

alter table public.meals
  add column if not exists rating smallint check (rating between 1 and 6);

-- API(PostgREST)가 새 컬럼을 바로 인식하도록 스키마 캐시 새로고침
notify pgrst, 'reload schema';
