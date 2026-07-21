# Claude Code (Fable 5) Master Build Prompt — v3  
## ClutchLab — PUBG Mobile Performance, Meta, Settings, and Training Platform  

> **Purpose:** This file is the authoritative build specification. Place it in the repository root and reference it from `CLAUDE.md`.  
>
> **Execution mode:** Research, design, implement, test, document, and continue through the phases in one continuous run. Do not stop after an audit or a high-level plan. Section 0.1 defines the operating protocol; Section 24 defines the execution loop.  
>
> **Non-negotiables:** No gameplay automation, macros, overlays, or live game interference — analysis is post-match only. No fabricated stats, codes, or pro settings. No copyrighted PUBG Mobile assets.  

⸻  
## 0. Your Role  
  
You are Claude Fable 5 acting as:  
  
- Principal product architect  
- Senior full-stack engineer  
- Mobile-first UX designer  
- Data modeler  
- AI/computer-vision systems designer  
- Gaming analytics product strategist  
- Security and privacy reviewer  
- QA lead  
- Technical writer  
  
Build a production-grade mobile-first application called **ClutchLab**.  

## 0.1 Claude Code Operating Protocol  

Follow this protocol for the entire build:  

1. **`CLAUDE.md` first.** Create or update `CLAUDE.md` in the repo root with: stack decisions, commands (dev, lint, typecheck, test, build, db migrate/seed), directory map, conventions, and a pointer to this spec. Keep it current as decisions are made.  
2. **Persistent progress ledger.** Maintain `PROGRESS.md` with per-phase status (done / in progress / blocked / not started), decisions made, and exact next steps. Update it after every meaningful milestone so work survives context compaction or a fresh session — a new session must be able to resume from `CLAUDE.md` + `PROGRESS.md` alone.  
3. **Git discipline.** Initialize git if absent. Commit in small, coherent units with descriptive messages (`feat(meta): version-scoped weapon tier engine`). Commit at minimum at every phase boundary and before any risky refactor. Never commit secrets; keep `.env` in `.gitignore` with a complete `.env.example`.  
4. **Verification gate at every phase boundary.** A phase is not complete until, in order: `lint` → `typecheck` → `test` → `build` all pass, and the dev server serves the new routes without console errors. Fix failures before moving on. Never mark a phase done with a failing gate.  
5. **Todo tracking.** Track the phase plan and in-phase tasks with your todo list so nothing is silently dropped.  
6. **Parallelize research, serialize implementation.** Use subagents/parallel tool calls for web research (patch notes, pro settings, season dates) and for read-only codebase exploration. Implement sequentially against a stable plan.  
7. **Honest placeholders.** When blocked by a credential or external service, build the real interface plus a clearly named mock adapter (`*.mock.ts`), document the swap-in steps in `SETUP.md`, and record the blocker in `PROGRESS.md`. Never silently stub a feature and report it as complete.  
8. **No invented data.** Seed data must follow Section 2's source rules. Anything unverifiable is labeled `sample` or `unverified` — in the database, not just the UI.  
9. **Reasonable autonomy.** Make and document sound decisions rather than pausing for approval. Ask only when a decision is irreversible, costly, or contradicts this spec.  

  
ClutchLab is an independent PUBG Mobile companion platform that helps players:  
  
1. Find current, verified pro-player sensitivity and control settings.  
2. Create settings calibrated to their device, grip, FPS, finger count, and playstyle.  
3. Understand the current weapon, attachment, map, and mode meta.  
4. Train aim, recoil, movement, positioning, audio, and decision-making.  
5. Analyze uploaded gameplay clips after a match.  
6. Track measurable improvement over time.  
7. Adapt automatically whenever PUBG Mobile receives a new version, season, balance patch, mode, weapon, attachment, or rules update.  
8. **Asynchronous VOD Combat Assistant:** A post-match analysis tool that reviews user-uploaded screen recordings to provide an AI-based danger assessment, helping players identify missed visual or auditory cues without injecting code or running live overlays during active gameplay.
9. **Recoil & Input Analysis Laboratory:** An interactive feedback tool that analyzes a player's manual horizontal and vertical recoil control from uploaded Training Grounds clips. It provides post-session metrics on crosshair placement, sound cue reactions, and mechanical inputs without utilizing any automated macros or live game interference.
  
⸻  
# 1. Product Thesis  
  
Most PUBG Mobile settings content is fragmented across YouTube videos, social posts, unverified code lists, outdated articles, and creator profiles. Many sites repeat universal “zero recoil” settings without accounting for:  
  
- Device size and aspect ratio  
- Touch sampling and input latency  
- Supported frame rate  
- Gyroscope hardware and drift  
- Finger count  
- Grip and hand size  
- Role and playstyle  
- Weapon and scope preference  
- Camera, ADS, and gyroscope interaction  
- Aim assist availability  
- Mode-specific rules  
- Version-specific weapon balancing  
- Player skill level  
  
ClutchLab must replace static advice with a **verified, versioned, personalized improvement system**.  
  
The primary product promise is:  
  
> **Do not blindly copy a pro. Learn why a setup works, test it on your own device, measure the result, and adapt it to your mechanics.**  

⸻  
# 2. Current Research Baseline  
  
Use the following as the initial context, but independently verify all time-sensitive information before seeding production data.  
  
## 2.1 Version and season terminology  
  
Treat these as separate database entities:  
  
- **Game version:** PUBG Mobile Version 4.5  
- **Classic/Casual seasonal cycle:** Season 31  
- **Ultimate Royale seasonal cycle:** S31 Ultimate Royale  
- **Mode-specific event windows:** Ranked Arena and other limited modes may have their own dates  
- **Region:** Global, KR/JP, VN, TW, BGMI, and other editions may differ  
- **Platform:** iOS and Android behavior or availability may differ  
  
Never label Version 4.5 as “Season 4.5.”  
  
Initial official dates to verify:  
  
- Version 4.5 released globally in July 2026.  
- S31 Classic Season runs from July 16, 2026 through September 11, 2026 UTC.  
- S31 Ultimate Royale runs from July 20, 2026 through September 7, 2026 UTC.  
- Version 4.5 includes a Casual Season and supports earning Season Points through eligible unranked modes.  
- Ultimate Royale uses a more competitive ruleset and aim assist is disabled.  
- Version 4.5 includes weapon balance changes, including an ACE32 stability/recoil improvement and enhancements to some SMGs.  
  
## 2.2 Research source priority  
  
Use this order of authority:  
  
1. Official PUBG Mobile version announcements and patch notes  
2. Official PUBG Mobile Security Center  
3. Official PUBG Mobile social accounts and in-game announcements  
4. Official PUBG Mobile esports rules and competition announcements  
5. Apple App Store and Google Play version history  
6. Liquipedia PUBG Mobile pages for structured cross-checking  
7. Current professional player or team posts  
8. Current creator videos with visible settings or controlled testing  
9. Reputable gaming publications  
10. Community discussions only as supporting evidence, never as sole authority for hard facts  
  
Every time-sensitive record must store:  
  
- Source name  
- Source URL  
- Source type  
- Source publication date  
- Date last verified  
- Game version  
- Season  
- Region  
- Confidence level  
- Reviewer  
- Change log  
- Whether the information is official, measured, creator-reported, community-reported, or editorial analysis  
  
Do not invent exact weapon statistics when official or reproducible measurements are unavailable. Clearly label measured, estimated, or disputed values.  
⸻  
# 3. Target Users  
  
Support these user groups:  
  
## 3.1 Beginner  
  
Needs:  
  
- Simple setup wizard  
- Two- or three-finger layouts  
- Aim assist guidance  
- Basic recoil and movement lessons  
- Stable starter weapons  
- Short drills  
- Plain-language explanations  
  
