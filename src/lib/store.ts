import path from "path";
import { todayIn } from "./dates";
import { currentUser, PHOTO_BUCKET, supabase } from "./supabase";
import type { Household, InviteInfo, Meal, MealPlan, MealSlot, PlanInput, MyRecipe, MyRecipeInput, Nutrition, PantryCategory, PantryItem, Recipe, SavedRecipe } from "./types";

// 008 SQL 부터 데이터는 "집(household)" 단위로 공유된다. insert 때 household_id 도 DB 기본값으로 자동으로 채워진다.
// 저장소: Supabase (Postgres 테이블 pantry_items, meals, recipe_usage + Storage 버킷 photos)
// 스키마는 supabase/*.sql 참고. DB 컬럼은 snake_case, 앱 타입은 camelCase 라서 여기서 변환한다.
// 모든 요청은 로그인한 사용자의 세션으로 나가고, RLS 정책이 그 사용자의 데이터만 보이게 한다.
// insert 할 때 user_id 는 DB 기본값(auth.uid())으로 자동으로 채워진다.

/**
 * 사진 주소. 서명 URL 은 매번 바뀌어 브라우저가 캐시하지 못하므로, 고정 주소(/api/photos/...)로 내려주고
 * 그 라우트가 로그인한 사용자의 권한으로 저장소에서 꺼내 "오래 캐시" 헤더를 붙여 보낸다.
 * 썸네일은 원본 옆에 "<원본경로>.thumb.jpg" 로 저장한다 (없으면 라우트가 원본을 대신 보냄).
 */
export function photoUrl(path: string, size: "full" | "thumb" = "full"): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `/api/photos/${encoded}${size === "thumb" ? "?size=thumb" : ""}`;
}

export const thumbPathOf = (path: string) => `${path}.thumb.jpg`;

type MealRow = {
  id: string;
  user_id: string;
  title: string;
  memo: string;
  date: string;
  photo_path: string;
  recipe: Recipe | null;
  rating?: number | null; // 007 SQL 전에는 컬럼이 없어서 undefined
  created_at: string;
};

type PantryRow = {
  id: string;
  name: string;
  category: PantryCategory;
  expires_on: string | null;
  added_at: string;
};

function check<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(`Supabase 오류: ${error.message}`);
  return data as T;
}

/** range 를 주면 그 기간(from~to, 양 끝 포함)의 기록만 */
export async function listMeals(range?: { from: string; to: string }): Promise<Meal[]> {
  let query = (await supabase()).from("meals").select("*");
  if (range) query = query.gte("date", range.from).lte("date", range.to);
  const rows = check<MealRow[]>(await query.order("date", { ascending: false }).order("created_at", { ascending: false }));
  if (rows.length === 0) return [];

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    memo: r.memo,
    date: r.date,
    photoUrl: photoUrl(r.photo_path),
    thumbUrl: photoUrl(r.photo_path, "thumb"),
    recipe: r.recipe ?? undefined,
    rating: r.rating ?? null,
    createdAt: r.created_at,
  }));
}

/** 기록을 저장하고 새 기록의 id 를 돌려준다 */
export async function addMeal(meal: {
  title: string;
  memo: string;
  date: string;
  photoPath: string;
  recipe?: Recipe;
  rating?: number | null;
}): Promise<string> {
  const row = check<{ id: string }>(
    await (await supabase())
      .from("meals")
      .insert({
        title: meal.title,
        memo: meal.memo,
        date: meal.date,
        photo_path: meal.photoPath,
        recipe: meal.recipe ?? null,
        // 별점을 매겼을 때만 보낸다 (007 SQL 전에도 별점 없는 기록은 저장되도록)
        ...(meal.rating ? { rating: meal.rating } : {}),
      })
      .select("id")
      .single(),
  );
  return row.id;
}

