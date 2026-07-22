/**
 * Vitest stand-in for the `server-only` marker package, which throws when
 * imported outside a React Server context. Tests exercise server modules in
 * plain Node, so the marker is neutralized here; Next.js still enforces it at
 * build time.
 */
export {};
