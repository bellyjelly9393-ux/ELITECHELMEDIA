# LGCHL shared data drop (Seth's parser / Claude ↔ reviewer)

This directory is a **data-exchange inbox**, not the live site database. The repo is public: **never commit GitHub tokens, cookies, API keys, private player data, or authenticated EA responses**. A drop does not modify site code, Supabase, or the live LGCHL tables.

LGCHL is the LeagueGaming Canadian Hockey League. LG league id **39**. Current season **55**. Calgary Hitmen's LG team ID is **412**. That number is an LG team ID only.

Seth's parser or Claude writes raw, source-backed exports here. A reviewer checks them before anything can go live. Files are dropped in by hand. Nothing in this folder fetches data, and nobody should scrape LeagueGaming from here or get around site access controls (login walls, Cloudflare, rate limits). If a page is blocked, stop and leave the file unwritten.

## Drop types

| Folder | One file is |
|---|---|
| `rosters/` | one team's public roster |
| `lineups/` | one game's lineup |
| `results/` | one game's official result or box score |
| `schedules/` | a set of fixtures |
| `standings/` | one standings table |

A file may cover a single team or a single night. Say so in `source_note`. Leave missing teams, games, and stats out. Do not pad the file to look complete.

## Three hard rules

### 1. LG team IDs, EA club IDs, and LG game IDs stay distinct

- **LG team ID** (`lg_team_id`) is LeagueGaming's id for a club in this league. Calgary Hitmen is **412**. It is the id on LG schedule, roster, and standings pages.
- **EA club ID** (`ea_club_id`) is the separate EA Sports NHL club id, from a different system. Store `null` and `ea_club_id_status: "unknown"` unless the page you are copying prints that exact club id. A number from LG3S, a jersey workbook, or another season stays out of this file.
- **LG game ID** (`lg_game_id`) is the numeric official fixture id on the LG game page (`gameid=` in the URL). It names one game.

League id **39** and season id **55** name the competition. They are not a team id, a club id, or a game id.

### 2. Private matchmaking codes stay unverified until the page shows them

A private matchmaking code is text printed on some LG game-detail pages. It is a different value from the LG game ID. Copy it only when that exact text is on the page in `source_url`. Otherwise store `null` and `lg_private_code_status: "not_verified"`. Guessing, slicing, suffixing, or reformatting a game ID into a code is forbidden.

### 3. Every game and every record keeps its source

Each record carries its own:

- `source_url` — the public page that record was copied from
- `parsed_at` — ISO-8601 UTC time the file was parsed
- `dropped_by` — `seth-parser` or `claude`
- `source_note` — one line on what was copied

A file-level URL does not stand in for per-record URLs when the file holds more than one game or team.

## File rules

UTF-8 JSON. Add a CSV twin when the subfolder README lists a header. Name every drop as a new file:

`lgchl-s55-<kind>-<scope>-<YYYYMMDDTHHMMSSZ>.json`

Example: `rosters/lgchl-s55-roster-team-412-20261026T190000Z.json`. A correction is a new timestamped file. Leave existing files in this folder and in `lgchl-drops-reviewed/` as they are.

Every JSON file opens with `schema_version` (`"1.0"`), `league` (`"LGCHL"`), `league_id` (`39`), `season_id` (`55`), `timezone` (`"America/Toronto"`), `parsed_at`, `dropped_by`, and `source_url`.

`date` is `YYYY-MM-DD` and `time_et` is 24-hour `HH:MM`, both as printed in Eastern time. Away and home are explicit fields, copied from the source. `status` on a game is `scheduled`, `final`, `postponed`, or `cancelled`, also copied from the source. **A `scheduled` row is a fixture.** It carries no score and is not a completed game. Missing values are `null`.

## Review and handoff

1. Parser or Claude adds the raw file here, then leaves it unchanged.
2. The reviewer checks LG team IDs, EA club IDs, LG game IDs, away/home, Eastern date and time, status, and `source_url`, and confirms matchmaking codes were copied or left null. A record that does not match its source stays flagged.
3. The reviewer writes the approved copy under [`lgchl-drops-reviewed/`](../lgchl-drops-reviewed/README.md), as a new filename. The raw file stays untouched.
4. Only the site importer promotes a reviewed file onto the live site. This folder is not that importer. No workflow, cron, or script here pulls LeagueGaming or writes to the site.

Field lists for each drop type are in the subfolder README.
