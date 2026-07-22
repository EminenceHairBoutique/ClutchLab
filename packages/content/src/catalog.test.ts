import { describe, expect, it } from "vitest";

import { CONTENT_BASELINE, computeBaselineTiers } from "./baseline";
import {
  attachmentRecordSchema,
  claimRecordSchema,
  gameVersionRecordSchema,
  mapRecordSchema,
  modeRecordSchema,
  patchRecordSchema,
  reviewTaskRecordSchema,
  seasonRecordSchema,
  sourceRecordSchema,
  weaponRecordSchema,
} from "./schemas";

const B = CONTENT_BASELINE;

describe("catalog validity", () => {
  it("every record passes its zod schema", () => {
    expect(() => gameVersionRecordSchema.parse(B.version)).not.toThrow();
    expect(() => patchRecordSchema.parse(B.patch)).not.toThrow();
    for (const s of B.seasons) expect(() => seasonRecordSchema.parse(s)).not.toThrow();
    for (const m of B.modes) expect(() => modeRecordSchema.parse(m)).not.toThrow();
    for (const m of B.maps) expect(() => mapRecordSchema.parse(m)).not.toThrow();
    for (const w of B.weapons) expect(() => weaponRecordSchema.parse(w)).not.toThrow();
    for (const a of B.attachments) expect(() => attachmentRecordSchema.parse(a)).not.toThrow();
    for (const s of B.sources) expect(() => sourceRecordSchema.parse(s)).not.toThrow();
    for (const c of B.claims) expect(() => claimRecordSchema.parse(c)).not.toThrow();
    for (const t of B.reviewTasks) expect(() => reviewTaskRecordSchema.parse(t)).not.toThrow();
  });

  it("never labels seed data as verified (spec §0.1.8)", () => {
    const statuses = [
      B.version.dataStatus,
      B.patch.dataStatus,
      ...B.patch.changes.map((c) => c.dataStatus),
      ...B.seasons.map((s) => s.dataStatus),
      ...B.modes.map((m) => m.dataStatus),
      ...B.maps.map((m) => m.dataStatus),
      ...B.weapons.map((w) => w.dataStatus),
      ...B.attachments.map((a) => a.dataStatus),
      ...B.claims.map((c) => c.dataStatus),
    ];
    expect(statuses.every((s) => s === "unverified" || s === "sample")).toBe(true);
  });

  it("every record carries a source name (spec §2.2)", () => {
    const sourced = [B.version, B.patch, ...B.seasons, ...B.modes, ...B.maps, ...B.weapons, ...B.attachments];
    for (const record of sourced) {
      expect(record.sourceName, JSON.stringify(record).slice(0, 80)).toBeTruthy();
    }
  });

  it("covers the full spec §5.3 required weapon list", () => {
    const required = [
      "ace32", "m416", "aug", "m762", "akm", "scarl", "ump45", "vector", "uzi", "mp5k",
      "p90", "dbs", "m1014", "s12k", "mini14", "mk12", "slr", "sks", "awm", "amr",
      "m24", "kar98k", "groza", "mg3", "dp28",
    ];
    const slugs = new Set(B.weapons.map((w) => w.slug));
    for (const slug of required) {
      expect(slugs.has(slug), `missing required weapon ${slug}`).toBe(true);
    }
  });

  it("weapon slugs and attachment slugs are unique", () => {
    const w = B.weapons.map((x) => x.slug);
    const a = B.attachments.map((x) => x.slug);
    expect(new Set(w).size).toBe(w.length);
    expect(new Set(a).size).toBe(a.length);
  });

  it("claims reference existing sources only", () => {
    const keys = new Set(B.sources.map((s) => s.key));
    for (const claim of B.claims) {
      for (const e of claim.evidence) {
        expect(keys.has(e.sourceKey), `claim ${claim.slug} → ${e.sourceKey}`).toBe(true);
      }
    }
  });

  it("required 4.5 evaluations exist: ACE32 change note and SMG class notes", () => {
    const ace = B.weapons.find((w) => w.slug === "ace32");
    expect(ace?.changeNote).toMatch(/recoil/i);
    const smgs = B.weapons.filter((w) => w.class === "smg");
    expect(smgs.length).toBeGreaterThanOrEqual(5);
    for (const smg of smgs) {
      expect(smg.changeNote, `${smg.slug} missing 4.5 class note`).toMatch(/C5/);
    }
  });
});

