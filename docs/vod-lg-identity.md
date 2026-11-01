# LG identity resolver (review branch only)

This change targets the existing Elite Chel Media VOD Lab in VVHL-HUB. It does not touch elite-labs, contact production, deploy code, backfill identities or rewrite reports. The SQL installer is deliberately in docs/sql, outside automatic migrations, and has only been executed in disposable PGlite PostgreSQL.

## Existing boundaries inspected

- `team_player_lockers`: team/season delivery address with optional bigint `lg_user_id`; the existing index is not unique. A locker is not a canonical identity.
- `hitmen_schedule_games`: explicit schedule ID, team and season. No latest-season fallback is safe.
- `lgchl_games`, `lg_game_box_scores`, `lg_game_player_lines`: official game index and captured LG player lines; a schedule-to-LG-game match and actual participation still need verification. Existing stall import uses LG ID or exact tag and chooses a locker; this resolver does not trust that historical fallback as identity evidence.
- `vod_review_sessions`, approved segments/markers, `vod_game_publications`: the source observations and management approval boundary.
- `team_player_game_reports`: existing per-review/locker uniqueness; the old publisher can update reports and match any season roster member by name. `vod_player_matching.sql` is the prior implementation; it is not the new installer.
- `vod_structured_report_routing.sql`: legacy chunk routing still contains name heuristics. Structured three-period VOD reviews bypass it. This change protects the approved structured VOD publication path; it does not repair historical/legacy chunk reports.

## New behavior

Canonical identity is the tuple `[league, season, LG user ID]`. IDs remain decimal strings across JSON, avoiding JavaScript bigint precision loss. A game roster is an explicit management-attested snapshot, not the entire season roster, a presumed lineup, or a name-derived join. Game/season/team and a unique LG-ID-to-locker binding are rechecked at resolution time.

`vod_verified_game_players` records participation evidence, verifier and time. `vod_verified_player_aliases` records game-scoped gamertag, CHEL character and broadcast aliases with separate evidence. Only case and outer whitespace are normalized. No prefix, substring, punctuation-stripping or fuzzy identity matching is used. Aliases never carry automatically between games, teams, leagues or seasons. Conflicting verified aliases remain ambiguous rather than being resolved by recency.

`vod_resolve_player_identity` returns resolved identity or an explicit unresolved reason. The publisher resolves again on the server; client `player_matches` cannot prove a match. Empty choices withhold an observation and `ignore` explicitly excludes it. Unresolved names and reasons remain in the publication, with original player observations intact. Resolved notes and timestamps consolidate into one new stall report per canonical player per game, enforced by a partial unique index on the canonical tuple. The approved VOD display uses canonical_players and lists unresolved identities separately; source players remain intact for audit and editing. Ratings retain the existing publisher policy; this change does not recalculate ratings from alias counts.

The browser requires identity schema version 2, removes automatic exact-tag selection, limits choices to verified participants, and requires evidence and alias type for a new binding. CHEL profile lookups remain suggestions. A minimum evidence length validates presence only: a responsible manager must assess whether the cited source actually proves participation/ownership.

New evidence tables have RLS and management-scoped select/insert only, without authenticated update/delete. All new functions use invoker permissions. Insert triggers validate provenance and the game/locker relationship, including direct Data API writes. No service-role key or new privileged function is introduced.

The publisher locks the game and refuses any existing publication for that review or any existing AI scouting report for that team/game. It cannot refresh or correct old scouting reports. A second attempt fails without changing reports. Alias attestations are saved separately before publication; if a publication fails, those audit records remain. Correcting/revoking an attestation needs a separately reviewed administrative process.

## Confirmations needed before activation

1. Confirm the game’s schedule ID, league code and season, and the exact participating LG user IDs with source evidence. The report attachment alone does not establish these.
2. Confirm each alias separately using roster evidence and footage/timestamps. Kells, Bad News Kells and Setty remain distinct or unresolved unless the evidence establishes a shared account. No real LG IDs were invented in fixtures.
3. Review the installer against a staging copy of the actual schema, including existing RLS grants/triggers and any changes made directly in production but absent from Git. Run management/non-management and full publication tests there. Then explicitly authorize a migration and application deployment as a separate task.
4. Review any desired historical corrections separately. This branch deliberately blocks refreshes of existing reports and does not import a verified roster automatically.

