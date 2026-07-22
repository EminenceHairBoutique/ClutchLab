import { z } from "zod";

/** AI coach pipeline types (spec §5.13). Everything AI-produced is zod-validated. */

export const UPLOAD_KINDS = [
  "clip",
  "full_match",
  "training_grounds",
  "arena_match",
  "screenshot",
  "settings_screenshot",
  "controls_screenshot",
  "results_screenshot",
] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export const UPLOAD_KIND_LABELS: Record<UploadKind, string> = {
  clip: "Short clip",
  full_match: "Full match",
  training_grounds: "Training Grounds recording",
  arena_match: "Arena match",
  screenshot: "Screenshot",
  settings_screenshot: "Settings screenshot",
  controls_screenshot: "Control-layout screenshot",
  results_screenshot: "Match-results screenshot",
};

export const observationSchema = z.object({
  tSeconds: z.number().int().min(0),
  category: z.enum([
    "crosshair_placement", "tracking", "recoil", "target_switching", "exposure",
    "positioning", "movement", "utility", "decision", "reload_timing", "other",
  ]),
  observation: z.string().min(10).max(500),
  /** True when the line is an inference rather than a direct observation (§5.13 safeguards). */
  inference: z.boolean(),
  confidence: z.enum(["high", "medium", "low", "disputed", "unverified"]),
});
export type Observation = z.infer<typeof observationSchema>;

export const mistakeSchema = z.object({
  tSeconds: z.number().int().min(0),
  what: z.string().min(10).max(400),
  whyItMattered: z.string().min(10).max(400),
  betterAlternative: z.string().min(10).max(400),
});
export type Mistake = z.infer<typeof mistakeSchema>;

export const reportDraftSchema = z.object({
  executiveSummary: z.string().min(20).max(1200),
  /** The three highest-impact mistakes — never more (§5.13). */
  mistakes: z.array(mistakeSchema).min(1).max(3),
  drillSlugs: z.array(z.string()).max(5),
  settingsNote: z.string().max(500).nullable(),
  couldNotDetermine: z.string().min(10).max(800),
  confidence: z.enum(["high", "medium", "low", "disputed", "unverified"]),
});
export type ReportDraft = z.infer<typeof reportDraftSchema>;

export interface CoachContext {
  uploadKind: UploadKind;
  label: string;
  durationSeconds: number | null;
  /** Base64 JPEG keyframes when the worker could extract them; empty otherwise. */
  frames: string[];
}

export interface CoachProvider {
  readonly modelId: string;
  readonly promptVersion: string;
  extractObservations(context: CoachContext): Promise<Observation[]>;
  synthesizeReport(context: CoachContext, observations: Observation[]): Promise<ReportDraft>;
}

export interface AnalysisResult {
  observations: Observation[];
  draft: ReportDraft;
  /** Drill slugs the provider suggested that are not in the catalog (dropped). */
  unknownDrillSlugs: string[];
  modelId: string;
  promptVersion: string;
}
