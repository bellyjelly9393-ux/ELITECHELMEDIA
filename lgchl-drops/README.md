# LGCHL shared data drop (game nights)

This is a **data-exchange inbox** for writers and review bots, like `lg3s-drops`. It is not
the live site database. The repo is public: never commit tokens, cookies, login data, or
private matchmaking codes.

## Delivered

- `lineups/2026-11-08/`: **Sun Nov 8: lineups as listed on LG before puck drop**, read off management's
  screenshots (2:33 PM ET). Chilliwack Bruins @ Calgary 9:35 (complete) and Calgary @ Edmonton Oil Kings
  10:10 (Edmonton's table is cut off after the RW row; its D pair and goalie come from the posted jerseys).
  Lethbridge @ Calgary 9:00 was **not captured**. Calgary's posted six is the same in both late games.
  The matching War Room pregame reports and battle plans are in the database (approved).

- `lineups/2026-11-02/`: **Mon Nov 2: lineups as listed on LG before puck drop** for all three Hitmen
  games: vs Spokane Chiefs 9:00, at Prince George Cougars 9:35, at Victoria Royals 10:10 ET. Team
  ratings, top line and top D pair (LG's Offense/Defense Break Down), first goalie listed, and full
  lists in LG's order with OVR, salary and season numbers.
- `leaders/2026-11-02/`: season 55 leaderboards after Sunday Nov 1, from every row of LG's member stats
  (1,388 skaters, 182 goalies): points, goals, assists, +/-, hits, GWG, takeaways, interceptions, blocks,
  D-men points; goalie wins, save % and GAA (10+ GP), shutouts.
- `standings/2026-11-02/`: all 62 teams after Sunday Nov 1 (51 GP each) with LG's playoff-race order. Checked against the saved game results: GP, W, L+OTL, GF and GA match for every team. Also loaded into `lgchl_standings_snapshots`.
- `transactions/2026-11-02/`: league news roster moves (waivers, claims, assignments, eliminations; strike/warning/ban entries left out) and trades completed Oct 29-31. LG lists trade sides as gamertags only, so players are not tied to teams.
- `games/s55/2026-11-01/`: LGCHL games from Sunday Nov 1, 2026 (93 scheduled). **Complete: 93 of 93**
  (918207-918243). The pull stopped at a Cloudflare check; the rest will be added. Same format as the
  October nights (LG game-page data, no EA part detail).

- `lineups/2026-10-27/`: **Tue Oct 27: lineups as listed on LG before puck drop** for all three Hitmen
  games: at Moncton Wildcats 9:00, vs London Knights 9:35, vs Ottawa 67's 10:10 ET. Team
  ratings, each team's top line and top D pair (LG's Offense/Defense Break Down), first goalie
  listed, and full lists in LG's order with OVR, salary and season numbers.
  Who actually played is in `games/s55/2026-10-27/`.
- `opponents/2026-10-27/`: tonight's three opponents (Moncton, London, Ottawa): who each one
  actually dressed in its three games on Mon Oct 26, results, team stats, builds and season 55
  totals. Compare with `lineups/2026-10-27/`: last night's lines differ from tonight's LG lists.
- `games/s55/2026-10-27/`: LGCHL games from Tuesday Oct 27, 2026 (93 scheduled). **Complete: all 93 games.**
  Read from the public LG game pages one at a time (25-second gaps). Same files and game JSON as
  Monday, with one difference: `ea_parts` lists only the segments shown on the LG page (periods,
  submitter, time), not EA's raw per-part player data. `capture.json` `flags` lists games whose LG
  period goals do not add up to the final score, and `notes` covers three Kamloops games with no
  player lines (forfeit-style) and team records on LG pages that do not always line up game to game.
- `games/s55/2026-10-26/`: LGCHL games from Monday Oct 26, 2026 (93 scheduled). **Complete: all 93 games.**
- `games/s55/2026-10-25/`: LGCHL games from Sunday Oct 25, 2026 (93 scheduled; puck drops at
  9:00, 9:35 and 10:10 PM Eastern). **Complete: all 93 games.**
- `lineups/2026-10-26/`: Monday Oct 26 lineups as listed on LG for all three Hitmen games
  (Shawinigan 9:00, Kingston 9:35, Sudbury 10:10 ET). Includes team ratings, each team's top
  line and top D pair (LG's Offense/Defense Break Down), first goalie listed, and full lists in
  LG's order with OVR, salary and season numbers.
- `opponents/2026-10-26/`: Calgary Hitmen's Monday Oct 26 opponents (Shawinigan, Kingston,
  Sudbury). Each opponent's lineup and results from Oct 25, with season 55 player totals.
  Lineups are who played last night, not a confirmed lineup for tonight.

## Files per game night

| File | What it is |
|---|---|
| `game_<lg_game_id>.json` | One game: final score, goals by period, team stats, possession by position, every skater and goalie line, and EA parts |
| `games.csv` | One row per game: teams, score, lag-out flag, source URL |
| `skater_game_lines.csv` | One row per skater per game, tagged with `lg_game_id` and team |
| `goalie_game_lines.csv` | One row per goalie per game |
| `capture.json` | When and how the night was captured, and game counts |

## Game JSON (`schema: lg-game-capture-v1`)

- `away` / `home`: `lg_team_id`, `name`, `full_name`, `record` (after this game), `score`, `goals_by_period`.
- `team_stats`: each stat as `{away, home}`. Examples: `total_shots`, `hits`, `time_on_attack`,
  `passing`, `face_offs_won`, `penalty_minutes`, `power_plays`, `blocks`.
- `possession_seconds_by_position`: seconds with the puck by position, per side.
- `skaters` / `goalies`: whole-game lines from LG's official game sheet. They include `lg_user_id`,
  `position`, and `build` (EA class, e.g. SNP, PLY, TWD, DNG). Shots are `on_goal/attempts`.
- Each goalie's `side` comes from matching goals allowed to the other team's score
  (`side_basis` says how it was decided).
- `ea_parts`: EA's raw data for each played segment, from LG's "View EA Game" link. There is
  more than one part when a game was finished after a disconnect (`lag_out: true`). `periods`
  shows which periods each part covers. A few EA players are not on LG's sheet (subs or
  different names); their `side` is `null`. **Do not add EA parts to the LG lines:** the LG
  sheet is already the combined official total.
- `edits`: how many times the score was edited, plus the last editor and time.

## Rules for writers

1. The LG game page (`source_url`) is the official record. EA parts add detail only.
2. Player lines are whole-game totals. Only team goals are split by period.
3. There is **no play-by-play**. The EA in-game Action Tracker (goal times, assists by event) is
   not in LG's or EA's web data. Do not invent goal times or scorers per period.
4. `record` is each team's record after this game.
5. Leave anything unmatched as `null`; never guess a team or player.

## How these were captured

Captured from the public LG game pages and LG's EA link with the LG Stats Client, one game at
a time with 1-2.5 minute gaps, then converted offline. It stops at the first LeagueGaming
Cloudflare check and does not try to get around it.
