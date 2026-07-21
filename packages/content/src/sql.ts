import { createHash } from "node:crypto";

/**
 * SQL emission helpers for the generated seed. Deterministic IDs keep diffs
 * stable across regenerations; literal escaping is unit-tested.
 */

/** Deterministic UUID (v4 format) derived from a namespace + key. */
export function stableId(namespace: string, key: string): string {
  const hex = createHash("sha256").update(`${namespace}:${key}`).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

export type SqlValue = string | number | boolean | null | string[] | Record<string, unknown>;

export function lit(value: SqlValue): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite number in seed data");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    const inner = value.map((v) => `"${v.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`).join(",");
    return `'{${inner.replaceAll("'", "''")}}'`;
  }
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  }
  return `'${value.replaceAll("'", "''")}'`;
}

export interface UpsertOptions {
  table: string;
  columns: string[];
  rows: SqlValue[][];
  conflictTarget: string;
  /** Columns updated on conflict; defaults to every non-conflict column. */
  updateColumns?: string[];
}

export function upsert({ table, columns, rows, conflictTarget, updateColumns }: UpsertOptions): string {
  if (rows.length === 0) return "";
  for (const row of rows) {
    if (row.length !== columns.length) {
      throw new Error(`row arity mismatch for ${table}: expected ${columns.length}, got ${row.length}`);
    }
  }
  const conflictCols = conflictTarget
    .replace(/[()]/g, "")
    .split(",")
    .map((c) => c.trim());
  const updates = (updateColumns ?? columns.filter((c) => !conflictCols.includes(c)))
    .map((c) => `${c} = excluded.${c}`)
    .join(",\n    ");
  const values = rows.map((row) => `  (${row.map(lit).join(", ")})`).join(",\n");
  return [
    `insert into public.${table} (${columns.join(", ")}) values`,
    values,
    updates.length > 0
      ? `on conflict (${conflictCols.join(", ")}) do update set\n    ${updates};`
      : `on conflict (${conflictCols.join(", ")}) do nothing;`,
    "",
  ].join("\n");
}
