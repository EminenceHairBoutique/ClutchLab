import type { DrillRecord } from "@clutchlab/content";

/**
 * Deterministic daily-plan generator (spec §5.10): fills a minute budget from
 * the drill catalog, spreading across the requested focus categories, easier
 * drills first. Pure and unit-tested; personalization deepens as tracked
 * results accumulate (weakness weighting arrives with more history).
 */

export interface GeneratePlanInput {
  minutes: 5 | 10 | 15 | 30 | 45 | 60;
  /** Skill categories to focus on; empty = spread across all. */
  focusCategories: string[];
  /** 'off' selects the aim-assist-off variants where a drill has them. */
  aimAssist: "on" | "off" | "mixed";
  /** Drill slugs recently passed at advanced level — deprioritized for variety. */
  masteredSlugs?: string[];
}

export interface GeneratedPlanItem {
  drill: DrillRecord;
  minutes: number;
}

export interface GeneratedPlan {
  items: GeneratedPlanItem[];
  totalMinutes: number;
  notes: string[];
}

const DIFFICULTY_ORDER = { beginner: 0, intermediate: 1, advanced: 2 } as const;

export function generatePlan(
  drills: readonly DrillRecord[],
  skillCategoryBySlug: ReadonlyMap<string, string>,
  input: GeneratePlanInput,
): GeneratedPlan {
  const notes: string[] = [];
  const mastered = new Set(input.masteredSlugs ?? []);

  let pool = drills.filter((d) => {
    if (input.aimAssist === "off" && d.aimAssistVariant === "on") return false;
    if (input.aimAssist === "on" && d.aimAssistVariant === "off") return false;
    return true;
  });

  if (input.focusCategories.length > 0) {
    const focused = pool.filter((d) =>
      input.focusCategories.includes(skillCategoryBySlug.get(d.skillSlug) ?? ""),
    );
    if (focused.length > 0) {
      pool = focused;
    } else {
      notes.push("No drills matched the requested focus — using the full catalog.");
    }
  }

  // Deterministic order: unmastered first, then difficulty, then slug.
  const sorted = [...pool].sort((a, b) => {
    const masteredDelta = Number(mastered.has(a.slug)) - Number(mastered.has(b.slug));
    if (masteredDelta !== 0) return masteredDelta;
    const difficultyDelta = DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
    if (difficultyDelta !== 0) return difficultyDelta;
    return a.slug.localeCompare(b.slug);
  });

  const items: GeneratedPlanItem[] = [];
  const usedCategories = new Map<string, number>();
  let remaining = input.minutes;

  // Round-robin across categories so a 30-minute block isn't 6 tracking drills.
  while (remaining >= 3) {
    const next = sorted.find((d) => {
      if (items.some((i) => i.drill.slug === d.slug)) return false;
      if (d.durationMinutes > remaining) return false;
      const category = skillCategoryBySlug.get(d.skillSlug) ?? "other";
      const used = usedCategories.get(category) ?? 0;
      const minUsed = Math.min(0, ...[...usedCategories.values()]);
      return used <= minUsed + 1;
    });
    if (!next) break;
    items.push({ drill: next, minutes: next.durationMinutes });
    remaining -= next.durationMinutes;
    const category = skillCategoryBySlug.get(next.skillSlug) ?? "other";
    usedCategories.set(category, (usedCategories.get(category) ?? 0) + 1);
  }

  if (items.length === 0) {
    notes.push("Budget too small for any drill — the 5-minute warmup plan is a better fit.");
  }
  if (input.aimAssist === "off") {
    notes.push("Aim-assist-off variants selected where available (Ultimate Royale preparation).");
  }

  return {
    items,
    totalMinutes: items.reduce((sum, item) => sum + item.minutes, 0),
    notes,
  };
}
