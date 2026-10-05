import path from "path";
import { todayIn } from "./dates";
import { currentUser, PHOTO_BUCKET, supabase } from "./supabase";
import type { Meal, MealPlan, MealSlot, MyRecipe, MyRecipeInput, Nutrition, PantryCategory, PantryItem, Recipe, SavedRecipe } from "./types";

// 저장소: Supabase (Postgres 테이블 pantry_items, meals, recipe_usage + Storage 버킷 photos)
// 스키마는 supabase/*.sql 참고. DB 컬럼은 snake_case, 앱 타입은 camelCase 라서 여기서 변환한다.
// 모든 요청은 로그인한 사용자의 세션으로 나가고, RLS 정책이 그 사용자의 데이터만 보이게 한다.
// insert 할 때 user_id 는 DB 기본값(auth.uid())으로 자동으로 채워진다.

const PHOTO_URL_TTL_SECONDS = 60 * 60;

type MealRow = {
  id: string;
  title: string;
  memo: string;
  date: string;
  photo_path: string;
  recipe: Recipe | null;
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

  // 비공개 버킷이라 사진마다 일정 시간 유효한 서명 URL을 붙여서 내려준다
  const signed = check(await (await supabase()).storage.from(PHOTO_BUCKET).createSignedUrls(rows.map((r) => r.photo_path), PHOTO_URL_TTL_SECONDS));
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    memo: r.memo,
    date: r.date,
    photoUrl: urlByPath.get(r.photo_path) ?? "",
    recipe: r.recipe ?? undefined,
    createdAt: r.created_at,
  }));
}

/** 기록을 저장하고 새 기록의 id 를 돌려준다 */
export async function addMeal(meal: { title: string; memo: string; date: string; photoPath: string; recipe?: Recipe }): Promise<string> {
  const row = check<{ id: string }>(
    await (await supabase())
      .from("meals")
      .insert({
        title: meal.title,
        memo: meal.memo,
        date: meal.date,
        photo_path: meal.photoPath,
        recipe: meal.recipe ?? null,
      })
      .select("id")
      .single(),
  );
  return row.id;
}

export async function savePhoto(file: File): Promise<string> {
  const client = await supabase();
  const user = await currentUser(client);
  if (!user) throw new Error("로그인이 필요해요.");
  // 버킷 정책상 사진은 "{user_id}/..." 폴더에만 올릴 수 있다
  const ext = (path.extname(file.name) || ".jpg").toLowerCase();
  const photoPath = `${user.id}/${new Date().toISOString().slice(0, 7)}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
  check(await client.storage.from(PHOTO_BUCKET).upload(photoPath, file, { contentType: file.type }));
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
      .upsert({ title: recipe.title, recipe }, { onConflict: "user_id,title" })
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

  const paths = rows.map((r) => r.photo_path).filter((p): p is string => Boolean(p));
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const signed = check(await client.storage.from(PHOTO_BUCKET).createSignedUrls(paths, PHOTO_URL_TTL_SECONDS));
    signed.forEach((s) => s.path && s.signedUrl && urlByPath.set(s.path, s.signedUrl));
  }

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
    photoUrl: r.photo_path ? (urlByPath.get(r.photo_path) ?? null) : null,
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
  if (photoChanged && oldPath) await client.storage.from(PHOTO_BUCKET).remove([oldPath]);
}

export async function deleteMyRecipe(id: string): Promise<void> {
  const client = await supabase();
  const { data } = await client.from("my_recipes").select("photo_path").eq("id", id).single();
  check(await client.from("my_recipes").delete().eq("id", id));
  if (data?.photo_path) await client.storage.from(PHOTO_BUCKET).remove([data.photo_path]);
}

type MealPlanRow = {
  id: string;
  plan_date: string;
  slot: MealSlot;
  title: string;
  recipe: Recipe | null;
  meal_id: string | null;
  created_at: string;
};

const SLOT_ORDER: Record<MealSlot, number> = { 아침: 0, 점심: 1, 저녁: 2 };

function toMealPlan(r: MealPlanRow): MealPlan {
  return { id: r.id, date: r.plan_date, slot: r.slot, title: r.title, recipe: r.recipe ?? undefined, mealId: r.meal_id, createdAt: r.created_at };
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

export async function addPlan(plan: { date: string; slot: MealSlot; recipe: Recipe }): Promise<MealPlan> {
  const row = check<MealPlanRow>(
    await (await supabase())
      .from("meal_plans")
      .insert({ plan_date: plan.date, slot: plan.slot, title: plan.recipe.title, recipe: plan.recipe })
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
