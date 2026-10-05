import Link from "next/link";

/** 레시피북 상단 탭: 찜한 레시피 / 내 레시피 */
export default function RecipeBookTabs({ active }: { active: "saved" | "mine" }) {
  const tabs = [
    { key: "saved", href: "/saved", label: "♥ 찜한 레시피" },
    { key: "mine", href: "/my-recipes", label: "✍️ 내 레시피" },
  ] as const;
  return (
    <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`flex-1 rounded-lg py-2 text-center text-sm ${active === t.key ? "bg-accent font-semibold text-white" : "text-muted hover:text-foreground"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
