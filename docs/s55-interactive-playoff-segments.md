# EliteChel Media | LGCHL Season 55 Interactive Playoff Segments

**Status: PRIVATE DEVELOPMENT / DRAFT PR. Owner has not approved production release.**

## What is built

1. **The Pressure Cooker** (`pressure-cooker.html`) uses the existing Season 55 verified series scores to identify RED HOT, FEELING THE HEAT, ON THE BRINK, ICE COLD, and unclassified opening-series teams. BUILT DIFFERENT is **editorial-only**. Eliminated teams leave active pressure lists, but remain available in their journey. Filters: OHL/WHL/QMJHL, conference, round and team. Current and previous editorial labels remain separate.
2. **Rivalry Report** (`rivalry-report.html?series=<canonical ID>`) creates a report for each confirmed playoff series from the existing bracket: current score, goal totals only from final games, recent games, factual story, official series link and links to each team journey. Editor stories, players to watch, verified video moments and one-vote-per-account polls are supported and **hidden unless actually published**.
3. **Road to the Cup** (`road-to-cup.html?team=<canonical ID>`) has all qualified teams, verified round-by-round paths, official byes, opponent TBD for unknown rounds, and statuses ALIVE/ADVANCING/ON THE BRINK/ELIMINATED/CHAMPION. Does not invent future opponents or advance on elapsed game time.
4. Homepage `index.html` preserves the entire existing Season 55 dashboard and adds **three compact linked previews under its existing predictor/bracket/scores dashboard**. The All Media dropdown is scrollable. The existing full playoff bracket and team rooms link to the new reports and journeys. Management remains only in the existing footer.
5. **Management**: one new card within `management.html` launches `playoff-segments-management.html`, which reuses the existing signed-in account state and Management Guard. Final publication authority is a **separate explicitly assigned RLS editor table** rather than user-editable `profiles.role`.

## Source contract and non-invention rules

- The **single** source for series records, official team IDs, playoff format, wins, results, and advancement is `/api/lgchl-playoffs`. If unavailable, the dated `assets/lgchl/playoffs/s55.json` snapshot is used and prominently marked delayed/stale.
- Confirmed series winners require `clinched=true`, a canonical winner ID, and a matching winner-side score meeting `wins_needed`; a predicted or scheduled result cannot eliminate anyone.
- A score that reaches the clinch threshold **without** a consistent official winner is **PENDING REVIEW**, not assumed advance or elimination.
- Recent form and goal totals only use unique `status=final` games with both verified distinct scores. Partial and duplicate game records are ignored.
- Journeys reflect the official WHL/OHL Cup semifinal and QMJHL direct-final pathways; no generic bracket is substituted.
- Player spotlights only show explicitly selected players whose identities match the separate reviewed public Season 55 playoff stat feed.
- Moments require a reviewed editor record containing a completed series game ID, a safe HTTPS LeagueGaming/Twitch/YouTube URL, a description, and `verified=true`. Period/clock are displayed only when both provided.
- The Fan War Room is **not** the existing Predictor Challenge: polls have their own published/closed state, authenticated voting, unique poll-voter key, votes visible only to each voter, and public totals returned by a guarded read-only RPC.
- Editorial entries can be unpublished/removed without changing any game result. The old label is captured by a DB trigger when labels change. Avoid anonymous pressure-number scores.

## Owner approval and release gates

1. **Do not merge PR or enable production.** Keep site code on the feature branch.
2. After owner approval, review and apply the staged migration `supabase/migrations/20261115190000_ecm_s55_segments_editorial_polls.sql`. It has **not** been applied.
3. An authorized owner must explicitly provision each editor ID into `ecm_s55_segment_editors` using privileged admin tooling. The website provides no ability to grant itself editor privileges.
4. Confirm new table RLS/public read and no anonymous/authenticated write rights on editor assignment. Test noneditor cannot update editorial, fan cannot cast second vote, and fan cannot reset poll.
5. Validate the controlled reset function with a genuine assigned editor; reset closes poll and removes votes. Log publish/reset events before general rollout.
6. With real authenticated testers, verify vote results reflect real inserts and no voter identity is exposed.
7. Complete responsive real-browser QA at **360px, 768px, 1440px**, test all three pages, the existing homepage, full playoff bracket, predictor, dropdown and Management footer. Check reduced-motion behavior.
8. Check empty-state and stale-snapshot behavior during LeagueGaming/Supabase outages. Test teams with byes, eliminated teams, and Cup final before publishing.
9. Run `node --test tests/lgchl-segments.test.cjs` and existing bracket/predictor regression tests. Resolve all failures.
10. Obtain explicit owner sign-off before merging, provisioning polls, or promoting the feature.

## Deferred (nonblocking for Phase 1 preview)

- Clip upload/transcoding and exportable postseason graphics.
- A complete player-stat import and reviewed postseason spotlight workflow is separate from these pages.
- Automated after-game editorial publish triggers and nightly update digest; currently factual series updates use live bracket refresh every 180 seconds.
- Capture/storing management change logs and poll anti-abuse monitoring.
- True mobile device/browser QA, poll submissions, and end-to-end admin write tests are blocked until safe review/deployment conditions exist.

No private Elite Labs footage, team-scoped VOD, or scouting data is used or exposed.
