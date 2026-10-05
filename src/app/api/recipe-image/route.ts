import { withErrors } from "@/lib/api";
import { naverConfigured, searchRecipeImages } from "@/lib/naver";

export const GET = withErrors(async (request: Request) => {
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 50);
  if (!query) return Response.json({ error: "검색어가 필요해요." }, { status: 400 });
  if (!naverConfigured()) return Response.json({ images: [], configured: false });

  return Response.json(
    { images: await searchRecipeImages(query), configured: true },
    { headers: { "Cache-Control": "private, max-age=86400" } },
  );
});
