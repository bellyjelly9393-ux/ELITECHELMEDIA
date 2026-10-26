# Schedules

Read `../README.md` first. The three hard rules there apply to every file in this folder.

One file is a **set of fixtures** (a night, a week, or one team). New versioned file each drop, for example `lgchl-s55-schedule-week-04-20261026T190000Z.json`. A later LG schedule change is a new timestamped file. The shape below is a blank contract. It is not a published slate.

Every game keeps its own `lg_game_id`, Eastern `date` and `time_et`, explicit away and home LG team IDs, `status`, `source_url`, and `parsed_at`. `lg_game_id` is the `gameid` in that game's URL. `away_ea_club_id` and `home_ea_club_id` stay `null` until the cited page prints them. `lg_private_matchmaking_code` stays `null` with `lg_private_code_status: "not_verified"` unless the code is printed on that game's `source_url`.

A schedule file has no scores. `status: "scheduled"` means the game is a fixture. Postponed and cancelled games keep those statuses and still have no score. A finished game belongs in `results/`, not in this folder with a filled score.

```json
{
  "schema_version": "1.0",
  "league": "LGCHL",
  "league_id": 39,
  "season_id": 55,
  "timezone": "America/Toronto",
  "date_start": null,
  "date_end": null,
  "status": "scheduled",
  "source_url": null,
  "parsed_at": "2026-10-26T19:00:00Z",
  "dropped_by": "claude",
  "source_note": "Fixtures copied from public LG schedule pages.",
  "games": [
    {
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
      "parsed_at": "2026-10-26T19:00:00Z"
    }
  ]
}
```

File-level `status` describes the slate (`scheduled` or `partial`). Per-game `status` is the status on that game's page.

CSV twin, one row per game:

```csv
lg_game_id,date,time_et,away_team,away_lg_team_id,away_ea_club_id,home_team,home_lg_team_id,home_ea_club_id,lg_private_matchmaking_code,lg_private_code_status,status,source_url,parsed_at
```
