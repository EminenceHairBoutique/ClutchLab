import "server-only";

import type { SensitivityValues } from "@clutchlab/calibration";

import { authMode } from "@/lib/auth/gateway";
import { getMockAuthStore } from "@/lib/auth/mock-store";
import { createServerSupabase } from "@/lib/auth/supabase-server";

/**
 * User-owned sensitivity data. Versions are IMMUTABLE (matching the DB
 * policies): every save/rollback appends a new version and repoints active.
 */

export interface ProfileListItem {
  id: string;
  name: string;
  activeVersionNo: number | null;
  versionCount: number;
}

export interface VersionSummary {
  id: string;
  versionNo: number;
  note: string | null;
  origin: string;
  createdAt: string;
  isActive: boolean;
}

export interface ProfileDetail {
  id: string;
  name: string;
  versions: VersionSummary[];
  activeValues: SensitivityValues;
  codes: Array<{ id: string; kind: string; code: string; label: string | null }>;
}

export type StoreResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface SensitivityStore {
  listProfiles(userId: string): Promise<ProfileListItem[]>;
  getProfile(userId: string, profileId: string): Promise<ProfileDetail | null>;
  getVersionValues(userId: string, profileId: string, versionId: string): Promise<SensitivityValues | null>;
  createProfile(userId: string, name: string, values: SensitivityValues): Promise<StoreResult<{ profileId: string }>>;
  appendVersion(
    userId: string,
    profileId: string,
    values: SensitivityValues,
    note: string,
    origin: "manual" | "calibration" | "rollback" | "fork" | "import",
  ): Promise<StoreResult<{ versionNo: number }>>;
  addCode(
    userId: string,
    profileId: string,
    kind: "sensitivity" | "controls",
    code: string,
    label: string | null,
  ): Promise<StoreResult<null>>;
}

function valuesToRows(values: SensitivityValues) {
  return Object.entries(values).map(([key, value]) => {
    const [family, scope] = key.split(":");
    return {
      family: family as "camera" | "ads" | "gyro" | "ads_gyro" | "free_look",
      scope: scope === "-" ? null : (scope as "no_scope_tpp" | "no_scope_fpp" | "red_dot" | "x2" | "x3" | "x4" | "x6" | "x8"),
      value,
    };
  });
}

function rowsToValues(rows: Array<{ family: string; scope: string | null; value: number }>): SensitivityValues {
  const values: SensitivityValues = {};
  for (const row of rows) {
    values[`${row.family}:${row.scope ?? "-"}`] = row.value;
  }
  return values;
}

class SupabaseSensitivityStore implements SensitivityStore {
  async listProfiles(userId: string): Promise<ProfileListItem[]> {
    const supabase = await createServerSupabase();
    const { data: profiles, error } = await supabase
      .from("sensitivity_profiles")
      .select("id, name, active_version_id")
      .eq("user_id", userId)
      .order("name");
    if (error) throw new Error(`sensitivity_profiles read failed: ${error.message}`);
    if (profiles.length === 0) return [];
    const { data: versions, error: versionsError } = await supabase
      .from("sensitivity_profile_versions")
      .select("id, profile_id, version_no")
      .in("profile_id", profiles.map((p) => p.id));
    if (versionsError) throw new Error(`versions read failed: ${versionsError.message}`);
    return profiles.map((p) => ({
      id: p.id,
      name: p.name,
      activeVersionNo:
        versions.find((v) => v.id === p.active_version_id)?.version_no ?? null,
      versionCount: versions.filter((v) => v.profile_id === p.id).length,
    }));
  }

