# Wildman Gameplay Intelligence Engine (WGIE) — v0 architecture

Status: design-only, isolated development branch. No production endpoint, database, VOD, or deployment changes.

## Goal
Reusable movement-to-coaching pipeline for NHL, EA Sports FC, Madden and other games. The existing VOD Lab remains the source of truth for reviews and publication; this service consumes authorized video references or copies, never mutates existing VOD tables.

## Pipeline
1. Source manifest: video URL or object storage reference, sport, game version, match ID, clip window, video clock origin.
2. Detection: model-versioned object detections (player, puck/ball, referee, field markings).
3. Tracking: ByteTrack baseline; compare BoT-SORT on moving cameras. Tracking IDs are provisional, not identities.
4. Camera/rink/field calibration: homography or sport-specific mapping, with error/confidence and calibration version.
5. Movement features: paths, velocity, spacing, formations, candidate tactical events, quality flags.
6. Sport plugin: hockey/football/soccer-specific event definitions and coaching heuristics.
7. Evidence: every finding links to timestamps, source detections/tracks, model versions and confidence.
8. Human review and publishing: only approved findings may feed player stalls or scouting reports.

## Data contracts (logical schema, NOT applied to any database)
- sources: source_id, sport, title, external_review_id(nullable), video_uri, start_ms, end_ms, video_sha256(nullable), created_at
- analysis_runs: run_id, source_id, detector_version, tracker_name, tracker_config_hash, calibration_version, status, started_at, finished_at, error
- detections: run_id, frame_index, timestamp_ms, detection_id, object_class, bbox_xyxy_normalized, confidence
- tracks: run_id, track_id, frame_index, detection_id, timestamp_ms, identity_status, team_label(nullable), identity_label(nullable), confidence
- spatial_samples: run_id, track_id, timestamp_ms, coordinate_system, x, y, mapping_error, confidence
- movement_events: event_id, run_id, sport, event_type, start_ms, end_ms, participants, feature_json, confidence, evidence_refs, review_status
- coaching_findings: finding_id, event_ids, summary, recommendation, confidence, reviewer, approved_at(nullable)

Use separate storage namespace/project and scoped service identity; never share service-role credentials in clients. Restrict access by tenant/team and require audit logs.

## Integration contract (future, after review)
- Read-only import of existing review identifiers and approved video windows.
- Worker writes exclusively to new intelligence storage.
- Existing VOD database and API endpoints are untouched.
- Optional new read-only UI can consume approved findings after separate approval.
- No automatic publishing or edits to existing player stalls.

## Acceptance tests
1. No diffs to existing VOD Lab files/endpoints or production schema.
2. A 60-second authorized gameplay clip produces reproducible detections and tracks.
3. Compare ByteTrack and BoT-SORT: ID switches, missed detections, speed, memory.
4. Camera movement compensation produces calibrated rink/field positions with measurable error.
5. Missing/occluded puck or players generate uncertainty, never fabricated certainty.
6. Findings link back to correct source timestamps.
7. Sport plugin swap does not require changing shared schema.
8. Duplicate source/run submission is idempotent; failures can be retried.
9. Access controls, rate limits, retention, privacy, and game footage rights are reviewed.
10. Production deployment and any write integration require explicit separate approval.

## Initial implementation order
A. Freeze this logical contract and select an isolated development database.
B. Build a tiny 60-second clip benchmark, no VOD system changes.
C. Evaluate detector + ByteTrack vs BoT-SORT.
D. Implement NHL rink calibration.
E. Generate spatial_samples and reviewed candidate events.
F. Only then design a safe, opt-in read-only War Room integration.
