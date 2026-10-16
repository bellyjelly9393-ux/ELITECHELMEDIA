# Hitman Radio — Remote Commentary Integration Plan

Status: DEVELOPMENT ONLY. Do not deploy or change production routing without a separate review.

## Architecture
Game source -> OBS test scene -> existing approved streaming destination -> Elite Chel Media website.
Remote commentator microphone -> private VDO.Ninja guest session -> dedicated OBS browser source.
Game preview -> separate low-latency return to commentator, excluding commentator microphone and any delayed broadcast mix.

## Device-neutral connection
- Computer: browser microphone/headset into guest link.
- Phone: browser microphone into guest link, with wired or Bluetooth headphones and separate game preview.
- Xbox: party/Discord capture requires an additional bridge and explicit audio routing; not assumed to work with browser guest links.

## OBS local setup (manual; no OBS configuration modified by this commit)
1. Export scene collection and profile backup.
2. Add new scene: HITMAN RADIO - TEST, without editing existing live scenes.
3. Add isolated game feed source (use an authorized game source).
4. Add browser source HITMAN - REMOTE MIC using the *producer* VDO.Ninja view URL, never the guest invite URL. Enable source audio control when supported.
5. Monitor commentary on headphones. Prevent monitor/output double-routing and echo.
6. Use OBS filters: noise suppression if needed, compressor, limiter; tune with real test speech. Avoid unverified fixed settings.
7. Record local sample with isolated audio tracks if supported; check lip/gameplay-to-commentary timing.
8. Simulate microphone disconnect, network interruption, reconnect, muted mic, and failed guest join.
9. Confirm production stream key, VOD ingestion endpoints, and existing scenes remain unchanged.

## Producer dashboard planned capabilities
- Game metadata and rosters from read-only existing data APIs (no write to scouting/VOD)
- Private guest invite generation (server-side authorization and expiring token if implemented)
- Mic connected/disconnected indicator based on actual media-session state
- Producer-only mute and gain control via authenticated local bridge, not public OBS WebSocket
- Private preview with no self-voice return
- No direct stream-start/stop, scene collection edits, or stream key access for commentators

## Acceptance criteria
- Guest voice audible in isolated OBS recording
- Gameplay and commentary aligned to producer's satisfaction
- No echo or duplicate monitoring
- Reconnect after network interruption
- No public guest room URLs or stream credentials
- No changes to production OBS, website routes, VOD or scouting services
- End-to-end website broadcast tested only after existing stream destination is identified

## Weekend test sequence
1. Producer tests using second device as guest.
2. Record 60 seconds with test gameplay, check levels and timing.
3. Disconnect/reconnect guest.
4. Replace second device with actual commentator's chosen equipment.
5. Only then stage integration into website behind a restricted test route.

## Outstanding inputs
- Where gameplay originates (Xbox capture, player Twitch feed, or site player)
- Which streaming protocol/service feeds website
- Commentator's available device and microphone
- Whether current OBS runs on producer's local Windows machine
