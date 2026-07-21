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