## 3.2 Intermediate ranked player  
  
Needs:  
  
- Personalized sensitivity calibration  
- Four- or five-finger control layouts  
- Weapon and attachment recommendations  
- Classic Ranked strategy  
- Map rotations  
- Performance tracking  
- Settings comparisons  
  
## 3.3 Advanced/competitive player  
  
Needs:  
  
- Aim-assist-off training  
- Ultimate Royale preparation  
- Per-scope calibration  
- Advanced movement and peeking  
- Mode-specific metas  
- Scrim routines  
- Video review  
- Team roles  
- Pro-setting change history  
- Version-to-version diffs  
  
## 3.4 Creator, coach, or professional player  
  
Needs:  
  
- Verified public profile  
- Publishable sensitivity and control presets  
- Training plans  
- Courses and drill packs  
- Change history  
- Source verification  
- Paid coaching marketplace  
- Analytics for profile views, saves, and conversions  
  
## 3.5 Squad or clan  
  
Needs:  
  
- Team roles  
- Shared plans  
- Scrim review  
- Map strategy  
- Drop-location playbooks  
- Team training calendar  
- Squad performance notes  
- Coach permissions  
⸻  
# 4. Core Information Architecture  
  
Build the following primary navigation:  
  
1. **Home**  
2. **Meta**  
3. **Weapons**  
4. **Settings**  
5. **Controls**  
6. **Training**  
7. **Coach**  
8. **Maps**  
9. **Pros**  
10. **Community**  
11. **Profile**  
  
On mobile, use a five-item bottom navigation with a clear “More” destination. Keep the most frequent actions within one thumb reach.  
  
Recommended mobile bottom navigation:  
  
- Home  
- Meta  
- Train  
- Coach  
- Profile  
⸻  
# 5. Feature Set  
  
## 5.1 Smart Onboarding and Player Profile  
  
Ask the user for:  
  
- PUBG Mobile edition/region  
- Current game version  
- Device manufacturer and model  
- Phone or tablet  
- Screen size  
- Aspect ratio  
- Operating system  
- Supported FPS  
- Graphics preset  
- Touch sampling rate when known  
- Gyroscope availability  
- Gyroscope mode: off, scope-on, or always-on  
- Finger count  
- Dominant hand  
- Grip style  
- Approximate hand size  
- Current rank  
- Main modes  
- Preferred perspective: TPP/FPP  
- Preferred maps  
- Primary role  
- Favorite weapons  
- Favorite scopes  
- Primary weaknesses  
- Training time available per day  
- Competitive goals  
- Whether the player wants aim-assist-on, aim-assist-off, or mixed-mode preparation  
  
Allow users to skip unknown technical fields. Explain why each field matters.  

Maintain a **device knowledge base** (seeded, admin-extendable) of popular phones and tablets with known screen size, aspect ratio, refresh rate, touch sampling rate, supported PUBG Mobile FPS tier, and gyroscope quality. When a user selects a known device, prefill the technical fields and mark them as inferred so calibration can still override them.  
  
Create a **Player Mechanics Profile** with:  
  
- Input style  
- Sensitivity tendency  
- Recoil-control method  
- Tracking tendency  
- Flick tendency  
- Close-range confidence  
- Mid-range spray confidence  
- Long-range tap confidence  
- Movement proficiency  
- Decision-making profile  
- Practice consistency  
⸻  
## 5.2 Version and Season Intelligence Center  
  
Create a central page that separates:  
  
- Current game version  
- Current Classic Season  
- Current Casual Season  
- Current Ultimate Royale season  
- Current Ranked Arena window  
- Current Metro Royale season  
- Current themed modes  
- Current World of Wonder changes  
- Region-specific differences  
  
Display:  
  
- Start and end dates  
- Countdown timers  
- Patch highlights  
- Weapon changes  
- Attachment changes  
- Movement changes  
- Settings changes  
- Map changes  
- Mode rules  
- Training drills affected  
- Sensitivity profiles that require retesting  
- Pro profiles that are still verified or now stale  
  
### Patch impact workflow  
  
When a new patch appears:  
  
1. Create a patch record.  
2. Parse and normalize its changes.  
3. Link each change to affected weapons, attachments, maps, modes, settings, guides, drills, and pro profiles.  
4. Mark affected content as:  
    - Unaffected  
    - Review recommended  
    - Retest required  
    - Outdated  
5. Create admin review tasks.  
6. Notify subscribed users only when the change affects their saved setup.  
7. Preserve the previous version rather than overwriting it.  
  
Example notification:  
  
> Version 4.5 changed ACE32 recoil behavior. Your saved ACE32 3× profile should be retested with the two-minute spray calibration.  

⸻  
## 5.3 Dynamic Meta Engine  
  
Do not create one universal tier list.  
  
Build a multidimensional meta engine that can rank weapons by:  
  
- Game version  
- Season  
- Region  
- Mode  
- Map  
- Perspective  
- Solo/duo/squad  
- Range  
- Ground loot versus airdrop  
- Weapon class  
- Player skill level  
- Gyro versus non-gyro  
- Aim assist on/off  
- Device performance tier  
- Role  
- Attachment availability  
  
### Required modes  
  
At minimum, support:  
  
- Ultimate Royale  
- Classic Ranked  
- Casual/Unranked Classic  
- Ranked Arena  
- Unranked Arena/TDM  
- World of Wonder training  
- Metro Royale as a separate future module  
  
### Tier labels  
  
Support:  
  
- S  
- A  
- B  
- C  
- D  
- F  
  
Also calculate:  
  
- Raw power score  
- Availability-adjusted score  
- Ease-of-use score  
- Skill-ceiling score  
- Close-range score  
- Mid-range score  
- Long-range score  
- Squad utility score  
- Solo utility score  
- Recoil difficulty  
- Attachment dependency  
- Ammo/logistics burden  
- Map suitability  
- Mode suitability  
- Confidence score  
  
### Important tier-list rules  
  
- Do not rank airdrop weapons and ground weapons together without an availability-adjusted view.  
- Do not rank all ranges together without showing the range profile.  
- Do not rank shotguns, SMGs, ARs, DMRs, and SRs using one simplistic formula.  
- Show why a weapon received its tier.  
- Show the previous tier and what changed.  
- Allow users to filter by “best for me,” not only “best overall.”  
- Let users compare editorial, pro-usage, measured-stat, and community tier lists.  
- Flag disputed rankings.  
  
### Current 4.5 seed requirement  
  
Research and seed a Version 4.5/S31 baseline for every available weapon. Do not blindly copy a single article.  
  
For each weapon, create:  
  
- Overall tier  
- Mode-specific tiers  
- Map-specific tiers  
- Range profile  
- Best role  
- Difficulty  
- Recommended pairings  
- Best attachment packages  
- Alternative attachments  
- Patch-change notes  
- Evidence and confidence  
  
The initial seed must explicitly evaluate:  
  
- ACE32 after its Version 4.5 stability/recoil improvement  
- SMGs affected by Version 4.5 mobility/response enhancements  
- M416  
- AUG  
- M762  
- AKM  
- SCAR-L  
- UMP45  
- Vector  
- UZI  
- MP5K  
- P90  
- DBS  
- M1014  
- S12K  
- Mini14  
- Mk12  
- SLR  
- SKS  
- AWM  
- AMR  
- M24  
- Kar98k  
- Groza  
- MG3  
- DP-28  
- Map-exclusive weapons  
  
Do not publish unsupported precision. When sources disagree, expose the disagreement.  
⸻  
## 5.4 Weapon Lab  
  
Create a detailed page for every firearm.  
  
### Required data  
  
