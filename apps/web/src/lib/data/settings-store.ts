import "server-only";

import { SETTING_EXPLAINERS } from "@clutchlab/content";
import type { Enums } from "@clutchlab/types";

import { authMode } from "@/lib/auth/gateway";
import { createServerSupabase } from "@/lib/auth/supabase-server";

import type { Provenance } from "./meta-store";

export interface SettingExplainerView {
  slug: string;
  name: string;
  category: Enums<"setting_category">;
  whatItDoes: string;
  whatItDoesNot: string | null;
  advantages: string | null;
  disadvantages: string | null;
  beginnerRec: string | null;
  competitiveRec: string | null;
  modeNotes: string | null;
  deviceImpact: string | null;
  retestAfterUpdate: boolean;
  dataStatus: Enums<"data_status">;
}

export async function listSettingExplainers(): Promise<{
  provenance: Provenance;
  explainers: SettingExplainerView[];
}> {
  if (authMode() === "supabase") {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("setting_definitions")
      .select("*")
      .order("category")
      .order("name");
    if (error) throw new Error(`setting_definitions read failed: ${error.message}`);
    return {
      provenance: "database",
      explainers: data.map((s) => ({
        slug: s.slug,
        name: s.name,
        category: s.category,
        whatItDoes: s.what_it_does,
        whatItDoesNot: s.what_it_does_not,
        advantages: s.advantages,
        disadvantages: s.disadvantages,
        beginnerRec: s.beginner_recommendation,
        competitiveRec: s.competitive_recommendation,
        modeNotes: s.mode_notes,
        deviceImpact: s.device_impact,
        retestAfterUpdate: s.retest_after_update,
        dataStatus: s.data_status,
      })),
    };
  }
  return {
    provenance: "bundled-baseline",
    explainers: SETTING_EXPLAINERS.map((s) => ({
      slug: s.slug,
      name: s.name,
      category: s.category,
      whatItDoes: s.whatItDoes,
      whatItDoesNot: s.whatItDoesNot,
      advantages: s.advantages,
      disadvantages: s.disadvantages,
      beginnerRec: s.beginnerRec,
      competitiveRec: s.competitiveRec,
      modeNotes: s.modeNotes,
      deviceImpact: s.deviceImpact,
      retestAfterUpdate: s.retestAfterUpdate,
      dataStatus: "unverified" as const,
    })),
  };
}
