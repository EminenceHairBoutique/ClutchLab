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
