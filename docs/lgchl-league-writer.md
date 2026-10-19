# LGCHL league writer (night wraps for LGCHL Media) — draft only

Status: **PR only. Not deployed, migration not applied, cron created disabled, nothing published.**

## Where league write-ups come from today (before this PR)

- `lgchl-media.html` / `lgchl-media.js` / `lgchl-media-segments.js`: the LG Media page builds its "League notes",
  power index, races, heaters & skids, upsets and matchups **in the browser** from public views
  (`lgchl_standings_current`, `lgchl_standings_snapshots`, `lgchl_games_board`, `wm_lgchl_s55_player_leaders`).
  These are team-level and season-level only: no night wrap, no per-game player performances, nothing stored.
- `media_posts`: Hitmen recaps/finals only. The one "night wrap" ever stored (media_key `night-wrap`, Oct 6) is a
  **Hitmen** night wrap rendered by `hitmen-postgame.js` / `hitmen-media-room.js`. No league-wide wrap table exists.
- Radio Show Host (Script) writes league write-ups and Hitman Radio segments by hand from the same public data.

## What this adds

`supabase/functions/lgchl-league-writer/`
- `public-sources.mjs` — the privacy boundary (see below).
- `load.mjs` — loads one Eastern-time game night through the allowlisted reader only.
- `compose.mjs` — deterministic night wrap (no AI, no quotes, no invented facts), same template approach as
  `hitmen-recap-autowriter`:
  - every final, grouped WHL / OHL / QMJHL, with OT, upset, shutout and box-score flags;
  - game of the night, picked by rule (upset gap, OT, conference top-four meeting, goal total, shutout, hat trick);
  - top performers, three-point nights, hat tricks, goalie save %, shutouts with the goalie when box-scored;
  - 2–3 player spotlights (night stat line, game-by-game, season line and LGCHL rank, point streaks);
  - scoring race (points/goals/assists/SV% leaders, freshness-labelled);
  - team win streaks, snapped streaks and skids (LG streak strings), milestones crossed tonight;
  - power-index movers (same formula as the page), new No. 1, winless nights, conference races by points;
  - `@gamertag` mentions exactly as LG lists them (Markdown-escaped, so they render byte-for-byte);
  - a Sources & coverage section that lists every gap instead of filling it.
- `index.ts` — Edge Function. `POST { night?, dryRun? }` with `x-sync-token`; **dryRun defaults to true**. With
  `dryRun:false` it only calls `lgchl_media_save_draft` (status `draft`, never overwrites an approved/rejected row).
- `scripts/lgchl-league-writer.mjs` — CLI: `--snapshot file.json` (offline) or `--rest` (anon key; RLS hides the
  server-only box scores, so you get finals/standings/season stats only). Writes `sample-night-wrap-<night>.md/.json`.
- `supabase/migrations/20261018200000_lgchl_media_night_wrap_drafts.sql` (**unapplied**): `lgchl_media_drafts`
  (staff-read only, no anon), the service-role save RPC, and a 12:50 AM EDT Mon/Tue/Wed kick created **disabled**.

How facts are derived:
- OT vs regulation: LG's own W/L/OTW/OTL deltas in the standings snapshots, cross-checked between both clubs;
  unresolved games carry no label (5 of 93 on Oct 13).
- Player lines: published LG box scores. A team side is used only if its goals equal the official final.
  Unlabelled lines are attributed only via the player's public season team.
- Milestones: only when every one of the player's team games that night is box-scored and the season stats were
  synced after the night and before the next one.
- Season context: LG Season 55 stats; labelled "after tonight" only when fresh, otherwise "as of <date>".

## Privacy enforcement

1. **Allowlist in code** (`PUBLIC_SOURCES`): 9 tables, explicit columns. Every read needs an explicit column list; no
   `*`, casts, embeds or joins; filter columns must also be allowlisted; `lg_player_season_stats` must be pinned to
   LGCHL regular season and `lg_game_box_scores` to LGCHL.
