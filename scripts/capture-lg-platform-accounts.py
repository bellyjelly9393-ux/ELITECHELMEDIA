"""Read-only scoped capture using the existing LG Stats Client, without session export.

Pass --client-dir and --output-dir explicitly. Qt dependencies must already be installed.
The client source and SQLite database are never modified. New browser storage is isolated.
"""
import argparse
import hashlib
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, parse_qs
sys.dont_write_bytecode = True

def validate_profile_url(raw, uid, season):
    u=urlparse(raw);q=parse_qs(u.query)
    if (u.scheme!='https' or u.hostname not in ('www.leaguegaming.com','leaguegaming.com')
        or u.username or u.password or u.port or u.path!='/forums/index.php'
        or q.get('page')!=['team_user'] or q.get('userid')!=[str(uid)]
        or q.get('leagueid')!=['39'] or q.get('seasonid')!=[str(season)]):
        raise ValueError('Profile URL is outside the scoped LG identity')
    return raw

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--client-dir', required=True, type=Path)
    p.add_argument('--output-dir', required=True, type=Path)
    p.add_argument('--from-date', required=True, type=date.fromisoformat)
    p.add_argument('--season', type=int, required=True)
    p.add_argument('--resume-from', type=Path)
    args = p.parse_args()
    if args.season < 1:
        p.error('Positive season required')
    args.client_dir = args.client_dir.resolve()
    args.output_dir = args.output_dir.resolve()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    state_path = args.output_dir / 'capture-status.json'
    if state_path.exists():
        p.error('Use a new output directory; existing captures are never overwritten')
    sys.path.insert(0, str(args.client_dir))
    import lg_client
    from lg_paths import ApplicationPaths
    from lg_storage import StatisticsRepository
    from PyQt6.QtCore import QTimer, QUrl
    from PyQt6.QtWidgets import QApplication, QLabel

    database = args.client_dir / 'lg_stats.db'
    def checksum():
        with database.open('rb') as f:
            return hashlib.file_digest(f, 'sha256').hexdigest()
    before = checksum()
    lg_client.StatisticsRepository = lambda path, read_only=False: StatisticsRepository(path, read_only=True)
    script = (Path(__file__).resolve().parents[1] / 'lib/lg-platform-capture-dom.js').read_text(encoding='utf8')
    base = 'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&leagueid=39&seasonid=' + str(args.season)
    state = {'schema':'lg-account-capture-run-v1', 'league':'LGCHL','season':args.season,'from_date':args.from_date.isoformat(),
             'status':'running','games':[],'rosters':[],'records':[],'issues':[],'pages_read':0,'published':False,'database_unchanged':True}
    if args.resume_from:
        previous=json.loads(args.resume_from.read_text(encoding='utf8'))
        if previous.get('schema')!=state['schema'] or previous.get('season')!=args.season or previous.get('from_date')!=args.from_date.isoformat():
            p.error('Resume scope does not match this run')
        if previous.get('status') in ('verification_required','profile_identity_mismatch','team_identity_mismatch'):
            p.error('The stopped source requires review before resuming')
        for key in ('games','rosters','records','issues','pages_read'):
            state[key]=previous[key]
    app = QApplication(sys.argv[:1])
    app.setApplicationName('LGStatsReadOnlyCapture')
    app.setOrganizationName('LeagueGamingClient')
    paths = ApplicationPaths(args.output_dir, args.output_dir/'cache', args.output_dir, database, args.output_dir/'browser-profile')
    months = {m:i+1 for i,m in enumerate(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'])}

    class Capture(lg_client.LGClient):
        def setup_sync(self, toolbar):
            toolbar.addWidget(QLabel('Read-only roster/account capture · no statistics sync'))
        def setup_developer_panel(self, toolbar):
            pass
        def inspect_page(self, ok):
            pass
        def closeEvent(self, event):
            if state['status']=='running':
                state['status']='stopped_by_user'
                self.persist()
            event.accept()
        def start_development_browser(self):
            self.queue=[('schedule',base+'&page=team_page_schedule&teamid=412','412')]
            self.seen_players=set()
            self.current=None
            self.timer=QTimer(self);self.timer.setSingleShot(True);self.timer.timeout.connect(lambda:self.finish('page_timeout'))
            self.fetch_poll=QTimer(self);self.fetch_poll.setInterval(250);self.fetch_poll.timeout.connect(self.poll_fetch)
            self.fetch_ticket=0
            self.page.loadFinished.connect(self.loaded)
            self.bootstrap=False
            if args.resume_from:
                done={r['lg_user_id'] for r in state['records']}|{r['lg_user_id'] for r in state['issues'] if r.get('lg_user_id')}
                self.queue=[]
                for roster in state['rosters']:
                    for player in roster['players']:
                        uid=player['lg_user_id']
                        if uid not in done and uid not in self.seen_players:
                            self.seen_players.add(uid);self.queue.append(('profile',validate_profile_url(player['profile_url'],uid,args.season),uid))
                self.bootstrap=True
                self.current=('bootstrap',base+'&page=team_user&userid=73707','73707')
                self.timer.start(60000);self.page.load(QUrl(self.current[1]))
            else:
                self.next_page()
        def persist(self):
            state['updated_at']=datetime.now(timezone.utc).isoformat()
            state['database_unchanged']=checksum()==before
            tmp=state_path.with_suffix('.tmp')
            tmp.write_text(json.dumps(state,indent=2),encoding='utf8');tmp.replace(state_path)
        def finish(self, reason):
            if state['status']!='running':return
            self.timer.stop();state['status']=reason;self.persist()
            print(json.dumps({'status':reason,'pages':state['pages_read'],'links':len(state['records']),'issues':len(state['issues'])}),flush=True)
            QTimer.singleShot(0,app.quit)
        def next_page(self):
            if not self.queue:
                self.finish('complete');return
            self.current=self.queue.pop(0)
            self.setWindowTitle('LG Stats Client - Scoped Account Capture: '+self.current[0]+' '+self.current[2])
            self.timer.start(60000)
            if args.resume_from and self.current[0]=='profile':
                # Same-origin public HTML requests inside the client's own browser.
                # Scripts in fetched HTML stay inert; no cookies or raw HTML are exported.
                self.fetch_ticket+=1
                target=json.dumps(self.current[1])
                parser=script.replace('(() => {','((document, pageUrl) => {',1).replace('location.href','pageUrl').rstrip()
                if not parser.endswith('})();'):self.finish('parser_format_changed');return
                parser=parser[:-5]+'})(doc, response.url);'
                js='''(async()=>{const ticket=TICKET;window.__lgAccountCapture=null;
                 try{const response=await fetch(TARGET,{credentials:'same-origin'});
                  if(!response.ok){window.__lgAccountCapture={ticket,data:{blocked:[401,403,429].includes(response.status),error:'http_'+response.status}};return;}
                  const html=await response.text();if(html.length>4000000)throw new Error('size');
                  const doc=new DOMParser().parseFromString(html,'text/html');
                  const data=PARSER
                  window.__lgAccountCapture={ticket,data};
                 }catch{window.__lgAccountCapture={ticket,data:{error:'profile_fetch_failed'}};}
                })();'''.replace('TICKET',str(self.fetch_ticket)).replace('TARGET',target).replace('PARSER',parser)
                self.page.runJavaScript(js)
                self.fetch_poll.start()
            else:
                self.page.load(QUrl(self.current[1]))
        def poll_fetch(self):
            self.page.runJavaScript('window.__lgAccountCapture||null',self.fetched)
        def fetched(self, payload):
            if not isinstance(payload,dict) or payload.get('ticket')!=self.fetch_ticket or not self.fetch_poll.isActive():return
            self.fetch_poll.stop();self.received(payload.get('data'))
        def loaded(self, ok):
            if state['status']!='running':return
            if not ok:
                self.finish('page_load_failed');return
            if self.bootstrap:
                self.bootstrap=False;self.timer.stop();QTimer.singleShot(1800,self.next_page);return
            QTimer.singleShot(1800,lambda:self.page.runJavaScript(script,self.received))
        def received(self, data):
            if state['status']!='running':return
            self.timer.stop()
            if not isinstance(data,dict):self.finish('parser_unavailable');return
            if data.get('blocked'):
                state['issues'].append({'source_url':self.current[1],'reason':'verification_required'});self.finish('verification_required');return
            if data.get('error'):
                state['issues'].append({'source_url':self.current[1],'reason':data['error']});self.finish('source_requires_review');return
            if data.get('kind')!=self.current[0]:self.finish('unexpected_page');return
            state['pages_read']+=1
            at=datetime.now(timezone.utc).isoformat()
            if data['kind']=='schedule':
                teams={'412':base+'&page=team_page&teamid=412'}
                for game in data['games']:
                    if sum(t['lg_team_id']=='412' for t in game['teams'])!=1:continue
                    game_date=date(args.from_date.year,months[game['month'].title()],game['day'])
                    if game_date<args.from_date:continue
                    game['date']=game_date.isoformat();state['games'].append(game)
                    for team in game['teams']:teams[team['lg_team_id']]=team['source_url']
                self.queue.extend(('roster',u,tid) for tid,u in teams.items())
            elif data['kind']=='roster':
                if data.get('team_id')!=self.current[2]:self.finish('team_identity_mismatch');return
                state['rosters'].append({**data,'observed_at':at})
                # Listed roster candidates only; reserves/history may also be listed.
                # Never assert current membership or game participation from this list.
                for player in data['players']:
                    uid=player['lg_user_id']
                    if uid not in self.seen_players:
                        self.seen_players.add(uid);self.queue.append(('profile',validate_profile_url(player['profile_url'],uid,args.season),uid))
            else:
                if data.get('lg_user_id')!=self.current[2]:self.finish('profile_identity_mismatch');return
                accounts=data.get('accounts',[])
                if len(accounts)!=1:
                    state['issues'].append({'lg_user_id':self.current[2],'source_url':data['source_url'],'observed_at':at,'reason':'missing_or_multiple_platform_accounts','accounts':accounts})
                else:
                    state['records'].append({'lg_user_id':self.current[2],**accounts[0],'source_url':data['source_url'],'observed_at':at,'source':'LG Stats Client Developer Starter - live LG profile','status':'account_link_observed','game_participation_verified':False})
            self.persist()
            print(json.dumps({'page':state['pages_read'],'kind':data['kind'],'links':len(state['records']),'queued':len(self.queue)}),flush=True)
            QTimer.singleShot(3000,self.next_page)

    window=Capture(mode=lg_client.BuildMode.DEVELOPMENT,paths=paths)
    window.show()
    result=app.exec()
    window.page.deleteLater()
    return result

if __name__=='__main__':
    raise SystemExit(main())
