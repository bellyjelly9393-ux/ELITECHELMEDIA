# Rosters

Read `../README.md` first. The three hard rules there apply to every file in this folder.

One file is **one team's public roster** for LGCHL season 55. New versioned file each drop, for example `lgchl-s55-roster-team-412-20261026T190000Z.json`. The shape below is a blank contract. It is not a live roster.

`lg_team_id` is the LG club (Calgary Hitmen = **412**). `ea_club_id` stays `null` with `ea_club_id_status: "unknown"` until the cited page prints that EA club id. A roster has no LG game ID; leave it out. `date` is the roster date (`YYYY-MM-DD`). `time_et` is the Eastern clock time when the page shows one, otherwise `null`.

Public gamertag, position, jersey, and LG user id are in scope only when that public roster page prints them. Emails, real names, Discord handles, passwords, and anything from a logged-in or authenticated session stay out of the file.

```json
{
  "schema_version": "1.0",
  "league": "LGCHL",
  "league_id": 39,
  "season_id": 55,
  "timezone": "America/Toronto",
  "lg_team_id": 412,
  "team_name": "Calgary Hitmen",
  "ea_club_id": null,
  "ea_club_id_status": "unknown",
  "date": "2026-10-26",
  "time_et": null,
  "status": "official",
  "source_url": null,
  "parsed_at": "2026-10-26T19:00:00Z",
  "dropped_by": "seth-parser",
  "source_note": "Public roster page for this lg_team_id.",
  "players": [
    {
      "lg_team_id": 412,
      "ea_club_id": null,
      "lg_user_id": null,
      "gamertag": null,
      "position": null,
      "jersey_number": null,
      "status": null,
      "source_url": null,
      "parsed_at": "2026-10-26T19:00:00Z"
    }
  ]
}
```

`status` on the file is `official` when the page is the current public roster, and `partial` when the export is incomplete. Per-player `status` is the roster label printed for that player, or `null`.

CSV twin, one row per player:

```csv
lg_team_id,team_name,ea_club_id,ea_club_id_status,lg_user_id,gamertag,position,jersey_number,status,date,time_et,source_url,parsed_at
```
