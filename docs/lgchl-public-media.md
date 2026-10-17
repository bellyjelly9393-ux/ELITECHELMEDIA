# LGCHL public media extension — preview only

## Review status

Draft implementation on `feature/lgchl-media-network`. **Neither migration has been applied to the live project. No Edge Function, environment variable or cron change has been deployed. Do not merge or enable without owner approval.**

The first unauthenticated public LG game request (game 917527, 2026-10-16) returned HTTP 403. Requests stopped immediately. There was no login, cookie use, challenge bypass or subsequent LG request. The checked-in HTML fixture is explicitly a synthetic schema example, not a captured LG page. Real LG markup compatibility remains unverified; ingestion is disabled by default.

The user's Windows `lg_stats.db` is not available in this execution environment. The importer has only been tested against isolated SQLite fixtures. No real season-history upload has occurred.

## Files and existing systems

- Extends the existing `lgchl-league-sync`; retains its token authentication and existing league schedule/standings pipeline.
- Reads existing public `lgchl_standings_current`, `lgchl_standings_snapshots`, `lgchl_games_board` and `wm_lgchl_s55_player_leaders`.
- Leaves private `lg_game_box_scores` / `lg_game_player_lines` unchanged.
- No API route, shared header, guard, management, scouting, locker, stall, VOD or video-pipeline edits.
- The only shared CSS edit is the requested additive desk-toggle logo width.

## Unapplied migrations, in order

1. `20261016210000_lgchl_public_box_scores.sql`
   - Adds `lgchl_public_box_scores` and `lgchl_public_player_lines`.
   - RLS: anonymous/authenticated SELECT only; writes and ingestion RPCs require service role.
   - Adds a private canonical LG-user-ID to random public UUID map, private once-only jobs and a global serial worker lease.
   - New final games queue transactionally; existing Season 55 finals are queued once. Applying the migration alone makes no LG request.
   - Atomic saves reconcile goals with the official final. Public JSON is reconstructed from known numeric fields and period labels; raw HTML and raw IDs are never published.
   - Public security-invoker views expose last-five scoring, latest recorded game-week totals and coverage.
   - A separate queue cron calls the same Edge Function but is created **disabled**. Existing schedules are not changed.
2. `20261016211000_lg_public_player_history.sql`
   - Adds an allowlisted season-stat table, import ledger, completed-import pointer and two public history projections.
   - Reuses the private identity map; relationships never rely on matching display names.
   - No public aliases, scouting identifiers or LG user IDs. Season source URLs contain league/season only.
   - Staging rows remain invisible to anon/auth. Publish checks the expected row count and swaps the public import pointer atomically.

Do not run `supabase db push` or execute these migrations against live Supabase until explicitly approved. Tests apply them only to an in-memory PGlite PostgreSQL instance with stubbed cron functions, without live network or database writes.

## Public game worker

`LGCHL_PUBLIC_BOX_SCORES_ENABLED=true` opts the deployed Edge Function into the new queue and shared lease; absent/false preserves the existing schedule workflow.

One identified LG GET runs at a time, with 1.5 seconds after every success/failure. HTTP 403/429 or Cloudflare content stops the call. A challenged LG request pauses the shared sync until manual service-role review when public ingestion is opted in. Successful, failed, blocked and interrupted game fetches are not automatically fetched a second time. Failures must be reviewed explicitly; there is no automatic retry/bypass loop.

The default parser rejects incomplete/unknown tables, missing or mismatched canonical game/team/player IDs, inconsistent totals and incomplete sixes rosters/stat sections. It retains period scoring, team stats and allowlisted skater/goalie lines, with source URL, HTML SHA-256, fetch time and import time. **This validates the offline contract, not the actual LG layout.**

Before enabling: obtain an authorized, manually saved public game HTML file without login/cookies, inspect for unrelated private content, add a real sanitized fixture and validate all observed skater/goalie columns and team/period stats. A blocked fetch is not evidence the parser works against production markup.

After source validation and migration approval, deploy the reviewed function, opt in the feature flag, perform a controlled queue run and check its source-linked public rows. Enable the new cron only after those checks. Service-only `lgchl_media_resume_boxes()` clears the pause, without requeueing failed/challenged jobs.

## One-way history importer

The standard-library Python importer reads only the explicitly named SQLite file, using a read-only connection and a consistent read transaction. It selects allowlisted columns only from `skater_stats` and `goalie_stats`. It does not enumerate, read, copy or upload `browser-data/` or `browser-cache/`. Source file contents remain unchanged.

Run a dry run on the Windows computer containing the database:

```powershell
python scripts/import-lg-public-history.py
```

The default path is the exact source path supplied by the owner. An alternate named `lg_stats.db` can be supplied with `--database`. The importer reports sanitized row counts only; it fails before upload if the actual schema differs, identities are duplicated, required values are missing or points do not reconcile.

