# VOD player identity fix - October 31 / November 1 work session

The VOD analyst could occasionally write about the same player as though they were several different people. A player might appear under their LG account name, Xbox or PlayStation gamertag, CHEL character name, and a shortened broadcast label. Previously, differently spelled labels could become separate player entries. Case-insensitive matching alone cannot connect names such as Setty and Kells.

We implemented a verified identity resolver in the existing VVHL-HUB codebase. Each canonical identity is league + season + LG user ID. Names remain useful labels and evidence, but the LG identity is what groups a player's scouting information. The work is on `feature/lg-player-identity-resolver`; no production scouting report has been overwritten.

## How the corrected flow works

1. Identify the specific LG game and confirm the actual participants for both teams. A season roster, reserve list, or pregame candidate list cannot establish who played.
2. Use the LG Stats Client Developer Starter as the primary LG source. Capture the player's LG ID and explicitly linked Xbox/PlayStation account without changing its statistics database.
3. Treat LG names, console accounts, EA identifiers, CHEL characters and broadcast names as separate fields. Current ChelStats character results are suggestions until verified for the historical game.
4. Attach a confirmed alias to a participant using evidence, such as a verified VOD marker and timestamp. Reuse that game-specific verification rather than repeatedly asking the analyst to identify the person by name alone.
5. Resolve all supported names to the canonical player and consolidate their scouting content into one canonical report for that game. Preserve original names, observations and timestamps so the reasoning remains reviewable. Separate games still have their own game reports and history.
6. Keep uncertain names unresolved and visible. Do not invent a match or a performance rating to fill a missing player slot.

## Kells, Bad News Kells and the player's marker

The user confirmed that Kells and Bad News Kells identify the same Hitmen player and that this was verified in the VOD player marker. That human confirmation has been recorded, alongside the relevant Ottawa review's existing marker timestamps. It is usable evidence of the alias relationship; the system should not insist these are different people simply because the labels differ.

The separate LG Client lookup ties registered account `l Setty l` to LG user ID 73707. The LG-linked Xbox tag currently returns Bad News Kells as a character candidate. The final gate for applying this to the Ottawa test review is confirming that LG ID on that game's actual lineup. This preserves the user's verification while keeping the LG ID and game participation grounded in the source data.

The resolver does not contain a blanket rule that Kells and Bad News Kells must stay separate. It also does not contain a blanket rule that similar names on one team must be merged. Verified aliases consolidate; conflicting or missing evidence stays visible for review.

## Player coverage and report protection

We added a lineup preflight for both teams across a night's three games. It highlights missing, unsafe or repeated LG IDs and distinguishes candidates from actual participants. The isolated test service lists all 12 participants from a final game sheet, including both goalies. A player with no attributable observation remains listed as lacking evidence rather than disappearing or receiving a fabricated assessment.

Publication groups supported entries by canonical identity and protects existing scouting reports from replacement. Original source names and timestamps remain available. Consolidating reports does not discard legitimate observations of the same player across several plays or periods, and it does not combine separate games into one game report.

## Verification completed

- 37 isolated database checks passed, including three verified aliases of one player, distinct similarly named players, missing/ambiguous LG IDs, management access and existing-report protection.
- 45 Node workflow checks passed, covering review behavior, lineup preflight, LG capture parsing, account/character lookup, period approval and evidence routing.
- Five Python account-export checks passed.
- Player matching, report restoration and desktop/mobile browser workflow checks passed.
- Two additional isolated deployment tests passed, checking production-configuration rejection, private authentication, actual resolver installation, alias consolidation, cross-game separation, ambiguity and 12-player coverage without invented evidence.
- Local HTTP startup, authenticated access to the two 12-player test rosters and rejection of unauthenticated API requests were verified.

The account-capture work checked 872 scoped LG IDs and found explicit console links for 870. All 17 players in the observed Hitmen team view had account evidence. Those profile captures support account linking; they do not replace an actual game's lineup.

## Test rollout and remaining limits

The code has been pushed on the feature branch. A separate Railway test service and dedicated storage were created, and deployment `34434170-a13d-4cce-a761-e9259cee8929` reached SUCCESS at commit `c6c126e8342f245d21b2da08be9ee3ae642cf7c8`. Because Supabase branching is unavailable on the current plan, the isolated service runs the real resolver SQL in its own PGlite database with a minimal compatibility schema. It cannot connect to the production database and does not certify the entire production Supabase integration.

Windsor and Gatineau are the first fresh-video test cases because their final LG Client captures each identify 12 actual participants. Both fresh jobs were started privately after deployment: Gatineau `4166e7aa-dba6-4ad0-8148-8b6576f031c0`, Windsor `bdaa5dd3-480d-4ef4-a1af-37dabafc1061`. The tests use new review IDs and copied source windows. They compare expected players, canonical player reports, unresolved names and evidence coverage while preserving existing reports. At this recorded checkpoint, both jobs were retrieving footage; no fresh-video accuracy result was yet available.

The protected test page is https://vod-lg-identity-test-vod-restore-test.up.railway.app. Its public address was created only after the user's explicit approval. Live checks confirmed that API requests without the private test code return 401, authenticated requests load both 12-player rosters, the worker has an AI provider configured, and no production database is configured. The first fresh test reached active video analysis; final accuracy results are still pending.

The change is implemented and regression-tested; a completed fresh-video accuracy comparison and full production activation must not be claimed before those steps finish. Missing recordings, historical alias verification and the lag-out game's period boundaries still limit testing of the rest of the week's games. Production deployment and historical report corrections remain separate decisions.