To attest a roster in staging, an authorized manager inserts a row in `vod_verified_game_players` with schedule_game_id, team_id, league, season, decimal-string lg_user_id, locker_id, source evidence and their authenticated verified_by. The trigger validates scope and stamps the actual user/time. No gamertag alias is implied by this insertion: verify it through `vod_verify_player_alias` or the VOD UI with its own evidence. There is no automatic loader or roster-verification screen in this change.

## Local validation

Install test dependencies outside the repository: `@electric-sql/pglite@0.3.14`, `jsdom@26.1.0`, `playwright@1.56.1`. Set NODE_PATH to that node_modules directory.

- `node test-vod-lg-identity.cjs`: actual SQL, RLS and publication regression tests in disposable PostgreSQL; three aliases, similar names, null/duplicate LG IDs, ambiguous aliases, game/season boundaries, untrusted client choices, report preservation and authorization.
- `node test-vod-player-matching.cjs`: DOM integration, evidence requirement, suggestions, explicit alias verification and request lock.
- `node test-vod-restore.cjs`: intake, approved periods, roster load, publication and filing.
- `node --test --test-isolation=none test-vod-review.cjs test-deep-scout.cjs test-vod-archive.mjs`: existing VOD/API tests. In this Windows session the default isolated runner could not spawn children; in-process execution passes.
- `node test-vod-browser.cjs`: full browser fixture workflow; uses no production login or paid requests.

The attached report’s relevant excerpts are retained in `test-fixtures/vod-hitmen-identity-reference.json`. Synthetic numeric IDs in tests demonstrate behavior only and do not identify the real players.

## Result and changed files

Local branch: `feature/lg-player-identity-resolver`, based on `636e9bc`. Changes are staged. Creating a commit was blocked because Git has no configured author name/email; no identity was invented or global configuration changed. It is not pushed; no remote build or preview deployment was requested.

| Files | Change |
| --- | --- |
| `docs/sql/vod_lg_identity.sql` | Transactional review-only schema, evidence checks, resolver, context, alias verification, canonical report aggregation and protected publication |
| `vod-lab.js`, `vod-lab.html` | Evidence-based choices, schema check, canonical approved display and unresolved identities |
| `test-vod-lg-identity.cjs` | 32 isolated PostgreSQL checks |
| `test-fixtures/vod-hitmen-identity-reference.json` | Attachment excerpts without invented identity bindings |
| `test-vod-player-matching.cjs` | DOM evidence and canonical display regression checks |
| `test-vod-browser.cjs`, `test-vod-restore.cjs` | Updated roster-loading and evidence workflows |
| `test-vod-routing-sql.cjs` | Normalize CRLF in the test’s source comparison so the existing check also runs on Windows |
| `.github/workflows/vod-review.yml` | Pinned local test dependencies and identity regression checks |
| `docs/vod-lg-identity.md` | Schema findings, verification instructions, limitations and results |

Passed: 37 SQL checks; 45 Node tests covering existing VOD/deep-scout/archive behavior and the new parser/account paths; 5 Python evidence-export checks; 13 existing Grok API tests; DOM player matching and canonical display; restore/intake/filing; period SQL; legacy routing SQL; full browser desktop/mobile workflow; JavaScript syntax and Git whitespace checks.

One additional, unrelated existing check (`test-grok-code.cjs`) could not complete on this Windows account: its fixture requires a symbolic link and Windows returned EPERM. No assertion about that code failed; the fixture could not be created. That check remains for Linux CI. All identity-specific checks completed.

Remaining activation blockers are the absence of verified real-game roster/alias evidence and staging validation against the actual database schema. The new roster attestation table intentionally starts empty; a manager must populate it with evidence before identities can resolve. No existing scouting report was changed during this work.

## Parser-file follow-up

The saved `lgchl-drops/lineups/2026-10-26` and `2026-10-27` JSON files contain LG user IDs for both sides of three games. Their accompanying Markdown explicitly describes a full pregame candidate list, not confirmed participants: several players are listed at the same position. The first entry at a position must not be treated as the actual starter. The older `data/hitmen/season-55-week-3-posted-lineups.json` has posted position assignments but no player IDs, so it cannot independently prove canonical identity.

`lib/vod-lineup-preflight.cjs` and the read-only CLI `scripts/vod-lineup-preflight.cjs` now prepare saved `lgchl-pregame-lineups-v1` files for review. Explicit league and season are required. The output retains both sides of every game, groups nightly appearances by canonical ID, surfaces missing/unsafe/duplicate IDs, and marks every pregame entry as candidate-only. Registered names in a parser file are preserved as source names; they do not automatically become verified CHEL/broadcast aliases or participation evidence. No database insertion occurs.

