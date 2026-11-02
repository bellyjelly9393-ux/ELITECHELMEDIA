"""Convert raw in-browser page extracts (raw/*.json) into the lg-game-capture-v1 drop format."""
import json, sys, re, csv, glob, os
from datetime import datetime, timezone

RAW, OUT = sys.argv[1], sys.argv[2]
SP = os.path.dirname(os.path.abspath(__file__)) + '/'
teams = {int(r['id']): r for r in csv.DictReader(open(SP + 'teams.csv'))}
sched = {int(r['gid']): (int(r['away']), int(r['home'])) for r in csv.DictReader(open(os.environ['SCHED']))}
URL = 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid={}'
NOTES = [
    "LG game page is the official record; EA parts here list only the segments shown on the LG page (periods, submitter, time).",
    "Player stat lines are whole-game totals; only team goals are split by period.",
    "No play-by-play (Action Tracker) is available in LG's or EA's web data.",
    "EA raw part data (View EA Game pages) was not captured for this night; ea_parts carries the LG page's segment list only.",
]
TS_KEYS = {'Goals': 'goals', 'Total Shots': 'total_shots', 'Hits': 'hits', 'Time on Attack': 'time_on_attack',
           'Passing%': 'passing_pct', 'Face offs won': 'face_offs_won', 'Penalty Minutes': 'penalty_minutes',
           'Power Plays': 'power_plays', 'Power Play Minutes': 'power_play_minutes', 'Blocks': 'blocks',
           'Shorthanded Goals': 'shorthanded_goals'}
INT_TS = {'goals', 'total_shots', 'hits', 'face_offs_won', 'blocks', 'shorthanded_goals'}
FLAGS = []
NAME_RE = re.compile(r'^(.*) \((LW|C|RW|LD|RD|G)\) (\S+)(?: (.*))?$')


def secs(t):
    m, s = t.split(':'); return int(m) * 60 + int(s)


def num(s):
    s = s.strip()
    if s in ('', '-'): return 0
    if re.fullmatch(r'[+-]?\d+', s): return int(s)
    return float(s)


def convert(raw):
    gid = raw['gid']
    away_id, home_id = sched[gid]
    tids = [int(x) for x in raw['tids'][:2]]
    assert tids == [away_id, home_id], (gid, tids, away_id, home_id)
    h = [t for _, t in raw['header']]
    status = next(x for x in h if re.fullmatch(r'FINAL|F/OT|F/SO', x))
    played = next(x for x in h if re.search(r'\d{4}, \d\d:\d\d [AP]M', x))
    scores = [int(c[1]) for c in raw['header'] if c[0] == 'lg_game_header']
    per = raw['period']
    cols = per[1][1:]
    side = {}
    for i, s in enumerate(('away', 'home')):
        row = per[2 + i]
        m = re.match(r'^(.*) \((\d+-\d+-\d+)\)$', row[0])
        tid = tids[i]
        gbp = {cols[j]: int(row[1 + j]) for j in range(len(cols))}
        side[s] = dict(lg_team_id=tid, name=m.group(1), record=m.group(2), goals_by_period=gbp,
                       score=scores[i], full_name=teams[tid]['name'])
        if sum(gbp.values()) != scores[i]:
            FLAGS.append((gid, s, 'period goals on the LG page do not add up to the final score'))
    ts = {}
    for r in raw['teamstats']:
        if len(r) == 3 and r[1] in TS_KEYS:
            k = TS_KEYS[r[1]]
            a, b = r[0], r[2]
            ts[k] = {'away': int(a) if k in INT_TS else a, 'home': int(b) if k in INT_TS else b}
    assert ts['goals'] == {'away': scores[0], 'home': scores[1]}, gid
    poss = {}
    pbt = raw.get('poss_by_team') or {}
    for s, tid in zip(('away', 'home'), tids):
        poss[s] = [{'position': r[0], 'seconds': int(r[1]), 'player': r[2]} for r in pbt.get(str(tid), [])]
    skaters, cur = [], None
    names = {teams[tids[0]]['name']: 'away', teams[tids[1]]['name']: 'home'}
    for p in raw['players']:
        c = p['c']
        if len(c) == 1:
            cur = names.get(c[0]); assert cur, (gid, c[0]); continue
        if not p['uid']: continue
        m = NAME_RE.match(c[2]); assert m, (gid, c[2])
        tod = c[9]
        skaters.append(dict(
            side=cur, team=side[cur]['full_name'], lg_user_id=int(p['uid']), player=m.group(1), position=m.group(2),
            build=m.group(3), badges=(m.group(4) or '').split() if m.group(4) else [], lg_ratings=[int(x) for x in p['rat']],
            goals=num(c[3]), ast=num(c[4]), pts=num(c[5]), plus_minus=num(c[6]),
            time_on_ice=c[7], time_on_ice_seconds=secs(c[7]), time_with_puck=c[8], time_with_puck_seconds=secs(c[8]),
            shots_on_goal_attempts=tod, shots_on_goal_attempts_on_goal=int(tod.split('/')[0]),
            shots_on_goal_attempts_attempts=int(tod.split('/')[1]),
            deflections=num(c[10]), pass_pct=num(c[11]), saucer_passes=num(c[12]), hits=num(c[13]), take_aways=num(c[14]),
            give_aways=num(c[15]), blocked_shots=num(c[16]), interceptions=num(c[17]), pims=c[18], pims_seconds=secs(c[18]),
            penalties_drawn=num(c[19]), pk_clears=num(c[20])))
    goalies = []
    for p in raw['goalies']:
        if not p['uid']: continue
        c = p['c']
        m = NAME_RE.match(c[2]); assert m, (gid, c[2])
        g = dict(lg_user_id=int(p['uid']), player=m.group(1), build=m.group(3), lg_ratings=[int(x) for x in p['rat']],
                 shots=num(c[3]), s_pct=num(c[4]), ga=num(c[5]), save=num(c[6]), gaa=num(c[7]), poke_check_saves=num(c[8]),
                 desperate_saves=num(c[9]), ba_sv=num(c[10]), break_away_pct=num(c[11]), pen_shot_pct=num(c[12]),
                 shutout_periods=num(c[13]))
        goalies.append(g)
    # goalie side: goals allowed matches opponent score
    for g in goalies:
        opts = [s for s in ('away', 'home') if g['ga'] == side['home' if s == 'away' else 'away']['score']]
        if len(opts) == 1:
            g.update(side=opts[0], side_basis='goals_allowed_matches_opponent_score', team=side[opts[0]]['full_name'])
        else:
            g.update(side=None, side_basis='ambiguous', team=None)
    if len(goalies) == 2 and goalies[0]['side'] is None and goalies[1]['side'] is None:
        # tie score in GA terms (both allowed same): fall back to page order (away goalie listed first)
        for g, s in zip(goalies, ('away', 'home')):
            g.update(side=s, side_basis='page_order_ga_equal', team=side[s]['full_name'])
    ea = []
    for r in raw['ea'][2:]:
        if len(r) >= 4 and r[0].startswith('View EA Game'):
            ea.append(dict(part=len(ea), periods=r[1], submitted_by=r[2], submitted_at=r[3]))
    edits = None
    if raw.get('edit'):
        m = re.search(r'Edited (\d+) time\(s\) The Last edit was by (.*) on (.*)$', raw['edit'])
        if m: edits = dict(count=int(m.group(1)), last_by=m.group(2), last_at=m.group(3))
    return dict(schema='lg-game-capture-v1', league='LGCHL', league_id=39, season=55, lg_game_id=gid, status=status,
                played_at_text=played, source_url=URL.format(gid), captured_at=raw['captured_at'],
                away=side['away'], home=side['home'], team_stats=ts, possession_seconds_by_position=poss,
                skaters=skaters, goalies=goalies, ea_parts=ea, lag_out=len(ea) > 1, edits=edits, notes=NOTES)


