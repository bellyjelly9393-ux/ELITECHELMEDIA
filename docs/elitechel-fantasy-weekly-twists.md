# EliteChel Fantasy: Weekly Twist System · Implementation Contract (Founders Beta)

Status: **Test-branch rules engine and interactive DEMO only. No real contests, public leaderboard, cash prize, player submission, or production database migration.**

## Product shape
Two independent fantasy competitions using one shared rules contract:
- **LG3S Pick Your 4:** Superstar (1), Up & Comer (1), Wildcard (1), Goalie (1). Exactly 4 distinct nations. Illustrative $36M cap.
- **LGCHL Pick Your 6:** LW, C, RW, LD, RD, G. Exactly one Superstar; at least one Up & Comer; at least one Sleeper/Underrated/Bounce-Back player. No more than 2 players from the same club. Illustrative $55M cap.
- One player per position/category slot, no duplicates. Player tier/category is not a position. A tier has an individually priced player; salary is not a real-world contract.
- Different fantasy caps for 4s vs 6s; prices and scoring must be balanced against eligible pool before the first paid-prize promotion (no real prizes in beta).
- Editor curates **multiple** options per category and role using verified season, recent and weekly stats. No implicit admission of all league players into the pool.

## Surprise-week rules
Each week/format has an independent bonus definition. Available types:
- `none`: NO additional bonus; standard fantasy total.
- `bounce_back`: +points when a chosen Bounce-Back tier player reaches the published verified-week fantasy points threshold and games-played minimum.
- `sleeper_surge`: +points when a Sleeper/Underrated pick reaches both an absolute threshold and at least `multiplier × projected_week_points` (projection captured **before** the week starts).
- `heater`: +points if a Heater-tier selection reaches the published verified-week threshold.
- `position_spotlight`: sixes only, +points for a named position reaching its announced target.

Each format may have a different type, bonus, salary cap and eligible pool **in the same week**. A format may go multiple weeks without a bonus. Bonuses must be an optional **single award** per entry (never stacked) and are limited to 1–8 demo points. Bonus examples are placeholders, not finalized scoring policy.

## Editorial publish process (required before real launch)
1. Prepare draft weekly formats and eligible player pools from verified source stats; editorial review tier, position, nation/team, player LG ID, role and salary. Validate enough affordable complete lineups are possible.
2. Decide weekly twist (including `none`) **privately** before opening. This can be surprising or non-sequential, but **must not be randomly modified after exposure**.
3. Publish the entire week definition and bonus targets together, including lock datetime with ET timezone. Server saves an immutable revision/hash of the rules and prices. Do not reveal unpublished future twists.
4. Only server-backed, authenticated entries may be accepted before lock. Evaluate caps, duplicate users, tier/position/role rules and lock **server-side**. The JS module is a UX validator, not authorization.
5. Once published/first pick placed, do not alter categories, cap, salaries, player eligibility, bonus thresholds or lock without an explicit postponed/cancelled contest audit trail. Freeze the pool and rule snapshot in all submitted entries.
6. Reveal other players' lineups **at the lock**, never beforehand. This prevents copying and reduces opportunities to coordinate picks.
7. Score only from verified, non-forfeit (or explicitly rule-approved) stats with immutable game/identity references. Late stat corrections trigger a versioned recompute with disclosure, not a covert rewrite.
8. Archive weekly selected players, salary, category, bonus type, earned bonus, final score and standings rank per account. No portrait ownership, prize eligibility or wallet balances implied.

## Real data readiness (verified Nov 1, 2026)
- LG3S: `lg3s_games`, `lg3s_player_game_lines`. At inspection there were 101 verified games, 378 unverified, 5 needing review and 2 corrected. **Never score those unverified rows.**
- LGCHL: `lgchl_public_week_players` (Week 5: 995 completed player-week records) and `wm_lgchl_s55_player_leaders` (1439 records). A strict case-insensitive (gamertag, team ID, player kind) join matched all 995 Week 5 rows with zero ambiguous matches **at that snapshot**, not guaranteed for future transfers/aliases. Snapshot LG user IDs in the fantasy pool to avoid relying on gamertag changes.
- Roles, prices and named tiers must be editor-approved. The current samples are FICTIONAL.

## Implementation in this PR
- `fantasy-weekly-rules.js`: pure shared lineup validators, independent twists and scoring gate.
- `fantasy-weekly-demo-data.js`: visibly fictional player pools, salary and twist settings.
- `fantasy-twist-preview.html`, `.css`, `.js`: isolated interface for previewing both formats and alternate rounds. No account or database writes.
- `fantasy-weekly-rules.test.js`: deterministic fixtures and 23 regression checks.
- **Not integrated yet** into existing experimental `feat/lg3s-pick4` (which currently diverges from main) or any live Pick Your 6 game. Build production backend with RLS, frozen week snapshots and server validation before that integration.

## Tests
- 23/23 regression checks pass: 4s/sixes valid/invalid caps, role/category rules, nation constraint, verified stats gate, conditional bonuses, no-bonus week and independent twist behavior.
- DOM wiring smoke tests: four A, six A, six B, four B all pass; zero missing/duplicate DOM IDs.
- External browser preview loaded and verified that four A = Bounce-Back, six A = Standard, six B = Position Spotlight with valid rosters; a separate attempted mobile visual check timed out and remains **NOT VERIFIED**.

## Future beta gates
1. Inspect mobile CSS at 360px, 390px and desktop via real browser.
2. Confirm a complete score source for each competition, with verified-only and id-matching tests across actual upcoming weeks.
3. Apply reviewed database schema for published weeks, curated pool, locked picks, bonus and leaderboard with RLS. Ensure no public write privilege for editor-controlled prize/rule data.
4. Run two-account tests: one user cannot see early private picks or change another user's entry, and picks cannot change after lock.
5. Conduct a small Hitmen tester cohort and evaluate retention, participant feedback and confusion around tier vs position.
6. Keep **personal locker-stall player cards separate** from fantasy player cards. Shared identity can exist without shared ownership.

No random prize draws, trading, cash betting, or purchased entries are implemented.
