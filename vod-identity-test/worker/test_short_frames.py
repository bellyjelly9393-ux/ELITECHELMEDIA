import shutil
import os
import json
import time
from types import SimpleNamespace
from unittest.mock import patch
import subprocess
import tempfile
import unittest
from pathlib import Path

import worker
from report_schema import lineup_roster

class ShortFrames(unittest.TestCase):
    def test_resume_preserves_saved_evidence_and_refuses_completed_jobs(self):
        with patch.dict(os.environ, {'REPLAY_ADMIN_TOKEN': 'synthetic-private-test-code'}):
            from test_bootstrap import Handler
            with tempfile.TemporaryDirectory(dir=os.getenv('VOD_TEST_TMP')) as folder, patch.object(worker, 'ROOT', Path(folder)):
                worker.initialize()
                job_id = 'd0000000-0000-4000-8000-000000000001'
                evidence = {'chunks': [{'label':'Period 1','start':0,'end':370,'review':{'observations':[]}}]}
                meta = {'source_kind':'twitch_replay','streamed_replay':True,'replay_phase':'analyze_periods',
                        'period_units':[{'label':'Period 1','start':0,'end':370},{'label':'Period 1','start':370,'end':372}],
                        'period_unit_index':1,'completed_parts':[0]}
                with worker.connect() as db:
                    db.execute('insert into jobs values(?,?,?,?,?,?,?)',
                               (job_id,'synthetic-owner',time.time(),'failed',json.dumps(meta),json.dumps(evidence),'old failure'))
                request = SimpleNamespace(path='/test/jobs/'+job_id+'/resume', command='POST',
                                          headers={'X-Test-Key':'synthetic-private-test-code'}, body=lambda:{},
                                          reply=lambda status,body:(status,body))
                status, body = Handler.dispatch(request)
                self.assertEqual(status, 202)
                self.assertTrue(body['saved_evidence_preserved'])
                saved = worker.get_job(job_id)
                self.assertEqual(saved['result'], evidence)
                self.assertEqual(saved['metadata']['completed_parts'], [0])
                self.assertEqual(saved['error'], '')
                worker.update(job_id, 'ready_for_review', evidence)
                with self.assertRaises(worker.Problem) as caught:
                    Handler.dispatch(request)
                self.assertEqual(caught.exception.status, 409)
                self.assertEqual(worker.get_job(job_id)['result'], evidence)
                request.headers = {}
                with self.assertRaises(worker.Problem) as caught:
                    Handler.dispatch(request)
                self.assertEqual(caught.exception.status, 401)

    def test_registered_gamertag_punctuation_is_preserved(self):
        self.assertEqual(lineup_roster('LW YaDayz-_-\nC l Setty l\nRW - Gully'),
                         [('LW', 'YaDayz-_-'), ('C', 'l Setty l'), ('RW', '- Gully')])

    @unittest.skipUnless(shutil.which('ffmpeg'), 'FFmpeg required')
    def test_short_valid_tail_decodes_but_out_of_range_still_fails(self):
        with tempfile.TemporaryDirectory(dir=os.getenv('VOD_TEST_TMP')) as folder:
            root = Path(folder)
            source = root / 'two-seconds.mp4'
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                            '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=30:d=2',
                            '-c:v', 'mpeg4', str(source)], check=True, capture_output=True)
            old = root / 'old'
            old.mkdir()
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                            '-i', str(source), '-vf', 'fps=1/6', '-pix_fmt', 'yuvj420p',
                            str(old / '%04d.jpg')], check=True, capture_output=True)
            self.assertEqual(list(old.glob('*.jpg')), [], 'Original FPS sampler misses a two-second tail')
            frames = worker.extract_frames(source, root / 'valid', 0, 2, 6, '160:90')
            self.assertGreaterEqual(len(frames), 1)
            with self.assertRaisesRegex(worker.Problem, 'No readable video frames'):
                worker.extract_frames(source, root / 'outside', 5, 7, 6, '160:90')
            units = worker.bounded_period_units([{'label':'Period 1','start':0,'end':372}])
            self.assertEqual(units, [{'label':'Period 1','start':0.0,'end':370.0},
                                     {'label':'Period 1','start':370.0,'end':372.0}])

if __name__ == '__main__':
    unittest.main()