Example: `node scripts/vod-lineup-preflight.cjs lgchl-drops/lineups/2026-10-27/hitmen-lineups-2026-10-27.json LGCHL 55`.

Four regression tests in `test-vod-lineup-preflight.cjs` pass against the saved parser file and malformed variants. They cover three games/both teams, one nightly record per LG account, unresolved missing/duplicate/unsafe IDs, explicit scope, duplicate games and rejection of unsupported names-only files. CI includes these tests.

The user has confirmed the client source and expanded the scope to the current week and remaining posted season. The October 26–27 sample files remain dated fixtures rather than current lineup proof. Final participation can be confirmed from an authoritative game sheet or directly verified lineup/footage, with substitutions checked per game. This adapter prepares the information available in the repository without claiming that pregame lists prove who took the ice.

### Source and scope confirmed by the user

The source is now identified: `C:\Users\elitechelmedia\Downloads\LG-Stats-Client-Developer-Starter`. Use that client as the primary workflow for LG information going forward, as recorded in the repository's AGENTS.md. Scope is the Hitmen and their scheduled opponents for the current week and remaining posted season, with each night’s three games checked separately. The preflight rejects unrelated games.

The included StatsBridge was inspected and used read-only. Exact lookup of `l Setty l` returns LG user ID `73707`; exact lookups of `Kells`, `Bad News Kells` and `Setty` returned no stored identity. A SHA-256 comparison before/after confirmed the SQLite file was unchanged. The database contains players, aliases and season statistics but no game/lineup tables. This confirms the client identity lookup works; it does not prove a particular night's participants or any CHEL/broadcast-name binding.

Existing dated `lg-game-capture-v1` exports explicitly describe LG game pages and their linked EA parts captured through the LG Stats Client. Their EA rows include `player`/`gamertag` but no stable EA account/persona ID. Therefore no stable EA ID has been inferred from those names. EA identifiers must remain separate from canonical LG IDs, with evidence for the connection. The user's narrowed scope does not authorize production writes or replacement of old scouting reports.

## LG account to console to character lookup

The new review-only installer also includes `vod_verified_platform_accounts`. It records the Xbox or PlayStation gamertag explicitly verified for a canonical participant in that game, with LG profile URL, evidence, verifier and timestamp. The profile URL must identify the exact LG user ID; a platform account cannot be assigned to two different participants in the same game. These bindings are management scoped, insert-only and RLS protected. A manager can attest a row after reading the linked-account fields in a profile captured through the LG Client. The current starter bridge does not expose Xbox/PS account fields, so no real console binding has been inferred from its current_username column, and no account-capture UI or live automatic LG profile parser is claimed here.

VOD lookup now uses only that verified console gamertag and its expected platform. Missing bindings are displayed for confirmation; it no longer falls back to the locker or roster name. The ChelStats identity API requires an exact returned username and rejects a conflicting explicit Xbox/PS platform. A missing or unknown provider platform is returned only as an unconfirmed suggestion, with platform_verified=false; it cannot establish an alias or historical game identity. Only explicit `skplayername` is suggested as a CHEL character; an arbitrary `displayName` is not. A valid EA blazeId is retained as a separate string when returned, with no unsafe numeric conversion. Fetch time and suggestion provenance are returned. A current profile does not establish what character was used in historical footage, and suggestions still require game-specific alias evidence before publication.

Public reference research on October 31, 2026:

