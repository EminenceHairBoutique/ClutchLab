#!/usr/bin/env node
/** Applies supabase/seed.sql (idempotent upserts) to DATABASE_URL. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

import { loadDotEnv } from "./dotenv.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
loadDotEnv(repoRoot);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set. Point it at your Postgres/Supabase database (see SETUP.md).",
  );
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql.begin(async (tx) => {
    await tx.file(path.join(repoRoot, "supabase", "seed.sql"));
  });
  console.log("seed applied");
} finally {
  await sql.end();
}