- Weapon name  
- Weapon class  
- Ammo type  
- Availability  
- Map availability  
- Fire modes  
- Magazine size  
- Extended magazine size  
- Compatible sights  
- Compatible muzzles  
- Compatible grips  
- Compatible stocks  
- Base damage when reliably known  
- Rate of fire when reliably known  
- Bullet velocity when reliably known  
- Damage drop-off  
- Reload characteristics  
- Hip-fire behavior  
- Moving accuracy  
- Recoil profile  
- Horizontal versus vertical recoil  
- Camera shake  
- Muzzle velocity  
- Practical effective ranges  
- Armor interactions  
- Patch history  
  
### Interactive tools  
  
Build:  
  
1. **Weapon Comparator**  
2. **Time-to-kill explorer**  
3. **Hits-to-kill explorer**  
4. **Range and armor simulator**  
5. **Attachment simulator**  
6. **Recoil profile viewer**  
7. **Scope compatibility viewer**  
8. **Weapon pairing recommender**  
9. **Map availability filter**  
10. **Mode recommendation engine**  
  
Every calculator must disclose assumptions.  
  
### Weapon pairing recommender  
  
Recommend primary/secondary combinations according to:  
  
- Mode  
- Map  
- Role  
- Range coverage  
- Ammo overlap  
- Inventory burden  
- User recoil ability  
- Aim assist rules  
- Squad composition  
- Loot availability  
  
Examples of pairing archetypes:  
  
- Stable AR + DMR  
- High-damage AR + SR  
- SMG + DMR  
- Shotgun + AR  
- LMG + DMR  
- Airdrop primary + utility secondary  
⸻  
## 5.5 Attachment Optimization Lab  
  
Do not display one universal “best attachment” without context.  
  
For each weapon and attachment slot, model:  
  
- Vertical recoil reduction  
- Horizontal recoil reduction  
- Recoil recovery  
- Camera shake  
- Weapon sway  
- Initial bullet stability  
- Sustained spray stability  
- Hip-fire spread  
- ADS speed  
- Scope opening behavior  
- Sound suppression  
- Muzzle flash  
- Reload or magazine benefits  
- Weapon-specific compatibility  
- Patch/version applicability  
  
### Required recommendation presets  
  
- Lowest total recoil  
- Lowest vertical recoil  
- Lowest horizontal recoil  
- Best first 10 bullets  
- Best sustained 40-round spray  
- Best close-range handling  
- Best 3× spray  
- Best 4× spray  
- Best tap firing  
- Best stealth  
- Best hip fire  
- Best beginner setup  
- Best competitive setup  
- Best setup when preferred attachment is unavailable  
  
### Personalized attachment ranking  
  
Use the user’s actual weakness.  
  
Examples:  
  
- A player who controls vertical recoil well but struggles with horizontal deviation should not automatically receive a vertical grip recommendation.  
- A non-gyro player may need a different setup from an always-on gyro player.  
- A close-range entry player may prefer handling and first-shot behavior over maximum long-range stability.  
  
### Attachment A/B test  
  
Guide the player through two controlled Training Grounds trials:  
  
- Same weapon  
- Same scope  
- Same distance  
- Same stance  
- Same magazine length  
- Different attachment package  
  
Collect:  
  
- Group width  
- Group height  
- Downward correction effort  
- Subjective stability  
- Target reacquisition speed  
  
Store the result and update the recommendation.  
⸻  
## 5.6 Settings Intelligence Lab  
  
Create explainers and recommendations for all meaningful game settings.  
  
At minimum include:  
  
- Aim assist  
- Gyroscope  
- ADS gyroscope  
- Camera sensitivity  
- ADS sensitivity  
- Free-look sensitivity  
- Camera rotation while ADS  
- Peek and fire  
- Peek and open scope  
- Lean mode  
- Scope mode  
- Quick scope switch  
- Bolt-action firing mode  
- Shotgun firing mode  
- Left-side fire button  
- Fixed joystick  
- Sprint sensitivity  
- Joystick size  
- Healing prompt  
- Auto-open doors  
- Auto-pickup  
- Throwables quick wheel  
- Throwable trajectory  
- Canted sight behavior  
- FPP swap  
- TPP camera view  
- Hit marker  
- Damage numbers where applicable  
- Sound quality  
- HRTF/spatial audio options where applicable  
- Graphics quality  
- Frame rate  
- Anti-aliasing  
- Brightness  
- Colorblind modes  
- Death replay  
- Highlight recording  
- Resource download options  
- Haptic feedback  
  
For each setting, show:  
  
- What it does  
- What it does not do  
- Advantages  
- Disadvantages  
- Beginner recommendation  
- Competitive recommendation  
- Mode-specific recommendation  
- Device-performance impact  
- Whether it needs retesting after an update  
- Source and verification date  
  
### Aim Assist Decision Lab  
  
Do not tell every player simply to turn aim assist on or off.  
  
Create a structured decision system:  
  
**Aim assist on may suit:**  
  
- Newer players  
- Classic Ranked players prioritizing accessibility  
- Players with lower touch precision  
- Players who are not preparing for aim-assist-disabled competition  
  
**Aim assist off may suit:**  
  
- Ultimate Royale preparation  
- Tournament-rule preparation  
- Players who want consistent manual tracking  
- Players who experience target-switch interference  
- Players training advanced crosshair control  
  
Build an A/B test:  
  
1. Run the same tracking and target-switch drills with aim assist on.  
2. Repeat with aim assist off.  
3. Compare:  
    - Tracking accuracy  
    - Target-switch time  
    - Headshot percentage  
    - Close-range confidence  
    - Performance with multiple targets  
4. Recommend:  
    - Keep on  
    - Keep off  
    - Train mixed  
    - Retest after sensitivity adjustment  
  
Create an **Ultimate Royale Readiness** program that specifically trains with aim assist off.  
⸻  
## 5.7 Personalized Sensitivity Builder  
  
This must be a central product, not a static calculator.  
  
### Sensitivity categories  
  
Support all current game sensitivity categories and scopes, including:  
  
- TPP no scope  
- FPP no scope  
- Red dot/holographic/iron sight  
- 2×  
- 3×  
- 4×/VSS  
- 6×  
- 8×  
- Camera sensitivity  
- ADS sensitivity  
- Gyroscope sensitivity  
- ADS gyroscope sensitivity  
- Free look  
  
### Inputs  
  
Use:  
  
- Device  
- Screen size  
- Aspect ratio  
- FPS  
- Touch sampling  
- Gyro sensor  
- Finger count  
- Grip  
- Aim assist preference  
- Main modes  
- Main scopes  
- Main weapons  
- Current settings  
- Over-aim/under-aim tendency  
- Recoil-test results  
- Target-switch results  
- User comfort  
  
### Calibration flow  
  
Build a guided in-game calibration workflow:  
  
1. Baseline setup  
2. 90° turn test  
3. 180° turn test  
4. Red-dot tracking test  
5. Hip-fire strafe test  
6. 2× tracking test  
7. 3× spray test  
8. 4× spray test  
9. 6× reduced-scope spray test  
10. DMR tap test  
11. Sniper micro-adjustment test  
12. Gyroscope drift/stability check  
13. Close-range target-switch test  
14. Final validation  
  
Only change one variable at a time.  
  
The system should make recommendations such as:  
  
> Your 3× spray is vertically controlled but spreads horizontally after bullet 12. Keep gyro unchanged and test a different grip before increasing sensitivity.  
  

### Sensitivity version control  
  
Support:  
  
- Named profiles  
- Version history  
- Before/after comparisons  
- Rollback  
- Patch compatibility  
- Device migration  
- Pro-derived profile forks  
- Notes  
- Test scores  
- Shareable codes when supplied by the user or creator  
- Expiration/reverification status  
  
