# LGCHL game-night pull (runbook)

How the `lgchl-drops/` files and the LGCHL database rows are refreshed from LeagueGaming.
Everything runs through the user's own signed-in Chrome (Claude in Chrome): LG pages are
fetched same-origin inside that tab, **one page every 20-25 seconds**, and the run **stops at
the first Cloudflare check** (no solving, no bypassing). No cookies, passwords or tokens leave
the tab, and nothing secret is ever committed (this repo is public).

## Files

| File | What it does |
|---|---|
| `browser.js` | Paste into the LG tab with `javascript_tool`. Pacing loop, lineup parser, box-score parser, member-stats parser (the LG Stats Client's own analyzer requests), gzip+base64 packer |
| `grab.py` | Reads the packed chunks back out of the session transcript (after `get_page_text`) and writes the JSON |
| `convert.py` | Raw box scores → `lg-game-capture-v1` game files + CSVs (`SCHED=<gid,away,home csv> NIGHT=YYYY-MM-DD python3 convert.py RAW_DIR OUT_DIR`) |
| `lineups.py` | Parsed lineup pages → `lineups/<date>/hitmen-lineups-<date>.json/.md` |
| `opponents.py` | Opponents' previous-night games + season totals → `opponents/<date>/` |
| `teams.csv` | LGCHL team ids, abbreviations, names, league, conference |

## Game day (Sun / Mon / Tue)

1. **Before puck drop: Calgary's three games.** Game ids from
   `select lg_game_id, game_at_label_et, away_lg_team_id, home_lg_team_id from lgchl_games where season=55 and 412 in (away_lg_team_id, home_lg_team_id) and (game_at at time zone 'America/New_York')::date = <today>`.
   Open the first game page in the LG tab, paste `browser.js`, parse it with `__parseLU(document, id)`,
   then `__pace` the other two through `fetch` + `DOMParser` + `__parseLU`. Pack, read, run `lineups.py`.
2. **Opponents' previous night.** From the previous night's converted games, `opponents.py`.
3. Commit both to a `data/lgchl-drops-<date>` branch and open a PR (Gronk reads the branch).

## Morning after a game night

1. **All 93 games.** `__pace` every game id of the night (from `lgchl_games`) through `__boxx`.
   Pack in 60 KB chunks, `__show(tag, i)` + `get_page_text` for each chunk, `grab.py`, then `convert.py`.
2. **Finals into the database:** update `lgchl_games` (status `final`, scores, `decided_in`) only where the
   row is still `scheduled` and the team ids match.
3. **Standings:** LG's standings page (`page=standing&leagueid=39&seasonid=55`) → new
   `lgchl_standings_snapshots` rows; check every team's GP/W/L/OTW/OTL/PTS/GF/GA against LG.
4. **Leaderboards:** member-stats page (`page=team_memberstats&leagueid=39&seasonid=55`) → `__memberstats()`.
5. **Transactions:** LG's league News (`page=team_news`) and Trades (`page=team_trade`) pages.
6. Write-ups (night wrap, game stories, upset alerts) go in `assets/lgchl-writeups/writeups.json`.

Rules for every write-up: only numbers that are in the pulled data; players play one night a week
(about three games), so never imply a player played more than one night; gamertags on the hide list
never appear in public text.
