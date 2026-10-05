import { photoError } from "@/lib/api";
import { MyRecipeInputSchema, type MyRecipeInput } from "@/lib/types";

/** 작성·수정 폼(multipart): data = 레시피 JSON, photo = 사진(선택), removePhoto = "1" 이면 사진 삭제 */
export async function readMyRecipeForm(
  request: Request,
): Promise<{ error: string } | { input: MyRecipeInput; photo: File | null; removePhoto: boolean }> {
  const form = await request.formData();
  let json: unknown;
  try {
    json = JSON.parse(String(form.get("data") ?? ""));
  } catch {
    return { error: "레시피 내용을 읽지 못했어요." };
  }
  const parsed = MyRecipeInputSchema.safeParse(json);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않아요." };

  const photo = form.get("photo");
  const invalid = photoError(photo, { required: false });
  if (invalid) return { error: invalid };

  return {
    input: parsed.data,
    photo: photo instanceof File && photo.size > 0 ? photo : null,
    removePhoto: form.get("removePhoto") === "1",
  };
}
