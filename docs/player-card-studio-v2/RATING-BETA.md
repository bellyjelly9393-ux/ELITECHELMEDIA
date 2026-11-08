# ECM rating beta — 2026-11-08

The card studio now computes a versioned `eco-beta-20261108` score for eligible
CHL Season 55 regular-season players. This supersedes the inactive concept
contract described in the earlier studio review. It is an experimental ECM
season-stat comparison, not an EA overall, LG rating, validated skill model,
manual scouting assessment or earned card progression.

## Data and eligibility

The existing public `wm_lgchl_s55_player_leaders` view supplies team names.
Additional anonymous reads of `lg_player_season_stats` supply the actual detailed
fields rather than view-coalesced missing values. No Supabase schema, policies,
private data or league records are changed. Canonical ID plus player kind selects
the newest record across aliases. A conflicting equal-version identity fails
closed. If the detailed read fails, basic cards still work and OVR stays pending.
LG3s keeps its current card flow with automatic OVR unavailable.

At least 6 games, all required metrics, and 20 eligible same-role players are
required. Goalies additionally require 100 shots faced. Rows explicitly missing
from the source, records over 48 hours behind the newest cohort source, and
skater rows with legacy extras are excluded. Source time is displayed; this
relative freshness test does not guarantee today's games have been imported.

Skater roles are C, W (LW/RW), and D (LD/RD). Goals, assists, interceptions,
takeaways, giveaways and PIM are divided by games. Passing uses source passing
percentage and attempts. Center faceoffs use source percentage with games as a
sample-size proxy because faceoff attempt counts are not available. This is a
limitation, not an exact faceoff-confidence model. Source percentage values are
on a 0–100 scale; PIM is validated as minutes or mm:ss. Missing metrics are not
substituted with zero, and points must equal goals plus assists.

## Formula

| Factor | C | W | D | G |
|---|---:|---:|---:|---:|
| Goals/game | 15 | 25 | 5 | — |
| Assists/game | 20 | 25 | 15 | — |
| Interceptions/game | 15 | 10 | 25 | — |
| Takeaways/game | 10 | 10 | 15 | — |
| Giveaways/game (lower is better) | 15 | 15 | 20 | — |
| Passing percentage | 10 | 10 | 10 | — |
| Faceoff percentage | 10 | — | — | — |
| PIM/game (lower is better) | 5 | 5 | 10 | — |
| Save percentage, derived from shots and GA | — | — | — | 80 |
| GA per 60, derived from GA and TOI (lower is better) | — | — | — | 20 |

Each component is shrunk toward the eligible role's median:
`adjusted = (value × exposure + median × prior)/(exposure + prior)`.
The prior is 6 games for per-game/GA-per-60/faceoff inputs, 200 attempts for
passing, and 100 shots for save percentage. Compare adjusted values using
midrank percentiles; reverse lower-is-better components. OVR is the rounded
weighted sum, 0–100. Equal-performance peers score 50. These weights and prior
sizes are ECM design choices and need calibration against reviewed play.
GAA is affected by team defense; interceptions/takeaways do not measure complete
defensive coverage. Context, opponents, zone entries, high-danger saves and
VOD-derived insights are not measured by this beta.

The explanation shows weights, component percentiles, cohort size and model
version, plus one next-game action associated with the lowest component.
Manual OVR stays a cosmetic override labeled CUSTOM OVR; clearing it restores
the automatic beta. Preview and PNG use the same displayed value and label,
including zero. Device/account customization stores only the manual override;
automatic ratings recompute from current available stats. XP/unlocks remain
planned and are not tied to this score.

## Validation

38 Node tests passed across rating, studio and workflow suites; the existing
background/persistence check also passed. New cases cover tied scores,
position cohorts, missing versus measured zero, sample adjustment, canonical
aliases, invalid metrics, goalie minimums, stale sources, detailed-feed fallback,
and custom override restoration. Existing collection/race/export tests passed.

Live browser QA against public Supabase: l Setty l loaded 19 GP / 21 G / 33 A /
54 PTS and ECM beta 60 against 427 eligible wings. Custom 99 was labeled CUSTOM
OVR; clearing it restored 60. PNG export completed at 1400×2000. XxPASTRNAK88
loaded goalie stats and beta 37 against 138 goalies. fred_7517's one-game goalie
record correctly remained OVR pending with a six-game explanation. These example
scores are experimental outputs, not a calibrated assessment of player ability.

Desktop client cloud sync is separately merged in stats-client-hitmen PR #1.
This card change is a review branch; production publication is not claimed.
