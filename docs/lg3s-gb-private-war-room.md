# Great Britain LG3s Private War Room (November 18, 2026)
This is the permanent **EliteChel Media** deployment target for the Great Britain private War Room: `/lg3s-gb-war-room.html`.

## Security and privacy
- All private records live in the existing EliteChel Supabase project, not in static HTML, JavaScript, or public JSON.
- Supabase migration `lg3s_gb_private_war_room_v1` creates `lg3s_gb_*` tables with RLS enabled. The unauthenticated role is denied table access.
- Three narrowly scoped access checks live in schema `private`: `gb_war_member()`, `gb_war_manager()`, `gb_war_owner()`. A signed-in account is not automatically a team member.
- Owner is provisioned privately, not seeded with an email/UUID in this public repository.
- BigK (intended GM) and ItsaMeAquino (intended AGM) are not auto-granted access. The owner approves after verifying Discord account ownership AND the LG player mapping. No trust from user-editable Discord display names.
- `robots noindex` is hygiene, **not** a security control. A copied private URL never bypasses Supabase RLS.
- Management can edit scouting, Battle Plans and VOD references. Individual players can customize their own linked stall preferences only. Staff can customize any.
- Temporary join requests are authenticated and invisible to other unapproved accounts.

## Live-data boundaries
- Public source: `lg3s_public_games` and `lg3s_public_player_lines`. Fixtures, stats and line overlap are **public** LeagueGaming data. Shared games are not a validated chemistry score.
- The 11 main-stall entries are seeded from the November 14, 2026 roster snapshot. A Training Camp roster was not verified in that snapshot: TC players are created by management as separately labelled entries.
- 3D room is the already-public Great Britain 3D showroom embedded in the authenticated War Room. The private stall modal links to game stats, partner co-appearances, development and private VOD references. The 3D show's own player hotspots still need a postMessage integration to open private stall modals directly.
- Scouting saved by humans remains `manual_unverified`; VOD evidence status must be approved separately. No AI model score or invented gameplay analysis is imported.
- VOD Center saves references only. The existing management VOD Lab can still be opened by authorized management. The new Todd/Elite Labs Stage 2 processor **is not connected** here until the owner's real-footage accuracy/cost tests pass.

## Deployment and tests
- All static changes in this feature branch; Vercel Git project `wildmanhockey-esportshub` serves the custom domain.
- Validate: unauthenticated cannot query private tables, owner can read/write, unknown authenticated user cannot read/write, a player cannot edit another player's stall, and owner-only approval is blocked to non-owners.
- Test Discord sign-in on the **permanent main domain**, because `backend.js` intentionally redirects OAuth back to the permanent domain.
- Do not merge/publish until the preview is inspected, the main-site link's login gate is tested, and there are no private footage/data exposures.
- Floot prototype was a separate temporary preview with its own database. Do not treat its accounts or saved notes as migrated.
