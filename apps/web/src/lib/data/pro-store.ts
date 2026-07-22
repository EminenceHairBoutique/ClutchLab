import "server-only";

import type { SensitivityValues } from "@clutchlab/calibration";
import { SAMPLE_PROS, SAMPLE_TEAMS } from "@clutchlab/content";
import type { Enums } from "@clutchlab/types";

import { authMode } from "@/lib/auth/gateway";
import { createServerSupabase } from "@/lib/auth/supabase-server";

import type { Provenance } from "./meta-store";

export interface ProSummary {
  slug: string;
  displayName: string;
  teamName: string | null;
  region: string | null;
  role: string | null;
  deviceLabel: string | null;
  verification: Enums<"verification_level">;
  isStale: boolean;
}

export interface ProDetail extends ProSummary {
  fpsTier: string | null;
  fingerCount: number | null;
  gripStyle: string | null;
  gyroMode: string | null;
  aimAssist: string | null;
  preferredWeapons: string[];
  mainModes: string[];
  gameVersionLabel: string | null;
  notes: string | null;
  values: SensitivityValues;
}

export interface ProStore {
  provenance: Provenance;
  listPros(): Promise<ProSummary[]>;
  getPro(slug: string): Promise<ProDetail | null>;
}

class BundledProStore implements ProStore {
  readonly provenance = "bundled-baseline" as const;

  async listPros(): Promise<ProSummary[]> {
    const teams = new Map(SAMPLE_TEAMS.map((t) => [t.slug, t.name]));
    return SAMPLE_PROS.map((p) => ({
      slug: p.slug,
      displayName: p.displayName,
      teamName: p.teamSlug ? (teams.get(p.teamSlug) ?? null) : null,
      region: p.region,
      role: p.role,
      deviceLabel: p.deviceLabel,
      verification: "sample" as const,
      isStale: false,
    }));
  }

  async getPro(slug: string): Promise<ProDetail | null> {
    const pro = SAMPLE_PROS.find((p) => p.slug === slug);
    if (!pro) return null;
    const teams = new Map(SAMPLE_TEAMS.map((t) => [t.slug, t.name]));
    const values: SensitivityValues = {};
    for (const value of pro.values) {
      values[`${value.family}:${value.scope ?? "-"}`] = value.value;
    }
    return {
      slug: pro.slug,
      displayName: pro.displayName,
      teamName: pro.teamSlug ? (teams.get(pro.teamSlug) ?? null) : null,
      region: pro.region,
      role: pro.role,
      deviceLabel: pro.deviceLabel,
      verification: "sample",
      isStale: false,
      fpsTier: pro.fpsTier,
      fingerCount: pro.fingerCount,
      gripStyle: pro.gripStyle,
      gyroMode: pro.gyroMode,
      aimAssist: pro.aimAssist,
      preferredWeapons: pro.preferredWeapons,
      mainModes: pro.mainModes,
      gameVersionLabel: "4.5",
      notes: pro.notes,
      values,
    };
  }
}

class SupabaseProStore implements ProStore {
  readonly provenance = "database" as const;

  async listPros(): Promise<ProSummary[]> {
    const supabase = await createServerSupabase();
    const { data: pros, error } = await supabase
      .from("pro_profiles")
      .select("slug, display_name, team_slug, region, role, device_label, verification, is_stale")
      .order("display_name");
    if (error) throw new Error(`pro_profiles read failed: ${error.message}`);
    const teamSlugs = [...new Set(pros.map((p) => p.team_slug).filter((t): t is string => !!t))];
    const teams =
      teamSlugs.length > 0
        ? await supabase.from("teams").select("slug, name").in("slug", teamSlugs)
        : { data: [], error: null };
    if (teams.error) throw new Error(`teams read failed: ${teams.error.message}`);
    const teamName = new Map((teams.data ?? []).map((t) => [t.slug, t.name]));
    return pros.map((p) => ({
      slug: p.slug,
      displayName: p.display_name,
      teamName: p.team_slug ? (teamName.get(p.team_slug) ?? null) : null,
      region: p.region,
      role: p.role,
      deviceLabel: p.device_label,
      verification: p.verification,
      isStale: p.is_stale,
    }));
  }

  async getPro(slug: string): Promise<ProDetail | null> {
    const supabase = await createServerSupabase();
    const { data: pro, error } = await supabase
      .from("pro_profiles")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(`pro_profiles read failed: ${error.message}`);
    if (!pro) return null;

    const [teamRes, valuesRes] = await Promise.all([
      pro.team_slug
        ? supabase.from("teams").select("name").eq("slug", pro.team_slug).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("pro_settings").select("family, scope, value").eq("pro_slug", slug),
    ]);
    if (valuesRes.error) throw new Error(`pro_settings read failed: ${valuesRes.error.message}`);

    const values: SensitivityValues = {};
    for (const row of valuesRes.data) {
      values[`${row.family}:${row.scope ?? "-"}`] = row.value;
    }

    return {
      slug: pro.slug,
      displayName: pro.display_name,
      teamName: teamRes.error ? null : (teamRes.data?.name ?? null),
      region: pro.region,
      role: pro.role,
      deviceLabel: pro.device_label,
      verification: pro.verification,
      isStale: pro.is_stale,
      fpsTier: pro.fps_tier,
      fingerCount: pro.finger_count,
      gripStyle: pro.grip_style,
      gyroMode: pro.gyro_mode,
      aimAssist: pro.aim_assist,
      preferredWeapons: pro.preferred_weapons,
      mainModes: pro.main_modes,
      gameVersionLabel: pro.game_version_label,
      notes: pro.notes,
      values,
    };
  }
}

export function getProStore(): ProStore {
  return authMode() === "supabase" ? new SupabaseProStore() : new BundledProStore();
}
