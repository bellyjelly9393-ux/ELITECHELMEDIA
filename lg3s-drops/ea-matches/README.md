# EA match data inbox

**Status: not scraped yet.** This folder is the expected location for upcoming public EA NHL club match page exports for all 12 LG3S Season 1 teams.

Create a new file per pull (example `ea-matches/2026-10-28/ea-2026-10-28T230000Z.json`). UTF-8 JSON:

```json
{
  "schema_version": "1.0",
  "league_id": 154,
  "season_id": 1,
  "source": "EA Sports NHL public club match page",
  "fetched_at_utc": "ISO-8601 UTC timestamp",
  "matches": [
    {
      "ea_match_id": "exact source ID or null",
      "ea_club_id": null,
      "ea_club_name": "exact name as EA shows",
      "opponent_ea_club_id": null,
      "opponent_ea_club_name": "exact name as EA shows",
      "start_at_utc": null,
      "home_away": "home|away|unknown",
      "goals_for": null,
      "goals_against": null,
      "source_url": "full public URL",
      "lg_game_id": null,
      "lg_private_matchmaking_code": null,
      "match_status": "unmatched",
      "evidence": []
    }
  ]
}
```

Do not treat the example as real EA results. Use real timestamps/club IDs when the source provides them; leave missing fields null. A time similarity is **not sufficient** to attach an EA match to an LG game. Cross-check club IDs, matchup, clock, and where possible the unique matchmaking identifier. Distinguish EA match statistics from LG official box scores. Never invent missing stats.

Reviewer should output a separate file in `reviewed/` with approvals and unresolved records, never overwrite source data. Do not store credentials, authenticated HTML with tokens, or private player information.
