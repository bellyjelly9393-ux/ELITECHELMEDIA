# LG3S Week 2 drop review: flags (validated 2026-10-24, ET)

Source drop: `lg3s-drops/` on main (README, `schedules/lg3s-s1-week-02.json` + `.csv`, `teams/lg3s-s1-teams.json`). Source files were **not modified**.

## Schedule: 54 / 54 validated, 0 mismatches
Every game (921587–921640, Oct 28–30) agrees with **lg3s_games** (away/home LG team IDs, game night, UTC start) and with **seth_upload3.xlsx** (date, ET time, away/home IDs). ET→UTC uses America/Toronto (EDT, UTC−4 on Oct 28–30): 20:00 / 20:35 / 21:10 ET = 00:00 / 00:35 / 01:10 UTC the next day.
Structure checks pass: 54 unique IDs in the exact range, 9 slots × 6 games, 9 games per team, no team twice in a slot, no repeated pairing, all `scheduled`, the CSV agrees row-for-row with the JSON, every `source_url` carries its own game ID, team names agree with IDs, and no lg3s_games week-2 ID is missing from the drop.
All `lg_private_matchmaking_code` values are `null` / `not_verified`. Correct per the README; none was derived from game IDs.

## Team mapping flags
1. **Slovakia (LG 1079): no EA club ID.** Its 9 week-2 games are `blocked_missing_club_id` for EA matching until Seth provides a verified ID. Not invented.
2. **47705 = Czechia: not an LG3S team.** It appears in `ea_clubs.json` / seth_upload2.xlsx but not in the drop (correct). It is excluded from the mapping and must never be matched.
3. **EA club IDs are workbook-sourced, unverified at EA** (drop status `workbook_sourced_unverified`). All 11 agree with `ea_clubs.json` and seth_upload2.xlsx; there are **no new or changed IDs**. Only Canada (4526) has EA-side evidence (the week-1 match paste).
4. LG team IDs and groups for all 12 teams agree with seth_upload2.xlsx and appear in the lg3s_games schedule.

## EA matching
- Games are not played yet, so **no EA match records exist**. `lg3s-drops/ea-matches/` holds only README.md (no JSON), and the matcher reads 0 records: 45 games `not_played_yet`, 9 `blocked_missing_club_id` (Slovakia). No match was attempted or invented.
- `ea_match.py --selftest` reproduces the week-1 Canada verification. Latvia 921567, Italy 921578 and Sweden 921583 come out `matched_verified`. Japan 921574 comes out `matched_restart_review` (a 0–3 DNF restart, then the 5–2 game that matches LG). Slovakia 921541 comes out blocked.

## Process notes
- The drop README says reviewed output goes under `reviewed/`; per Seth's instruction it is in `lg3s-drops-reviewed/` instead.
- The site, Supabase and lg3s_* tables were not touched; this is review output only, on a branch, not main.
