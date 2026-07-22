import "server-only";

import type { Json } from "@clutchlab/types";

import { authMode } from "@/lib/auth/gateway";
import { getMockAuthStore } from "@/lib/auth/mock-store";
import { createServerSupabase } from "@/lib/auth/supabase-server";
import type { ErgonomicsAnalysis, PlacedElement } from "@/lib/controls/ergonomics";

export interface LayoutListItem {
  id: string;
  name: string;
  fingerCount: number;
  activeVersionNo: number | null;
  versionCount: number;
  activeScore: number | null;
}

export interface LayoutVersionSummary {
  id: string;
  versionNo: number;
  note: string | null;
  origin: string;
  createdAt: string;
  isActive: boolean;
  score: number | null;
}

export interface LayoutDetail {
  id: string;
  name: string;
  fingerCount: number;
  versions: LayoutVersionSummary[];
  activePositions: PlacedElement[];
  activeAnalysis: ErgonomicsAnalysis | null;
}

export type ControlsResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ControlsStore {
  listLayouts(userId: string): Promise<LayoutListItem[]>;
  getLayout(userId: string, layoutId: string): Promise<LayoutDetail | null>;
  getVersionPositions(userId: string, layoutId: string, versionId: string): Promise<PlacedElement[] | null>;
  createLayout(
    userId: string,
    name: string,
    fingerCount: number,
    positions: PlacedElement[],
    analysis: ErgonomicsAnalysis,
  ): Promise<ControlsResult<{ layoutId: string }>>;
  appendVersion(
    userId: string,
    layoutId: string,
    positions: PlacedElement[],
    note: string,
    origin: "manual" | "template" | "rollback",
    analysis: ErgonomicsAnalysis,
  ): Promise<ControlsResult<{ versionNo: number }>>;
}

class MockControlsStore implements ControlsStore {
  async listLayouts(userId: string): Promise<LayoutListItem[]> {
    return getMockAuthStore()
      .listControlLayouts(userId)
      .map((layout) => {
        const active = layout.versions.find((v) => v.id === layout.activeVersionId);
        return {
          id: layout.id,
          name: layout.name,
          fingerCount: layout.fingerCount,
          activeVersionNo: active?.versionNo ?? null,
          versionCount: layout.versions.length,
          activeScore: active?.analysis.score ?? null,
        };
      });
  }

  async getLayout(userId: string, layoutId: string): Promise<LayoutDetail | null> {
    const layout = getMockAuthStore().getControlLayout(userId, layoutId);
    if (!layout) return null;
    const active = layout.versions.find((v) => v.id === layout.activeVersionId);
    return {
      id: layout.id,
      name: layout.name,
      fingerCount: layout.fingerCount,
      versions: [...layout.versions]
        .sort((a, b) => b.versionNo - a.versionNo)
        .map((v) => ({
          id: v.id,
          versionNo: v.versionNo,
          note: v.note,
          origin: v.origin,
          createdAt: v.createdAt,
          isActive: v.id === layout.activeVersionId,
          score: v.analysis.score,
        })),
      activePositions: active?.positions.map((p) => ({ ...p })) ?? [],
      activeAnalysis: (active?.analysis as ErgonomicsAnalysis | undefined) ?? null,
    };
  }

  async getVersionPositions(
    userId: string,
    layoutId: string,
    versionId: string,
  ): Promise<PlacedElement[] | null> {
    const layout = getMockAuthStore().getControlLayout(userId, layoutId);
    const version = layout?.versions.find((v) => v.id === versionId);
    return version ? version.positions.map((p) => ({ ...p })) : null;
  }

  async createLayout(
    userId: string,
    name: string,
    fingerCount: number,
    positions: PlacedElement[],
    analysis: ErgonomicsAnalysis,
  ): Promise<ControlsResult<{ layoutId: string }>> {
    const result = getMockAuthStore().createControlLayout(userId, name, fingerCount, positions, analysis);
    if (!result.ok) return result;
    return { ok: true, data: { layoutId: result.layoutId } };
  }

