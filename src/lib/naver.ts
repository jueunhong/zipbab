// 네이버 이미지 검색. 두 가지 키 중 설정된 쪽을 쓴다.
// - NAVER API HUB (네이버 클라우드, 현재 방식): NCP_API_HUB_CLIENT_ID / NCP_API_HUB_CLIENT_SECRET
// - 네이버 개발자센터 (developers.naver.com, 기존 방식): NAVER_CLIENT_ID / NAVER_CLIENT_SECRET
// 두 방식 모두 하루 25,000회까지, 응답 형식은 같다.

export type RecipeImage = {
  url: string;
  thumbnail: string;
  width: number;
  height: number;
};

type NaverImageItem = { title: string; link: string; thumbnail: string; sizeheight: string; sizewidth: string };

function endpoint(): { url: string; headers: Record<string, string> } | null {
  const hubId = process.env.NCP_API_HUB_CLIENT_ID;
  const hubSecret = process.env.NCP_API_HUB_CLIENT_SECRET;
  if (hubId && hubSecret) {
    return {
      url: "https://naverapihub.apigw.ntruss.com/search/v1/image",
      headers: { "X-NCP-APIGW-API-KEY-ID": hubId, "X-NCP-APIGW-API-KEY": hubSecret },
    };
  }
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (id && secret) {
    return {
      url: "https://openapi.naver.com/v1/search/image",
      headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
    };
  }
  return null;
}

export function naverConfigured(): boolean {
  return endpoint() !== null;
}

export async function searchRecipeImages(query: string, count = 6): Promise<RecipeImage[]> {
  const ep = endpoint();
  if (!ep) throw new Error("네이버 검색 API 키가 설정되지 않았어요.");

  const params = new URLSearchParams({ query: `${query} 요리`, display: "20", sort: "sim", filter: "large" });
  const res = await fetch(`${ep.url}?${params}`, {
    headers: ep.headers,
    // 같은 요리 이름은 하루 동안 다시 검색하지 않는다 (호출 횟수 절약)
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) throw new Error(`네이버 이미지 검색 실패 (${res.status}): ${await res.text()}`);

  const { items = [] } = (await res.json()) as { items?: NaverImageItem[] };
  return (
    items
      // https 사이트에서 http 이미지는 막히므로 https 로 바꿔 시도한다 (안 열리면 화면에서 네이버 썸네일로 대체).
      // 너무 작거나 세로로 긴 이미지는 뺀다
      .filter((it) => it.thumbnail.startsWith("https://"))
      .map((it) => ({
        url: it.link.replace(/^http:\/\//, "https://"),
        thumbnail: it.thumbnail,
        width: Number(it.sizewidth),
        height: Number(it.sizeheight),
      }))
      .filter((img) => img.width >= 400 && img.height >= 300 && img.height / img.width < 1.4)
      .slice(0, count)
  );
}
