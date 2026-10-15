/** 페이지를 불러오는 동안 보여주는 회색 틀 (빈 화면 대신) */
export default function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="불러오는 중">
      <div className="h-7 w-40 rounded bg-line" />
      <div className="h-4 w-64 rounded bg-line" />
      <div className="h-48 rounded-2xl bg-line" />
      <div className="h-24 rounded-2xl bg-line" />
    </div>
  );
}