  async appendVersion(
    userId: string,
    layoutId: string,
    positions: PlacedElement[],
    note: string,
    origin: "manual" | "template" | "rollback",
    analysis: ErgonomicsAnalysis,
  ): Promise<ControlsResult<{ versionNo: number }>> {
    const result = getMockAuthStore().appendControlVersion(userId, layoutId, positions, note, origin, analysis);
    if (!result.ok) return result;
    return { ok: true, data: { versionNo: result.versionNo } };
  }
}

class SupabaseControlsStore implements ControlsStore {
  async listLayouts(userId: string): Promise<LayoutListItem[]> {
    const supabase = await createServerSupabase();
    const { data: layouts, error } = await supabase
      .from("control_layouts")
      .select("id, name, finger_count, active_version_id")
      .eq("user_id", userId)
      .order("name");
    if (error) throw new Error(`control_layouts read failed: ${error.message}`);
    if (layouts.length === 0) return [];
    const { data: versions, error: versionsError } = await supabase
      .from("control_layout_versions")
      .select("id, layout_id, version_no")
      .in("layout_id", layouts.map((l) => l.id));
    if (versionsError) throw new Error(`versions read failed: ${versionsError.message}`);
    const { data: analyses, error: analysesError } = await supabase
      .from("control_analysis")
      .select("version_id, ergonomics_score")
      .in("version_id", versions.map((v) => v.id));
    if (analysesError) throw new Error(`analysis read failed: ${analysesError.message}`);
    const scoreByVersion = new Map(analyses.map((a) => [a.version_id, a.ergonomics_score]));
    return layouts.map((layout) => {
      const own = versions.filter((v) => v.layout_id === layout.id);
      const active = own.find((v) => v.id === layout.active_version_id);
      return {
        id: layout.id,
        name: layout.name,
        fingerCount: layout.finger_count,
        activeVersionNo: active?.version_no ?? null,
        versionCount: own.length,
        activeScore: active ? (scoreByVersion.get(active.id) ?? null) : null,
      };
    });
  }

  async getLayout(userId: string, layoutId: string): Promise<LayoutDetail | null> {
    const supabase = await createServerSupabase();
    const { data: layout, error } = await supabase
      .from("control_layouts")
      .select("id, name, finger_count, active_version_id")
      .eq("user_id", userId)
      .eq("id", layoutId)
      .maybeSingle();
    if (error) throw new Error(`layout read failed: ${error.message}`);
    if (!layout) return null;

    const { data: versions, error: versionsError } = await supabase
      .from("control_layout_versions")
      .select("id, version_no, note, origin, created_at")
      .eq("layout_id", layoutId)
      .order("version_no", { ascending: false });
    if (versionsError) throw new Error(`versions read failed: ${versionsError.message}`);

    const { data: analyses, error: analysesError } = await supabase
      .from("control_analysis")
      .select("version_id, ergonomics_score, findings, workloads, engine_version")
      .in("version_id", versions.map((v) => v.id));
    if (analysesError) throw new Error(`analysis read failed: ${analysesError.message}`);
    const analysisByVersion = new Map(analyses.map((a) => [a.version_id, a]));

    let activePositions: PlacedElement[] = [];
    let activeAnalysis: ErgonomicsAnalysis | null = null;
    if (layout.active_version_id) {
      const positions = await this.readPositions(layout.active_version_id);
      activePositions = positions ?? [];
      const stored = analysisByVersion.get(layout.active_version_id);
      if (stored) {
        // Reverse of the audited jsonb cast on write.
        activeAnalysis = {
          score: stored.ergonomics_score,
          findings: (stored.findings as unknown as ErgonomicsAnalysis["findings"]) ?? [],
          workloads: (stored.workloads as unknown as ErgonomicsAnalysis["workloads"]) ?? {
            left_thumb: [], right_thumb: [], left_index: [], right_index: [], other: [],
          },
          collisions: [],
          engineVersion: stored.engine_version,
        };
      }
    }

    return {
      id: layout.id,
      name: layout.name,
      fingerCount: layout.finger_count,
      versions: versions.map((v) => ({
        id: v.id,
        versionNo: v.version_no,
        note: v.note,
        origin: v.origin,
        createdAt: v.created_at,
        isActive: v.id === layout.active_version_id,
        score: analysisByVersion.get(v.id)?.ergonomics_score ?? null,
      })),
      activePositions,
      activeAnalysis,
    };
  }

