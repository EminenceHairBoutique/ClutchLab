import { readFileSync } from "node:fs";
import path from "node:path";

/** Minimal .env loader (KEY=value lines, optional single/double quotes). */
export function loadDotEnv(rootDir) {
  let content;
  try {
    content = readFileSync(path.join(rootDir, ".env"), "utf8");
  } catch {
    return;
  }
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