### Code import  

Let users paste their own sensitivity or layout codes. Store them verbatim as user-supplied artifacts attached to the profile version — never parse a code into fabricated numeric values, and never generate codes the game did not produce.  

Never claim a code is “zero recoil.”  
⸻  
## 5.8 Verified Pro Settings Vault  
  
Create professional-player and creator profiles.  
  
### Profile fields  
  
- Display name  
- Legal name when publicly available and appropriate  
- Team  
- Region  
- Role  
- Device  
- FPS  
- Finger count  
- Grip style  
- Gyroscope mode  
- Aim assist preference when verifiable  
- Control code  
- Sensitivity code  
- Manual sensitivity values  
- HUD screenshots  
- Preferred weapons  
- Preferred scopes  
- Main modes  
- Date last updated  
- Game version  
- Source links  
- Verification level  
- Change history  
  
### Verification labels  
  
- Player verified  
- Team verified  
- Direct visual source  
- Source verified  
- Community submitted  
- Unverified  
- Expired  
  
### Staleness rules  
  
A profile becomes “review required” when:  
  
- A new game version changes relevant settings  
- The player changes device  
- The player publishes a new code  
- The source is older than a configurable threshold  
- The profile conflicts with a newer verified source  
  
### Comparison experience  
  
Allow users to:  
  
- Compare a pro’s profile to their own  
- Fork it as a starting point  
- See exact differences  
- See device compatibility warnings  
- See why direct copying may not translate  
- See historical changes by version  
- Follow a player and receive verified update notifications  
  
### Creator portal  
  
Verified creators can:  
  
- Submit new settings  
- Attach proof  
- Publish tutorials  
- Publish drill packs  
- Answer questions  
- Offer paid coaching  
- View profile analytics  
- Mark old settings as retired  
⸻  
## 5.9 Control Layout Studio  
  
Create a visual HUD editor that approximates the PUBG Mobile screen without copying protected game assets.  
  
Support:  
  
- Two-finger  
- Three-finger  
- Four-finger  
- Five-finger  
- Six-finger  
- Tablet layouts  
- Left-handed layouts  
- Accessibility-oriented layouts  
  
### Layout elements  
  
Include draggable representations for:  
  
- Movement joystick  
- Sprint  
- Left fire  
- Right fire  
- Scope  
- Peek left/right  
- Crouch  
- Prone  
- Jump/vault  
- Reload  
- Weapon slots  
- Throwables  
- Healing  
- Eye/free look  
- Backpack  
- Vehicle controls  
- Mark/ping  
- Quick scope  
- Canted sight  
- FPP switch  
  
### Ergonomic analysis  
  
Calculate:  
  
- Finger travel distance  
- Thumb workload  
- Index-finger workload  
- Button collisions  
- Overlap risk  
- Accidental-touch risk  
- Reachability  
- Simultaneous-action conflicts  
- Camera-control interruption  
- Crouch/jump/peek combo accessibility  
- Device-edge comfort  
- Safe-area/notch conflicts  
  
Show a heat map and findings like:  
  
> Your right thumb is responsible for camera, scope, crouch, jump, reload, and weapon switching. Move crouch or scope to an index finger to reduce close-range input congestion.  
  

### Layout test protocol  
  
Provide drills to test:  
  
- Scope-fire timing  
- Peek-fire timing  
- Crouch spray  
- Jump shot  
- Drop shot  
- Weapon swap  
- Heal cancel  
- Throwable swap  
- Camera continuity during movement  
  
Allow layout screenshots and codes to be stored with version history.  
⸻  
## 5.10 Training Academy  
  
Build a complete curriculum, not a loose list of tips.  
  
### Training categories  
  
### Aim fundamentals  
  
- Crosshair placement  
- Micro-corrections  
- Tracking  
- Flicking  
- Target switching  
- Reaction time  
- Head-level discipline  
- Hip fire  
- ADS transitions  
  
### Recoil  
  
- First ten bullets  
- Full magazine  
- Red dot  
- 2×  
- 3×  
- 4×  
- 6× reduced  
- Standing  
- Crouched  
- Prone  
- Moving spray  
- Vehicle spray  
  
### Close-range combat  
  
- Jiggle movement  
- Strafe tracking  
- Crouch timing  
- Jump timing  
- Drop-shot discipline  
- Shoulder baiting  
- Pre-fire  
- Hip-fire centering  
- Shotgun timing  
- Room entry  
- Staircase fights  
- Target switching between multiple enemies  
  
### Mid-range combat  
  
- Burst control  
- Spray transfer  
- Cover discipline  
- Peek duration  
- Repositioning  
- DMR follow-up  
- Vehicle knock drills  
  
### Long-range combat  
  
- DMR cadence  
- Bullet lead  
- Bullet drop  
- Sniper micro-adjustment  
- Moving targets  
- Head peeks  
- Re-peek punishment  
  
### Movement  
  
- Joystick control  
- Sprint activation  
- Jiggle patterns  
- Crouch and prone transitions  
- Jump/vault control  
- Lean combinations  
- Door fighting  
- Cover-to-cover movement  
- Camera separation  
- Vehicle exit discipline  
  
### Audio  
  
- Footstep direction  
- Floor identification  
- Distance estimation  
- Gunshot direction  
- Suppressed weapon recognition  
- Vehicle approach  
- Sound baiting  
  
### Throwables  
  
- Frag timing  
- Cooking  
- Bank throws  
- Molotov denial  
- Smoke walls  
- Smoke revives  
- Stun entry  
- Underhand throws  
- Vehicle-zone utility  
  
### Battle royale intelligence  
  
- Loot efficiency  
- Rotation timing  
- Zone prediction principles  
- Vehicle management  
- Ridge and compound control  
- Split positioning  
- Crash decisions  
- Reset decisions  
- Revive decisions  
- Endgame spacing  
- Solo versus squad decisions  
  
### Team play  
  
- Entry fragger  
- Support  
- IGL  
- Scout  
- Sniper  
- Anchor  
- Trade spacing  
- Focus fire  
- Utility sequencing  
- Comms  
- Resetting after a knock  
  
### Drill structure  
  
Every drill must include:  
  
- Objective  
- Skill category  
- Difficulty  
- Prerequisites  
- Required mode/map  
- Weapon  
- Attachments  
- Scope  
- Distance  
- Stance  
- Duration  
- Repetitions  
- Passing score  
- Advanced score  
- Common mistakes  
- Coaching cues  
- Progression  
- Regression  
- Applicable modes  
- Applicable versions  
- Video demonstration  
- Evidence/source  
- Date last verified  
  
### Daily plan generator  
  
Generate plans for:  
  
- 5 minutes  
- 10 minutes  
- 15 minutes  
- 30 minutes  
- 45 minutes  
- 60 minutes  
  
Plans must adapt to:  
  
- Weaknesses  
- Recent performance  
- Upcoming mode  
- Available time  
- Fatigue  
- Device changes  
- New sensitivity  
- New control layout  
- Patch changes  
  
### World of Wonder drill directory  
  
Support community and official World of Wonder training maps.  
  
Store:  
  
- Map name  
- Creator  
- Map code  
- Region/version  
- Training category  
- Player count  
- Rules  
- Last verified date  
- User ratings  
- Moderation status  
  
Do not assume a map code remains valid forever.  
⸻  
## 5.11 Mode-Specific Meta and Coaching  
  
## Ultimate Royale  
  
Build a dedicated competitive preparation hub.  
  
Focus on:  
  
- Aim-assist-off mechanics  
- Reliable recoil control  
- Tournament-like discipline  
- Conservative exposure  
- Fast trades  
- Utility sequencing  
- Rotation planning  
- Compound entries  
- Endgame spacing  
- Team roles  
- Communication  
- Scrim review  
  
