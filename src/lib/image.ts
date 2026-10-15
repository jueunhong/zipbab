/**
 * 업로드 전에 브라우저에서 사진을 줄인다 (기본: 긴 변 1600px, JPEG).
 * 휴대폰 원본 3~5MB → 보통 300KB 안팎. 디코딩할 수 없는 형식이면 원본을 그대로 돌려준다.
 */
export async function compressImage(file: File, { maxSide = 1600, quality = 0.82 } = {}): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** 목록·캘린더 칸에 쓰는 작은 사진 (긴 변 480px, 보통 30~50KB) */
export function makeThumbnail(file: File): Promise<File> {
  return compressImage(file, { maxSide: 480, quality: 0.75 });
}
