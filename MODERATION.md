# MODERATION

Community moderation policy and mechanics (spec §5.16, deliverable §22.11).

## Prohibited content — zero tolerance

Removed on sight; repeat offenses escalate to account restrictions:

1. **Cheats and hacks** — aimbots, wallhacks, ESP, "no recoil" hacks/mods, cheat menus.
2. **Macros and scripts** — recoil scripts, auto-clickers, any input automation.
3. **Modified clients** — modded APKs, injectors, config-file exploits.
4. **Account trading** — buying, selling, or renting accounts.
5. **UC scams** — discounted/free UC offers, off-platform top-up "deals".
6. **Credential requests** — asking for logins, passwords, or session tokens for any reason.
7. **False verification claims** — presenting settings or profiles as "officially verified"
   outside the platform's verification workflow.
8. **Harassment** — targeted abuse, hate, threats.
9. **Copyright infringement** — reposting protected PUBG Mobile assets or paid content.

These mirror the product's own hard rules: ClutchLab itself never ships automation, and the
community may not promote it either.

## Standards for factual claims

- Settings/meta claims presented as fact need a source (link, replicable test, or in-app record).
- "Zero recoil" claims are treated as misinformation — recoil can be managed, not deleted.
- Unsourced claims may be labeled or moved to opinion threads by moderators.

## Enforcement pipeline

1. **Automated risk flags** (`apps/web/src/lib/community/risk-flags.ts`): conservative
   rule-based screening at post time. A match sets `status='flagged'` with the matched reason —
   content is held (visible only to its author) pending human review. Flags never auto-remove.
2. **User reports**: any signed-in user can report posts, comments, or pro profiles with a
   §5.16 reason code. Reports are visible to the reporter and the moderator queue only.
3. **Moderator queue** (`/admin/moderation`, moderator role+): oldest-first review. Decisions:
   - *Remove content* → entity `status='removed'`, report `actioned`.
   - *Dismiss report* → report `dismissed` (content untouched; flagged content restored).
   Every decision writes a `moderation_actions` row — the audit trail is not optional.
4. **Pro-profile corrections**: `correction_requests` route community corrections to editors,
   feeding the §5.8 verification workflow rather than the conduct queue.

## Enforcement guarantees (tested)

- Row-level security — not UI — enforces the model: flagged/removed content is invisible to the
  public, visible to its author and moderators; authors cannot assign moderation statuses;
  only moderators can write `moderation_actions`; reports are never visible to third parties.
  See `packages/db/src/rls-community.test.ts`.
- Reputation adjustments (`reputation_events`) are written only by moderation tooling.

## Appeals

Removed-content authors may appeal via a `correction`-kind post referencing the removal;
appeals land in the moderator queue with the original action attached. A different moderator
than the original actor should resolve an appeal where staffing allows.

## Roles

- **Moderator** — conduct: reports queue, removals, warnings.
- **Editor** — content accuracy: correction requests, verification labels.
- **Admin** — both, plus role management (service-side only) and audit review.