Provide:  
  
- Ultimate Royale weapon tiers  
- Map-specific loadouts  
- No-aim-assist drills  
- Promotion/rank requirements  
- Seasonal dates  
- Rule changes  
- Team practice plans  
- Readiness score  
  
## Classic Ranked  
  
Focus on:  
  
- Placement versus aggression balance  
- Drop strategy  
- Loot route  
- Vehicle timing  
- Rotations  
- Zone edge versus center  
- Rank-safe decision-making  
- Weapon flexibility  
- Recall/themed-mode differences when applicable  
- Solo, duo, and squad variations  
  
Provide:  
  
- Rank-climb plans  
- Hot-drop, warm-drop, and safe-drop paths  
- Map-specific weapon recommendations  
- Early-, mid-, and late-game priorities  
- Survival and combat review  
  
## Ranked Arena  
  
Focus on:  
  
- Close-range TTK  
- Repeated engagements  
- Spawn awareness  
- Target switching  
- Movement  
- Pre-aim  
- Team spacing  
- Weapon mastery  
- Counter-loadouts  
- Map lane control  
  
Provide:  
  
- Arena-only weapon tiers  
- Loadout counters  
- Short warmups  
- Ranked Arena session review  
- Tilt/fatigue management  
- Weapon combat-power progress where applicable  
  
## Casual/Unranked  
  
Use as a low-pressure experimentation layer.  
  
Provide:  
  
- New control-layout tests  
- New sensitivity tests  
- Weapon challenges  
- Movement experiments  
- Beginner missions  
- Season Point guidance when officially supported  
- Transition plans into Ranked  
⸻  
## 5.12 Map Strategy Center  
  
Support current PUBG Mobile maps and version-specific availability.  
  
For each map, include:  
  
- Overview  
- Size  
- Terrain profile  
- Typical engagement ranges  
- Loot density  
- Vehicle dependence  
- High-risk drops  
- Medium-risk drops  
- Safe drops  
- Rotation choke points  
- Power positions  
- Common endgame terrain  
- Weapon meta  
- Scope meta  
- Vehicle meta  
- Mode availability  
- Version changes  
  
Create interactive map layers for:  
  
- Drop spots  
- Loot routes  
- Vehicle spawns when reliably known  
- Rotation routes  
- Choke points  
- Compounds  
- Ridges  
- Bridges  
- Water crossings  
- Sniper positions  
- Endgame examples  
  
Do not copy proprietary maps without permission. Use original, simplified tactical diagrams or licensed assets.  
  
### Personal route builder  
  
Let users create:  
  
- Drop location  
- First loot path  
- Backup path  
- Vehicle pickup  
- First rotation  
- Emergency rotation  
- Preferred compounds  
- Squad assignments  
⸻  
## 5.13 AI Post-Match Coach  
  
The AI coach must analyze uploaded recordings only after or outside active gameplay.  
  
### Supported uploads  
  
- Short clip  
- Full match  
- Training Grounds recording  
- Arena match  
- Screenshot  
- Settings screenshot  
- Control-layout screenshot  
- Match-results screenshot  
  
### Analysis targets  
  
- Crosshair placement  
- Tracking  
- Over-aiming  
- Under-aiming  
- Recoil pattern  
- Target switching  
- Reaction time  
- Exposure duration  
- Peek duration  
- Re-peek behavior  
- Cover usage  
- Movement predictability  
- Reload timing  
- Weapon switching  
- Utility usage  
- Knock-to-push decisions  
- Revive decisions  
- Positioning  
- Rotation timing  
- Death cause  
- Repeat mistakes  
  
### Output format  
  
Every review should provide:  
  
1. Executive summary  
2. Three highest-impact mistakes  
3. Timestamped evidence  
4. What the player did  
5. Why it mattered  
6. Better alternative  
7. Assigned drills  
8. Settings changes only when evidence supports them  
9. Confidence score  
10. What the model could not determine  
  
Example:  
  
> At 02:14, your crosshair entered the room below chest level. The enemy appeared from the expected right doorway, requiring a large upward correction. Practice the head-height room-entry drill before changing sensitivity.  
  

### Important AI safeguards  
  
- Never diagnose cheating from one clip.  
- Never claim exact hit registration when the video cannot prove it.  
- Separate observation from inference.  
- Show uncertainty.  
- Do not recommend sensitivity changes based on one isolated miss.  
- Require multiple samples before changing a stable profile.  
- Never provide live opponent detection.  

### Implementation pipeline  

1. Resumable upload to Supabase Storage via signed URLs, with size/duration/type limits per plan tier.  
2. Queue an idempotent `analysis_job`; process in a background worker, never in a request handler.  
3. Extract keyframes and audio features server-side (e.g., ffmpeg) at an adaptive sampling rate; send frames to the vision-capable model through the AI provider abstraction.  
4. Two-pass analysis: (a) structured per-segment observations as validated JSON, (b) a synthesis pass producing the report format above.  
5. Persist raw observations separately from the report so reports can be regenerated when prompts improve.  
6. **Cost guardrails:** per-tier monthly quotas, per-job token/frame budgets, result caching, and a circuit breaker on provider errors. Surface remaining quota to the user before upload.  
7. Every AI output stores model ID, prompt version, and confidence — required for the human-review tools in Phase 7.  
⸻  
## 5.14 Performance Tracking  
  
Track:  
  
- Drill completion  
- Accuracy  
- Reaction time  
- Tracking score  
- Flick score  
- Target-switch time  
- Spray group width  
- Spray group height  
- Headshot percentage when user-provided or measured  
- Sensitivity changes  
- Layout changes  
- Weapon mastery  
- Mode performance  
- Practice streak  
- Fatigue score  
- Confidence score  
  
Create:  
  
- Daily report  
- Weekly report  
- Monthly report  
- Patch adaptation report  
- Pre-competition report  
  
Do not reward meaningless practice volume. Reward:  
  
- Consistency  
- Accuracy  
- Transfer to matches  
- Reduction in repeat mistakes  
- Completion of deliberate drills  
- Stable improvement  
⸻  
## 5.15 Myth Lab and Controlled Testing  
  
Create a searchable library of claims such as:  
  
- “This code has zero recoil.”  
- “Aim assist should always be off.”  
- “A higher gyro is always better.”  
- “A certain grip is always best.”  
- “Crouching always solves recoil.”  
- “A tablet sensitivity can be copied to a phone.”  
- “One pro’s settings work for every device.”  
  
For each claim:  
  
- Verdict  
- Version  
- Conditions  
- Test method  
- Evidence  
- Result  
- Limitations  
- Community replication count  
- Date last verified  
  
Allow users to perform guided replications.  
⸻  
## 5.16 Community  
  
Build moderated community features:  
  
- Settings posts  
- Control-layout posts  
- Drill results  
- Weapon discussions  
- Meta debates  
- Pro-profile corrections  
- World of Wonder maps  
- Questions and answers  
- Squad recruitment  
- Coaching reviews  
  
### Moderation  
  
Prohibit:  
  
- Cheats  
- Macros  
- Scripts  
- Modified APKs  
- Config-file exploits  
- Account selling  
- UC scams  
- Credential requests  
- Harassment  
- False “verified” claims  
- Copyright infringement  
  
Create:  
  
- Reporting  
- Moderator queue  
- Automated risk flags  
- Source requirements  
- Reputation scores  
- Expert badges  
- Appeals  
⸻  
## 5.17 Coach and Creator Marketplace  
  
Allow qualified coaches to offer:  
  
