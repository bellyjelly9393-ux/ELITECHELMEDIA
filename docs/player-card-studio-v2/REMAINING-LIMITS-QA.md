# Remaining limits — test results

Scope: explicitly test the five remaining limits. No production deployment, schema migration or account-record write was performed.

| Remaining item | Result | Evidence / next dependency |
|---|---|---|
| Real signed-in Discord save/reload | Not completed | Preview access worked and its real Sign in with Discord control reached Discord's login form. This browser is a guest; a user-completed login is required before a genuine account save/reload can be checked. |
| Full cross-device persistence | Not implemented; cannot pass a full round-trip yet | Read-only inspection confirmed the live elitechel_player_cards table contains identity, finish, custom OVR, jersey, and timestamps, but no artwork, theme, edition, positioning or rating-snapshot columns. Existing account code sends only the supported legacy fields. No schema change was made. |
| Automatic performance OVR | Correctly withheld, not implemented as an approved model | Role/weights/gating tests pass. Version eco-concept-20261103 still returns no official score. Missing measured inputs and calibration approval are product dependencies, not tests that can be marked passed. |
| Reference-image visual fidelity | Does not pass the requested identical-match standard | The running studio retains a labeled placeholder without a player upload; frame facets, bright arena composition, custom frost and some proportions differ from the reference. Existing actual screenshots remain review evidence, not proof of visual equivalence. |
| Device quota failures | Passed controlled fault-injection tests after a fix | A full-store exception preserves the previous complete save, keeps the selected player and stats, and reports failure. Denied local storage leaves preview controls functional. Partial multi-record saves were reproduced and eliminated. |

## Device-save bug and fix

Previously cosmetics/artwork and V2 positioning were written to separate localStorage keys. If the large card record hit quota, a later small positioning write could succeed, leaving a partial save.

The complete device card now uses one localStorage record. It includes the existing fields and a nested layout snapshot with position, season, player stats snapshot, rating version and save time. A rejected setItem leaves the previous record intact. The renderer still reads legacy V2 layout keys so existing saves remain compatible; legacy data is not rewritten during reads.

New automated cases cover:

1. QuotaExceededError preserving the last successful record and reporting failure.
2. Denied storage during reset/read without losing the live selected player's verified stats.
3. Preventing a partial layout save when the card write fails.
4. Saving cosmetics/layout/snapshot together in one record.
5. Reading legacy position records without migrating them implicitly.

These use controlled failures in the actual application scripts' storage dependency. They do not fill a user's physical browser disk or claim every browser has the same quota.

## Browser verification

The revised single-record save was exercised in the actual running local studio with l Setty l, Season 55. Storm / Signature / Gold and scale 101, horizontal +1 survived a page reload. The same player remained selected. Source statistics were unchanged.

## Read-only live account checks

- Row-level security is enabled on public.elitechel_player_cards.
- SELECT, INSERT, UPDATE and DELETE policies are restricted to authenticated owners via auth.uid() = user_id; UPDATE has both USING and WITH CHECK.
- An anonymous REST read requesting zero rows was denied with HTTP 401 / SQLSTATE 42501. No access grant was added.

These are configuration and anonymous-boundary checks. They do not substitute for two real signed-in users exercising isolation or for an authenticated save/reload.

## Overall test count

25 automated tests pass (6 rating/module tests + 19 workflow tests), plus the independent seven-scene persistence contract. git diff --check passes. Existing LGCHL/LG3s browser/source checks are documented in QA-FOLLOWUP.md.

The existing draft PR remains the only release vehicle. Main and production deployment remain unchanged by this testing work.
