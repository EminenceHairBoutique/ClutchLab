import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

/**
 * RLS integration test harness.
 *
 * Preferred: TEST_DATABASE_URL pointing at a THROWAWAY superuser Postgres
 * (e.g. a CI service container). Fallback: boots a private local PostgreSQL
 * cluster via initdb/pg_ctl on a unix socket. Either way it applies
 * supabase/tests/harness/auth_shim.sql, then the real migrations, then the
 * real seed — so the SQL under test is exactly what ships to Supabase.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SHIM = path.join(REPO_ROOT, "supabase", "tests", "harness", "auth_shim.sql");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");
const SEED = path.join(REPO_ROOT, "supabase", "seed.sql");

export interface AuthedSql {
  sql: postgres.TransactionSql;
}

export interface TestDb {
  /** Superuser connection (bypasses RLS) for fixtures and assertions. */
  sql: postgres.Sql;
  /** Insert an auth.users row (simulates signup); returns the new user id. */
  createUser(email: string): Promise<string>;
  /** Grant a role directly (as the server-side tooling would via service role). */
  grantRole(userId: string, roleSlug: string): Promise<void>;
  /** Run fn inside a transaction as an authenticated user (RLS active). */
  asUser<T>(userId: string, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T>;
  /** Run fn inside a transaction as the anonymous role (RLS active). */
  asAnon<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T>;
  /** Run fn inside a transaction as service_role (BYPASSRLS, like Supabase). */
  asServiceRole<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T>;
  stop(): Promise<void>;
}

/**
 * PostgreSQL refuses to run as root. In root-only sandboxes (containers) we
 * drop to the unprivileged `postgres` system user via runuser; elsewhere we
 * exec directly.
 */
function unprivilegedPgUser(): string | undefined {
  if (typeof process.getuid !== "function" || process.getuid() !== 0) return undefined;
  try {
    execFileSync("id", ["-u", "postgres"], { stdio: "ignore" });
    return "postgres";
  } catch {
    return undefined;
  }
}

const PG_RUN_AS = unprivilegedPgUser();

function pgExec(binPath: string, args: string[]): void {
  if (PG_RUN_AS) {
    execFileSync("runuser", ["-u", PG_RUN_AS, "--", binPath, ...args], { stdio: "pipe" });
  } else {
    execFileSync(binPath, args, { stdio: "pipe" });
  }
}

export function pgBinDir(): string | undefined {
  if (process.env.PG_BIN_DIR && existsSync(process.env.PG_BIN_DIR)) {
    return process.env.PG_BIN_DIR;
  }
  const base = "/usr/lib/postgresql";
  if (existsSync(base)) {
    const versions = readdirSync(base)
      .map((v) => Number.parseInt(v, 10))
      .filter((v) => Number.isFinite(v))
      .sort((a, b) => b - a);
    for (const version of versions) {
      const bin = path.join(base, String(version), "bin");
      if (existsSync(path.join(bin, "initdb"))) return bin;
    }
  }
  try {
    const found = execFileSync("which", ["initdb"], { encoding: "utf8" }).trim();
    if (found) return path.dirname(found);
  } catch {
    // fall through
  }
  return undefined;
}

export function harnessAvailable(): boolean {
  return Boolean(process.env.TEST_DATABASE_URL) || pgBinDir() !== undefined;
}

async function applySchema(sql: postgres.Sql): Promise<void> {
  await sql.file(SHIM);
  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of migrations) {
    await sql.file(path.join(MIGRATIONS_DIR, file));
  }
  await sql.file(SEED);
}

function makeTestDb(sql: postgres.Sql, cleanup: () => Promise<void>): TestDb {
  async function runAs<T>(
    configure: (tx: postgres.TransactionSql) => Promise<void>,
    fn: (tx: postgres.TransactionSql) => Promise<T>,
  ): Promise<T> {
    const result = await sql.begin(async (tx) => {
      await configure(tx);
      return fn(tx);
    });
    return result as T;
  }

  return {
    sql,
    async createUser(email: string): Promise<string> {
      const rows = await sql`insert into auth.users (email) values (${email}) returning id`;
      const first = rows[0];
      if (!first) throw new Error("auth.users insert returned no row");
      return first.id as string;
    },
    async grantRole(userId: string, roleSlug: string): Promise<void> {
      await sql`insert into public.user_roles (user_id, role_slug) values (${userId}, ${roleSlug})
                on conflict do nothing`;
    },
    asUser(userId, fn) {
      const claims = JSON.stringify({ sub: userId, role: "authenticated" });
      return runAs(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${claims}, true)`;
        await tx.unsafe("set local role authenticated");
      }, fn);
    },
    asAnon(fn) {
      return runAs(async (tx) => {
        await tx`select set_config('request.jwt.claims', '', true)`;
        await tx.unsafe("set local role anon");
      }, fn);
    },
    asServiceRole(fn) {
      return runAs(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role: "service_role" })}, true)`;
        await tx.unsafe("set local role service_role");
      }, fn);
    },
    async stop(): Promise<void> {
      await sql.end({ timeout: 5 });
      await cleanup();
    },
  };
}

export async function startTestDb(): Promise<TestDb> {
  const external = process.env.TEST_DATABASE_URL;
  if (external) {
    const sql = postgres(external, { max: 1, onnotice: () => {} });
    await applySchema(sql);
    return makeTestDb(sql, async () => {});
  }

  const bin = pgBinDir();
  if (!bin) {
    throw new Error(
      "No Postgres available: set TEST_DATABASE_URL or install PostgreSQL server binaries (initdb/pg_ctl).",
    );
  }

  // When dropping to the postgres user, parents of the data dir must be
  // traversable by it — os.tmpdir() (mode 1777) is; arbitrary dirs may not be.
  const baseDir = PG_RUN_AS ? os.tmpdir() : (process.env.CLUTCHLAB_TEST_PG_DIR ?? os.tmpdir());
  const dataDir = mkdtempSync(path.join(baseDir, "clutchlab-pgdata-"));
  // Unix socket paths have a ~107 char kernel limit — keep the socket dir short.
  const sockDir = mkdtempSync(path.join(os.tmpdir(), "cl-sock-"));
  if (PG_RUN_AS) {
    execFileSync("chown", ["-R", PG_RUN_AS, dataDir, sockDir]);
  }

  pgExec(path.join(bin, "initdb"), [
    "-D",
    dataDir,
    "-U",
    "postgres",
    "--auth=trust",
    "--no-sync",
    "-E",
    "UTF8",
  ]);
  pgExec(path.join(bin, "pg_ctl"), [
    "-D",
    dataDir,
    "-l",
    path.join(dataDir, "server.log"),
    "-o",
    `-c listen_addresses='' -k ${sockDir} -c fsync=off -c full_page_writes=off`,
    "-w",
    "start",
  ]);

  const sql = postgres({
    host: sockDir,
    database: "postgres",
    username: "postgres",
    max: 1,
    onnotice: () => {},
  });

  const teardown = (): void => {
    pgExec(path.join(bin, "pg_ctl"), ["-D", dataDir, "-m", "immediate", "stop"]);
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(sockDir, { recursive: true, force: true });
  };

  try {
    await applySchema(sql);
  } catch (error) {
    await sql.end({ timeout: 5 }).catch(() => {});
    teardown();
    throw error;
  }

  return makeTestDb(sql, async () => {
    teardown();
  });
}