After owner approval/application of the migrations, set `LG_MEDIA_SUPABASE_SERVICE_KEY` **locally**, outside source control, and explicitly add `--upload`. Never put that credential in Vercel browser variables or a public file. Staging chunks publish together; interruption leaves the previous complete import visible.

Optional `--captured-at` accepts a known source-capture timestamp with timezone. Unknown capture time stays unknown; file modification time is not presented as an LG capture time.

Leagues: 37 NHL, 38 AHL, 84 ECHL, 39 CHL, 112 NCAA; seasons S1 onward. Raw LG IDs reach only service-only RPC inputs and the private map, not public output.

Rules unchanged from the supplied snapshot:
- Breakout: S55 CHL GP >= 6 and S54 CHL GP >= 10, positive P/GP improvement, ordered by improvement.
- AHL participation: S54 AHL GP >= 5 and S55 CHL GP >= 4.
- Participation is not evidence of the reason for a move; no cause is inferred.

## Browser gates, provenance and missing data

`lgchl-media-config.js` has separate public readiness flags, both **false** in this preview. This avoids querying nonexistent tables before migration approval. Set history true only after an approved completed import; set boxScores true only after validated public rows exist.

Breakout/movement prefer completed public history when enabled. Until then, the supplied snapshot remains visibly dated with its generation time and its original current/history source labels. No new snapshot statistics are manufactured. Missing feeds and empty qualifying samples have explicit states.

Trending means the latest **five imported appearances**, not a claim of complete league coverage. It requires five records per player. Players of the Week is a points statistics board in the latest imported game week, not an automatically published editorial award. Both display source links, fetch/import times and coverage. Weekly source links are ordered most recent first.

## Validation

There is no root package/build/lint command in this static repository. Checks are syntax checks, Edge Function type checking, parser/worker tests, PostgreSQL migration/RLS tests, Python importer tests and automated Chromium rendering.

Browser checks use isolated, explicitly synthetic API fixtures; these never enter production data. They exercise pending, populated and empty feeds at 390, 768 and 1440 pixels, tabs, literal rendering of markup-like names, and no horizontal overflow or console/page errors. A scoped GitHub Actions workflow repeats these checks and stores screenshots.

Remaining integration checks: actual LG captured HTML; dry run against the user's actual SQLite schema; approved live migrations/import; controlled Edge Function verification. These are prerequisites for live statistics, not accomplished by offline fixture tests.

## Security review follow-up (2026-10-16)

An independent read-only code review found no urgent credential leak, anonymous write grant or private Calgary publication path. It identified two publication-integrity gaps and one low-severity canonical-ID issue, corrected in the follow-up candidate:

- A complete supported sixes game now requires at least five skaters and a goalie on each team, required stat fields, team statistics and reconciled period scoring. Unknown or partial layouts fail closed for manual review.
- Canonical/OG game identity in the HTML must match the official queued game; conflicting source season/league identifiers are rejected. SQL also validates the parsed source game ID.
- Python parses integer identifiers exactly with Decimal, rejecting out-of-range PostgreSQL bigint values rather than rounding through binary floating point.

With public ingestion opted in, the shared pause now blocks ordinary schedule/probe requests as well as public queue requests. Every LG request renews and verifies the owning lease first; a delayed/expired lease response cannot begin a request. The existing 1.5-second delay and stop-on-challenge behavior remain.

Regression tests cover partial games, wrong source identities, missing period/team stats, both anon/auth RPC denial, paused/expired request leases, and identifiers above the binary64 exact range.

These are source/offline test checks, not a live database security audit. Migrations remain unapplied, the new cron and all readiness flags remain disabled, actual LG HTML is still unvalidated, and the real local SQLite file is still unavailable. Owner approval is still required.

## Player discovery follow-up

The media desk shows the top 10 qualifying players for points, goals, assists and save percentage. Its full-board and search links carry the selected metric into the existing `lgchl-leaders.html` destination.

That destination reads up to 250 players per metric from the existing public `wm_lgchl_s55_player_leaders` view, with 25 rows per page and local player/team search. Points, goals, assists and the existing extended/goalie metrics are supported. GAA sorts ascending; save percentage sorts descending. Both goalie boards use an explicit 8-GP threshold.

Tied values share a competition rank; games played and gamertag order the tied rows. Filtering and pagination preserve those original board ranks. Search is explicitly limited to the selected metric's top 250; a missing result is not a claim the player is absent from the full import. Source/import times remain visible, and unavailable values are not replaced with zero.

No database migration, parser change, private data access or new API is required for this display expansion. Existing public data already supports the larger read. New browser regressions exercise real top-ten-to-full-board links, search, ties across pages, the last page, goalie ordering/qualification and empty/unavailable states at 390/768/1440 pixels.
