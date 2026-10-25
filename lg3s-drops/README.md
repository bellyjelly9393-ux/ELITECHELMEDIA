# LG3S shared data drop (ChatGPT ↔ reviewer)

This directory is a **data-exchange inbox**, not the live site database. The repo is public: **never commit GitHub tokens, cookies, API keys, private player data, or authenticated EA responses**. Do not modify the existing `lg3s-season1-data.json` or site code as part of ingest.

## Delivered, ready to check
- `schedules/lg3s-s1-week-02.json`: **54 official LeagueGaming fixtures**, Wednesday Oct 28 through Friday Oct 30, 2026, at 20:00 / 20:35 / 21:10 Eastern; 12 teams, 9 games each.
- `schedules/lg3s-s1-week-02.csv`: Same 54 fixture records for spreadsheet/manual import.
- `teams/lg3s-s1-teams.json`: 12 official LG team IDs and EA club ID candidates from the jersey workbook. Slovakia's EA club ID is **unknown**, not invented.
- `ea-matches/README.md`: Precise format for subsequent EA match-page exports, not a claim of completed EA scraping.

## Required identifiers: DO NOT CONFUSE THESE
1. **LG team ID** = season-1 national team identifier (e.g. Great Britain **1446**).
2. **EA club ID** = separate EA Sports club identifier (Great Britain candidate **50648**, not yet reverified at EA).
3. **LG game ID** = numeric official fixture identifier (e.g. **921595**).
4. **Private matchmaking code** = text like **lg1595**, which appears on *some* LG game-detail pages. It is **NOT** the LG game ID and must **never be guessed** by slicing the game ID. The JSON uses `null` for unverified codes.

## JSON schedule contract (schema_version 1.0)
Top level: `schema_version`, `league`, `league_id` (154), `season_id` (1), `week` (2), `timezone` (America/Toronto), `date_start`, `date_end`, `status`, `total_games`, `games`.

Per game: `game_id` (integer, unique), `date` (YYYY-MM-DD), `time_et` (HH:MM 24h), `away_team`, `away_team_id`, `home_team`, `home_team_id`, `lg_private_matchmaking_code` (string or null), `lg_private_code_status`, `status`, `source_url`.

**Away/home order is explicit.** Do not infer it from winner/loser or the current standings. `status: scheduled` does not assert a score.

## Review and handoff process
1. **ChatGPT / parser** writes raw source-backed exports, new versioned files. Do not overwrite a teammate's reviewed data.
2. **Reviewer / Grok** checks all matchups against official LG game pages, EA club IDs against EA, and EA results against exact club/opponent/time evidence. Keep every unmatched game flagged `unmatched` rather than force-fitting an ID.
3. Reviewer writes approved derived data under `reviewed/` using a separate filename. Only the site importer may promote reviewed exports to the public scoreboards and leaderboards.
4. Before promotion validate **54 unique game IDs, six games per slot, nine per team, all twelve IDs resolved**, no duplicate or invented box scores, and no `scheduled` record presented as a completed game.
5. Keep an attribution `source_url` for every fixture and for every EA match. Preserve raw/source provenance and parsing time. Check rate limits and page access; do not circumvent site access controls.

If an LG schedule changes, create a timestamped revision or new week file. Do not silently replace a verified data drop. This folder alone does not automatically scrape EA or perform GitHub synchronization; each agent needs appropriate repository read/write access or an authorized automation.
