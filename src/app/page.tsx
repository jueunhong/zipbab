"use client";

import dynamic from "next/dynamic";
import PageSkeleton from "@/components/PageSkeleton";

// 저장해 둔 추천 결과(localStorage)를 첫 화면부터 보여주기 위해 브라우저에서만 렌더한다
const Recommender = dynamic(() => import("@/components/Recommender"), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function Home() {
  return <Recommender />;
}