/** 사진(과 썸네일)을 저장하고 원본 경로를 돌려준다 */
export async function savePhoto(file: File, thumb?: File | null): Promise<string> {
  const client = await supabase();
  const user = await currentUser(client);
  if (!user) throw new Error("로그인이 필요해요.");
  // 버킷 정책상 사진은 "{user_id}/..." 폴더에만 올릴 수 있다
  const ext = (path.extname(file.name) || ".jpg").toLowerCase();
  const photoPath = `${user.id}/${new Date().toISOString().slice(0, 7)}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
  check(await client.storage.from(PHOTO_BUCKET).upload(photoPath, file, { contentType: file.type }));
  if (thumb) {
    // 썸네일은 없어도 원본으로 대신 보여주므로, 실패해도 저장 자체는 성공으로 둔다
    const { error } = await client.storage.from(PHOTO_BUCKET).upload(thumbPathOf(photoPath), thumb, { contentType: "image/jpeg" });
    if (error) console.error("[savePhoto] thumbnail", error.message);
  }
  return photoPath;
}

function toPantryItem(r: PantryRow): PantryItem {
  return { id: r.id, name: r.name, category: r.category, expiresOn: r.expires_on ?? undefined, addedAt: r.added_at };
}

export async function listPantry(): Promise<PantryItem[]> {
  const rows = check<PantryRow[]>(await (await supabase()).from("pantry_items").select("*").order("added_at"));
  return rows.map(toPantryItem);
}

export async function addPantryItem(item: Pick<PantryItem, "name" | "category" | "expiresOn">): Promise<PantryItem> {
  const row = check<PantryRow>(
    await (await supabase())
      .from("pantry_items")
      .insert({ name: item.name, category: item.category, expires_on: item.expiresOn ?? null })
      .select()
      .single(),
  );
  return toPantryItem(row);
}

export async function removePantryItem(id: string): Promise<void> {
  check(await (await supabase()).from("pantry_items").delete().eq("id", id));
}

type SavedRecipeRow = { id: string; title: string; recipe: Recipe; created_at: string };

function toSavedRecipe(r: SavedRecipeRow): SavedRecipe {
  return { id: r.id, recipe: r.recipe, createdAt: r.created_at };
}

export async function listSavedRecipes(): Promise<SavedRecipe[]> {
  const rows = check<SavedRecipeRow[]>(
    await (await supabase()).from("saved_recipes").select("*").order("created_at", { ascending: false }),
  );
  return rows.map(toSavedRecipe);
}

/** 찜하기. 같은 이름의 레시피를 이미 찜했다면 내용을 새 레시피로 바꾼다. */
export async function saveRecipe(recipe: Recipe): Promise<SavedRecipe> {
  const row = check<SavedRecipeRow>(
    await (await supabase())
      .from("saved_recipes")
      .upsert({ title: recipe.title, recipe }, { onConflict: "household_id,title" })
      .select()
      .single(),
  );
  return toSavedRecipe(row);
}

export async function unsaveRecipe(id: string): Promise<void> {
  check(await (await supabase()).from("saved_recipes").delete().eq("id", id));
}

/** 오늘(한국 시간 기준) 레시피 추천을 몇 번 썼는지 */
export async function countRecipeUsageToday(): Promise<number> {
  const today = todayIn("Asia/Seoul");
  const { count, error } = await (await supabase())
    .from("recipe_usage")
    .select("*", { count: "exact", head: true })
    .gte("created_at", `${today}T00:00:00+09:00`);
  if (error) throw new Error(`Supabase 오류: ${error.message}`);
  return count ?? 0;
}

export async function recordRecipeUsage(): Promise<void> {
  check(await (await supabase()).from("recipe_usage").insert({}));
}

type MyRecipeRow = {
  id: string;
  title: string;
  description: string;
  servings: number;
  cook_time_minutes: number | null;
  ingredients: MyRecipeInput["ingredients"];
  steps: string[];
  tips: string;
  photo_path: string | null;
  nutrition: Nutrition | null;
  created_at: string;
  updated_at: string;
};

function toMyRecipeRow(input: MyRecipeInput) {
  return {
    title: input.title,
    description: input.description,
    servings: input.servings,
    cook_time_minutes: input.cookTimeMinutes,
    ingredients: input.ingredients,
    steps: input.steps,
    tips: input.tips,
    nutrition: input.nutrition,
  };
}

export async function listMyRecipes(): Promise<MyRecipe[]> {
  const client = await supabase();
  const rows = check<MyRecipeRow[]>(await client.from("my_recipes").select("*").order("updated_at", { ascending: false }));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    servings: r.servings,
    cookTimeMinutes: r.cook_time_minutes,
    ingredients: r.ingredients,
    steps: r.steps,
    tips: r.tips,
    nutrition: r.nutrition,
    photoUrl: r.photo_path ? photoUrl(r.photo_path) : null,
    thumbUrl: r.photo_path ? photoUrl(r.photo_path, "thumb") : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createMyRecipe(input: MyRecipeInput, photoPath: string | null): Promise<void> {
  check(await (await supabase()).from("my_recipes").insert({ ...toMyRecipeRow(input), photo_path: photoPath }));
}

/** 수정. newPhotoPath 가 있으면 사진을 바꾸고, removePhoto 면 사진을 지운다. 이전 사진 파일은 저장소에서 삭제한다. */
export async function updateMyRecipe(
  id: string,
  input: MyRecipeInput,
  { newPhotoPath, removePhoto }: { newPhotoPath: string | null; removePhoto: boolean },
): Promise<void> {
  const client = await supabase();
  const { photo_path: oldPath } = check<{ photo_path: string | null }>(
    await client.from("my_recipes").select("photo_path").eq("id", id).single(),
  );
  const photoChanged = Boolean(newPhotoPath) || removePhoto;

  check(
    await client
      .from("my_recipes")
      .update({
        ...toMyRecipeRow(input),
        ...(photoChanged ? { photo_path: newPhotoPath } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id),
  );
  if (photoChanged && oldPath) await client.storage.from(PHOTO_BUCKET).remove([oldPath, thumbPathOf(oldPath)]);
}

export async function deleteMyRecipe(id: string): Promise<void> {
  const client = await supabase();
  const { data } = await client.from("my_recipes").select("photo_path").eq("id", id).single();
  check(await client.from("my_recipes").delete().eq("id", id));
  if (data?.photo_path) await client.storage.from(PHOTO_BUCKET).remove([data.photo_path, thumbPathOf(data.photo_path)]);
}

type MealPlanRow = {
  id: string;
  plan_date: string;
  slot: MealSlot;
  title: string;
  recipe: Recipe | null;
  my_recipe_id: string | null;
  meal_id: string | null;
  created_at: string;
};

const SLOT_ORDER: Record<MealSlot, number> = { 아침: 0, 점심: 1, 저녁: 2 };

function toMealPlan(r: MealPlanRow): MealPlan {
  return {
    id: r.id,
    date: r.plan_date,
    slot: r.slot,
    title: r.title,
    recipe: r.recipe ?? undefined,
    myRecipeId: r.my_recipe_id ?? null,
    mealId: r.meal_id,
    createdAt: r.created_at,
  };
}

/** from~to(양 끝 포함) 기간의 식단. 날짜 → 아침·점심·저녁 순 */
export async function listPlans(range: { from: string; to: string }): Promise<MealPlan[]> {
  const rows = check<MealPlanRow[]>(
    await (await supabase())
      .from("meal_plans")
      .select("*")
      .gte("plan_date", range.from)
      .lte("plan_date", range.to)
      .order("plan_date")
      .order("created_at"),
  );
  return rows.map(toMealPlan).sort((a, b) => a.date.localeCompare(b.date) || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
}

export async function addPlan(plan: PlanInput): Promise<MealPlan> {
  const row = check<MealPlanRow>(
    await (await supabase())
      .from("meal_plans")
      .insert({
        plan_date: plan.date,
        slot: plan.slot,
        title: plan.recipe?.title ?? plan.title,
        recipe: plan.recipe ?? null,
        // 6번 SQL 전에도 동작하도록 내 레시피일 때만 컬럼을 보낸다
        ...(plan.myRecipeId ? { my_recipe_id: plan.myRecipeId } : {}),
      })
      .select()
      .single(),
  );
  return toMealPlan(row);
}

export async function updatePlan(id: string, patch: { date?: string; slot?: MealSlot; mealId?: string | null }): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.date) update.plan_date = patch.date;
  if (patch.slot) update.slot = patch.slot;
  if (patch.mealId !== undefined) update.meal_id = patch.mealId;
  check(await (await supabase()).from("meal_plans").update(update).eq("id", id));
}

export async function deletePlan(id: string): Promise<void> {
  check(await (await supabase()).from("meal_plans").delete().eq("id", id));
}

// ── 우리집 (함께 쓰기) ────────────────────────────────────────────────

/** 구글 이름에 섞여 오는 보이지 않는 문자(소프트 하이픈, 제로폭 공백 등)를 지운다 */
function cleanName(name: string | null | undefined): string {
  return (name ?? "").replace(/[\u00AD\u200B-\u200F\u2060\uFEFF]/g, "").trim();
}

/** 지금 내가 속한 집, 멤버, 아직 유효한 초대 링크 */
export async function getHousehold(): Promise<Household> {
  const client = await supabase();
  const user = await currentUser(client);
  if (!user) throw new Error("로그인이 필요해요.");
  const [{ data: h, error: e1 }, { data: members, error: e2 }, { data: invites, error: e3 }] = await Promise.all([
    client.from("households").select("id, name").single(),
    client.from("household_members").select("user_id, display_name, avatar_url, joined_at").order("joined_at"),
    client.from("household_invites").select("code, expires_at").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
  ]);
  const error = e1 ?? e2 ?? e3;
  if (error) throw new Error(`Supabase 오류: ${error.message}`);
  return {
    id: h!.id,
    name: h!.name,
    me: user.id,
    members: (members ?? []).map((m) => ({
      userId: m.user_id,
      name: cleanName(m.display_name) || "이름 없음",
      avatarUrl: m.avatar_url ?? null,
      joinedAt: m.joined_at,
    })),
    invites: (invites ?? []).map((i) => ({ code: i.code, expiresAt: i.expires_at })),
  };
}

export async function renameHousehold(name: string): Promise<void> {
  const client = await supabase();
  const { data: h } = await client.from("households").select("id").single();
  if (!h) throw new Error("우리집 정보를 찾지 못했어요.");
  check(await client.from("households").update({ name }).eq("id", h.id));
}

/** 7일 동안 쓸 수 있는 초대 코드 (추측하기 어려운 12자리) */
export async function createInvite(): Promise<{ code: string; expiresAt: string }> {
  const client = await supabase();
  const { data: h } = await client.from("households").select("id").single();
  if (!h) throw new Error("우리집 정보를 찾지 못했어요.");
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"; // 헷갈리는 글자(l, o, 0, 1) 제외
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  const row = check<{ code: string; expires_at: string }>(
    await client.from("household_invites").insert({ code, household_id: h.id }).select("code, expires_at").single(),
  );
  return { code: row.code, expiresAt: row.expires_at };
}

export async function getInviteInfo(code: string): Promise<InviteInfo | null> {
  const { data, error } = await (await supabase()).rpc("invite_info", { invite_code: code });
  if (error) throw new Error(`Supabase 오류: ${error.message}`);
  const row = (data as Array<Record<string, unknown>> | null)?.[0];
  if (!row) return null;
  return {
    householdName: String(row.household_name),
    inviterName: cleanName(row.inviter_name as string | null) || "친구",
    memberCount: Number(row.member_count),
    expired: Boolean(row.expired),
    alreadyMember: Boolean(row.already_member),
    iAmAlone: Boolean(row.i_am_alone),
  };
}

export async function joinHousehold(code: string): Promise<void> {
  const { error } = await (await supabase()).rpc("join_household", { invite_code: code });
  if (error) {
    if (error.message.includes("invalid_invite")) throw new Error("초대 링크가 만료됐거나 잘못됐어요. 새 링크를 받아 주세요.");
    throw new Error(`Supabase 오류: ${error.message}`);
  }
}

export async function leaveHousehold(): Promise<void> {
  const { error } = await (await supabase()).rpc("leave_household");
  if (error) {
    if (error.message.includes("alone")) throw new Error("혼자 쓰는 집에서는 나갈 수 없어요.");
    throw new Error(`Supabase 오류: ${error.message}`);
  }
}
