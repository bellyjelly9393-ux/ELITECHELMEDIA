#!/usr/bin/env python3
"""Read-only validator for lg3s-drops/ (schedule + team mapping). Writes only into lg3s-drops-reviewed/.
Usage: python3 lg3s-drops-reviewed/validate.py   (run from repo root)"""
import json, csv, collections
from datetime import datetime
from zoneinfo import ZoneInfo
ET, UTC = ZoneInfo('America/Toronto'), ZoneInfo('UTC')
D, R = 'lg3s-drops/', 'lg3s-drops-reviewed/'
src = json.load(open(D + 'schedules/lg3s-s1-week-02.json'))
csvr = list(csv.DictReader(open(D + 'schedules/lg3s-s1-week-02.csv', encoding='utf-8-sig')))
teams = json.load(open(D + 'teams/lg3s-s1-teams.json'))['teams']
db = {g['id']: g for g in json.load(open(R + 'reference/lg3s_games_week2_snapshot.json'))}
x3 = {g['game_id']: g for g in json.load(open(R + 'reference/seth_upload3_games.json'))}
x2 = json.load(open(R + 'reference/seth_upload2_team_ids.json'))
ea = json.load(open(R + 'reference/ea_clubs.json'))['clubs']
flags = []
def to12(t):  # "20:00" -> "8:00 PM"
    h, m = map(int, t.split(':')); return f"{(h-1)%12+1}:{m:02d} {'PM' if h>=12 else 'AM'}"
games, out = src['games'], []
ids = [g['game_id'] for g in games]
csv_by = {int(r['game_id']): r for r in csvr} if csvr and 'game_id' in csvr[0] else {}
tid = {t['lg_team_id']: t for t in teams}
for g in sorted(games, key=lambda g: g['game_id']):
    gid, chk, notes = g['game_id'], {}, []
    utc = datetime.fromisoformat(g['date'] + 'T' + g['time_et']).replace(tzinfo=ET).astimezone(UTC)
    utc_s = utc.strftime('%Y-%m-%dT%H:%M')
    d = db.get(gid)
    chk['in_lg3s_games'] = d is not None
    if d:
        chk['away_matches_db'] = d['a'] == g['away_team_id']; chk['home_matches_db'] = d['h'] == g['home_team_id']
        chk['utc_matches_db'] = d['utc'] == utc_s; chk['night_matches_db'] = d['night'] == g['date']
    x = x3.get(gid); chk['in_seth_upload3'] = x is not None
    if x:
        chk['away_matches_xlsx'] = x['away_team_id'] == g['away_team_id']; chk['home_matches_xlsx'] = x['home_team_id'] == g['home_team_id']
        chk['date_matches_xlsx'] = x['date'] == g['date']; chk['time_matches_xlsx'] = x['time_et'] == to12(g['time_et'])
    chk['team_names_match_ids'] = tid.get(g['away_team_id'], {}).get('name') == g['away_team'] and tid.get(g['home_team_id'], {}).get('name') == g['home_team']
    chk['source_url_has_game_id'] = f"gameid={gid}&" in (g.get('source_url') or '')
    if csv_by:
        c = csv_by.get(gid); chk['csv_row_matches'] = bool(c) and all(str(c.get(k, '')).strip() == str(g[k]) for k in ('date', 'time_et', 'away_team_id', 'home_team_id'))
    if g.get('lg_private_matchmaking_code') is not None: notes.append('matchmaking code present; must be verified on the LG game page')
    bad = [k for k, v in chk.items() if not v]
    out.append({**{k: g[k] for k in ('game_id', 'date', 'time_et', 'away_team', 'away_team_id', 'home_team', 'home_team_id', 'lg_private_matchmaking_code', 'lg_private_code_status', 'source_url')},
                'scheduled_at_utc': utc_s + ':00Z', 'fixture_status': g['status'],
                'validation_status': 'validated' if not bad else 'mismatch', 'failed_checks': bad, 'checks': chk, 'notes': notes,
                'ea_match_status': 'unmatched', 'ea_match_note': 'Not played yet (validated 2026-10-24); no EA record can exist.'})
    if bad: flags.append(f"SCHEDULE {gid}: failed {', '.join(bad)}")
