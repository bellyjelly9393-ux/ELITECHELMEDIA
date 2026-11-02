"""Converted game files -> one UPDATE for lgchl_games (only rows still 'scheduled' with matching teams)."""
import json, glob, sys
D = sys.argv[1]
rows = []
for f in sorted(glob.glob(D.rstrip('/') + '/game_*.json')):
    g = json.load(open(f))
    dec = {'FINAL': 'REG', 'F/OT': 'OT', 'F/SO': 'SO'}[g['status']]
    rows.append(f"({g['lg_game_id']},{g['away']['lg_team_id']},{g['home']['lg_team_id']},{g['away']['score']},{g['home']['score']},'{dec}','{g['captured_at']}'::timestamptz)")
print('with v(gid,away,home,ascore,hscore,dec,cap) as (values\n' + ',\n'.join(rows) + ')\n'
      "update public.lgchl_games g set status='final', away_score=v.ascore, home_score=v.hscore, decided_in=v.dec, fetched_at=v.cap, updated_at=now()\n"
      "from v where g.lg_game_id=v.gid and g.away_lg_team_id=v.away and g.home_lg_team_id=v.home and g.season=55 and g.status='scheduled'\n"
      "returning g.lg_game_id;")
