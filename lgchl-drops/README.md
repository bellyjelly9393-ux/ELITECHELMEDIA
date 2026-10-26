# LGCHL shared data drop (game nights)

This is a **data-exchange inbox** for writers and review bots, like `lg3s-drops`. It is not
the live site database. The repo is public: never commit tokens, cookies, login data, or
private matchmaking codes.

## Delivered

- `games/s55/2026-10-25/`: LGCHL games from Sunday Oct 25, 2026 (93 scheduled; puck drops at
  9:00, 9:35 and 10:10 PM Eastern). **Partial:** `capture.json` says how many are included so
  far. More are added as LG allows.
- `lineups/2026-10-26/`: **tonight's lineups as listed on LG** for all three Hitmen games
  (Shawinigan 9:00, Kingston 9:35, Sudbury 10:10 ET). Includes team ratings, each team's top
  line and top D pair (LG's Offense/Defense Break Down), first goalie listed, and full lists in
  LG's order with OVR, salary and season numbers. **Use this for tonight's lineups.**
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