def main():
    os.makedirs(OUT, exist_ok=True)
    games = []
    for f in sorted(glob.glob(RAW + '/*.json')):
        raw = json.load(open(f))
        if raw.get('error'):
            print('SKIP', raw['gid'], raw['error']); continue
        g = convert(raw); games.append(g)
        json.dump(g, open(f"{OUT}/game_{g['lg_game_id']}.json", 'w'), indent=1, ensure_ascii=False)
    with open(OUT + '/games.csv', 'w', newline='') as fh:
        w = csv.writer(fh); w.writerow(['lg_game_id', 'played_at', 'status', 'away', 'away_score', 'home', 'home_score', 'lag_out', 'ea_parts', 'source_url'])
        for g in games:
            w.writerow([g['lg_game_id'], g['played_at_text'], g['status'], g['away']['full_name'], g['away']['score'],
                        g['home']['full_name'], g['home']['score'], g['lag_out'], len(g['ea_parts']), g['source_url']])
    sk_cols = ['side', 'team', 'lg_user_id', 'player', 'position', 'build', 'badges', 'goals', 'ast', 'pts', 'plus_minus', 'time_on_ice',
               'time_on_ice_seconds', 'time_with_puck', 'time_with_puck_seconds', 'shots_on_goal_attempts', 'shots_on_goal_attempts_on_goal',
               'shots_on_goal_attempts_attempts', 'deflections', 'pass_pct', 'saucer_passes', 'hits', 'take_aways', 'give_aways',
               'blocked_shots', 'interceptions', 'pims', 'pims_seconds', 'penalties_drawn', 'pk_clears']
    with open(OUT + '/skater_game_lines.csv', 'w', newline='') as fh:
        w = csv.writer(fh); w.writerow(['lg_game_id'] + sk_cols)
        for g in games:
            for s in g['skaters']:
                w.writerow([g['lg_game_id']] + [json.dumps(s[k]) if k == 'badges' else s[k] for k in sk_cols])
    gl_cols = ['lg_user_id', 'player', 'build', 'shots', 's_pct', 'ga', 'save', 'gaa', 'poke_check_saves', 'desperate_saves', 'ba_sv',
               'break_away_pct', 'pen_shot_pct', 'shutout_periods', 'side', 'side_basis', 'team']
    with open(OUT + '/goalie_game_lines.csv', 'w', newline='') as fh:
        w = csv.writer(fh); w.writerow(['lg_game_id'] + gl_cols)
        for g in games:
            for x in g['goalies']:
                w.writerow([g['lg_game_id']] + [x[k] for k in gl_cols])
    cap = dict(league='LGCHL', league_id=39, season=55, game_night=os.environ.get('NIGHT','2026-10-27'), games_scheduled=93, games_included=len(games),
               complete=len(games) == 93, converted_at=datetime.now(timezone.utc).isoformat(),
               source="Public LG game pages, read one at a time with 20-25 second gaps in the user's own Chrome; LG game-page data only (no EA part detail)")
    json.dump(cap, open(OUT + '/capture.json', 'w'), indent=1)
    for f in FLAGS: print('FLAG', f)
    cap['flags'] = [dict(lg_game_id=f[0], side=f[1], note=f[2]) for f in FLAGS]
    json.dump(cap, open(OUT + '/capture.json', 'w'), indent=1)
    print('games', len(games), 'skater lines', sum(len(g['skaters']) for g in games), 'goalie lines', sum(len(g['goalies']) for g in games))


if __name__ == '__main__':
    main()
