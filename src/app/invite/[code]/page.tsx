import type { Metadata } from "next";
import InviteView from "./InviteView";

// 초대 링크를 카카오톡 등에 붙였을 때 보이는 미리보기 (이미지는 app/opengraph-image.png 로고)
export const metadata: Metadata = {
  title: "Zipbab 초대장 🍚",
  description: "우리집에 초대되었어요. 들어와서 같이 맛있게 집밥 해먹어요!",
  // openGraph 를 여기서 정하면 상위(layout) 설정을 통째로 덮어써서, 로고 이미지도 다시 지정한다
  openGraph: {
    type: "website",
    siteName: "Zipbab",
    locale: "ko_KR",
    title: "Zipbab 초대장 🍚",
    description: "우리집에 초대되었어요. 들어와서 같이 맛있게 집밥 해먹어요!",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Zipbab" }],
  },
  twitter: { card: "summary_large_image", images: ["/opengraph-image.png"] },
};

export default function InvitePage() {
  return <InviteView />;
}
