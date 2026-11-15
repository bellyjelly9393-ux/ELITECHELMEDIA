# LGCHL Season 55 · EliteChel Playoff Central

Status: **staged, not launched**. The broadcast script is separate. This is the web experience.

## What exists

- `playoff-central.html`, `playoff-central.css`, `playoff-central.js`: responsive series scoreboard, official game links, WHL/OHL/QMJHL tabs, round filters, authenticated pick ballots and overall/round leaderboards.
- Homepage and LGCHL desk navigation point to Playoff Central once the branch is deployed.
- The existing `/api/lgchl-playoffs` and saved `assets/lgchl/playoffs/s55.json` supply game/series scores. We show a staleness warning when live data is not available.
- Separate Supabase tables and functions manage fan entries and points; no player data from Elite Labs is used or linked.
- Ballots are server-validated as complete per round, with server-based lock times, one pick per person per series, and no direct public table writes.
- 10 points for a correct winner, 5 more for exact length, 5 more for a lower-seed upset, and 20 for a perfect round of at least two series. Exact and upset only score when the winner was correct.
- A separate public ranking also displays whether a person remains eligible for the grand prize based on complete entries in every **started** open round. Missing rounds can still participate in the weekly standings.

## Launch is blocked until

1. Approve the free-to-enter promotional contest's official rules: eligibility, jurisdiction, age, prize, deadlines, dispute handling, ties, contest period, privacy disclosures, and any legally required skill-testing provisions.
2. Review the 12 wildcard matchups and first-game start times against the current official LeagueGaming bracket, since the initial snapshot was fetched November 11, 2026.
3. Review and apply `supabase/migrations/20261115000000_ecm_playoff_predictor_s55.sql` to the **existing** EliteChel Media Supabase project, not Elite Labs. The migration seeds all first-round series **is_open=false** intentionally.
4. Verify the new RPC and row-level policies with two test accounts, including signed-out and signed-in access.
5. Only then open entries and announce the prize. Merge and deploy separately after review.

## Operator SQL (Supabase dashboard SQL editor, trusted admins only)

### Review configured round

```sql
select id,league,conference,team_a,team_b,seed_a,seed_b,lock_at,is_open,
       confirmed_winner_id,actual_games,verified_at
from public.ecm_playoff_series
where season=55 and round_no=1 order by league,conference,id;
```

### Open a verified round

Only after prize/rules/legal review, and only after confirming **every** series and lock time:

```sql
update public.ecm_playoff_series
set is_open = true
where season=55 and round_no=1 and lock_at > now();
```

Do not change `lock_at` after ballots have been accepted. To close early, set `is_open=false`; this intentionally locks the whole round submission while leaving the scoreboard readable.

### Confirm a result and score the competition

Never accept game timing alone as proof. Cross-check the official series page and final result. This is a **template**: insert real verified values.

```sql
-- Example template, not executable as-is:
update public.ecm_playoff_series
set confirmed_winner_id = <TEAM_ID>,
    actual_games = <NUMBER_BETWEEN_4_AND_7>,
    verified_at = now(),
    verified_source_url = '<OFFICIAL_SERIES_URL>'
where id = '<SERIES_ID>'
  and <TEAM_ID> in (team_a, team_b);
```

The leaderboard recomputes totals from those confirmed values. A correction also recomputes the standings, but requires operator documentation and clear correction notes.

### Future rounds

Add the next round's **officially confirmed** matchups with unique IDs, seeds, and first-game locks using `insert into public.ecm_playoff_series (...)`. Leave `is_open=false` until the round ballot and prize conditions are reviewed. Do not guess the matchup from an unplayed bracket slot. R2 and later are intentionally not pre-seeded.

## Security guarantees and limits

- `ecm_playoff_series`: public read-only; admin/service writes only.
- `ecm_playoff_handles`: signed-in users can read their own handle; public leaderboard emits pseudonyms, not user IDs or email.
- `ecm_playoff_picks`: only the owner can read their ballot; all direct public writes denied.
- `ecm_predictor_submit_ballot`: requires a signed-in Supabase user, validates the whole round, its series IDs, selected winners, game count and server-time lock; updates atomically.
- `ecm_predictor_leaderboard`: public read-only computed rankings; zero trust in browser-submitted points.
- A determined person could register multiple accounts. This implementation does not prove unique human identity. For a real prize, publish one-person entry rules and add moderation/anti-abuse checks before announcing winners.
- The score ticker depends on LGCHL/LeagueGaming source freshness. If stale, the UI says so. Results for prediction points require human verification in this version.
- The public media repo is separate from the private Elite Labs repo.

## Acceptance checklist

- [ ] Wildcard board shows 12 real matchup cards, with appropriate league/conference and upcoming first-game times
- [ ] League and round filters work on mobile and desktop
- [ ] No game is incorrectly marked live merely due to elapsed wall-clock time
- [ ] All official score and series links lead to leaguegaming.com
- [ ] The saved-bracket warning appears if the fresh feed is unavailable
- [ ] Public and signed-out viewers cannot access another user's ballot
- [ ] Signed-in user cannot submit incomplete ballot or an invalid team/series
- [ ] Editing works only before the first-game deadline
- [ ] Same user re-submitting does not create duplicate picks
- [ ] Other user's chosen handle cannot be claimed
- [ ] Scoring of correct winner (10), exact length (+5), upset (+5), perfect round (+20) is verified
- [ ] An unverified series yields no points even if the on-page score already shows four wins
- [ ] Missing a started round excludes a person from grand prize without hiding their weekly scores
- [ ] All contest rules are approved before `is_open=true`
- [ ] Production deployment is inspected and a rollback plan is available

## Metrics to watch

Unique Playoff Central visitors, predictions completed, round-to-round returning entrants, scoreboard-to-ballot conversion, show-to-series-page clicks, and referral clicks from Discord. Retention matters more than raw first-day views.
