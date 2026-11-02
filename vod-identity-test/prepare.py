"""Copy bounded, public LG evidence and the isolated compatibility schema for tests."""
from pathlib import Path
import json
import re

root = Path(__file__).resolve().parent.parent
dest = root / 'vod-identity-test'
source = (root / 'test-vod-lg-identity.cjs').read_text(encoding='utf-8')
schema = source[source.index('create role authenticated;'):source.index('select set_config(')]
schema = schema.replace('${id(1)}', 'a0000000-0000-4000-8000-000000000001').replace('${id(2)}', 'a0000000-0000-4000-8000-000000000002')
assert '${' not in schema
(dest / 'schema.sql').write_text(schema.rstrip() + '\n', encoding='utf-8')
games = json.loads((dest / 'reviews.json').read_text(encoding='utf-8'))
for game in games:
    if game.get('lineup_capture'):
        capture = root / game['lineup_capture']
        saved = json.loads(capture.read_text(encoding='utf-8'))
        assert saved['status']=='complete' and saved['database_unchanged']
        data = next(g for g in saved['games'] if str(g['lg_game_id'])==str(game['lg_game_id']))
        assert data['schema']=='lg-final-game-lineup-v1'
        game['players'] = data['players']
        observed = data['observed_at']
    else:
        capture = root / 'lgchl-drops/games/s55/2026-10-25' / ('game_' + str(game['lg_game_id']) + '.json')
        data = json.loads(capture.read_text(encoding='utf-8'))
        game['players'] = [{**{key: row.get(key) for key in ('player', 'side', 'team', 'lg_user_id')}, 'position': row.get('position') or 'G'} for row in data['skaters'] + data['goalies']]
        observed = data['captured_at']
    assert data['league'] == 'LGCHL' and data['season'] == 55 and str(data['lg_game_id']) == str(game['lg_game_id'])
    game['lineup_source'] = {'url': data['source_url'], 'captured_at': observed, 'client_capture': str(capture.relative_to(root)).replace('\\', '/')}
    assert len(game['players']) == 12 and len({str(p['lg_user_id']) for p in game['players']}) == 12
    assert all(re.fullmatch('[1-9][0-9]*', str(p['lg_user_id'])) for p in game['players'])
(dest / 'games.json').write_text(json.dumps(games, indent=2) + '\n', encoding='utf-8')
print('Prepared', len(games), 'LG final-game rosters,', sum(len(g['players']) for g in games), 'player appearances; new test IDs only.')