- Clip review  
- Full-match review  
- Sensitivity calibration  
- Control-layout review  
- Ultimate Royale preparation  
- Squad VOD review  
- Map strategy session  
  
Include:  
  
- Coach profile  
- Region/language  
- Credentials  
- Availability  
- Pricing  
- Reviews  
- Dispute handling  
- Deliverables  
- Secure payments  
- Platform fee  
  
Do not let coaches request game credentials.  
⸻  
## 5.18 Notifications  
  
Support granular opt-in notifications for:  
  
- New PUBG Mobile version  
- New season  
- Saved weapon changed  
- Saved attachment changed  
- Pro updated settings  
- Profile became stale  
- Ultimate Royale starts  
- Ranked Arena starts  
- Daily training  
- Weekly report  
- Coach response  
- Community reply  
  
Avoid spam.  
⸻  
## 5.19 Offline and Low-Bandwidth Support  
  
Provide offline access to:  
  
- Saved settings  
- Saved controls  
- Current drills  
- Downloaded guides  
- Weapon favorites  
- Personal plans  
  
Optimize images and videos. Allow manual download quality selection.  
⸻  
# 6. Unique Competitive Advantages  
  
ClutchLab must differentiate itself through:  
  
1. Versioned and source-backed data  
2. Mode-specific metas  
3. Personal calibration instead of generic codes  
4. Verified pro-setting history  
5. Attachment A/B testing  
6. Aim-assist decision testing  
7. Control-layout ergonomics  
8. Drill-to-setting feedback loop  
9. Patch impact graph  
10. Post-match AI coaching  
11. Confidence and evidence labels  
12. Personal “best for me” rankings  
13. Ultimate Royale readiness  
14. World of Wonder drill discovery  
15. Myth testing  
16. Safe, anti-cheat-compliant design  
⸻  
# 7. UX and Visual Design  
  
## 7.1 Brand direction  
  
Use the working brand **ClutchLab**.  
  
Design language:  
  
- Competitive  
- Technical  
- Premium  
- Fast  
- Clean  
- Dark-first  
- Data-rich without clutter  
- Original, not a copy of PUBG Mobile’s interface  
  
Suggested visual direction:  
  
- Near-black graphite background  
- Neutral dark panels  
- High-contrast text  
- One electric accent color  
- Clear tier colors with accessible labels  
- Monospaced numerals for stats  
- Strong typography  
- Subtle tactical-grid motifs  
- Motion used only to clarify changes  
  
Do not use copyrighted PUBG artwork, logos, weapon renders, maps, UI screenshots, or sound effects unless licensed.  
  
## 7.2 Accessibility  
  
Meet WCAG 2.2 AA where practical.  
  
Include:  
  
- Color-independent tier labels  
- Reduced motion  
- Scalable text  
- High contrast  
- Screen-reader labels  
- Keyboard navigation on web  
- Captions/transcripts  
- Left-handed layouts  
- Large control targets  
  
## 7.3 Mobile UX requirements  
  
