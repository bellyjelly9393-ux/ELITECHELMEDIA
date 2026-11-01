import importlib.util
from pathlib import Path
import unittest

def module(name, filename):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).resolve().parents[1]/'scripts'/filename)
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result

exporter=module('account_export','export-lg-account-capture.py')
capture=module('account_capture','capture-lg-platform-accounts.py')
url='https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=team_user&userid=1&leagueid=39&seasonid=55'

class ExportTests(unittest.TestCase):
    def fixture(self):
        return {'schema':'lg-account-capture-run-v1','league':'LGCHL','season':55,'from_date':'2026-10-25','status':'complete',
                'games':[],'rosters':[{'team_id':'412','source_url':'https://www.leaguegaming.com/','players':[{'lg_user_id':'1','registered_name':'Forum Name'}]}],
                'records':[],'database_unchanged':True,'issues':[{'lg_user_id':'1','source_url':url,'accounts':[
                    {'platform':'xbox','account_gamertag':'Xbox Name','evidence':'Xbox GamerTag: Xbox Name'},
                    {'platform':'playstation','account_gamertag':'PS Name','evidence':'PSN GamerTag: PS Name'}]}]}
    def test_two_explicit_console_links_keep_one_canonical_player(self):
        result=exporter.export(self.fixture())
        self.assertEqual(len(result['players']),1)
        self.assertEqual(result['counts']['account_links'],2)
        self.assertFalse(result['players'][0]['game_participation_verified'])
        self.assertNotIn('browser-profile',str(result))
    def test_reject_mismatched_profile_owner(self):
        data=self.fixture();data['issues'][0]['source_url']=url.replace('userid=1','userid=2')
        with self.assertRaisesRegex(ValueError,'mismatched'):exporter.export(data)
    def test_same_console_tag_on_distinct_lg_accounts_is_not_merged(self):
        data=self.fixture();data['rosters'][0]['players'].append({'lg_user_id':'2','registered_name':'Other Person'})
        data['records'].append({'lg_user_id':'2','platform':'xbox','account_gamertag':'Xbox Name','source_url':url.replace('userid=1','userid=2'),'evidence':'Xbox GamerTag: Xbox Name','status':'account_link_observed'})
        result=exporter.export(data)
        self.assertEqual(len(result['players']),2)
        self.assertEqual(result['counts']['console_owner_conflicts'],1)
        self.assertTrue(all(p['account_status']=='ambiguous_console_binding' for p in result['players']))
    def test_unrelated_team_cannot_enter_export(self):
        data=self.fixture();data['rosters'][0]['team_id']='999'
        with self.assertRaisesRegex(ValueError,'schedule scope'):exporter.export(data)
    def test_resumed_profile_targets_are_exact_lg_league_season(self):
        self.assertEqual(capture.validate_profile_url(url,'1',55),url)
        for bad in [url.replace('www.leaguegaming.com','example.com'),url.replace('userid=1','userid=2'),url.replace('seasonid=55','seasonid=54')]:
            with self.assertRaises(ValueError):capture.validate_profile_url(bad,'1',55)

if __name__=='__main__':unittest.main()