- [ChelScout's public scout page](https://chelscout.net/scout/player) advertises fuzzy name search and currently requires sign-in for scouting. The public homepage browser code calls `/api/suggest?q=...`, displays username/team/league context and carries league_id on selection. That is name disambiguation, not public proof of an LG-to-console or character binding. Its private backend mapping was not inspected and no sign-in was performed.
- [ChelScout's About page](https://chelscout.net/about) describes code recomputing statistics from game logs before handing data to its AI. This is a useful pattern for deterministic evidence preparation, not evidence that it recognizes character aliases in VOD.
- [ChelStats](https://chelstats.app/) and [ChelHead](https://chelhead.com/) expose public player search. The existing repository ChelStats API was extended; no undocumented ChelHead endpoint was invented. The initial web-tool API check was unavailable. A later direct public API request returned a current character candidate for the LG-linked Xbox tag l Setty l; its omitted platform is retained as an unresolved qualification, never filled from assumption.

Validation: the database suite now passes 37 checks, including exact-LG profile proof, unique game console bindings, independent roster/console names, missing bindings and account RLS. Seven new API checks in `test-vod-chel-account.cjs` cover exact tags, platform conflicts/absence, character field semantics, safe EA IDs and nested identity responses. The DOM test checks the verified console tag is sent and missing account links cause no lookup. No real players were bound to Xbox/PS accounts during these tests.

## Live console-account capture

The October 31 capture uses the existing LG Stats Client class and its QWebEngine page-reading API. The source client's Windows environment lacked its pinned UI dependencies, so those were installed in an isolated workspace folder. Client source files and the original statistics database were not edited. The capture runner forces statistics connections read-only, omits auto-sync and developer-console actions, uses separate browser storage and compares the database checksum throughout the run.

The live Hitmen team view supplied 17 named players, each resolving to one exact LG ID through the client bridge. Explicit profile labels have now been captured for all 17. Examples include Gullyrr → Xbox `l Gully I`, matt_0_5 → Xbox `McKenna l72I`, and Kudolken → both PSN `Kudolken` and Xbox `I Crease Fire I`. Both links are retained for a multi-platform profile; the account used in any particular game is not selected automatically.

The live schedule defines 27 games from October 25 through November 10, involving the Hitmen and 27 opponent teams. Team-page lists can include reserves or historical members. They supply candidate IDs for account lookup, not proof of current membership or game participation. Game IDs and dates are captured directly from the LG schedule; displayed times are retained without assuming they are UTC.

`lib/lg-platform-capture-dom.js` extracts only schedule/team IDs, roster names and explicit Xbox/PSN labels within Career Info. It excludes unrelated profile details and preserves LG's special page-routing query while stripping unrelated parameters. `scripts/capture-lg-platform-accounts.py` visits pages through the client, one request at a time with a three-second gap. Resumed profile capture reads same-origin HTML without loading every image/advertisement; fetched scripts stay inert. HTTP access/rate barriers or visible verification challenges stop the run. No browser cookies or raw page HTML are exported.

`scripts/export-lg-account-capture.py` creates a separate evidence-only review file, refuses to overwrite an existing export, checks source profile IDs and schedule scope, preserves multiple linked consoles under one canonical player and flags any console handle listed under distinct LG IDs. The state/checkpoint and browser storage remain outside the repository; only curated evidence is copied into `artifacts/lg-account-links`.

Run using the client's pinned Qt dependencies on PYTHONPATH:

```text
python -B scripts/capture-lg-platform-accounts.py --client-dir <LG-client-directory> --output-dir <new-workspace-output-directory> --from-date 2026-10-25 --season 55
```

The optional `--resume-from <prior-capture-status.json>` preserves prior evidence and skips checked profiles. A stopped verification challenge requires source review; the script does not automatically retry it. New output directories keep prior captures intact.

The live ChelStats result for the source-linked Xbox tag `l Setty l` returned `Bad News Kells` and blazeId `186209497` without a platform field. It is saved as a current profile candidate. The VOD UI can display this explicitly unconfirmed suggestion, but never auto-selects it as an alias. It does not establish that historical `Kells` footage belongs to the same LG player.

Additional checks: four DOM capture tests cover field scoping, Xbox/PSN namespaces, exact LG IDs, schedule extraction and challenge stops. Five Python export checks cover multi-platform consolidation, cross-LG console conflicts, exact profile URLs and exclusion of unrelated teams. The full local Node suite passes 45 tests, the isolated SQL suite passes 37 checks, and the desktop/mobile browser and DOM workflows pass.

### Completed capture results

The live October 31 run completed all 872 scoped LG profile checks across 28 team pages and 27 posted games (October 25–November 10). The curated export contains 985 console-account links for 870 LG IDs: 755 profiles listed one account, 115 listed multiple accounts, and two exposed no account fields. No platform/gamertag pair was found under competing LG IDs in this scope. All 17 players in the observed Hitmen roster view have account evidence. The current character lookup produced 17 candidates from 18 Hitmen console accounts, with one unresolved Xbox response.

Final evidence and qualifications are indexed in `artifacts/lg-account-links/README.md`. The source database's before/after SHA-256 values match. Only account/profile evidence was collected; actual game participation, future roster changes and historical aliases remain separate verification steps. No production or existing scouting-report data was changed.
