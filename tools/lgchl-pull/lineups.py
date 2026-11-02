"""Build lgchl-pregame-lineups-v1 json + md from in-browser parsed game pages (lu.json)."""
import json, sys, re
LU, DATE, DAYTXT, OUTDIR = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
URL = 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid={}'
raw = json.load(open(LU))
games = []
for gid in sorted(raw, key=int):
    g = raw[gid]
    t = re.search(r'(\d\d:\d\d [AP]M)', g['when']).group(1).lstrip('0')
    def team(s):
        return {k: s[k] for k in ('team', 'skaters', 'goalies', 'offense_breakdown', 'defense_breakdown')}
    games.append(dict(lg_game_id=int(gid), puck_drop_et=t, away=team(g['away']), home=team(g['home']),
                      team_ratings={k: g['team_ratings'][k] for k in ('tot', 'off', 'def', 'goalie')},
                      source_url=URL.format(gid)))
doc = dict(schema='lgchl-pregame-lineups-v1', date=DATE,
           basis="Players listed for each team on LG's game page before puck drop", games=games)
json.dump(doc, open(f'{OUTDIR}/hitmen-lineups-{DATE}.json', 'w'), indent=1, ensure_ascii=False)


def pm(v):
    return f'+{v}' if isinstance(v, int) and v > 0 else str(v)


def combo(b):
    who = ' '.join(b['players'])
    return f"**{who}**: combined {b['rec']} in {b['gp']} GP, {b['goals']}-{b['ast']}-{b['pts']}, {pm(b['plus_minus'])} "


L = [f'# Hitmen games tonight: lineups listed on LG ({DAYTXT})', '',
     "From each game's LG page before puck drop. \"Top line\" and \"Top D pair\" are LG's Offense / Defense",
     'Break Down: the first player listed at each spot. Combined numbers are those players\' own totals added up.',
     "Each team's full list is shown in LG's order, with overall rating (OVR), salary, record and season 55 numbers.", '',
     "**Note for writers:** report what LG lists and do not guess who will actually dress. The game sheet after each game is the final word.", '']
for g in games:
    a, h, r = g['away'], g['home'], g['team_ratings']
    L += [f"## {g['puck_drop_et']} ET: {a['team']} @ {h['team']} (game {g['lg_game_id']})", '',
          f"| Rating | {a['team']} | {h['team']} |", '|---|---|---|']
    for k, lab in (('tot', 'Tot'), ('off', 'Off'), ('def', 'Def'), ('goalie', 'Goalie')):
        L.append(f"| {lab} | {r[k]['away']} | {r[k]['home']} |")
    L.append('')
    for s in (a, h):
        L += [f"**{s['team']}**", '']
        if s['offense_breakdown']:
            L.append('- Top line (LG Offense Break Down): ' + combo(s['offense_breakdown'][0]))
        if s['defense_breakdown']:
            L.append('- Top D pair (LG Defense Break Down): ' + combo(s['defense_breakdown'][0]))
        if s['goalies']:
            x = s['goalies'][0]
            L.append(f"- First goalie listed: **{x['player']}** ({x['gwin']}-{x['gloss']}, GAA {x['gaa']}, SV {x['savep']})")
        L += ['', "Full list on the game page, in LG's order:", '',
              '| Pos | Player | OVR | $M | Rec | GP | G-A-P | +/- |', '|---|---|---|---|---|---|---|---|']
        for p in s['skaters']:
            L.append(f"| {p['position']} | {p['player']} | {p['overall']} | {p['salary_m']} | {p['rec']} | {p['gp']} | {p['goals']}-{p['ast']}-{p['pts']} | {p['plus_minus']} |")
        for x in s['goalies']:
            L.append(f"| G | {x['player']} | {x['overall']} | {x['salary_m']} | {x['gwin']}-{x['gloss']} | {x['ggp']} | GAA {x['gaa']}, SV {x['savep']} | |")
        L.append('')
open(f'{OUTDIR}/hitmen-lineups-{DATE}.md', 'w').write('\n'.join(L))
print('games', len(games), [(g['lg_game_id'], g['away']['team'], g['home']['team'], len(g['away']['skaters']), len(g['home']['skaters'])) for g in games])
