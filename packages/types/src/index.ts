export type {
  Database,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./database";

/** Role slugs seeded in supabase/seed.sql (spec §13). `guest` = unauthenticated. */
export const ROLE_SLUGS = [
  "player",
  "creator",
  "verified_creator",
  "coach",
  "editor",
  "moderator",
  "admin",
  "super_admin",
] as const;

export type RoleSlug = (typeof ROLE_SLUGS)[number];

/**
 * Role rank ladder — MUST mirror supabase/seed.sql. Higher = more privileged.
 * The database is authoritative (public.has_role_at_least); this copy exists for
 * the mock adapter and client-side display only.
 */
export const ROLE_RANKS: Record<RoleSlug, number> = {
  player: 10,
  creator: 20,
  verified_creator: 30,
  coach: 40,
  editor: 50,
  moderator: 60,
  admin: 70,
  super_admin: 80,
};
