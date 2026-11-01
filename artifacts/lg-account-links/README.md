# LG account capture — October 31, 2026

The capture is complete for the LG-listed candidate pool attached to the Hitmen and their posted opponents for the current LG week and remaining posted regular season: **October 25–November 10, 2026**.

| Result | Count |
| --- | ---: |
| Posted games in scope | 27 |
| Team pages in scope, including Calgary | 28 |
| Unique LG IDs checked | 872 |
| LG IDs with explicit Xbox/PSN account fields | 870 |
| Console-account links captured | 985 |
| Profiles listing multiple accounts | 115 |
| Profiles with no listed account fields | 2 |
| Platform + gamertag pairs claimed by competing LG IDs | 0 |

All **17 players in the live Hitmen roster view** have account evidence. They account for 18 linked console accounts because Kudolken lists both Xbox and PSN. A small ChelStats check returned 17 current character-name candidates from those 18 accounts; the Xbox `I Crease Fire I` response could not be resolved.

## Review files

- [Hitmen identity map](hitmen-identity-map-2026-10-31.md): one row per LG player, with console names and current character candidates.
- [Complete season-scope account evidence](season-account-evidence-2026-10-31.json): scoped games, canonical LG players, explicit account labels, roster references and unresolved cases.
- [Capture summary](capture-summary-2026-10-31.json): final counts and completion status.
- [Original database integrity check](database-integrity-2026-10-31.json): identical SHA-256 values before and after capture.
- [Hitmen character-name candidates](hitmen-character-candidates-2026-10-31.json): exact returned account names, character fields and separate blazeId candidates.

The other files in this folder are earlier observations or progress snapshots, retained for traceability. The complete season-scope file and final summary above are the final account-capture outputs.

## What remains unresolved

- [chellybrini — LG ID 81005](https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=team_user&userid=81005&leagueid=39&seasonid=55) and [chasepidgeon. — LG ID 80074](https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=team_user&userid=80074&leagueid=39&seasonid=55) exposed no recognized Xbox/PSN account fields. No names were inferred for them.
- Multiple listed accounts remain under their single canonical LG identity. The platform/account used in a particular game is not selected from profile order.
- Team-page lists can include reserves or historical players. They are **not confirmed game lineups**. Verify actual participation separately for each game; future roster changes require fresh checks.
- ChelStats omitted platform confirmation in the current Hitmen lookups. Its character names are suggestions, not approved historical VOD aliases. `l Setty l` returned `Bad News Kells`, but **“Kells” has not been merged with “Bad News Kells.”**

## Method and validation

The existing LG Stats Client Developer Starter supplied the browser/page-reading code and exact LG ID lookups. The scoped collector read public LG pages one at a time, retained only needed roster/account evidence and stopped on access/verification errors. Browser storage and checkpoints were kept outside the repository. The client's statistics database was forced read-only, automatic syncing was omitted, and its checksum is unchanged.

The code remains on `feature/lg-player-identity-resolver`. Validation passed: **37 isolated PostgreSQL checks, 45 Node tests, 5 Python export checks, DOM integration and desktop/mobile browser workflows**. The capture/parser scripts, VOD lookup/API changes, SQL review installer, test fixtures, tests, CI and detailed implementation notes are listed in [the implementation report](../../docs/vod-lg-identity.md).

No production data was written, no deployment was performed, no aliases were automatically published, and no existing scouting reports were overwritten. Staging validation and game-specific lineup/alias evidence remain necessary before activation. A commit has not been created because this workspace has no configured Git author identity.
