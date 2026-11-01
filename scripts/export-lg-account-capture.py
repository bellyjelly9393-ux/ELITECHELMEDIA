"""Export only scoped game, roster and account evidence, never browser storage."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs

def export(state):
    if state.get('schema')!='lg-account-capture-run-v1' or state.get('league')!='LGCHL':
        raise ValueError('Unsupported capture')
    memberships={}
    scoped_teams={'412'}|{str(t['lg_team_id']) for g in state['games'] for t in g['teams']}
    for roster in state['rosters']:
        if str(roster['team_id']) not in scoped_teams:raise ValueError('Roster team is outside the Hitmen schedule scope')
        for p in roster['players']:
            memberships.setdefault(p['lg_user_id'],[]).append({'lg_team_id':roster['team_id'],'registered_name':p['registered_name'],'source_url':roster['source_url'],'membership_status':'listed_candidate_only'})
    records=list(state['records'])
    for issue in state['issues']:
        for a in issue.get('accounts',[]):
            records.append({**a,'lg_user_id':issue['lg_user_id'],'source_url':issue['source_url'],'observed_at':issue.get('observed_at'),'status':'multiple_linked_accounts_game_platform_unconfirmed'})
    players={}
    for r in records:
        uid=r['lg_user_id'];u=urlparse(r['source_url'])
        if u.scheme!='https' or u.hostname not in ('leaguegaming.com','www.leaguegaming.com') or parse_qs(u.query).get('userid')!=[uid]:
            raise ValueError('Account evidence has a mismatched LG profile URL')
        if uid not in memberships or r['platform'] not in ('xbox','playstation'):
            raise ValueError('Account evidence is outside the roster scope')
        player=players.setdefault(uid,{'canonical_key':['LGCHL',state['season'],uid],'lg_user_id':uid,'listed_rosters':memberships[uid],'accounts':[],'game_participation_verified':False})
        entry={k:r.get(k) for k in ['platform','account_gamertag','source_url','observed_at','evidence','status']}
        if not any(a['platform']==entry['platform'] and a['account_gamertag']==entry['account_gamertag'] for a in player['accounts']):player['accounts'].append(entry)
    by_account={}
    for uid,player in players.items():
        for a in player['accounts']:by_account.setdefault((a['platform'],a['account_gamertag'].strip().lower()),set()).add(uid)
    conflicts=[]
    for (platform,tag),owners in by_account.items():
        if len(owners)>1:
            conflicts.append({'platform':platform,'account_gamertag':tag,'lg_user_ids':sorted(owners),'status':'unresolved_console_owner_conflict'})
            for uid in owners:players[uid]['account_status']='ambiguous_console_binding'
    return {'schema':'lg-reviewed-account-evidence-v1','league':'LGCHL','season':state['season'],'from_date':state['from_date'],
            'capture_status':state['status'],'updated_at':state.get('updated_at'),'games':state['games'],
            'players':list(players.values()),'issues':state['issues'],'account_conflicts':conflicts,'database_unchanged':state['database_unchanged'],
            'counts':{'games':len(state['games']),'team_pages':len(state['rosters']),'scoped_roster_candidates':len(memberships),'players_with_account_evidence':len(players),'account_links':sum(len(p['accounts']) for p in players.values()),'issues':len(state['issues']),'console_owner_conflicts':len(conflicts)},
            'published':False,'note':'Explicit LG profile labels establish listed account links. They do not verify a game lineup, the account used in a game, or a CHEL/broadcast alias.'}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('capture',type=Path);p.add_argument('output',type=Path);args=p.parse_args()
    result=export(json.loads(args.capture.read_text(encoding='utf8')))
    with args.output.open('x',encoding='utf8') as f:json.dump(result,f,indent=2)
    print(json.dumps(result['counts']))