  private async readPositions(versionId: string): Promise<PlacedElement[] | null> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("control_positions")
      .select("element_slug, x, y, size")
      .eq("version_id", versionId);
    if (error) throw new Error(`positions read failed: ${error.message}`);
    return data.map((row) => ({
      slug: row.element_slug,
      x: Number(row.x),
      y: Number(row.y),
      size: Number(row.size),
    }));
  }

  async getVersionPositions(
    _userId: string,
    layoutId: string,
    versionId: string,
  ): Promise<PlacedElement[] | null> {
    const supabase = await createServerSupabase();
    const { data: version, error } = await supabase
      .from("control_layout_versions")
      .select("id")
      .eq("id", versionId)
      .eq("layout_id", layoutId)
      .maybeSingle();
    if (error) throw new Error(`version read failed: ${error.message}`);
    if (!version) return null;
    return this.readPositions(versionId);
  }

  async createLayout(
    userId: string,
    name: string,
    fingerCount: number,
    positions: PlacedElement[],
    analysis: ErgonomicsAnalysis,
  ): Promise<ControlsResult<{ layoutId: string }>> {
    const supabase = await createServerSupabase();
    const { data: layout, error } = await supabase
      .from("control_layouts")
      .insert({ user_id: userId, name, finger_count: fingerCount })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "You already have a layout with that name." };
      return { ok: false, error: `Could not create layout: ${error.message}` };
    }
    const versionResult = await this.insertVersion(layout.id, 1, positions, "From template", "template", analysis);
    if (!versionResult.ok) return versionResult;
    return { ok: true, data: { layoutId: layout.id } };
  }

  private async insertVersion(
    layoutId: string,
    versionNo: number,
    positions: PlacedElement[],
    note: string,
    origin: string,
    analysis: ErgonomicsAnalysis,
  ): Promise<ControlsResult<{ versionNo: number }>> {
    const supabase = await createServerSupabase();
    const { data: version, error } = await supabase
      .from("control_layout_versions")
      .insert({ layout_id: layoutId, version_no: versionNo, note, origin })
      .select("id")
      .single();
    if (error) return { ok: false, error: `Could not create version: ${error.message}` };
    const rows = positions.map((pos) => ({
      version_id: version.id,
      element_slug: pos.slug,
      x: pos.x,
      y: pos.y,
      size: pos.size,
    }));
    if (rows.length > 0) {
      const { error: positionsError } = await supabase.from("control_positions").insert(rows);
      if (positionsError) return { ok: false, error: `Could not save positions: ${positionsError.message}` };
    }
    // Plain-data structures serialize losslessly to jsonb; single audited cast.
    const { error: analysisError } = await supabase.from("control_analysis").insert({
      version_id: version.id,
      ergonomics_score: analysis.score,
      findings: analysis.findings as unknown as Json,
      workloads: analysis.workloads as unknown as Json,
      engine_version: analysis.engineVersion,
    });
    if (analysisError) return { ok: false, error: `Could not store analysis: ${analysisError.message}` };
    const { error: pointerError } = await supabase
      .from("control_layouts")
      .update({ active_version_id: version.id })
      .eq("id", layoutId);
    if (pointerError) return { ok: false, error: `Could not activate version: ${pointerError.message}` };
    return { ok: true, data: { versionNo } };
  }

  async appendVersion(
    _userId: string,
    layoutId: string,
    positions: PlacedElement[],
    note: string,
    origin: "manual" | "template" | "rollback",
    analysis: ErgonomicsAnalysis,
  ): Promise<ControlsResult<{ versionNo: number }>> {
    const supabase = await createServerSupabase();
    const { data: latest, error } = await supabase
      .from("control_layout_versions")
      .select("version_no")
      .eq("layout_id", layoutId)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, error: `Could not read versions: ${error.message}` };
    if (!latest) return { ok: false, error: "Layout not found." };
    return this.insertVersion(layoutId, latest.version_no + 1, positions, note, origin, analysis);
  }
}

export function getControlsStore(): ControlsStore {
  return authMode() === "supabase" ? new SupabaseControlsStore() : new MockControlsStore();
}
