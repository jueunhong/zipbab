import PageSkeleton from "@/components/PageSkeleton";

// 페이지 이동 중에 바로 보여주는 화면 (메뉴는 그대로 두고 본문만 회색 틀)
export default function Loading() {
  return <PageSkeleton />;
}