describe("phase 3 catalog", () => {
  it("ships at least 30 settings explainers (spec §21)", async () => {
    const { SETTING_EXPLAINERS, settingExplainerSchema } = await import("./catalog/settings");
    expect(SETTING_EXPLAINERS.length).toBeGreaterThanOrEqual(30);
    for (const s of SETTING_EXPLAINERS) {
      expect(() => settingExplainerSchema.parse(s)).not.toThrow();
    }
    const slugs = SETTING_EXPLAINERS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("ships at least 10 pro profiles, all explicitly fictional samples", async () => {
    const { SAMPLE_PROS, proProfileSchema } = await import("./catalog/pros");
    expect(SAMPLE_PROS.length).toBeGreaterThanOrEqual(10);
    for (const p of SAMPLE_PROS) {
      expect(() => proProfileSchema.parse(p)).not.toThrow();
      expect(p.slug.startsWith("sample-"), p.slug).toBe(true);
      expect(p.notes).toMatch(/fictional/i);
      for (const value of p.values) {
        expect(value.value).toBeGreaterThanOrEqual(1);
        expect(value.value).toBeLessThanOrEqual(300);
      }
    }
  });

  it("pro team references resolve to sample teams", async () => {
    const { SAMPLE_PROS, SAMPLE_TEAMS } = await import("./catalog/pros");
    const teamSlugs = new Set(SAMPLE_TEAMS.map((t) => t.slug));
    for (const p of SAMPLE_PROS) {
      if (p.teamSlug) expect(teamSlugs.has(p.teamSlug), p.slug).toBe(true);
    }
  });

  it("pro preferred weapons reference the real weapon catalog", async () => {
    const { SAMPLE_PROS } = await import("./catalog/pros");
    const weaponSlugs = new Set(B.weapons.map((w) => w.slug));
    for (const p of SAMPLE_PROS) {
      for (const weapon of p.preferredWeapons) {
        expect(weaponSlugs.has(weapon), `${p.slug} → ${weapon}`).toBe(true);
      }
    }
  });
});

describe("phase 4 training catalog", () => {
  it("ships at least 40 drills covering the required structure (spec §21, §5.10)", async () => {
    const { DRILLS, drillSchema } = await import("./catalog/training");
    expect(DRILLS.length).toBeGreaterThanOrEqual(40);
    for (const d of DRILLS) {
      expect(() => drillSchema.parse(d), d.slug).not.toThrow();
    }
    const slugs = DRILLS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("drills reference existing skills and progressions", async () => {
    const { DRILLS, SKILLS } = await import("./catalog/training");
    const skillSlugs = new Set(SKILLS.map((s) => s.slug));
    const drillSlugs = new Set(DRILLS.map((d) => d.slug));
    for (const d of DRILLS) {
      expect(skillSlugs.has(d.skillSlug), `${d.slug} → skill ${d.skillSlug}`).toBe(true);
      if (d.progressionSlug) {
        expect(drillSlugs.has(d.progressionSlug), `${d.slug} → ${d.progressionSlug}`).toBe(true);
      }
    }
  });

  it("includes the aim-assist A/B pairs (spec §5.6 decision lab)", async () => {
    const { DRILLS } = await import("./catalog/training");
    const on = DRILLS.filter((d) => d.aimAssistVariant === "on");
    const off = DRILLS.filter((d) => d.aimAssistVariant === "off");
    expect(on.length).toBeGreaterThanOrEqual(2);
    expect(off.length).toBeGreaterThanOrEqual(2);
  });

  it("ships at least 10 plans whose items reference real drills and fit their budget", async () => {
    const { DRILLS, TRAINING_PLANS, planSchema } = await import("./catalog/training");
    expect(TRAINING_PLANS.length).toBeGreaterThanOrEqual(10);
    const drillSlugs = new Set(DRILLS.map((d) => d.slug));
    for (const plan of TRAINING_PLANS) {
      expect(() => planSchema.parse(plan), plan.slug).not.toThrow();
      const total = plan.items.reduce((sum, item) => sum + item.minutes, 0);
      expect(total, `${plan.slug} minutes`).toBeLessThanOrEqual(plan.minutes);
      expect(total, `${plan.slug} minutes`).toBeGreaterThanOrEqual(plan.minutes - 5);
      for (const item of plan.items) {
        expect(drillSlugs.has(item.drillSlug), `${plan.slug} → ${item.drillSlug}`).toBe(true);
      }
    }
  });

  it("WoW directory entries never carry invented map codes", async () => {
    const { WOW_MAPS } = await import("./catalog/training");
    expect(WOW_MAPS.length).toBeGreaterThanOrEqual(6);
    for (const map of WOW_MAPS) {
      expect(map.mapCode, map.slug).toBeNull();
      expect(map.slug.startsWith("sample-"), map.slug).toBe(true);
    }
  });
});

describe("baseline tiers", () => {
  const rows = computeBaselineTiers();

  it("produces a tier for every tierable weapon in every snapshot mode", () => {
    expect(rows).toHaveLength(B.tierableWeapons.length * B.snapshotModes.length);
  });

  it("every tier result carries the versioned methodology and a breakdown", () => {
    for (const { result } of rows) {
      expect(result.methodology.slug).toBe(B.methodology.slug);
      expect(result.breakdown.length).toBeGreaterThanOrEqual(3);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it("is deterministic (stable seeds and diffs)", () => {
    const again = computeBaselineTiers();
    expect(again).toEqual(rows);
  });

  it("mode context changes outcomes: UR punishes the hardest-recoil AR more than classic", () => {
    const find = (slug: string, mode: string) =>
      rows.find((r) => r.weapon.slug === slug && r.result.modeSlug === mode);
    const m762classic = find("m762", "classic_ranked");
    const m762ur = find("m762", "ultimate_royale");
    expect(m762classic && m762ur).toBeTruthy();
    if (m762classic && m762ur) {
      expect(m762ur.result.score).toBeLessThan(m762classic.result.score);
    }
  });
});
