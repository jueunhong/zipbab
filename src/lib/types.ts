import { z } from "zod";

// 모델이 출력하는 레시피 형식 (structured outputs 로 강제됨)
export const RecipeOutputSchema = z.object({
  title: z.string(),
  // 이미지 검색용 짧은 요리 이름 (예: "김치참치볶음밥과 반숙 계란후라이" → "김치참치볶음밥")
  searchKeyword: z.string(),
  summary: z.string(),
  servings: z.number(),
  cookTimeMinutes: z.number(),
  difficulty: z.enum(["쉬움", "보통"]),
  ingredients: z.array(
    z.object({
      name: z.string(),
      amount: z.string(),
    }),
  ),
  steps: z.array(z.string()),
  nutritionPerServing: z.object({
    calories: z.number(),
    carbsG: z.number(),
    proteinG: z.number(),
    fatG: z.number(),
  }),
  balanceNote: z.string(),
  tips: z.array(z.string()),
});

// 저장된 레시피 검증용 — searchKeyword 가 생기기 전에 찜·기록한 레시피도 받아준다
export const RecipeSchema = RecipeOutputSchema.partial({ searchKeyword: true });

export type Recipe = z.infer<typeof RecipeSchema>;

export type RecipeRequest = {
  ingredients?: string;
  seasonings?: string;
  maxMinutes?: number;
  servings?: number;
  notes?: string;
  avoid?: string[];
};

export const PANTRY_CATEGORIES = ["냉장", "냉동", "실온", "양념"] as const;
export type PantryCategory = (typeof PANTRY_CATEGORIES)[number];

export type PantryItem = {
  id: string;
  name: string;
  category: PantryCategory;
  expiresOn?: string;
  addedAt: string;
};

export const NutritionSchema = z.object({
  calories: z.number(),
  carbsG: z.number(),
  proteinG: z.number(),
  fatG: z.number(),
});
export type Nutrition = z.infer<typeof NutritionSchema>;

// 내 레시피 입력값 검증 (작성·수정 폼 → API)
export const MyRecipeInputSchema = z.object({
  title: z.string().trim().min(1, "레시피 이름을 입력해 주세요.").max(100),
  description: z.string().trim().max(500).default(""),
  servings: z.number().int().min(1).max(20).default(1),
  cookTimeMinutes: z.number().int().min(1).max(600).nullable().default(null),
  ingredients: z
    .array(z.object({ name: z.string().trim().max(50), amount: z.string().trim().max(50) }))
    .max(50)
    .transform((list) => list.filter((i) => i.name)),
  steps: z
    .array(z.string().trim().max(500))
    .max(30)
    .transform((list) => list.filter(Boolean)),
  tips: z.string().trim().max(1000).default(""),
  nutrition: NutritionSchema.nullable().default(null),
});
export type MyRecipeInput = z.infer<typeof MyRecipeInputSchema>;

export type MyRecipe = MyRecipeInput & {
  id: string;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export const MEAL_SLOTS = ["아침", "점심", "저녁"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않아요.");

export const PlanInputSchema = z.object({
  date: DateString,
  slot: z.enum(MEAL_SLOTS).default("저녁"),
  recipe: RecipeSchema,
});

export const PlanUpdateSchema = z.object({
  date: DateString.optional(),
  slot: z.enum(MEAL_SLOTS).optional(),
});

export type MealPlan = {
  id: string;
  date: string;
  slot: MealSlot;
  title: string;
  recipe?: Recipe;
  mealId: string | null;
  createdAt: string;
};

export type SavedRecipe = {
  id: string;
  recipe: Recipe;
  createdAt: string;
};

export type Meal = {
  id: string;
  title: string;
  memo: string;
  date: string;
  photoUrl: string;
  recipe?: Recipe;
  createdAt: string;
};
