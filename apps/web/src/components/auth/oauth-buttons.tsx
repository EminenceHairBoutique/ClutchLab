import { isOAuthEnabled } from "@clutchlab/config/env.client";
import { Button } from "@clutchlab/ui";

import { signInWithOAuthAction } from "@/lib/auth/actions";
import { authMode } from "@/lib/auth/gateway";

/**
 * OAuth entry points, rendered only when the provider is enabled via env and a
 * real Supabase project is configured (spec §13: Google + Apple sign-in).
 */
export function OAuthButtons() {
  if (authMode() !== "supabase") return null;
  const providers = (["google", "apple"] as const).filter((p) => isOAuthEnabled(p));
  if (providers.length === 0) return null;

  return (
    <div className="space-y-2">
      {providers.map((provider) => (
        <form key={provider} action={signInWithOAuthAction}>
          <input type="hidden" name="provider" value={provider} />
          <Button type="submit" variant="outline" className="w-full capitalize">
            Continue with {provider}
          </Button>
        </form>
      ))}
      <div aria-hidden className="flex items-center gap-3 py-1 text-xs text-faint">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
