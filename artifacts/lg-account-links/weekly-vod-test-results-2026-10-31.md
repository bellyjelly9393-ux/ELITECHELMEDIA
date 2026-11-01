# Weekly VOD test results - October 31, 2026

Branch: `feature/lg-player-identity-resolver`. No deployment, production writes, or original report changes were made.

## Tests executed

- 37 isolated PostgreSQL identity, publication and authorization checks passed. Includes three explicitly verified aliases of one player, distinct similarly named players, missing/ambiguous LG IDs, and no replacement of existing reports.
- 45 Node checks passed across VOD review, game lineup preflight, console/character lookup, LG capture parser, routing, period approval and GM evidence access.
- Five Python account-export checks passed.
- Player-matching and report-restoration DOM checks passed.
- Desktop/mobile browser workflow checks passed, including reviewed-evidence preservation, approval, publication controls, archive and restore. The initial restricted browser launch failed; the permitted local browser rerun passed.

These checks validate software behavior with controlled fixtures. They do not prove hockey observations or complete identification in real footage.

## Read-only audit of this week's saved reviews

The companion JSON contains the five saved review IDs, source windows, reported names, and unresolved game links. It deliberately excludes full private scouting prose.

| Saved review | State | Names in saved document or worker rollup | Verified game link |
| --- | --- | ---: | --- |
| Oct 25 Game 1 lag-out reconstruction | Needs periods | 0 | Missing |
| Oct 25 Windsor | Ready for review | 13 | Missing |
| Oct 25 Gatineau | Ready for review | 8 | Missing |
| Oct 27 London | Ready for review | 5 | Missing |
| Oct 27 Ottawa | Ready for review | 5 | Missing |

The document is used when present; otherwise the worker's final player rollup is used. These counts are name rows, not unique verified participants. None of these selected report layers contains the new canonical player list or LG user IDs on its player rows. Period evidence may mention additional names; the counts are not a full evidence search.

- Ottawa's worker rollup contains both Kells and Setty. This is a potential alias duplication, not proof they are the same player. Kells and Bad News Kells remain unmerged.
- Windsor's saved manual match map points Jose Lecum and Whiteout181 to the same locker. This records the existing mapping; it does not independently verify it.
- Saved LG client final-game captures for Windsor (917960) and Gatineau (918009) each contain ten skaters and two goalies, all with LG IDs. They supply a 12-player expected roster for each game. Broadcast aliases still require verification before calculating attributed coverage. The captures also show positions that differ from some report labels; position alone must not identify a player.
- No October 26 review or October 27 Moncton review was present among the team's recent saved reviews. The October 27 source context explicitly says its recording contains Games 2 and 3 only. Existing season account links or pregame lists cannot supply missing footage or actual participation.

## Fresh VOD rerun blockers and confirmations

Fresh video analyses were not started. Railway's existing `vod-restore-test` service is sleeping on `fix/vod-auto-restore-worker`, commit `e8ad201c094a88961153d40b140157ab3c0c05ec`, predating the resolver. Its connected variable reader exposes names only; an isolated database destination could not be verified. Starting jobs there would not test this branch's resolver.

The resolver SQL has not been installed in a staging database. A meaningful end-to-end test requires a separate database and worker integrating this branch, fresh test-only review IDs, actual per-game LG lineup evidence for both teams, and explicitly verified broadcast aliases. The lag-out game additionally needs confirmed period/restart boundaries. Game IDs suggested by dates/opponents must be confirmed against footage before linking test reviews.

Needed confirmation: permission to prepare/deploy an isolated test worker and database for this branch (production remains untouched). Also needed: missing recording links for October 26 and Moncton if testing all nine scheduled games, plus the lag-out period boundaries and unresolved in-game aliases. No confirmation is needed to rerun the local regression checks.
