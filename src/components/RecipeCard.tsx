import RecipeImages from "@/components/RecipeImages";
import type { Nutrition, Recipe } from "@/lib/types";

export function MacroBar({ nutrition }: { nutrition: Nutrition }) {
  const { carbsG, proteinG, fatG, calories } = nutrition;
  const kcal = { carbs: carbsG * 4, protein: proteinG * 4, fat: fatG * 9 };
  const total = kcal.carbs + kcal.protein + kcal.fat || 1;
  const parts = [
    { key: "carbs", label: "탄수화물", g: carbsG, pct: (kcal.carbs / total) * 100, color: "bg-carbs" },
    { key: "protein", label: "단백질", g: proteinG, pct: (kcal.protein / total) * 100, color: "bg-protein" },
    { key: "fat", label: "지방", g: fatG, pct: (kcal.fat / total) * 100, color: "bg-fat" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-semibold">1인분 영양 (추정)</span>
        <span className="text-muted">{Math.round(calories)} kcal</span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full gap-0.5">
        {parts.map((p) => (
          <div key={p.key} className={p.color} style={{ width: `${p.pct}%` }} />
        ))}
      </div>
      <div className="flex gap-4 text-xs text-muted">
        {parts.map((p) => (
          <span key={p.key} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${p.color}`} />
            {p.label} {Math.round(p.g)}g · {Math.round(p.pct)}%
          </span>
        ))}
      </div>
    </div>
  );
}

/** withImage: 네이버 이미지 검색으로 찾은 참고 사진을 맨 위에 보여준다 (직접 찍은 사진이 있는 기록 화면에서는 끔) */
export default function RecipeCard({ recipe, withImage = false }: { recipe: Recipe; withImage?: boolean }) {
  return (
    <article className="card space-y-5">
      {withImage && <RecipeImages query={recipe.searchKeyword || recipe.title} />}
      <div>
        <h2 className="text-xl font-bold">{recipe.title}</h2>
        <p className="mt-1 text-sm text-muted">{recipe.summary}</p>
        <div className="mt-2 flex gap-2 text-xs">
          <span className="rounded-full border border-line px-2 py-0.5">⏱ {recipe.cookTimeMinutes}분</span>
          <span className="rounded-full border border-line px-2 py-0.5">{recipe.servings}인분</span>
          <span className="rounded-full border border-line px-2 py-0.5">{recipe.difficulty}</span>
        </div>
      </div>

      <MacroBar nutrition={recipe.nutritionPerServing} />
      <p className="text-sm">{recipe.balanceNote}</p>

      <section>
        <h3 className="mb-2 font-semibold">재료</h3>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {recipe.ingredients.map((ing) => (
            <li key={ing.name} className="flex justify-between border-b border-line py-1">
              <span>{ing.name}</span>
              <span className="text-muted">{ing.amount}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 font-semibold">만드는 법</h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          {recipe.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>

      {recipe.tips.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">팁</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {recipe.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
