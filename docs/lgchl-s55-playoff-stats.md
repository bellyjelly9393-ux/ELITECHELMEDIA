# EliteChel Media · LGCHL Season 55 Playoff Statistics
Status: UI and reviewed public feed implemented. No Season 55 playoff player totals have been approved for publication yet.

## Sources and provenance
- `/api/lgchl-playoffs` is the live public playoff bracket and game schedule; `assets/lgchl/playoffs/s55.json` is the dated fallback.
- `playoff-stats.js` only counts a playoff game in team GP/W/L/GF/GA if the game ID is valid, the game is `final`, and distinct nonnegative final scores are present.
- Source `public.lg_player_season_stats` distinguishes `season_type='regular'` from `season_type='playoffs'`. There were no LGCHL S55 playoff rows on November 15, 2026.
- The approved public feed is `public.ecm_lgchl_s55_playoff_public_players`. It contains only selected league stats and source provenance; it is **not** a direct public window into the underlying imports or any Elite Labs/War Room data.
- RLS permits public SELECT only on individually verified rows with official LeagueGaming source URLs and review timestamps. Anonymous and authenticated visitors have no write permissions. No sample rows were inserted.

## Updating postseason player and goalie leaders
1. Wait for Season 55 `LGCHL`, `season_type='playoffs'` import to contain real official totals. Never use `regular` or `career` rows as a substitute.
2. Match each row to the correct team and league. Reject missing identities, duplicate or ambiguous aliases, and incomplete goalie data.
3. Stage the reviewed numerical totals in `ecm_lgchl_s55_playoff_public_players` as `verified=false` with the source box-score URL and review timestamp. The RLS gate prevents unfinished rows from appearing publicly.
4. Compare GP/G/A/PTS, saves, shots against, and goals against against the official playoff page and game-by-game source. Ensure cumulative stats contain only playoff games and no duplicated lagout segments.
5. Set `verified=true` **only** for individually reviewed rows. Browser public queries immediately surface them; no website deployment is required.
6. When an official number changes, mark its row unverified before editing, reconcile the correction with dated evidence, then approve again. Keep a dated source/correction log outside the public table.
7. Before importing results for a new round, verify the correct `season_type` and complete the same approval checks.

## Rimouski correction
- The current regular-season standings view was observed at **47–15–1, 95 points**, which conflicts with the reported **22-loss** second-tagging outcome.
- Contender rankings quarantine Rimouski while that contradiction remains. Do not invent adjusted points, wins or goal differential.
- After LeagueGaming's authoritative standings feed has incorporated the correction, Rimouski can re-enter the editorial contender calculation.

## Editorial contender methodology
- Only teams present in the official playoff bracket qualify.
- Index = 55% regular-season points percentage + 25% normalized goal differential per game + 20% official playoff seed. Once verified final playoff games exist, the final 20% uses playoff win rate.
- This is an **editorial index**, not official rankings, odds, or a measured championship probability.
- Matchup storylines disclose that player-to-watch numbers are regular-season history, not playoff production or confirmation of lineup availability.

## Release QA
Run `node --test tests/playoff-stats-broadcast.test.cjs tests/league-leaderboards.test.cjs`. Manually check at phone/tablet/desktop widths: full leaderboard team backgrounds, linked Hockey Cards, playoff team totals and series previews, dropdown menus, and source freshness statuses. Do not claim visual QA until actually performed.