- iPhone safe areas  
- Android gesture areas  
- Thumb-reachable controls  
- Fast load  
- Skeleton states  
- Optimistic interactions where safe  
- Clear offline states  
- No dense desktop tables forced onto mobile  
- Swipeable comparisons  
- Sticky filters  
- Search everywhere  
- i18n-ready copy (English default; string extraction scaffolded for future locales, since PUBG Mobile's audience is global)  
⸻  
# 8. Technical Architecture  
  
Use current stable, production-ready versions at implementation time. Avoid experimental dependencies unless necessary and documented.  
  
## 8.1 Recommended structure  
  
Use a TypeScript monorepo.  
  
Suggested applications:  
  
- `apps/web` — mobile-first Next.js PWA  
- `apps/admin` — admin/editorial console  
- `apps/mobile` — Expo React Native application after the PWA foundation  
- `packages/ui` — shared design system  
- `packages/types` — shared types  
- `packages/config` — lint, TypeScript, environment validation  
- `packages/meta-engine` — ranking and scoring logic  
- `packages/calibration` — sensitivity algorithms  
- `packages/analytics` — event definitions  
- `packages/content` — content schemas and validators  
  
If the repository already exists, audit it first and preserve working systems.  
  
## 8.2 Core stack  
  
Recommended:  
  
- Next.js with App Router (chosen over a Vite SPA specifically for the SEO/SSR requirements in Section 19 — document this decision in `ARCHITECTURE.md`)  
- React  
- TypeScript in strict mode  
- Tailwind CSS v4  
- shadcn/ui or equivalent accessible primitives  
- Supabase:  
    - Postgres  
    - Auth  
    - Storage  
    - Realtime where useful  
    - Row Level Security  
- Stripe for subscriptions and marketplace payments  
- Server-side scheduled jobs  
- Background job queue for video processing  
- Sentry  
- Product analytics with privacy controls  
- Web push  
- PWA support  
- Expo/React Native for native mobile phase  
  
Use pnpm workspaces (with Turborepo or equivalent task runner) for the monorepo.  

Use a provider abstraction for AI so the product is not locked to one model vendor. Default to the Anthropic API behind that abstraction; read model IDs from environment/config rather than hard-coding them, so model upgrades are a config change.  
  
## 8.3 Architecture principles  
  
- Server-authoritative permissions  
- Typed database access  
- Schema validation  
- RLS  
- Least privilege  
- Auditable content changes  
- Immutable patch history  
- Soft deletion where appropriate  
- Idempotent jobs  
- Rate limiting  
- Signed upload URLs  
- Virus/malware scanning for uploads  
- Privacy-preserving analytics  
- Feature flags  
- Environment validation  
- No secrets in the client  
- No service-role key exposed to browsers  
⸻  
# 9. Database Design  
  
Create normalized tables, migrations, indexes, RLS policies, seed scripts, and generated TypeScript types.  
  
At minimum include:  
  
## Identity and profiles  
  
- users  
- player_profiles  
- devices  
- user_devices  
- player_goals  
- user_preferences  
- subscriptions  
- roles  
- permissions  
  
## Versions and seasons  
  
- game_editions  
- regions  
- game_versions  
- patches  
- patch_changes  
- seasons  
- mode_seasons  
- event_windows  
- content_impact_links  
  
## Modes and maps  
  
- modes  
- mode_rules  
- maps  
- map_versions  
- map_locations  
- map_routes  
- user_map_plans  
  
## Weapons  
  
- weapons  
- weapon_versions  
- weapon_stats  
- weapon_availability  
- weapon_attachments  
- attachments  
- attachment_versions  
- attachment_effects  
- weapon_pairings  
- weapon_tiers  
- tier_methodologies  
- meta_snapshots  
- meta_evidence  
  
## Settings and sensitivity  
  
- setting_definitions  
- setting_versions  
- sensitivity_profiles  
- sensitivity_values  
- sensitivity_tests  
- sensitivity_test_results  
- sensitivity_recommendations  
- setting_codes  
- profile_forks  
- profile_change_logs  
  
## Controls  
  
- control_layouts  
- control_elements  
- control_positions  
- control_analysis  
- control_test_results  
  
## Pros and creators  
  
- pro_profiles  
- teams  
- pro_team_history  
- pro_settings  
- verification_sources  
- verification_reviews  
- creator_profiles  
- creator_content  
  
## Training  
  
- skills  
- drills  
- drill_versions  
- drill_steps  
- training_plans  
- training_plan_items  
- user_training_sessions  
- drill_results  
- benchmarks  
- wow_maps  
  
## Coaching and video  
  
- video_uploads  
- analysis_jobs  
- video_observations  
- coaching_reports  
- coaching_recommendations  
- coach_profiles  
- coach_services  
- bookings  
- coach_reviews  
- marketplace_orders  
  
## Community  
  
- posts  
- comments  
- reactions  
- reports  
- moderation_actions  
- reputation_events  
- correction_requests  
  
## Sources and editorial  
  
- sources  
- source_snapshots  
- claims  
- claim_evidence  
- review_tasks  
- content_revisions  
- audit_logs  
  
## Notifications  
  
- notification_preferences  
- notifications  
- push_subscriptions  
  
Add appropriate composite indexes for version, season, region, mode, map, weapon, and verification date.  
⸻  
# 10. Meta Scoring Model  
  
Implement an explainable scoring model.  
  
Do not use a hidden arbitrary score.  
  
Example structure:  
  
```
overall_score =
  weighted(close_range_score, user/mode context)
  + weighted(mid_range_score, user/mode context)
  + weighted(long_range_score, user/mode context)
  + availability_adjustment
  + attachment_dependency_adjustment
  + ease_of_use_adjustment
  + role_fit_adjustment
  + map_fit_adjustment
  + aim_assist_rules_adjustment
  + confidence_adjustment

```
  
  
Requirements:  
  
- Store the methodology version.  
- Store each component.  
- Allow editorial overrides with an explanation.  
- Show users why a tier changed.  
- Recompute affected rankings after patch changes.  
- Keep historical snapshots.  
- Provide separate raw-power and practical-value rankings.  
⸻  
# 11. AI and Data Integrity  
  
## 11.1 Retrieval-backed answers  
  
The in-app AI coach must retrieve from:  
  
- Current version data  
- Current mode rules  
- Verified weapon data  
- User profile  
- User test history  
- Approved training library  
- Verified pro profiles  
- Source-backed guides  
  
The AI must cite the underlying app records.  
  
## 11.2 Confidence levels  
  
Use:  
  
- High  
- Medium  
- Low  
- Disputed  
- Unverified  
  
## 11.3 Hallucination prevention  
  
The AI must:  
  
- Never fabricate a sensitivity code  
- Never fabricate a pro’s settings  
- Never invent patch notes  
- Never invent exact weapon stats  
- Never present old data as current  
- Never call a setup “zero recoil”  
- State when a result is an inference  
- Ask the user to test uncertain recommendations  
⸻  
# 12. Admin and Editorial Console  
  
Build a secure admin application.  
  
Features:  
  
- User and role management  
- Version creation  
- Patch ingestion  
- Patch-change normalization  
- Season and event dates  
- Weapon records  
- Attachment records  
- Tier editor  
- Meta snapshot publisher  
- Pro-profile verification  
- Source manager  
- Drill editor  
- Guide editor  
- World of Wonder map verification  
- Community moderation  
- AI analysis review  
- Feature flags  
- Notification composer  
- Audit log  
- Content preview  
- Scheduled publishing  
- Rollback  
  
### Research workflow  
  
Create an editorial queue:  
  
1. New source discovered  
2. Source snapshot saved  
3. Claim extracted  
4. Claim linked to entities  
5. Reviewer verifies  
6. Confidence assigned  
7. Content updated  
8. Impacted pages rebuilt  
9. Subscribers notified when appropriate  
⸻  
# 13. Authentication and Permissions  
  
Support:  
  
- Email/password  
- Google  
- Apple  
- Optional anonymous guest mode  
  
Roles:  
  
- Guest  
- Player  
- Creator  
- Verified creator  
- Coach  
- Editor  
- Moderator  
- Admin  
- Super admin  
  
Use RLS for all user-owned and restricted content.  
⸻  
# 14. Monetization  
  
## Free  
  
- Basic onboarding  
- Current version summary  
- Limited weapon/meta access  
- Basic sensitivity builder  
- One saved sensitivity profile  
- One control layout  
- Basic drills  
- Limited pro profiles  
- Weekly summary  
- Community access  
  
## Pro  
  
Suggested test range: **$4.99–$7.99/month**  
  
- Full meta engine  
- All weapon and attachment tools  
- Unlimited profiles  
- Advanced sensitivity calibration  
- Control ergonomics  
- Personalized training  
- Patch impact alerts  
- Full pro vault  
- Advanced analytics  
- Limited AI clip reviews  
- Offline downloads  
  
## Elite  
  
Suggested test range: **$12.99–$19.99/month**  
  
- More AI video processing  
- Full-match reviews  
- Ultimate Royale preparation  
- Squad tools  
- Advanced reports  
- Coach discounts  
- Premium drill packs  
- Early access to new tools  
  
## Marketplace  
  
- Coach session fee  
- Creator course sales  
- Platform commission  
- Refund/dispute workflow  
  
Use entitlements, not scattered hard-coded plan checks.  
⸻  
  
# 15. Legal, Privacy, and Safe Operating Model  
  
## Safe operating model  
- No PUBG credentials  
- No claim of official affiliation  
- Prominent independent-product disclaimer  
- Trademark review before release  
- Original visuals or properly licensed assets  
- DMCA/contact process  
- Privacy policy  
- Terms of service  
- Community guidelines  
- Data deletion/export  
- Age-appropriate controls  
⸻  
# 16. Analytics  
  
Track product events with a documented event taxonomy.  
  
Examples:  
  
- onboarding_started  
- onboarding_completed  
- sensitivity_profile_created  
- calibration_started  
- calibration_completed  
- recommendation_accepted  
- recommendation_rejected  
- profile_rolled_back  
- pro_profile_followed  
- weapon_compared  
- attachment_test_completed  
- drill_started  
- drill_completed  
- ai_review_requested  
- ai_review_viewed  
- subscription_started  
- subscription_cancelled  
  
Track outcomes:  
  
- Activation  
- Day 1/7/30 retention  
- Calibration completion  
- Drill completion  
- Recommendation acceptance  
- Improvement over time  
- Patch-notification usefulness  
- Conversion  
- Churn  
- AI review satisfaction  
  
Do not collect more data than necessary.  
⸻  
# 17. Testing Requirements  
  
Implement:  
  
- Unit tests  
- Integration tests  
- Component tests  
- End-to-end tests  
- RLS tests  
- Migration tests  
- Permission tests  
- Billing tests  
- Upload tests  
- Job idempotency tests  
- Meta-scoring tests  
- Calibration logic tests  
- Accessibility tests  
- Mobile viewport tests  
- Offline/PWA tests  
- Performance tests  
- Security tests  
  
Critical E2E flows:  
  
1. Guest explores current meta  
2. User signs up  
3. User completes onboarding  
4. User creates a sensitivity profile  
5. User completes calibration  
6. User receives a recommendation  
7. User rolls back a setting  
8. User compares a pro profile  
9. User completes a drill  
10. User uploads a clip  
11. User receives a coaching report  
12. User upgrades  
13. Admin publishes a patch  
14. Impacted content becomes review-required  
15. User receives a relevant patch alert  
⸻  
# 18. Performance Requirements  
  
Targets:  
  
- Mobile-first Core Web Vitals in the good range  
- Fast first meaningful view on 4G  
- Lazy-load rich charts and video  
- Image optimization  
- Virtualized long lists  
- Server pagination  
- Indexed search  
- CDN delivery  
- Background processing for video  
- Resumable uploads  
- Graceful low-memory behavior  
- No blocking AI request on primary navigation  
⸻  
# 19. SEO and Discoverability  
  
Create structured, indexable pages for:  
  
- Current PUBG Mobile version  
- Current season  
- Weapon pages  
- Attachment pages  
- Mode tier lists  
- Map guides  
- Sensitivity explainers  
- Pro profiles  
- Training drills  
- Patch notes  
- Settings explainers  
  
Use:  
  
- Canonicals  
- Open Graph  
- JSON-LD where appropriate  
- Dynamic metadata  
- Sitemap  
- Robots controls  
- Version-aware URLs  
- Redirects for retired content  
- “Last verified” labels  
  
Do not use deceptive claims such as “guaranteed zero recoil.”  
⸻  
# 20. Implementation Phases  
  
Continue through as many phases as possible in one execution. Do not stop after generating a plan.  

**Phase exit criteria (applies to every phase):** the Section 0.1 verification gate passes (`lint` → `typecheck` → `test` → `build`), new functionality has at least smoke-level automated tests, `PROGRESS.md` and `CLAUDE.md` are updated, and the work is committed to git.  
  
## Phase 0 — Repository audit  
  
- Inspect all files  
- Run the app  
- Run tests  
- Identify architecture  
- Identify broken systems  
- Identify secrets exposure  
- Document current state  
- Preserve working features  
  
## Phase 1 — Foundation  
  
- Monorepo or clean project structure  
- Design system  
- Auth  
- Database  
- RLS  
- Environment validation  
- Core navigation  
- User profile  
- Admin roles  
- CI  
- Error monitoring  
  
## Phase 2 — Versioned content and meta MVP  
  
- Versions  
- Seasons  
- Modes  
- Maps  
- Weapons  
- Attachments  
- Sources  
- Tier lists  
- Meta filters  
- Admin publishing  
- Seed Version 4.5/S31 data  
  
## Phase 3 — Settings and sensitivity MVP  
  
- Settings library  
- Sensitivity profiles  
- Calibration flow  
- Recommendations  
- Version history  
- Rollback  
- Pro profile comparison  
  
## Phase 4 — Training MVP  
  
- Skill taxonomy  
- Drill library  
- Plan generator  
- Session tracking  
- Benchmarks  
- Weekly reports  
- World of Wonder directory  
  
## Phase 5 — Control Studio  
  
- Visual editor  
- Layout storage  
- Ergonomic analysis  
- Layout testing  
- Sharing  
  
## Phase 6 — Community and verification  
  
- Posts  
- Comments  
- Reactions  
- Reports  
- Verification workflow  
- Creator portal  
- Pro vault  
  
## Phase 7 — AI Coach  
  
- Upload flow  
- Job queue  
- Clip segmentation  
- Observation extraction  
- Timestamped report  
- Drill assignment  
- Confidence system  
- Human-review tools  
  
## Phase 8 — Billing and marketplace  
  
- Free/Pro/Elite  
- Entitlements  
- Stripe  
- Coach marketplace  
- Bookings  
- Reviews  
- Payout workflow  
  
## Phase 9 — Native mobile  
  
- Expo app  
- Shared API/types/design tokens  
- Push notifications  
- Offline access  
- Uploads  
- Deep links  
⸻  
# 21. Seed Content Requirements  
  
Seed enough realistic content that the product feels operational.  
  
At minimum:  
  
- Version 4.5  
- S31 Classic  
- S31 Casual  
- S31 Ultimate Royale  
- Current Ranked Arena status if officially verified  
- All major modes  
- All currently available maps  
- Major weapon catalog  
- Current attachment catalog  
- At least 30 settings explainers  
- At least 40 drills  
- At least 10 complete training plans  
- At least 15 weapon comparison examples  
- At least 10 attachment packages  
- At least 10 example pro/creator profiles clearly marked as sample or verified  
- At least 10 map strategy guides  
- At least 20 myth-lab claims  
  
Do not label placeholder data as verified.  
⸻  
# 22. Deliverables  
  
Produce:  
  
1. Working application  
2. Admin console  
3. Database migrations  
4. RLS policies  
5. Seed scripts  
6. Tests  
7. `.env.example`  
8. Setup documentation  
9. Architecture documentation  
10. Data-source and verification documentation  
11. Moderation policy  
12. Security review  
13. Privacy checklist  
14. Deployment documentation  
15. Product roadmap  
16. Known limitations  
17. Changelog  
  
Suggested documents:  
  
- `CLAUDE.md`  
- `PROGRESS.md`  
- `IMPLEMENTATION_PLAN.md`  
- `SETUP.md`  
- `README.md`  
- `ARCHITECTURE.md`  
- `DATABASE.md`  
- `RLS_POLICIES.md`  
- `DATA_VERIFICATION.md`  
- `META_ENGINE.md`  
- `SENSITIVITY_CALIBRATION.md`  
- `AI_COACH.md`  
- `SECURITY.md`  
- `MODERATION.md`  
- `DEPLOYMENT.md`  
- `QA_PLAN.md`  
- `ROADMAP.md`  
⸻  
# 23. Definition of Done  
  
The MVP is not done until:  
  
- The app works well on iPhone and Android mobile browsers.  
- A new user can complete onboarding.  
- The app distinguishes version, season, mode, map, and region.  
- Current content includes verification dates and sources.  
- A user can browse a mode-specific weapon tier list.  
- A user can compare weapons and attachment packages.  
- A user can create and test a sensitivity profile.  
- A user can save and roll back settings.  
- A user can browse pro profiles with verification labels.  
- A user can complete a structured training plan.  
- An admin can publish a patch and mark affected content for review.  
- RLS prevents cross-user data access.  
- Paid entitlements work.  
- Core flows have automated tests.  
- The app never performs or encourages prohibited gameplay automation.  
- Lint, typecheck, all tests, and the production build pass cleanly.  
- `CLAUDE.md`, `PROGRESS.md`, and `.env.example` are complete and current.  
- Git history is clean, incremental, and secret-free.  
- The independent-product disclaimer is visible in-app before release.  
⸻  
# 24. Execution Instructions  
  
1. If a repository is provided, run the Phase 0 audit first; otherwise scaffold the monorepo per Section 8 and initialize git.  
2. In parallel with scaffolding, use web research to independently verify the current PUBG Mobile version, S31 dates, mode availability, and Version 4.5 balance changes. Record findings with sources in `DATA_VERIFICATION.md`.  
3. Write `CLAUDE.md`, `PROGRESS.md`, and a concise `IMPLEMENTATION_PLAN.md` into the repository, then start implementation immediately.  
4. Do not return only mockups, pseudocode, or recommendations — build real routes, components, schemas, migrations, RLS policies, tests, and seed data.  
5. Use strict typing and production-quality error handling; no `any` escapes, no swallowed errors, no unhandled promise rejections.  
6. Preserve existing working functionality; behavior changes require a note in the changelog.  
7. Make reasonable decisions autonomously and record them in `PROGRESS.md` rather than repeatedly asking for approval.  
8. Continue through the phases, passing the exit criteria in Section 20 at each boundary, until blocked by a credential, external approval, or unavailable service.  
9. When blocked, implement the real interface plus a clearly named mock adapter and setup instructions rather than abandoning the feature; log the blocker.  
10. After the final phase of the run: execute lint, typecheck, the full test suite, and a production build; fix all failures before reporting.  
11. Final report must include:  
    - Phases completed and their gate results  
    - What changed (per area, referencing commits)  
    - Commands run and their outcomes  
    - Remaining blockers with exact unblocking steps  
    - Known limitations and deviations from this spec, with reasons  
    - Exact next steps in priority order  
⸻  
# 25. Final Product Standard  
  
ClutchLab should feel like a combination of:  
  
- A versioned PUBG Mobile knowledge base  
- A personalized sensitivity laboratory  
- A control-layout ergonomics tool  
- A weapon and attachment analytics platform  
- A deliberate-practice training system  
- A verified pro-settings database  
- A post-match AI coach  
- A competitive preparation platform  
  
It must be more trustworthy than a sensitivity-code website, more personalized than a static guide, safer than a game modifier, and more actionable than a collection of videos.  

Every screen should answer three questions: *what is true right now for my version, mode, and region — how do we know — and what should I do about it on my device.*  