  async getProfile(userId: string, profileId: string): Promise<ProfileDetail | null> {
    const supabase = await createServerSupabase();
    const { data: profile, error } = await supabase
      .from("sensitivity_profiles")
      .select("id, name, active_version_id")
      .eq("user_id", userId)
      .eq("id", profileId)
      .maybeSingle();
    if (error) throw new Error(`profile read failed: ${error.message}`);
    if (!profile) return null;

    const [versionsRes, codesRes] = await Promise.all([
      supabase
        .from("sensitivity_profile_versions")
        .select("id, version_no, note, origin, created_at")
        .eq("profile_id", profileId)
        .order("version_no", { ascending: false }),
      supabase
        .from("setting_codes")
        .select("id, kind, code, label")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false }),
    ]);
    if (versionsRes.error) throw new Error(`versions read failed: ${versionsRes.error.message}`);
    if (codesRes.error) throw new Error(`codes read failed: ${codesRes.error.message}`);

    let activeValues: SensitivityValues = {};
    if (profile.active_version_id) {
      const values = await this.readValues(profile.active_version_id);
      if (values) activeValues = values;
    }

    return {
      id: profile.id,
      name: profile.name,
      versions: versionsRes.data.map((v) => ({
        id: v.id,
        versionNo: v.version_no,
        note: v.note,
        origin: v.origin,
        createdAt: v.created_at,
        isActive: v.id === profile.active_version_id,
      })),
      activeValues,
      codes: codesRes.data,
    };
  }

  private async readValues(versionId: string): Promise<SensitivityValues | null> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("sensitivity_values")
      .select("family, scope, value")
      .eq("version_id", versionId);
    if (error) throw new Error(`values read failed: ${error.message}`);
    return rowsToValues(data);
  }

  async getVersionValues(
    userId: string,
    profileId: string,
    versionId: string,
  ): Promise<SensitivityValues | null> {
    const supabase = await createServerSupabase();
    const { data: version, error } = await supabase
      .from("sensitivity_profile_versions")
      .select("id, profile_id")
      .eq("id", versionId)
      .eq("profile_id", profileId)
      .maybeSingle();
    if (error) throw new Error(`version read failed: ${error.message}`);
    if (!version) return null;
    return this.readValues(versionId);
  }

  async createProfile(
    userId: string,
    name: string,
    values: SensitivityValues,
  ): Promise<StoreResult<{ profileId: string }>> {
    const supabase = await createServerSupabase();
    const { data: profile, error } = await supabase
      .from("sensitivity_profiles")
      .insert({ user_id: userId, name })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "You already have a profile with that name." };
      return { ok: false, error: `Could not create profile: ${error.message}` };
    }
    const versionResult = await this.insertVersion(profile.id, 1, values, "Initial values", "manual");
    if (!versionResult.ok) return versionResult;
    return { ok: true, data: { profileId: profile.id } };
  }

  private async insertVersion(
    profileId: string,
    versionNo: number,
    values: SensitivityValues,
    note: string,
    origin: string,
  ): Promise<StoreResult<{ versionNo: number }>> {
    const supabase = await createServerSupabase();
    const { data: version, error } = await supabase
      .from("sensitivity_profile_versions")
      .insert({ profile_id: profileId, version_no: versionNo, note, origin })
      .select("id")
      .single();
    if (error) return { ok: false, error: `Could not create version: ${error.message}` };
    const rows = valuesToRows(values).map((r) => ({ ...r, version_id: version.id }));
    if (rows.length > 0) {
      const { error: valuesError } = await supabase.from("sensitivity_values").insert(rows);
      if (valuesError) return { ok: false, error: `Could not save values: ${valuesError.message}` };
    }
    const { error: pointerError } = await supabase
      .from("sensitivity_profiles")
      .update({ active_version_id: version.id })
      .eq("id", profileId);
    if (pointerError) return { ok: false, error: `Could not activate version: ${pointerError.message}` };
    return { ok: true, data: { versionNo } };
  }

  async appendVersion(
    userId: string,
    profileId: string,
    values: SensitivityValues,
    note: string,
    origin: "manual" | "calibration" | "rollback" | "fork" | "import",
  ): Promise<StoreResult<{ versionNo: number }>> {
    const supabase = await createServerSupabase();
    const { data: latest, error } = await supabase
      .from("sensitivity_profile_versions")
      .select("version_no")
      .eq("profile_id", profileId)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, error: `Could not read versions: ${error.message}` };
    if (!latest) return { ok: false, error: "Profile not found." };
    return this.insertVersion(profileId, latest.version_no + 1, values, note, origin);
  }

  async addCode(
    userId: string,
    profileId: string,
    kind: "sensitivity" | "controls",
    code: string,
    label: string | null,
  ): Promise<StoreResult<null>> {
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from("setting_codes")
      .insert({ user_id: userId, profile_id: profileId, kind, code, label });
    if (error) return { ok: false, error: `Could not store code: ${error.message}` };
    return { ok: true, data: null };
  }
}

class MockSensitivityStore implements SensitivityStore {
  async listProfiles(userId: string): Promise<ProfileListItem[]> {
    return getMockAuthStore()
      .listSensitivityProfiles(userId)
      .map((p) => ({
        id: p.id,
        name: p.name,
        activeVersionNo:
          p.versions.find((v) => v.id === p.activeVersionId)?.versionNo ?? null,
        versionCount: p.versions.length,
      }));
  }

  async getProfile(userId: string, profileId: string): Promise<ProfileDetail | null> {
    const profile = getMockAuthStore().getSensitivityProfile(userId, profileId);
    if (!profile) return null;
    const active = profile.versions.find((v) => v.id === profile.activeVersionId);
    return {
      id: profile.id,
      name: profile.name,
      versions: [...profile.versions]
        .sort((a, b) => b.versionNo - a.versionNo)
        .map((v) => ({
          id: v.id,
          versionNo: v.versionNo,
          note: v.note,
          origin: v.origin,
          createdAt: v.createdAt,
          isActive: v.id === profile.activeVersionId,
        })),
      activeValues: { ...(active?.values ?? {}) },
      codes: getMockAuthStore()
        .listCodes(userId, profileId)
        .map((c) => ({ id: c.id, kind: c.kind, code: c.code, label: c.label })),
    };
  }

  async getVersionValues(
    userId: string,
    profileId: string,
    versionId: string,
  ): Promise<SensitivityValues | null> {
    const profile = getMockAuthStore().getSensitivityProfile(userId, profileId);
    const version = profile?.versions.find((v) => v.id === versionId);
    return version ? { ...version.values } : null;
  }

  async createProfile(
    userId: string,
    name: string,
    values: SensitivityValues,
  ): Promise<StoreResult<{ profileId: string }>> {
    const result = getMockAuthStore().createSensitivityProfile(userId, name, values);
    if (!result.ok) return result;
    return { ok: true, data: { profileId: result.profileId } };
  }

  async appendVersion(
    userId: string,
    profileId: string,
    values: SensitivityValues,
    note: string,
    origin: "manual" | "calibration" | "rollback" | "fork" | "import",
  ): Promise<StoreResult<{ versionNo: number }>> {
    const result = getMockAuthStore().appendSensitivityVersion(userId, profileId, values, note, origin);
    if (!result.ok) return result;
    return { ok: true, data: { versionNo: result.versionNo } };
  }

  async addCode(
    userId: string,
    profileId: string,
    kind: "sensitivity" | "controls",
    code: string,
    label: string | null,
  ): Promise<StoreResult<null>> {
    getMockAuthStore().addCode(userId, profileId, kind, code, label);
    return { ok: true, data: null };
  }
}

export function getSensitivityStore(): SensitivityStore {
  return authMode() === "supabase" ? new SupabaseSensitivityStore() : new MockSensitivityStore();
}
