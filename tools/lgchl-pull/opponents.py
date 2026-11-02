"""Hitmen opponents drop: each of tonight's opponents' games from the previous night (converted
game JSON) plus season totals from the member-stats pull.

usage: opponents.py LINEUPS_JSON PREV_NIGHT_GAMES_DIR MEMBERSTATS_JSON DATE "Day label" "Prev night label" OUTDIR
"""
import json, sys, glob, collections
LU, GDIR, MS, DATE, DAY, PREV, OUT = sys.argv[1:8]
CAL = 412
lu = json.load(open(LU))
games = [json.load(open(f)) for f in sorted(glob.glob(GDIR.rstrip('/') + '/game_*.json'))]
ms = json.load(open(MS))
sk_tab = next(t for t in ms['tables'] if t['type'] == 'skater')
gl_tab = next(t for t in ms['tables'] if t['type'] == 'goalie')
SH, GH = sk_tab['headers'], gl_tab['headers']
season_sk = {r[1]['uid']: dict(zip(SH, r)) for r in sk_tab['rows'] if isinstance(r[1], dict)}
season_gl = {r[1]['uid']: dict(zip(GH, r)) for r in gl_tab['rows'] if isinstance(r[1], dict)}

opps = []
for g in lu['games']:
    side = 'home' if g['away']['team'] == 'Calgary Hitmen' else 'away'
    opps.append((g, g[side]['team']))

doc = dict(schema='lgchl-opponent-lineups-v1', date=DATE, team='Calgary Hitmen', lg_team_id=CAL,
           basis=f"Opponents' {PREV} LG game sheets + season 55 player totals", opponents=[])
md = [f'# Hitmen opponents: {DAY} (LGCHL S55)', '',
      f"Built from each opponent's games on {PREV} (LG game sheets) plus season 55 totals.",
      'Lineups are who actually played last night, not a confirmed lineup for tonight.',
      f"Tonight's LG-listed lineups are in `../../lineups/{DATE}/`.", '']
for tg, name in opps:
    mine = [x for x in games if name in (x['away']['full_name'], x['home']['full_name'])]
    tid = next((x[s]['lg_team_id'] for x in mine for s in ('away', 'home') if x[s]['full_name'] == name), None)
    o = dict(lg_team_id=tid, name=name, record_after_last_night=None, last_night=[])
    spots = collections.defaultdict(collections.Counter)
    build = {}
    gl = collections.Counter()
    last_id = 0
    for x in sorted(mine, key=lambda x: x['lg_game_id']):
        me = 'away' if x['away']['full_name'] == name else 'home'
        op = 'home' if me == 'away' else 'away'
        a, b = x[me]['score'], x[op]['score']
        res = ('W' if a > b else ('OTL' if x['status'] != 'FINAL' else 'L')) + f' {a}-{b}'
        if x['status'] != 'FINAL': res += ' (' + x['status'] + ')'
        if x['lg_game_id'] > last_id: last_id, o['record_after_last_night'] = x['lg_game_id'], x[me]['record']
        lineup = []
        for s in x['skaters']:
            if s['side'] != me: continue
            spots[s['position']][s['player']] += 1; build[s['player']] = (s['build'], s['lg_user_id'])
            lineup.append(dict(position=s['position'], player=s['player'], build=s['build'], g=s['goals'], a=s['ast'], p=s['pts'],
                               plus_minus=s['plus_minus'], shots=s['shots_on_goal_attempts'], hits=s['hits'], takeaways=s['take_aways'],
                               giveaways=s['give_aways'], time_with_puck=s['time_with_puck']))
        goalies = []
        for q in x['goalies']:
            if q['side'] != me: continue
            gl[q['player']] += 1; build[q['player']] = (q['build'], q['lg_user_id'])
            goalies.append(dict(player=q['player'], build=q['build'], shots=q['shots'], saves=q['save'], ga=q['ga']))
        o['last_night'].append(dict(lg_game_id=x['lg_game_id'], played_at=x['played_at_text'], opponent=x[op]['full_name'],
                                    home_or_away=me, result=res, lag_out=x['lag_out'], goals_by_period=x[me]['goals_by_period'],
                                    team_stats={k: v[me] for k, v in x['team_stats'].items()}, lineup=lineup, goalies=goalies))
    usual = []
    for pos in ('LW', 'C', 'RW', 'LD', 'RD'):
        for p, n in spots[pos].most_common():
            st = season_sk.get(build[p][1], {})
            usual.append(dict(position=pos, player=p, games=n, build=build[p][0], s55=dict(gp=st.get('GP'), g=st.get('G'), a=st.get('A'), pts=st.get('Pts'), plus_minus=st.get('+/-'))))
    for p, n in gl.most_common():
        st = season_gl.get(build[p][1], {})
        usual.append(dict(position='G', player=p, games=n, build=build[p][0], s55=dict(gp=st.get('GP'), record=st.get('Record'), save_pct=st.get('Save%'), gaa=st.get('GAA'))))
    o['usual_lineup'] = usual
    doc['opponents'].append(o)
    t = tg['puck_drop_et']; ha = 'vs' if tg['home']['team'] == 'Calgary Hitmen' else '@'
    md += [f"## {t} ET: Hitmen {ha} {name} (game {tg['lg_game_id']})", '',
           f"Record after last night: **{o['record_after_last_night']}**", '', '**Last night**', '']
    for ln in o['last_night']:
        ts = ln['team_stats']; at = 'vs' if ln['home_or_away'] == 'home' else '@'
        lag = ' (lag-out)' if ln['lag_out'] else ''
        md.append(f"- {ln['result']} {at} {ln['opponent']}{lag}: shots {ts.get('total_shots')}, hits {ts.get('hits')}, TOA {ts.get('time_on_attack')}, pass {ts.get('passing_pct')}, FO won {ts.get('face_offs_won')}")
    if not o['last_night']:
        md.append('- No games found for last night.')
    md += ['', '**Usual lineup last night** (games played at that spot)', '',
           '| Pos | Player | Build | S55 GP | S55 G-A-P | S55 +/- |', '|---|---|---|---|---|---|']
    for u in usual:
        s = u['s55']
        if u['position'] == 'G':
            md.append(f"| G | {u['player']} ({u['games']}) | {u['build']} | {s['gp']} | {s['record']}, {s['save_pct']} sv% | — |")
        else:
            md.append(f"| {u['position']} | {u['player']} ({u['games']}) | {u['build']} | {s['gp']} | {s['g']}-{s['a']}-{s['pts']} | {s['plus_minus']} |")
    md.append('')
json.dump(doc, open(f'{OUT}/hitmen-opponents-{DATE}.json', 'w'), indent=1, ensure_ascii=False)
open(f'{OUT}/hitmen-opponents-{DATE}.md', 'w').write('\n'.join(md))
print([(o['name'], o['record_after_last_night'], len(o['last_night'])) for o in doc['opponents']])
