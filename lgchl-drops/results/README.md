# Results and box scores

Read `../README.md` first. The three hard rules there apply to every file in this folder.

One file is **one game's official LG result**, with box-score lines only when that game page prints them. New versioned file each drop, for example `lgchl-s55-result-game-<lg_game_id>-20261026T190000Z.json`. The shape below is a blank contract. It is not a real result.

This folder records the LG result. An EA club match is a different source. EA goals, EA match ids, and EA club ids stay in their own fields and stay `null` until that EA page is the cited source. They do not fill `away_score` or `home_score`.

Away and home are explicit fields from the LG game page, including the team that lost. `lg_game_id` is the `gameid` in the URL. Team ids and club ids follow the hard rules in the parent README. `date` is `YYYY-MM-DD` and `time_et` is 24-hour `HH:MM` Eastern. `lg_private_matchmaking_code` is `null` unless the code is printed on `source_url`.

`status` is `final` only when the source shows a completed game and both scores. **A `scheduled` row is not a result.** Leave both scores `null` on `scheduled`, `postponed`, and `cancelled`. The shell below leaves `status` null so it is not copied as a finished game. `decided_in` is `REG`, `OT`, `SO`, or `null` when the page does not say.

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
  "away_score": null,
  "home_team": null,
  "home_lg_team_id": null,
  "home_ea_club_id": null,
  "home_score": null,
  "lg_private_matchmaking_code": null,
  "lg_private_code_status": "not_verified",
  "status": null,
  "decided_in": null,
  "ea_match_id": null,
  "source_url": null,
  "parsed_at": "2026-10-26T19:00:00Z",
  "dropped_by": "seth-parser",
  "source_note": "Official LG game page. Scores only if status is final.",
  "skaters": [
    {
      "side": "away",
      "lg_team_id": null,
      "ea_club_id": null,
      "lg_user_id": null,
      "gamertag": null,
      "goals": null,
      "assists": null,
      "shots": null,
      "source_url": null,
      "parsed_at": "2026-10-26T19:00:00Z"
    }
  ],
  "goalies": [
    {
      "side": "home",
      "lg_team_id": null,
      "ea_club_id": null,
      "lg_user_id": null,
      "gamertag": null,
      "saves": null,
      "shots_against": null,
      "source_url": null,
      "parsed_at": "2026-10-26T19:00:00Z"
    }
  ]
}
```

Omit `skaters` and `goalies` when the page has no box score. A missing stat is `null`. Player lines are in scope only for names and counting stats printed on that public game page.

CSV twin, one row for the game (player lines stay in the JSON):

```csv
lg_game_id,date,time_et,away_team,away_lg_team_id,away_ea_club_id,away_score,home_team,home_lg_team_id,home_ea_club_id,home_score,lg_private_matchmaking_code,lg_private_code_status,status,decided_in,ea_match_id,source_url,parsed_at
```
