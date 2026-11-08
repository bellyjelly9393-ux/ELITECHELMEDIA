# Player Card Studio V2 — review build

Update November 8: [RATING-BETA.md](RATING-BETA.md) documents the implemented beta calculation and replaces the inactive OVR description below. Earlier visual and account validation notes remain historical.

This is a reviewable implementation, not the final definition of done. Production deployment is not authorized. Work is isolated to the player-card studio and its tests/documentation.

## Audit and implementation plan

Reuse: player-cards.js public league loader, stable LG IDs plus league/player-kind, existing local preferences, player-cards-account.js Discord PKCE and private collection operations, existing ECM/team artwork, legacy background and edition IDs.

Improve: explicit player selection after searching (typing no longer silently picks a player); dimensional chrome/ice presentation; mobile card-first layout; uploaded artwork resolution and transparency; race protection for uploads; source freshness display; missing-artwork export errors; shared preview/export composition.

Create: player-card-renderer.js (layered 1400 × 2000 canvas), player-card-studio-v2.js (orchestration, autocomplete, positioning and generation), player-card-rating.js (versioned concept contract), scoped styling and tests.

No database schema changes or private Labs integration were made. The account collection code was preserved.

## Visual comparison

Implemented: ECM crest and metallic masthead, league/season branding, left-side numbered inset builder, gold Generate control, large portrait ice/chrome card, real arena and ice imagery, team identity plate, four-metric strip, three informational panels. Mobile stacks the card above touch-sized controls.

Still different: the screenshot's handcrafted fractured ice, stadium composition, header league mark, realistic player cutout, some proportions and theme artwork are not identical. The placeholder is deliberately labeled; a reference player's likeness or example rating/rank was not assigned to another player. No fabricated rank or movement appears.

Desktop screenshot: desktop.jpg. Mobile screenshot: mobile.jpg (390px iframe viewport, cropped to the actual mobile region). A PNG export was generated and decoded during QA; it is an intermediate test output, not a source asset. These are captures of the running implementation, not design mockups. Desktop capture shows the top of the page; the exported PNG shows the complete card.

## Existing data sources

- Supabase project lrgllzvwgvqagcpiyvfd, public REST view wm_lgchl_s55_player_leaders.
- LGCHL newer capture overlay: data/lgchl/leaders-current.json. This is a partial season export and cannot establish complete league rankings.
- LG3s views lg3s_public_skater_leaders and lg3s_public_goalie_leaders remain connected through the existing adapters.
- Team mapping: verified lg_team_id → assets/lgchl/s55/team<ID>.png, with the existing assets/logos/chl/index.json map when a team ID is unavailable.
- Existing private account collection: elitechel_player_cards, using the unchanged owner-based RLS migration already in the repository.

Verified source examples: l Setty l, LG ID 73707, Calgary Hitmen, LW: 19 GP / 21 G / 33 A / 54 PTS. XxPASTRNAK88, LG ID 80604, Calgary Hitmen, G: 34 GP / 16 W / .794 SV / 3.22 GAA. These public records were last fetched November 4, 2026. They are latest available records observed here, not a claim that every import is current or complete.

## OVR model

Version eco-concept-20261103 preserves the proposed weights published in elite-chel-cards.html:

| Role | Proposed factors |
|---|---|
| C | Offense 20%, defensive coverage 25%, faceoffs 20%, puck movement 15%, possession 10%, discipline 10% |
| LW/RW | Offense 35%, defensive coverage 15%, faceoffs 5%, puck movement 20%, possession 15%, discipline 10% |
| D | Offense 15%, defensive coverage 35%, puck movement 15%, possession 25%, discipline 10% |
| G | Shot stopping 45%, high-danger saves 25%, consistency 20%, puck management 10% |

Every role sums to 100%. This remains a concept, not an approved calculation. There is no verified normalization/calibration implementation or complete input set for these factors. The module returns overall=null and approved=false; missing metrics are not scored as zero. Manual OVR is labeled CUSTOM OVR in preview and PNG. No official performance ratings were published.

Smallest next rating step: agree which consistently available metrics can support a first public model, document normalization and sample thresholds, then calibrate against actual league cohorts before approval. Do not silently remove the approved-concept factors and call the result equivalent.

## Actual verification

| Check | Outcome |
|---|---|
| JavaScript parsing and git diff whitespace | Passed |
| 6 rating/module tests | Passed |
| Scene/edition/finish persistence contract test | Passed; 7 scenes, existing IDs preserved |
| Existing skater lookup and source totals | Passed: Setty |
| Existing goalie lookup and source totals | Passed: Pastrnak |
| Similar names | Passed: XxPasTrnack88 / Prince George / RD / ID44367 distinguished from Calgary goalie ID80604 |
| No matching player | Passed: explicit no-match notice, selected card unchanged |
| Player switching | Passed: goalie → Setty restored 19/21/33/54 and skater labels |
| Theme, edition and finish | Passed for exercised storm/signature/gold combination and prior heat/gold/ice combination; selections did not change stats |
| Image upload | Passed using existing transparent Calgary jersey as QA artwork; not a claim of a player cutout |
| Image scale/position/reset controls | Implemented; complete end-to-end interaction check outstanding |
| Automatic OVR | Correctly withheld; role/weight/gating tests passed |
| Team logo | Calgary team412 image loaded in preview/export |
| Generate | Passed |
| PNG export | Passed; downloaded and decoded as 1400 × 2000 PNG with the complete card |
| Save on device and reload | Passed: storm/signature/gold restored after reload |
| Signed-in account save and retrieval | Not exercised; review browser was a guest. Existing code and DB schema preserved |
| Desktop | Visually inspected; not pixel-identical to target |
| Mobile | Actual 390px iframe viewport; html clientWidth=375 and scrollWidth=375 including scrollbar allowance; no horizontal overflow |
| Missing statistics / feed failures / failed external art | Failure paths implemented but not fully fault-injected in browser |
| Full LG3s regression | Existing data connection preserved; complete browser regression outstanding |

Commands: node test-player-card-backgrounds.cjs; node --test tests/player-card-studio-v2.test.cjs; git diff --check.

## Saving and known limits

Device saves now retain cosmetics/artwork and a nested V2 layout snapshot in one atomic localStorage record, including position, season, stats snapshot, model version and save time. Legacy separate layout records remain readable. See REMAINING-LIMITS-QA.md for quota fault-injection results. When saved source totals differ from current totals, a notice distinguishes current data from the saved snapshot. The original PNG is a fixed snapshot; re-generating uses current available records.

Account collections still sync only player reference, finish, custom OVR and jersey number. Cross-device background, edition, image, positioning and historical rendered snapshots require an additive account/storage extension and authenticated QA. No destructive migrations were introduced.

Verified aliases were not invented or merged. The current public feed search supports gamertags and teams; a verified alias source and protected mapping contract still need connection. There is no arbitrary season picker for seasons that do not have a feed.

## Release status and next move

Branch: codex/player-card-studio-v2. Main was not merged and no production deployment command was issued. A Git-linked service may create its ordinary branch preview; this is not production release approval.

Highest-value next move: supply the original player artwork/cutout used in the reference and finish the visual composition against it, then complete image-positioning, failure-path, LG3s and authenticated collection QA. The build should not be released as complete while the OVR and cross-device collection limitations remain.
