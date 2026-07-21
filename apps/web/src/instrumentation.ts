/**
 * Runs once on server startup: validate the environment before serving anything.
 * A production runtime without Supabase configuration (or with AUTH_MOCK set)
 * crashes here with an explicit message instead of limping along mocked.
 */
export async function register(): Promise<void> {
  const { getServerEnv } = await import("@clutchlab/config/env");
  getServerEnv();
}
