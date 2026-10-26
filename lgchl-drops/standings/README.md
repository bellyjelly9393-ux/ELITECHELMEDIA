# Standings

Read `../README.md` first. The three hard rules there apply to every file in this folder.

One file is **one standings table** as printed on the public LG page. New versioned file each drop, for example `lgchl-s55-standings-20261026T190000Z.json`. The shape below is a blank contract. It is not a live table.

Each row is a team, not a game. `lg_team_id` is the LG club (Calgary Hitmen = **412**). `ea_club_id` stays `null` with `ea_club_id_status: "unknown"` until the cited page prints that EA club id. A standings row has **no LG game ID**; do not borrow a team id or invent a game id to fill one. `date` is the standings date (`YYYY-MM-DD`). `time_et` is the Eastern clock time when the page shows one, otherwise `null`.

`home_record` and `away_record` are the road/home record strings printed in the table (for example a W-L-OTL split). They are not the away and home teams of a game. Counting stats that the page does not show stay `null`.

`circuit` is the junior circuit printed for that club: `WHL`, `OHL`, or `QMJHL`. `conference` is `Eastern` or `Western` when the page shows it. `division` is the division label copied as text.

```json
{
  "schema_version": "1.0",
  "league": "LGCHL",
  "league_id": 39,
  "season_id": 55,
  "timezone": "America/Toronto",
  "date": null,
  "time_et": null,
  "status": "official",
  "source_url": null,
  "parsed_at": "2026-10-26T19:00:00Z",
  "dropped_by": "seth-parser",
  "source_note": "Public LGCHL standings page.",
  "teams": [
    {
      "lg_team_id": null,
      "team_name": null,
      "ea_club_id": null,
      "ea_club_id_status": "unknown",
      "circuit": null,
      "conference": null,
      "division": null,
      "division_rank": null,
      "gp": null,
      "w": null,
      "l": null,
      "otw": null,
      "otl": null,
      "pts": null,
      "gf": null,
      "ga": null,
      "gd": null,
      "streak": null,
      "last10": null,
      "home_record": null,
      "away_record": null,
      "date": null,
      "time_et": null,
      "status": "official",
      "source_url": null,
      "parsed_at": "2026-10-26T19:00:00Z"
    }
  ]
}
```

File and row `status` are `official` when the page is the current official table, and `partial` when the export is incomplete. Standings are not finals. A `scheduled` game is not represented here as a result.

CSV twin, one row per team:

```csv
lg_team_id,team_name,ea_club_id,ea_club_id_status,circuit,conference,division,division_rank,gp,w,l,otw,otl,pts,gf,ga,gd,streak,last10,home_record,away_record,date,time_et,status,source_url,parsed_at
```
