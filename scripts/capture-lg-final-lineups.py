"""Read two scoped final game sheets through the user's LG Client; no source DB writes."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
from datetime import datetime, timezone
sys.dont_write_bytecode = True

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--client-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    args.client_dir = args.client_dir.resolve()
    args.output_dir = args.output_dir.resolve()
    root = Path(__file__).resolve().parents[1]
    args.output_dir.mkdir(parents=True, exist_ok=False)
    database = args.client_dir / 'lg_stats.db'
    digest = lambda: hashlib.sha256(database.read_bytes()).hexdigest()
    before = digest()
    sys.path.insert(0, str(args.client_dir))
    import lg_client
    from lg_paths import ApplicationPaths
    from lg_storage import StatisticsRepository
    from PyQt6.QtCore import QTimer, QUrl
    from PyQt6.QtWidgets import QApplication, QLabel
    lg_client.StatisticsRepository = lambda path, read_only=False: StatisticsRepository(path, read_only=True)
    script = (root / 'lib/lg-final-lineup-dom.js').read_text(encoding='utf-8')
    # These IDs come from the already captured Hitmen schedule, not name inference.
    ids = ['918170', '918200']
    scope = json.loads((root / 'artifacts/lg-account-links/season-account-evidence-2026-10-31.json').read_text(encoding='utf-8'))
    allowed = {str(g['lg_game_id']) for g in scope['games'] if g['date']=='2026-10-27' and any(t['lg_team_id']=='412' for t in g['teams'])}
    assert set(ids) <= allowed
    state = {'status':'running','games':[],'database_unchanged':True}
    app = QApplication(sys.argv[:1])
    paths = ApplicationPaths(args.output_dir,args.output_dir/'cache',args.output_dir,database,args.output_dir/'browser-profile')
    class Capture(lg_client.LGClient):
        def setup_sync(self, toolbar):
            toolbar.addWidget(QLabel('Read-only final LG lineup capture'))
        def setup_developer_panel(self, toolbar):
            pass
        def inspect_page(self, ok):
            pass
        def start_development_browser(self):
            self.queue = list(ids)
            self.page.loadFinished.connect(self.loaded)
            self.timeout = QTimer(self)
            self.timeout.setSingleShot(True)
            self.timeout.timeout.connect(lambda:self.finish('page_timeout'))
            QTimer.singleShot(500,self.next)
        def next(self):
            if not self.queue:return self.finish('complete')
            self.current = self.queue.pop(0)
            self.timeout.start(60000)
            self.page.load(QUrl('https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid='+self.current+'&leagueid=39&seasonid=55'))
        def loaded(self, ok):
            if state['status']!='running':return
            # A blocked third-party frame can make Qt report loadFinished(False)
            # while the LG game sheet is readable. Validate the main DOM itself;
            # challenges and incomplete game sheets still stop without retry.
            QTimer.singleShot(1800,lambda:self.page.runJavaScript(script,self.received))
        def received(self, data):
            self.timeout.stop()
            if not isinstance(data,dict) or data.get('blocked') or data.get('error'):
                state['source_issue']=data
                return self.finish('source_requires_review')
            if data.get('lg_game_id')!=self.current:return self.finish('game_identity_mismatch')
            data['observed_at']=datetime.now(timezone.utc).isoformat()
            state['games'].append(data)
            print(json.dumps({'game':self.current,'participants':len(data['players'])}),flush=True)
            QTimer.singleShot(3000,self.next)
        def finish(self, status):
            state['status']=status
            state['database_unchanged']=digest()==before
            (args.output_dir/'lineups.json').write_text(json.dumps(state,indent=2),encoding='utf-8')
            print(json.dumps({'status':status,'database_unchanged':state['database_unchanged']}),flush=True)
            app.quit()
    window = Capture(mode=lg_client.BuildMode.DEVELOPMENT,paths=paths)
    window.setWindowTitle('LG Stats Client - Read-only final lineup capture')
    window.show()
    return app.exec()

if __name__=='__main__':
    raise SystemExit(main())
