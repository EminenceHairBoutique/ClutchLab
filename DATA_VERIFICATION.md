# DATA_VERIFICATION

Research log for time-sensitive facts (spec §2, §24.2). Every claim below maps to database rows
whose `data_status`/`confidence` must match this log. **Nothing may be stored as `verified`
unless its source here is official (§2.2 priority 1–5).**

Method: web research from the build sandbox on 2026-07-21. Searches reached secondary
gaming-news aggregators and one official press-release distributor; direct official patch notes
(pubgmobile.com in-game announcements) were not captured this pass — scheduled as an editorial
review task in the seed.

## Verified-enough-to-seed claims (stored as `unverified`, confidence noted)

| # | Claim | Sources (type) | Confidence | Notes |
|---|---|---|---|---|
| C1 | PUBG Mobile Version 4.5 launched globally 2026-07-09; version window runs to ~2026-09-07 | [vpesports](https://vpesports.com/games/pubg/pubg-mobile-summer-2026) (news), [sportsdunia](https://www.sportsdunia.com/gaming/pubg-mobile-4-5-update-to-go-live) (news), [enjoygm](https://www.enjoygm.com/blog/pubg-mobile/pubg-mobile-4-5-update) (news) | medium | Consistent across 3 independent secondary sources; matches spec §2.1 baseline ("July 2026"). |
| C2 | S31 Classic Season runs 2026-07-16 → 2026-09-11 (UTC) | [topuplive](https://www.topuplive.com/news/pubg-mobile-season-31-update.html) (news), [sportsdunia](https://www.sportsdunia.com/gaming/pubg-mobile-season-31-rewards-weapon-balance-changes) (news) | medium | Two sources agree; matches spec §2.1 exactly. |
| C3 | S31 Ultimate Royale opens 2026-07-20 (UTC); ends ~2026-09-07 | [topuplive](https://www.topuplive.com/news/pubg-mobile-season-31-update.html) (news) | medium-low | Start date corroborated; end date inferred from version window + spec baseline — needs official confirmation. |
| C4 | 4.5 improved ACE32 firing animation and recoil control | [sportsdunia](https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes) (news, beta notes) | medium-low | Matches spec baseline; exact magnitude unknown — no numeric recoil deltas may be stored. |
| C5 | 4.5 SMG changes: no sprint-speed reduction while equipped; reduced moving bullet spread | [sportsdunia](https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes) (news, beta notes) | medium-low | Which SMGs exactly is unconfirmed — stored as class-level patch note, not per-weapon stats. |
| C6 | Ultimate Royale ruleset: aim assist disabled; no shop/flare gun; Crown-tier entry; esports-standard zones | [gamingonphone](https://gamingonphone.com/news/pubg-mobile-ultimate-royale-mode/) (news) | medium | Long-standing mode rules, consistent with spec; per-season rule diffs unverified. |
| C7 | 4.5 headline content: Naruto Shippuden themed mode; Spider-Man collab from 2026-07-30; Sea Odyssey mode return | [gamespress](https://www.gamespress.com/PUBG-MOBILES-VERSION-45-UPDATE-INTRODUCES-ONE-OF-ITS-BIGGEST-EVER-COLL) (official press release), [u7buy](https://www.u7buy.com/blog/new-update-pubg-mobile-4-5/) (news) | medium | Gamespress is an official PR channel — strongest source this pass, but the archived page itself wasn't snapshotted. |

## Could NOT verify (must stay null / absent / clearly labeled)

- **Current 4.5 Classic Ranked map rotation for Mobile.** Search results conflated PC PUBG's
  rotation (Erangel/Miramar/Taego/Rondo) with Mobile. Map catalog seeds as entities; per-version
  availability rows carry `data_status='unverified'` with an explicit "rotation unconfirmed" note.
- **Exact numeric weapon stats** (damage, RoF, velocity, recoil values) for any weapon in 4.5.
  Stored as NULL. The Weapon Lab renders "not yet verified" states instead of numbers.
- **Per-weapon 4.5 tier justifications from pro usage or measured testing.** Seed tiers are
  editorial baselines (`tier_methodologies.slug = 'editorial-baseline-v1'`, confidence `low`),
  flagged for review.
- **Region-specific season differences** (KR/JP, VN, TW, BGMI). Not researched this pass.

## Standing rules applied to seeds

1. Sources above are secondary (§2.2 priority 8–9) except gamespress (~3) → all seeded content
   rows carry `data_status='unverified'` with `source_name`/`source_url`/`source_date` filled.
2. `review_tasks` rows are seeded for: capturing official 4.5 patch notes, confirming the UR end
   date, confirming the Mobile map rotation, and sourcing per-weapon balance details.
3. Re-verification cadence: every claim here goes stale at the next version/season boundary
   (patch-impact workflow, spec §5.2).
