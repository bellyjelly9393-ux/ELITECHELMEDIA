# lg3s-drops-reviewed/

Reviewer output derived from `lg3s-drops/` (never edited). Nothing here is read by the live site.

| file | what |
|---|---|
| `schedule_week2.validated.json` | 54 fixtures with per-game `validation_status`, checks, UTC start, `ea_match_status` |
| `team_mapping.validated.json` | 12 teams, `review_status` + flags; excluded non-LG3S clubs |
| `review_flags.md` | every flag from this review |
| `validate.py` | re-runs the schedule/mapping validation (`python3 lg3s-drops-reviewed/validate.py` from repo root) |
| `ea_match.py` | EA↔LG matcher. `--selftest` replays the week-1 Canada verification. After games are final: drop EA JSON in `lg3s-drops/ea-matches/`, add `reference/lg_finals_week2.json` from verified lg3s_games, run it, and review `ea_matches_week2.review.json` |
| `reference/` | snapshots used for validation (lg3s_games week-2 schedule, Seth's xlsx extracts, ea_clubs.json, week-1 Canada fixtures without player data) |

`matched_*` statuses are proposals for human review, never auto-promoted.
