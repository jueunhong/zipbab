import { PHOTO_BUCKET, supabase } from "@/lib/supabase";
import { thumbPathOf } from "@/lib/store";

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * GET /api/photos/{사용자id}/{...}.jpg[?size=thumb]
 * 로그인한 사용자의 권한으로 저장소에서 사진을 꺼낸다 (버킷 정책상 내 폴더만 읽힘).
 * 사진 경로는 한 번 정해지면 바뀌지 않으므로 브라우저가 1년간 캐시하게 한다 → 다시 볼 때는 즉시 뜸.
 */
export async function GET(request: Request, { params }: Ctx) {
  const { path } = await params;
  if (path.some((seg) => seg === ".." || seg === "." || seg === "")) {
    return new Response("Bad path", { status: 400 });
  }
  const photoPath = path.join("/");
  const wantThumb = new URL(request.url).searchParams.get("size") === "thumb";
  const storage = (await supabase()).storage.from(PHOTO_BUCKET);

  // 썸네일이 없는 예전 사진은 원본으로 대신 보낸다
  let { data } = wantThumb ? await storage.download(thumbPathOf(photoPath)) : { data: null };
  if (!data) ({ data } = await storage.download(photoPath));
  if (!data) return new Response("Not found", { status: 404 });

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
