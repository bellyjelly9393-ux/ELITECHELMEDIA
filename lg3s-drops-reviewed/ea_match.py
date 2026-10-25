#!/usr/bin/env python3
"""LG3S <-> EA match linker (read-only on lg3s-drops/; writes only lg3s-drops-reviewed/ea_matches_week2.review.json).

Method (same as the Week-1 Canada verification, see --selftest):
  1. Club identity: both LG teams must map to an EA club ID in team_mapping.validated.json. Missing ID (Slovakia) => blocked_missing_club_id.
     Clubs not in the LG3S mapping (e.g. 47705 Czechia) are never matched.
  2. Opponent: the EA match must contain exactly the two clubs {away_ea, home_ea}.
  3. Time: EA's match `timestamp` is the END of the game (Canada wk1: +12..+37 min after LG start). Candidate window is
     LG scheduled start -15 min .. +75 min. Slots are 35 min apart, so time alone can overlap the next slot: opponent pair is mandatory.
  4. Score: EA goals per club vs the LG official final (away/home). Score is only compared when the LG game is final.
  5. Matchmaking code: if an LG private code and an EA-side code are both present they must be equal; never derived from the game ID.
Statuses: matched_verified | matched_restart_review (one score-matching candidate + other DNF/restart candidates) |
  score_mismatch_review | ambiguous_multiple_candidates | candidate_pending_lg_final | unmatched | blocked_missing_club_id | not_played_yet.
Nothing is written to Supabase or the site. A 'matched_*' status is a proposal for human review, not a promotion.

Accepted EA inputs (any *.json under lg3s-drops/ea-matches/, recursively):
  a) drop contract   {"matches":[{"ea_match_id","ea_club_id","opponent_ea_club_id","start_at_utc","goals_for","goals_against",...}]}
  b) raw EA proclubs [{"matchId","timestamp","clubs":{"<id>":{"score":..}},"players":{"<id>":{"<pid>":{"player_dnf":"0|1"}}}}]
     (also {"matches":[...raw...]})
  c) summary         {"matches":[{"matchId","ts","score":{"<id>":n},"dnf":bool}]}
Usage: python3 lg3s-drops-reviewed/ea_match.py [--now ISO] | --selftest
"""
import json, glob, sys, os
from datetime import datetime, timezone
WIN_BEFORE, WIN_AFTER = 15 * 60, 75 * 60
R = 'lg3s-drops-reviewed/'

def epoch(v):
    if v is None: return None
    if isinstance(v, (int, float)) or str(v).isdigit(): return int(v)
    return int(datetime.fromisoformat(str(v).replace('Z', '+00:00')).timestamp())

def normalise(obj, src):
    """-> list of {id, ts, score{club:int}, dnf, code, src}"""
    rows = obj.get('matches', obj) if isinstance(obj, dict) else obj
    out = {}
    for m in rows if isinstance(rows, list) else []:
        if 'clubs' in m:  # raw EA
            sc = {str(c): int(v.get('score', v.get('goals', 0))) for c, v in m['clubs'].items()}
            dnf = any(str(p.get('player_dnf', '0')) == '1' for cl in (m.get('players') or {}).values() for p in cl.values())
            rec = dict(id=str(m.get('matchId')), ts=epoch(m.get('timestamp')), score=sc, dnf=dnf, code=None)
        elif 'score' in m:  # summary
            rec = dict(id=str(m.get('matchId')), ts=epoch(m.get('ts')), score={str(k): int(v) for k, v in m['score'].items()}, dnf=bool(m.get('dnf')), code=None)
        elif 'ea_club_id' in m:  # drop contract
            if m.get('ea_club_id') is None or m.get('opponent_ea_club_id') is None or m.get('goals_for') is None: continue
            rec = dict(id=str(m.get('ea_match_id')), ts=epoch(m.get('start_at_utc')), score={str(m['ea_club_id']): int(m['goals_for']), str(m['opponent_ea_club_id']): int(m['goals_against'])},
                       dnf=bool(m.get('dnf')), code=m.get('lg_private_matchmaking_code'))
        else: continue
        rec['src'] = src
        if rec['ts'] is None: continue
        k = rec['id'] if rec['id'] not in ('None', 'null') else f"{src}:{rec['ts']}"
        out[k] = {**out.get(k, {}), **rec}
    return list(out.values())

