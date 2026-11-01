"""Isolated test adapter. No Supabase, live ingestion, or production routes."""
import hmac
import json
import os
import threading
from http.server import ThreadingHTTPServer
from urllib.parse import urlsplit

if os.getenv('SUPABASE_URL') or os.getenv('WORKER_QUEUE_SECRET') or os.getenv('HITMEN_GM_PROFILE_URL'):
    raise RuntimeError('Test worker refuses production-connected configuration')
if not os.getenv('REPLAY_ADMIN_TOKEN'):
    raise RuntimeError('Private test authentication is required')

import worker
import replay
SEED_LOCK = threading.Lock()

class Handler(worker.Handler):
    def dispatch(self):
        path = urlsplit(self.path).path
        if not hmac.compare_digest(self.headers.get('X-Test-Key', ''), os.environ['REPLAY_ADMIN_TOKEN']):
            raise worker.Problem(401, 'Test access required')
        if path == '/health' and self.command == 'GET':
            return self.reply(200, {'status': 'ok', 'isolated': True, 'aiConfigured': worker.ai_configured(), 'routing': worker.model_routing(), 'twitchAuthConfigured': replay.twitch_auth_configured()})
        if path == '/test/jobs' and self.command == 'POST':
            data = self.body()
            # Only the loopback Node adapter calls this route. The public adapter
            # supplies a fixed manifest and never accepts URLs, owners, or IDs.
            with SEED_LOCK:
                os.environ['REPLAY_TEST_SEED'] = json.dumps([data])
                os.environ['REPLAY_TEST_SEED_TOKEN'] = 'isolated-identity-v1'
                try:
                    seeded = replay.seed_replay_test_batch()
                finally:
                    os.environ.pop('REPLAY_TEST_SEED', None)
            if len(seeded) != 1:
                raise worker.Problem(400, 'Invalid test manifest')
            if any(p.get('label', '').startswith('Overtime ') for p in data.get('periods', [])):
                with worker.WRITE_LOCK:
                    job = worker.get_job(seeded[0]['job_id'])
                    meta = dict(job['metadata'])
                    meta['overtime_confirmed'] = True
                    worker.update_metadata(job['id'], meta)
            return self.reply(202, seeded[0])
        if path.startswith('/test/jobs/') and self.command == 'GET':
            job = worker.get_job(path.rsplit('/', 1)[-1])
            return self.reply(200, {key: job[key] for key in ('id', 'status', 'result', 'error')})
        raise worker.Problem(404, 'Not found')

if __name__ == '__main__':
    worker.initialize()
    worker.start_work_loop()
    ThreadingHTTPServer(('127.0.0.1', int(os.getenv('TEST_WORKER_PORT', '8081'))), Handler).serve_forever()
