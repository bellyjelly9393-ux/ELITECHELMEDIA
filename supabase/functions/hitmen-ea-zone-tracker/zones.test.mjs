// Synthetic unit test only (not real game data).
import assert from 'node:assert';
import { parseMembers, zoneDelta, windowHasOnlyMatch } from './zones.mjs';
import { eventSections } from '../hitmen-recap-autowriter/evidence.mjs';
const mk = (gp, s7, s15, g7) => ({ name: 'A', skgp: gp, skshots: s7 + s15, skgoals: g7, skShotsLocationOnIce7: s7, skShotsLocationOnIce15: s15, skGoalsLocationOnIce7: g7 });
const b = parseMembers({ members: [mk(10, 5, 3, 1)] }), a = parseMembers({ members: [mk(11, 7, 4, 2)] });
let r = zoneDelta(b, a, { x: { playername: 'A', position: 'center', skshots: '3', skgoals: '1' } });
assert.deepEqual(r.rows.map((x) => [x.event_type, x.ice_zone, x.event_count]), [['shot_zone', 7, 2], ['shot_zone', 15, 1], ['goal_zone', 7, 1]]);
r = zoneDelta(b, a, { x: { playername: 'A', position: 'center', skshots: '4', skgoals: '1' } }); assert.equal(r.rows.length, 0); assert.match(r.rejected[0].why, /zone sums/);
assert.equal(windowHasOnlyMatch([{ matchId: 1, timestamp: 150 }], 1, new Date(100e3).toISOString(), new Date(200e3).toISOString()), true);
assert.equal(windowHasOnlyMatch([{ matchId: 1, timestamp: 150 }, { matchId: 2, timestamp: 160 }], 1, new Date(100e3).toISOString(), new Date(200e3).toISOString()), false);
const secs = eventSections([{ side: 'calgary', event_type: 'shot_zone', ice_zone: 7, event_count: 2, verified: true }, { side: 'calgary', event_type: 'shot_zone', ice_zone: 15, event_count: 1, verified: true },
  { side: 'calgary', event_type: 'goal', period: 2, game_clock: '12:04', player: 'A', ice_zone: 7, event_count: 1, verified: true }, { side: 'calgary', event_type: 'shot_zone', ice_zone: 1, event_count: 9, verified: false }], { oNick: 'Red Deer', lgGameId: 1 });
console.log(secs.join('\n\n'));
assert.equal(eventSections([], { oNick: 'X', lgGameId: 1 }).length, 0);
console.log('OK');