# league-level structure checks (README promotion rules)
slot = collections.Counter((g['date'], g['time_et']) for g in games); per = collections.Counter()
for g in games: per[g['away_team_id']] += 1; per[g['home_team_id']] += 1
pairs = collections.Counter(frozenset((g['away_team_id'], g['home_team_id'])) for g in games)
struct = {'total_games': len(games), 'declared_total': src.get('total_games'), 'unique_ids': len(set(ids)), 'id_range_ok': sorted(ids) == list(range(921587, 921641)),
          'six_per_slot': all(v == 6 for v in slot.values()) and len(slot) == 9, 'nine_per_team': len(per) == 12 and all(v == 9 for v in per.values()),
          'no_team_twice_in_slot': all(len({t for g in games if (g['date'], g['time_et']) == s for t in (g['away_team_id'], g['home_team_id'])}) == 12 for s in slot),
          'all_scheduled': all(g['status'] == 'scheduled' for g in games), 'db_ids_not_in_drop': sorted(set(db) - set(ids)), 'csv_rows': len(csvr),
          'repeat_pairings': sorted([sorted(p) for p, n in pairs.items() if n > 1])}
for k, v in struct.items():
    if v is False: flags.append(f'STRUCTURE: {k} failed')
if struct['db_ids_not_in_drop']: flags.append(f"STRUCTURE: lg3s_games has week-2 IDs missing from drop: {struct['db_ids_not_in_drop']}")
# team mapping
x2n = {t['name']: t for t in x2}; tm = []
for t in teams:
    f, n = [], t['name']; w = x2n.get(n, {}); e = ea.get(n)
    if w.get('lg_team_id') != t['lg_team_id']: f.append(f"LG team ID {t['lg_team_id']} != seth_upload2 {w.get('lg_team_id')}")
    if w.get('group') != t['group']: f.append(f"group {t['group']} != seth_upload2 {w.get('group')}")
    if t['ea_club_id'] != w.get('club_id'): f.append(f"EA club {t['ea_club_id']} != seth_upload2 {w.get('club_id')}")
    if t['ea_club_id'] != e: f.append(f"EA club {t['ea_club_id']} != ea_clubs.json {e}")
    if t['ea_club_id'] is None: f.append('EA club ID unknown: EA matching impossible for this team until Seth supplies a verified ID')
    st = 'validated_lg_id_ea_unverified' if t['ea_club_id'] and not [x for x in f if '!=' in x] else ('lg_id_validated_ea_missing' if t['ea_club_id'] is None else 'mismatch')
    if n == 'Canada' and st == 'validated_lg_id_ea_unverified': st = 'validated_lg_id_ea_verified_week1'
    tm.append({**t, 'review_status': st, 'flags': f, 'lg_team_id_in_db_schedule': any(t['lg_team_id'] in (d['a'], d['h']) for d in db.values())})
    flags += [f'TEAM {n}: {x}' for x in f]
extra = sorted(set(ea) - {t['name'] for t in teams})
for n in extra: flags.append(f"TEAM {n}: EA club {ea[n]} appears in ea_clubs.json/seth_upload2 but is NOT an LG3S team; excluded from mapping (must never be matched)")
dup = [c for c, k in collections.Counter(t['ea_club_id'] for t in teams if t['ea_club_id']).items() if k > 1]
if dup: flags.append(f'TEAM: duplicate EA club IDs {dup}')
if 47705 in [t['ea_club_id'] for t in teams]: flags.append('TEAM: 47705 (Czechia) is assigned to an LG3S team!')
meta = {'validated_at': datetime.now(ET).isoformat(timespec='seconds'), 'validator': 'lg3s-drops-reviewed/validate.py', 'source_file': D + 'schedules/lg3s-s1-week-02.json',
        'references': ['lg3s_games (Supabase lrgllzvwgvqagcpiyvfd) snapshot 2026-10-24', 'seth_upload3.xlsx Games sheet', 'seth_upload2.xlsx Team IDs', 'ea_clubs.json']}
summ = {'validated': sum(o['validation_status'] == 'validated' for o in out), 'mismatch': sum(o['validation_status'] == 'mismatch' for o in out)}
json.dump({**meta, 'summary': summ, 'structure': struct, 'games': out}, open(R + 'schedule_week2.validated.json', 'w'), indent=1)
json.dump({**meta, 'excluded_non_lg3s_clubs': {n: ea[n] for n in extra}, 'teams': tm}, open(R + 'team_mapping.validated.json', 'w'), indent=1)
pass
print(summ, struct, *flags, sep='\n')
