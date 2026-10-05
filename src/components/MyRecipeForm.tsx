"use client";

import { useState } from "react";
import PhotoPicker, { usePhoto } from "@/components/PhotoPicker";
import { MacroBar } from "@/components/RecipeCard";
import { compressImage } from "@/lib/image";
import type { MyRecipe, MyRecipeInput, Nutrition } from "@/lib/types";

type Ingredient = { name: string; amount: string };

const NUTRITION_FIELDS: { key: keyof Nutrition; label: string; unit: string }[] = [
  { key: "calories", label: "칼로리", unit: "kcal" },
  { key: "carbsG", label: "탄수화물", unit: "g" },
  { key: "proteinG", label: "단백질", unit: "g" },
  { key: "fatG", label: "지방", unit: "g" },
];

/** 내 레시피 작성·수정 폼. editing 이 있으면 수정 모드 */
export default function MyRecipeForm({
  editing,
  onSaved,
  onCancel,
}: {
  editing?: MyRecipe;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [servings, setServings] = useState(editing?.servings ?? 1);
  const [cookTime, setCookTime] = useState(editing?.cookTimeMinutes?.toString() ?? "");
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    editing?.ingredients.length ? editing.ingredients : [{ name: "", amount: "" }],
  );
  const [steps, setSteps] = useState<string[]>(editing?.steps.length ? editing.steps : [""]);
  const [tips, setTips] = useState(editing?.tips ?? "");
  const [nutrition, setNutrition] = useState<Partial<Record<keyof Nutrition, string>>>(
    editing?.nutrition ? Object.fromEntries(Object.entries(editing.nutrition).map(([k, v]) => [k, String(Math.round(v))])) : {},
  );
  const [nutritionNote, setNutritionNote] = useState("");
  const photo = usePhoto(editing?.photoUrl ?? null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filledIngredients = ingredients.filter((i) => i.name.trim());

  // 네 칸이 모두 채워졌을 때만 영양 정보로 저장한다
  const nutritionValue: Nutrition | null = NUTRITION_FIELDS.every((f) => nutrition[f.key]?.trim())
    ? (Object.fromEntries(NUTRITION_FIELDS.map((f) => [f.key, Number(nutrition[f.key])])) as Nutrition)
    : null;

  function updateIngredient(i: number, patch: Partial<Ingredient>) {
    setIngredients((list) => list.map((item, j) => (j === i ? { ...item, ...patch } : item)));
  }

  async function estimate() {
    setEstimating(true);
    setError("");
    try {
      const res = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "내 요리", servings, ingredients: filledIngredients }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const { note, ...values } = data.nutrition as Nutrition & { note: string };
      setNutrition(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(Math.round(v))])));
      setNutritionNote(note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "영양 성분을 계산하지 못했어요.");
    } finally {
      setEstimating(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const input: MyRecipeInput = {
      title,
      description,
      servings,
      cookTimeMinutes: cookTime ? Number(cookTime) : null,
      ingredients: filledIngredients,
      steps: steps.filter((s) => s.trim()),
      tips,
      nutrition: nutritionValue,
    };
    const form = new FormData();
    form.set("data", JSON.stringify(input));
    if (photo.file) form.set("photo", await compressImage(photo.file));
    else if (removePhoto) form.set("removePhoto", "1");

    const res = await fetch(editing ? `/api/my-recipes/${editing.id}` : "/api/my-recipes", {
      method: editing ? "PATCH" : "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({ error: "저장하지 못했어요." }));
    setSaving(false);
    if (!res.ok) return setError(data.error);
    onSaved();
  }

  return (
    <form onSubmit={submit} className="card space-y-5">
      <h2 className="text-lg font-bold">{editing ? "레시피 수정" : "새 레시피"}</h2>

      <PhotoPicker
        preview={photo.preview}
        onPick={(f) => {
          photo.pick(f);
          setRemovePhoto(false);
        }}
        emptyText="완성 사진 (선택)"
      />
      {photo.preview && (
        <button
          type="button"
          className="text-xs text-muted underline"
          onClick={() => {
            photo.pick(null);
            setRemovePhoto(true);
          }}
        >
          사진 빼기
        </button>
      )}

      <div className="space-y-2">
        <input className="input !py-3 !text-base" placeholder="레시피 이름 (예: 엄마표 된장찌개)" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea className="input min-h-16" placeholder="한 줄 소개 (선택)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted">인분</span>
            <input type="number" min={1} max={20} className="input" value={servings} onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted">조리 시간(분)</span>
            <input type="number" min={1} max={600} className="input" placeholder="선택" value={cookTime} onChange={(e) => setCookTime(e.target.value)} />
          </label>
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">재료</h3>
        {ingredients.map((ing, i) => (
          <div key={i} className="flex gap-2">
            <input className="input flex-[2]" placeholder="재료 (예: 두부)" value={ing.name} onChange={(e) => updateIngredient(i, { name: e.target.value })} />
            <input className="input flex-1" placeholder="양 (예: 1/2모)" value={ing.amount} onChange={(e) => updateIngredient(i, { amount: e.target.value })} />
            <button
              type="button"
              aria-label="재료 삭제"
              className="w-9 shrink-0 rounded-lg text-muted hover:bg-line"
              onClick={() => setIngredients((list) => (list.length > 1 ? list.filter((_, j) => j !== i) : [{ name: "", amount: "" }]))}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="text-sm text-accent" onClick={() => setIngredients((list) => [...list, { name: "", amount: "" }])}>
          + 재료 추가
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">만드는 법</h3>
        {steps.map((step, i) => (
          <div key={i} className="flex gap-2">
            <span className="mt-2 w-5 shrink-0 text-right text-sm text-muted">{i + 1}.</span>
            <textarea
              className="input min-h-12"
              placeholder={i === 0 ? "예: 두부를 깍둑썰기 한다" : "다음 단계"}
              value={step}
              onChange={(e) => setSteps((list) => list.map((s, j) => (j === i ? e.target.value : s)))}
            />
            <button
              type="button"
              aria-label="단계 삭제"
              className="w-9 shrink-0 rounded-lg text-muted hover:bg-line"
              onClick={() => setSteps((list) => (list.length > 1 ? list.filter((_, j) => j !== i) : [""]))}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="text-sm text-accent" onClick={() => setSteps((list) => [...list, ""])}>
          + 단계 추가
        </button>
      </section>

      <textarea className="input min-h-16" placeholder="팁·메모 (선택)" value={tips} onChange={(e) => setTips(e.target.value)} />

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">1인분 영양 (선택)</h3>
          <button
            type="button"
            onClick={estimate}
            disabled={estimating || filledIngredients.length === 0}
            className="rounded-lg border border-line px-3 py-1.5 text-xs hover:border-accent disabled:opacity-50"
            title={filledIngredients.length === 0 ? "재료를 먼저 입력해 주세요" : "하루 AI 사용 횟수에 포함돼요"}
          >
            {estimating ? "계산 중…" : "🧮 AI로 계산"}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {NUTRITION_FIELDS.map((f) => (
            <label key={f.key} className="space-y-1 text-xs text-muted">
              <span>
                {f.label}({f.unit})
              </span>
              <input
                type="number"
                min={0}
                className="input"
                value={nutrition[f.key] ?? ""}
                onChange={(e) => setNutrition((n) => ({ ...n, [f.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        {nutritionValue && <MacroBar nutrition={nutritionValue} />}
        {nutritionNote && <p className="text-xs text-muted">AI 추정치예요 · {nutritionNote}</p>}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button className="btn flex-1 !py-3" disabled={saving || !title.trim()}>
          {saving ? "저장 중…" : "저장"}
        </button>
        <button type="button" className="rounded-lg border border-line px-4 py-2 text-sm" onClick={onCancel}>
          취소
        </button>
      </div>
    </form>
  );
}
