import { z } from "zod";

/** Zod-validated profile form input (spec convention: validate all external input). */
export const profileSchema = z.object({
  displayName: z.string().min(1).max(40).nullable(),
  handle: z
    .string()
    .regex(/^[a-z0-9_]{3,20}$/, "Handle must be 3–20 characters: a–z, 0–9, underscore.")
    .nullable(),
  region: z.enum(["global", "kr_jp", "vn", "tw", "bgmi", "other"]).nullable(),
  primaryDeviceId: z.string().min(1).nullable(),
  fingerCount: z.coerce.number().int().min(2).max(6).nullable(),
  gripStyle: z
    .enum(["thumbs", "claw_3", "claw_4", "claw_5", "claw_6", "hybrid", "other"])
    .nullable(),
  gyroMode: z.enum(["off", "scope_on", "always_on"]).nullable(),
  aimAssistPref: z.enum(["on", "off", "mixed", "undecided"]).nullable(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const emptyToNull = (value: FormDataEntryValue | null): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};
