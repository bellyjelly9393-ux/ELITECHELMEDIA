# Player Card Studio V2 — additional QA

Scope: follow-up testing and fixes on the existing draft branch. No production release, database migration, auth-policy changes or real collection writes.

## Bugs reproduced and fixed

1. League loading left the previous card's statistics and custom OVR visible until a response arrived. The loader now clears the selected identity, artwork and cosmetics and renders blank statistics immediately.
2. League switching reused the original URL's player ID. Requests now resolve selection against the current URL, so selecting a new league does not silently select a same-numbered record from another feed.
3. An upload begun before a league switch could finish afterward. Changing leagues now invalidates pending uploads; failed/stale upload paths release object URLs.
4. Collection upsert transport rejection left its Save button disabled and did not report an actionable error. A catch/finally now reports failure and restores the button according to session state.
5. Failed team-metadata requests were permanently cached. Metadata is loaded lazily and its failed promise is cleared for retry. LG3s rendering does not depend on the CHL mapping file.
6. A player could change during asynchronous PNG encoding, producing a misleading filename/identity combination. Export now checks the captured identity and render revision before downloading.

## Verification results

All 20 node tests passed, comprising the prior 6 rating/module tests and 14 added workflow tests. The separate seven-scene persistence contract also passed. `git diff --check` passed.

The added workflow tests execute the actual loader, orchestration and account scripts in a controlled DOM/network harness. They cover:

- Clearing old stats/custom OVR immediately during a delayed league load.
- Preventing old URL identity reuse in another league.
- Handling feed rejection with blank stats and an unavailable notice.
- Missing goalie values staying blank rather than zero or skater totals.
- Guest collection-write prevention.
- Owner-scoped collection reads and cosmetic-only writes with a mocked authenticated client.
- Collection transport rejection restoring its button.
- Scale/X/Y values reaching the shared renderer and resetting to defaults.
- Required artwork failure preventing PNG encoding.
- Retrying metadata after a failed request.
- PNG encoding returning no blob.
- Player changes during encoding preventing a mislabelled download.
- Upload completion after a league switch not attaching to a new player.
- A stale league request not replacing a more recent response.

These are automated mocks, not proof of a real Discord session, live collection write, database RLS enforcement or pixel-perfect artwork positioning.

## Actual browser and source checks

The LG3s studio loaded 161 public records. The displayed values were compared with direct read-only queries to the existing Supabase views:

| Player | Record | Display/source comparison |
|---|---|---|
| _phostry_ | skater:80614, Slovakia | 1 GP, 0 goals, 4 assists, 4 points — matched lg3s_public_skater_leaders |
| Bodycheck7 | goalie:67226, Kazakhstan | 2 GP, 60.0% SV, 5.00 GAA — matched lg3s_public_goalie_leaders |

The goalie feed has no wins field. The card correctly displays `--` for W. No wins were inferred from other statistics.

Browser input checks: scale changed to 200, horizontal to +1, vertical to -1; a device save/reload restored 200/+1/-1. Selecting the goalie reset positioning to 100/0/0. The Reset image position control also produced 100/0/0. These checks verify the functional control workflow; this run did not upload a new cutout or compare its movement pixel by pixel.

Generate succeeded. PNG download occurred; the file was independently decoded as a 1400 × 2000 PNG. Browser automation reported a click timeout despite the actual download; the completed download event and on-page export status confirmed the action, and the file bytes were inspected. The exported PNG is an intermediate test output rather than a source asset.

Switching from that goalie to LGCHL immediately displayed SELECT PLAYER and blank GP; it remained unselected after the LGCHL feed finished, as intended.

Actual browser evidence: lg3s-qa.jpg shows the selected goalie and the blank W metric. It is a screenshot of the running studio.

## Remaining limits

- A real signed-in Discord save and collection reload remains unverified. Authenticated unit tests use a mock client and do not write production rows.
- Full cross-device artwork/theme/edition persistence still requires the previously documented account/storage extension.
- Automatic OVR remains withheld pending approved scoring inputs/calibration; the existing proposed weights remain unchanged.
- Visual fidelity is still a review-build limitation, including original player artwork and the reference's handcrafted frost/frame treatment.
- Device save failure is handled in existing code but storage-quota behavior was not newly fault-injected during this run.

Changes belong only on codex/player-card-studio-v2 / draft PR #212. Do not merge or deploy production without release approval.