2. **Never-columns**: `lg_user_id`, `raw`, `scouting_player_id`, `period_stats` (the stored blob carries the page's
   signup log), `source_snapshot_id`, `team_id`, `author_id`.
3. **Forbidden-name guard** (`hitmen_`, `scout`, `vod`, `film`, `pregame`, `tendenc`, `chemistry`, `lineup`,
   `war_room`, `rating`, `valuation`, `intelligence`, `opponent`, `media_posts`, …) applies even if the allowlist is edited.
4. **Re-projection**: rows are rebuilt from the requested columns, so a backend that over-returns cannot leak.
5. The composer and loader never get a database client; the test fails if they reference one, a private table, or
   a table outside the allowlist. The Edge Function reads `lg_sync_settings` only to check the caller's token.
6. `tests/lgchl-league-writer.test.mjs`: refuses 43 real private tables (incl. `hitmen_opponent_ea_games`,
   pregame/scout reports, VOD, chemistry, lineups, battle plans, valuation, intelligence), runs the full pipeline
   against a snapshot seeded with private canary tables and raw/lg_user_id canaries, and asserts none appear.

## Gaps (honest)

- **Player lines exist for 3 of 93 games per night**, all Calgary games, because box scores are imported only for
  Hitmen games (`lg_game_box_scores`). League-wide player nights need either the unapplied public box-score
  pipeline (`20261016210000`, blocked by LG 403s) or, cheaper, the unapplied stat-history trigger
  (`20261017140000_lgchl_player_stat_history.sql`). The writer already reads `lgchl_player_stat_history` when it
  exists and switches to league-wide night deltas automatically.
- Conference races are by points (LG tiebreakers not applied).
- No public LG transactions feed exists in the hub (`transactions` is the hub's own table), so no transaction notes.
- LG season "GP" counts differently from team games; the writer quotes it as LG lists it and computes no per-game rate.

## Radio Show Host routine (suggested)

Replace hand-written wraps with: at 1:00 AM Mon/Tue/Wed ET, read the draft for last night
(`select title, dek, body_md, payload from lgchl_media_drafts where kind='night-wrap' and night = <yesterday ET>`),
or until the function is deployed, run
`node scripts/lgchl-league-writer.mjs --night <YYYY-MM-DD> --snapshot <export.json>` on a public export.
Use `payload.metrics` / `payload.cards` / `payload.mentions` for the radio segment, add only voice and transitions, and
never add a fact, quote or stat that is not in the draft. Drafts stay drafts until Seth approves.

## Partial nights (nightly job)

The nightly `lgchl-night-wrap-drafts` call runs in partial-night mode by default (`partial` omitted or `true`):
every final is written, and each unreported game is listed under **Sources & coverage** as
`Not yet reported (N): Away at Home, scheduled H:MM PM ET (LG game ID)`. No result is ever inferred for those games.
If fewer than 80% of the night's games are final, nothing is saved and the function logs
`{ saved: false, reason, pending }` (also returned in the HTTP response). Pass `partial: false` for the old all-final rule.
The CLI matches with `--partial` (80% floor; override with `--min-final 0.9`).

## Players of the Night

`lgchl_public_night_players` (migration `20261019200000`) gives each player's change in LG season totals across each of the last 7 game nights: the latest total saved before the night's first game compared with the last total saved after it, before the next night starts. The 12:25 AM ET `lgchl-stats-postnight` refresh writes the "after" totals.
The LG Media page and the night wrap use the same rule. The three stars are the top three skaters by points, then goals, then shots. Goalie of the night is the best save % with 50+ shots faced.
Both show coverage as goals accounted for vs. official finals. Players without a saved pre-night total are not ranked.
`lgchl_public_week_players` now covers the current week while it's in progress (`week_complete=false`).

Backfill (Oct 19): `supabase/backfills/20261019_lgchl_stat_history_pre_oct18.sql` holds the totals as stored at 11:41 AM ET on Oct 18, before Sunday's games. They come from an allowlisted export of `wm_lgchl_s55_player_leaders`, and only rows refreshed that morning are included (1,234 rows). For Oct 18 they account for 779 of 848 goals.
