# Lineups

Read `../README.md` first. The three hard rules there apply to every file in this folder.

One file is **one game's lineup**. New versioned file each drop, for example `lgchl-s55-lineup-game-<lg_game_id>-20261026T190000Z.json`. The shape below is a blank contract. It is not a real game.

Away and home are explicit. Copy them from the game page. `lg_game_id` is the `gameid` in that page's URL. `away_lg_team_id` and `home_lg_team_id` are LG team IDs. `away_ea_club_id` and `home_ea_club_id` stay `null` until the cited page prints those EA club IDs. `date` is `YYYY-MM-DD` and `time_et` is 24-hour `HH:MM` Eastern.

`lg_private_matchmaking_code` is `null` and `lg_private_code_status` is `not_verified` unless the code is printed on `source_url`. A lineup file records who is dressed. It is not a result: no scores, and a `scheduled` game stays `scheduled`.

```json
{
  "schema_version": "1.0",
  "league": "LGCHL",
  "league_id": 39,
  "season_id": 55,
  "timezone": "America/Toronto",
  "lg_game_id": null,
  "date": null,
  "time_et": null,
  "away_team": null,
  "away_lg_team_id": null,
  "away_ea_club_id": null,
  "home_team": null,
  "home_lg_team_id": null,
  "home_ea_club_id": null,
  "lg_private_matchmaking_code": null,
  "lg_private_code_status": "not_verified",
  "status": "scheduled",
  "source_url": null,
  "parsed_at": "2026-10-26T19:00:00Z",
  "dropped_by": "claude",
  "source_note": "Public lineup for this lg_game_id.",
  "skaters": [
    {
      "side": "away",
      "lg_team_id": null,
      "ea_club_id": null,
      "lg_user_id": null,
      "gamertag": null,
      "position": null,
      "line": null,
      "source_url": null,
      "parsed_at": "2026-10-26T19:00:00Z"
    }
  ]
}
```

`side` is `away` or `home`. `line` is the label the page prints (`1`, `2`, `PP`, `PK`, or similar), or `null`. Goalies use the same object shape in a `goalies` array. `status` is the game status on the source: `scheduled`, `final`, `postponed`, or `cancelled`.

CSV twin, one row per dressed player:

```csv
lg_game_id,date,time_et,side,lg_team_id,ea_club_id,lg_user_id,gamertag,position,line,lg_private_matchmaking_code,lg_private_code_status,status,source_url,parsed_at
```
