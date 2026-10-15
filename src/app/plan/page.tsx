"use client";

import dynamic from "next/dynamic";
import PageSkeleton from "@/components/PageSkeleton";

// "오늘"과 이번 주를 사용자 시간대로 계산하기 위해 브라우저에서만 렌더한다
const WeekPlanner = dynamic(() => import("@/components/WeekPlanner"), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function PlanPage() {
  return <WeekPlanner />;
}
