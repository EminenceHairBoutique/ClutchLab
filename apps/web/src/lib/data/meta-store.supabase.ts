import "server-only";

import { z } from "zod";

import { createServerSupabase } from "@/lib/auth/supabase-server";

import type {
  MetaStore,
  ModeOption,
  ScoreLine,
  TierBoard,
  TierEntry,
  VersionIntel,
  WeaponDetail,
  WeaponSummary,
} from "./meta-store";

/** Live database implementation. All reads run under the caller's session (RLS). */

const breakdownSchema = z.array(z.object({ label: z.string(), points: z.number() }));
const componentsSchema = z.object({ breakdown: breakdownSchema.optional() }).passthrough();
const rangeProfileSchema = z.object({
  close: z.number(),
  mid: z.number(),
  long: z.number(),
});

function parseBreakdown(components: unknown): ScoreLine[] {
  const parsed = componentsSchema.safeParse(components);
  return parsed.success && parsed.data.breakdown ? parsed.data.breakdown : [];
}

function parseRangeProfile(value: unknown): TierEntry["rangeProfile"] {
  const parsed = rangeProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export class SupabaseMetaStore implements MetaStore {
  readonly provenance = "database" as const;

  async getVersionIntel(): Promise<VersionIntel> {
    const supabase = await createServerSupabase();
    const { data: version, error: versionError } = await supabase
      .from("game_versions")
      .select("*")
      .order("released_on", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (versionError) throw new Error(`game_versions read failed: ${versionError.message}`);
    if (!version) return { provenance: this.provenance, version: null, seasons: [], changes: [] };

    const [seasonsRes, patchesRes] = await Promise.all([
      supabase
        .from("seasons")
        .select("*")
        .eq("game_version_id", version.id)
        .order("starts_at", { ascending: true, nullsFirst: false }),
      supabase.from("patches").select("id").eq("game_version_id", version.id),
    ]);
    if (seasonsRes.error) throw new Error(`seasons read failed: ${seasonsRes.error.message}`);
    if (patchesRes.error) throw new Error(`patches read failed: ${patchesRes.error.message}`);

    const patchIds = patchesRes.data.map((p) => p.id);
    const changes =
      patchIds.length > 0
        ? await supabase.from("patch_changes").select("*").in("patch_id", patchIds)
        : { data: [], error: null };
    if (changes.error) throw new Error(`patch_changes read failed: ${changes.error.message}`);

    return {
      provenance: this.provenance,
      version: {
        version: version.version,
        releasedOn: version.released_on,
        windowEnd: version.window_end,
        headline: version.headline,
        dataStatus: version.data_status,
        confidence: version.confidence,
        sourceName: version.source_name,
        sourceUrl: version.source_url,
      },
      seasons: seasonsRes.data.map((s) => ({
        slug: s.slug,
        name: s.name,
        kind: s.kind,
        startsAt: s.starts_at,
        endsAt: s.ends_at,
        dataStatus: s.data_status,
        confidence: s.confidence,
        notes: s.notes,
      })),
      changes: (changes.data ?? []).map((c) => ({
        summary: c.summary,
        detail: c.detail,
        changeType: c.change_type,
        area: c.area,
        targetSlug: c.target_slug,
        confidence: c.confidence,
        dataStatus: c.data_status,
      })),
    };
  }

  private async latestPublishedSnapshot() {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("meta_snapshots")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`meta_snapshots read failed: ${error.message}`);
    return data;
  }

  async listTierModes(): Promise<ModeOption[]> {
    const supabase = await createServerSupabase();
    const snapshot = await this.latestPublishedSnapshot();
    if (!snapshot) return [];
    const { data: tierModes, error } = await supabase
      .from("weapon_tiers")
      .select("mode_slug")
      .eq("snapshot_id", snapshot.id);
    if (error) throw new Error(`weapon_tiers read failed: ${error.message}`);
    const slugs = [...new Set(tierModes.map((t) => t.mode_slug))];
    if (slugs.length === 0) return [];
    const { data: modes, error: modesError } = await supabase
      .from("modes")
      .select("slug, name, aim_assist_allowed")
      .in("slug", slugs);
    if (modesError) throw new Error(`modes read failed: ${modesError.message}`);
    return modes.map((m) => ({
      slug: m.slug,
      name: m.name,
      aimAssistAllowed: m.aim_assist_allowed,
    }));
  }

  async getTierBoard(modeSlug: string): Promise<TierBoard | null> {
    const supabase = await createServerSupabase();
    const snapshot = await this.latestPublishedSnapshot();
    if (!snapshot) return null;

    const [modeRes, tiersRes, methodologyRes] = await Promise.all([
      supabase.from("modes").select("slug, name").eq("slug", modeSlug).maybeSingle(),
      supabase
        .from("weapon_tiers")
        .select("*")
        .eq("snapshot_id", snapshot.id)
        .eq("mode_slug", modeSlug),
      supabase
        .from("tier_methodologies")
        .select("slug, version, name")
        .eq("id", snapshot.methodology_id)
        .maybeSingle(),
    ]);
    if (modeRes.error) throw new Error(`modes read failed: ${modeRes.error.message}`);
    if (!modeRes.data) return null;
    if (tiersRes.error) throw new Error(`weapon_tiers read failed: ${tiersRes.error.message}`);
    if (tiersRes.data.length === 0) return null;

    const weaponSlugs = tiersRes.data.map((t) => t.weapon_slug);
    const { data: weapons, error: weaponsError } = await supabase
      .from("weapons")
      .select("slug, name, class, availability, description")
      .in("slug", weaponSlugs);
    if (weaponsError) throw new Error(`weapons read failed: ${weaponsError.message}`);
    const weaponsBySlug = new Map(weapons.map((w) => [w.slug, w]));

    const tierOrder = ["S", "A", "B", "C", "D", "F"];
    const entries: TierEntry[] = tiersRes.data
      .map((t) => {
        const weapon = weaponsBySlug.get(t.weapon_slug);
        return {
          weaponSlug: t.weapon_slug,
          weaponName: weapon?.name ?? t.weapon_slug,
          weaponClass: weapon?.class ?? "other",
          availability: weapon?.availability ?? "ground_loot",
          description: weapon?.description ?? null,
          tier: t.tier,
          score: t.score,
          breakdown: parseBreakdown(t.components),
          rangeProfile: parseRangeProfile(t.range_profile),
          difficulty: t.difficulty,
          confidence: t.confidence,
          evidenceNote: t.evidence_note,
          changeNote: t.change_note,
          dataStatus: t.data_status,
        } satisfies TierEntry;
      })
      .sort(
        (a, b) =>
          tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier) ||
          (b.score ?? 0) - (a.score ?? 0),
      );

    return {
      provenance: this.provenance,
      modeSlug,
      modeName: modeRes.data.name,
      snapshotSlug: snapshot.slug,
      snapshotNotes: snapshot.notes,
      methodology: methodologyRes.error ? null : (methodologyRes.data ?? null),
      entries,
    };
  }

  async listWeapons(): Promise<WeaponSummary[]> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("weapons")
      .select("*")
      .neq("data_status", "sample")
      .order("class")
      .order("name");
    if (error) throw new Error(`weapons read failed: ${error.message}`);

    const { data: versionNotes, error: notesError } = await supabase
      .from("weapon_versions")
      .select("weapon_slug, change_note");
    if (notesError) throw new Error(`weapon_versions read failed: ${notesError.message}`);
    const noteBySlug = new Map(versionNotes.map((n) => [n.weapon_slug, n.change_note]));

    return data.map((w) => ({
      slug: w.slug,
      name: w.name,
      weaponClass: w.class,
      ammo: w.ammo,
      availability: w.availability,
      description: w.description,
      confidence: w.confidence,
      dataStatus: w.data_status,
      changeNote: noteBySlug.get(w.slug) ?? null,
    }));
  }

  async getWeaponDetail(slug: string): Promise<WeaponDetail | null> {
    const supabase = await createServerSupabase();
    const { data: weapon, error } = await supabase
      .from("weapons")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(`weapons read failed: ${error.message}`);
    if (!weapon || weapon.data_status === "sample") return null;

    const snapshot = await this.latestPublishedSnapshot();
    const [tiersRes, versionNoteRes, impactsRes, attachmentsRes] = await Promise.all([
      snapshot
        ? supabase
            .from("weapon_tiers")
            .select("*")
            .eq("snapshot_id", snapshot.id)
            .eq("weapon_slug", slug)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("weapon_versions").select("change_note").eq("weapon_slug", slug).maybeSingle(),
      supabase
        .from("content_impact_links")
        .select("impact, note")
        .eq("entity_type", "weapon")
        .eq("entity_id", slug),
      supabase
        .from("attachments")
        .select("slug, name, slot, compatible_classes")
        .contains("compatible_classes", [weapon.class]),
    ]);
    if (tiersRes.error) throw new Error(`weapon_tiers read failed: ${tiersRes.error.message}`);
    if (impactsRes.error) throw new Error(`impacts read failed: ${impactsRes.error.message}`);
    if (attachmentsRes.error) {
      throw new Error(`attachments read failed: ${attachmentsRes.error.message}`);
    }

    const attachmentSlugs = attachmentsRes.data.map((a) => a.slug);
    const effects =
      attachmentSlugs.length > 0
        ? await supabase
            .from("attachment_effects")
            .select("attachment_slug, effect_key, direction, magnitude")
            .in("attachment_slug", attachmentSlugs)
        : { data: [], error: null };
    if (effects.error) throw new Error(`attachment_effects read failed: ${effects.error.message}`);
    const effectsBySlug = new Map<string, Array<{ key: string; direction: string; magnitude: string }>>();
    for (const e of effects.data ?? []) {
      const list = effectsBySlug.get(e.attachment_slug) ?? [];
      list.push({ key: e.effect_key, direction: e.direction, magnitude: e.magnitude });
      effectsBySlug.set(e.attachment_slug, list);
    }

    return {
      slug: weapon.slug,
      name: weapon.name,
      weaponClass: weapon.class,
      ammo: weapon.ammo,
      availability: weapon.availability,
      description: weapon.description,
      confidence: weapon.confidence,
      dataStatus: weapon.data_status,
      changeNote: versionNoteRes.error ? null : (versionNoteRes.data?.change_note ?? null),
      fireModes: weapon.fire_modes,
      notes: weapon.notes,
      sourceName: weapon.source_name,
      tiers: (tiersRes.data ?? []).map((t) => ({
        modeSlug: t.mode_slug,
        tier: t.tier,
        score: t.score,
        breakdown: parseBreakdown(t.components),
        confidence: t.confidence,
        evidenceNote: t.evidence_note,
      })),
      impacts: impactsRes.data,
      attachments: attachmentsRes.data.map((a) => ({
        slug: a.slug,
        name: a.name,
        slot: a.slot,
        effects: effectsBySlug.get(a.slug) ?? [],
      })),
    };
  }
}
