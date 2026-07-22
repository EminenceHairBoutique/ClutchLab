#!/usr/bin/env node
/**
 * Applies supabase/migrations/*.sql (filename order) to DATABASE_URL, tracking
 * applied files in _clutchlab.migrations. Idempotent. Works against any
 * Postgres, including a real Supabase project's connection string.
 * Alternative for linked Supabase projects: `supabase db push` (see SETUP.md).
 */
import { readdir } from "node:fs/promises";
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

const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql`create schema if not exists _clutchlab`;
  await sql`create table if not exists _clutchlab.migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  )`;
  const appliedRows = await sql`select filename from _clutchlab.migrations`;
  const applied = new Set(appliedRows.map((row) => row.filename));
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip    ${file} (already applied)`);
      continue;
    }
    await sql.begin(async (tx) => {
      await tx.file(path.join(migrationsDir, file));
      await tx`insert into _clutchlab.migrations (filename) values (${file})`;
    });
    console.log(`applied ${file}`);
  }
  console.log("migrations up to date");
} finally {
  await sql.end();
}
