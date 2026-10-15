import type { MetadataRoute } from "next";

// 휴대폰 "홈 화면에 추가" 정보: 이름, 아이콘(로고), 주소창 없이 앱처럼 열기, 크림색 배경
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zipbab 집밥",
    short_name: "Zipbab",
    description: "건강하고 간단한 집밥 레시피 추천과 요리 기록",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fcf8ed",
    theme_color: "#fcf8ed",
    lang: "ko",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // 안드로이드가 동그라미·둥근 사각형으로 잘라 쓰는 아이콘 (로고를 가운데 안전 영역에만)
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