def link(games, ea_of, records, now):
    """games: [{game_id, away_team_id, home_team_id, start(epoch), away_score, home_score, final(bool), code}]"""
    lg3s = {str(v) for v in ea_of.values() if v}
    res, claimed = [], {}
    for g in games:
        a, h = ea_of.get(g['away_team_id']), ea_of.get(g['home_team_id'])
        r = {'lg_game_id': g['game_id'], 'away_ea_club_id': a, 'home_ea_club_id': h, 'candidates': [], 'flags': []}
        if not a or not h:
            r['status'] = 'blocked_missing_club_id'; r['flags'].append('An LG team has no verified EA club ID'); res.append(r); continue
        pair = {str(a), str(h)}
        cands = [x for x in records if set(x['score']) == pair and g['start'] - WIN_BEFORE <= x['ts'] <= g['start'] + WIN_AFTER]
        for x in cands:
            ok = None
            if g.get('final'): ok = x['score'][str(a)] == g['away_score'] and x['score'][str(h)] == g['home_score']
            code_ok = None if not (x.get('code') and g.get('code')) else x['code'] == g['code']
            r['candidates'].append({'ea_match_id': x['id'], 'ea_end_utc': datetime.fromtimestamp(x['ts'], timezone.utc).isoformat().replace('+00:00', 'Z'),
                                    'minutes_after_lg_start': round((x['ts'] - g['start']) / 60, 1), 'ea_away_goals': x['score'][str(a)], 'ea_home_goals': x['score'][str(h)],
                                    'score_matches_lg_final': ok, 'dnf': x['dnf'], 'code_matches': code_ok, 'source_file': x['src']})
        c = r['candidates']; good = [x for x in c if x['score_matches_lg_final'] and x['code_matches'] is not False]
        if not c: r['status'] = 'not_played_yet' if g['start'] > now else 'unmatched'
        elif not g.get('final'): r['status'] = 'candidate_pending_lg_final' if len(c) == 1 else 'ambiguous_multiple_candidates'
        elif len(c) == 1 and good: r['status'] = 'matched_verified'
        elif len(good) == 1:
            r['status'] = 'matched_restart_review'; r['flags'].append(f"{len(c)-1} other EA game(s) between these clubs in the window (restart/DNF?) - confirm manually")
        elif len(good) > 1: r['status'] = 'ambiguous_multiple_candidates'; r['flags'].append('More than one EA game reproduces the LG final')
        else: r['status'] = 'score_mismatch_review'; r['flags'].append('EA score differs from LG final (DNF scoring, restart or wrong game)')
        if any(x['dnf'] for x in c): r['flags'].append('DNF present on a candidate')
        if good and len(good) == 1: r['proposed_ea_match_id'] = good[0]['ea_match_id']; claimed.setdefault(good[0]['ea_match_id'], []).append(g['game_id'])
        res.append(r)
    conflicts = {k: v for k, v in claimed.items() if len(v) > 1}
    for r in res:
        if r.get('proposed_ea_match_id') in conflicts: r['status'] = 'ambiguous_multiple_candidates'; r['flags'].append(f"EA match also proposed for {conflicts[r['proposed_ea_match_id']]}")
    used = {x['ea_match_id'] for r in res for x in r['candidates']}
    orphans = [{'ea_match_id': x['id'], 'clubs': x['score'], 'end_utc': datetime.fromtimestamp(x['ts'], timezone.utc).isoformat(), 'non_lg3s_club': not set(x['score']) <= lg3s, 'src': x['src']}
               for x in records if x['id'] not in used]
    return res, orphans

def main():
    sched = json.load(open(R + 'schedule_week2.validated.json'))['games']
    ea_of = {t['lg_team_id']: t['ea_club_id'] for t in json.load(open(R + 'team_mapping.validated.json'))['teams']}
    finals = {}
    if os.path.exists(R + 'reference/lg_finals_week2.json'):  # optional: [{lg_game_id, away_score, home_score}] from verified lg3s_games after games are final
        finals = {f['lg_game_id']: f for f in json.load(open(R + 'reference/lg_finals_week2.json'))}
    games = [{'game_id': g['game_id'], 'away_team_id': g['away_team_id'], 'home_team_id': g['home_team_id'], 'start': epoch(g['scheduled_at_utc']), 'code': g['lg_private_matchmaking_code'],
              'final': g['game_id'] in finals, 'away_score': finals.get(g['game_id'], {}).get('away_score'), 'home_score': finals.get(g['game_id'], {}).get('home_score')} for g in sched]
    files = [f for f in glob.glob('lg3s-drops/ea-matches/**/*.json', recursive=True)]
    recs = [x for f in files for x in normalise(json.load(open(f)), f)]
    now = epoch(sys.argv[sys.argv.index('--now') + 1]) if '--now' in sys.argv else int(datetime.now(timezone.utc).timestamp())
    res, orphans = link(games, ea_of, recs, now)
    from collections import Counter
    out = {'generated_at_utc': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'ea_files_read': files, 'ea_records': len(recs), 'window_minutes': [-WIN_BEFORE // 60, WIN_AFTER // 60],
           'summary': dict(Counter(r['status'] for r in res)), 'games': res, 'orphan_ea_matches': orphans}
    json.dump(out, open(R + 'ea_matches_week2.review.json', 'w'), indent=1); print(out['summary'], 'files:', len(files), 'records:', len(recs), 'orphans:', len(orphans))

def selftest():
    ea = normalise(json.load(open(R + 'reference/selftest_canada_week1_ea.json')), 'selftest')
    lg = json.load(open(R + 'reference/selftest_canada_week1_lg.json'))['games']
    ea_of = {t['lg_team_id']: t['ea_club_id'] for t in json.load(open(R + 'team_mapping.validated.json'))['teams']}
    games = [{'game_id': g['lg_game_id'], 'away_team_id': g['a'], 'home_team_id': g['h'], 'start': g['ts'], 'final': True, 'away_score': g['as'], 'home_score': g['hs'], 'code': None} for g in lg]
    res, orph = link(games, ea_of, ea, 1792900000)
    got = {r['lg_game_id']: (r['status'], r.get('proposed_ea_match_id')) for r in res}
    exp = {921567: ('matched_verified', '2790576450015'), 921574: ('matched_restart_review', '2834696320310'), 921578: ('matched_verified', '2836771760211'),
           921583: ('matched_verified', '2840124120396'), 921541: ('blocked_missing_club_id', None)}
    bad = {k: (got[k], v) for k, v in exp.items() if got[k] != v}
    for k in sorted(got): print(k, *got[k])
    print('SELFTEST', 'PASS' if not bad else f'FAIL {bad}', '| orphans', len(orph)); sys.exit(1 if bad else 0)

if __name__ == '__main__':
    selftest() if '--selftest' in sys.argv else main()
