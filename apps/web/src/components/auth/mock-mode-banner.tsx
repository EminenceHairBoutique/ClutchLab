import { authMode } from "@/lib/auth/gateway";

/**
 * Visible whenever the mock auth adapter is active, so a mocked environment can
 * never be mistaken for the real thing (spec §0.1.7).
 */
export function MockModeBanner() {
  if (authMode() !== "mock") return null;
  return (
    <div
      role="status"
      className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
    >
      Auth is running in <strong>mock mode</strong> — Supabase is not configured. Accounts and
      profile data live in server memory and reset on restart. See SETUP.md to connect a real
      project.
    </div>
  );
}
