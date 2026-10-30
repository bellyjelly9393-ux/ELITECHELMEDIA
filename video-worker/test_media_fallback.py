"""Unusable retrievals must try another resolver without repeating paid analysis."""
import io
import shutil
import subprocess
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import replay
import worker
from test_worker_reliability import Base


class MediaFallback(Base):
    def run_fallback(self, bad_ytdlp_first=False):
        fixture = worker.ROOT / 'valid clip with spaces.mp4'
        worker.command(['ffmpeg','-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=5',
                        '-t','2','-c:v','libx264','-y',str(fixture)])
        units = [{'label':'Period 1','start':0,'end':370},
                 {'label':'Period 1','start':370,'end':600},
                 {'label':'Period 2','start':600,'end':1200},
                 {'label':'Period 3','start':1200,'end':1600}]
        evidence = {'chunks':[{'label':'Period 1','start':0,'end':370,
                              'sequence_checked':True,'review':{'summary':'Saved first part'}}]}
        job_id = self.insert('retrieving', {
            'source_kind':'twitch_replay','vod_url':self.review['vod_url'],
            'source_start_seconds':100,'source_end_seconds':1700,
            'streamed_replay':True,'replay_phase':'analyze_periods',
            'period_units':units,'period_unit_index':1,'completed_parts':[0]}, evidence)
        calls = []
        real_popen = subprocess.Popen
        class Finished:
            returncode = 0
            def poll(self): return 0
        def launch(args, *a, **kw):
            if args[0] == 'streamlink':
                Path(args[args.index('-o')+1]).write_bytes(b'not a video')
                calls.append(args)
                return Finished()
            if args[0] == 'yt-dlp':
                calls.append(args)
                target = Path(args[args.index('-o')+1].replace('%(ext)s','mp4'))
                if bad_ytdlp_first and sum(c[0]=='yt-dlp' for c in calls) == 1:
                    target.write_bytes(b'also not a video')
                else:
                    shutil.copyfile(fixture,target)
                return Finished()
            return real_popen(args,*a,**kw)
        with patch.object(replay.subprocess,'Popen',side_effect=launch), patch.object(worker,'analyze') as ai:
            replay.retrieve(job_id)
            ai.assert_not_called()
        job = worker.get_job(job_id)
        self.assertEqual(job['status'],'queued')
        self.assertEqual(job['result'],evidence)
        self.assertIn(0,job['metadata']['completed_parts'])
        self.assertEqual(job['metadata']['period_unit_index'],1)
        self.assertGreater(worker.probe(worker.ROOT/job_id/'source.mp4'),0)
        ytdlp = [c for c in calls if c[0]=='yt-dlp']
        self.assertEqual(len(ytdlp),2 if bad_ytdlp_first else 1)
        self.assertTrue(all(c[c.index('--download-sections')+1]=='*7:50-11:40' for c in ytdlp))

    def test_exit_zero_invalid_streamlink_retries_with_ytdlp(self):
        self.run_fallback()

    def test_invalid_ytdlp_candidate_tries_next_variant(self):
        self.run_fallback(True)


class MediaDiagnostics(unittest.TestCase):
    def test_failure_reports_tool_and_sanitizes_private_url(self):
        exc = subprocess.CalledProcessError(1,['ffprobe'],stderr=b'bad https://private.test/path?token=secret token=hidden')
        out = io.StringIO()
        with patch.object(worker.subprocess,'run',side_effect=exc), redirect_stdout(out):
            with self.assertRaises(worker.Problem) as caught:
                worker.command(['ffprobe','private path'])
        self.assertEqual(caught.exception.code,'media_processing_failed')
        self.assertIn('ffprobe',caught.exception.message)
        self.assertNotIn('secret',out.getvalue())
        self.assertNotIn('hidden',out.getvalue())
        self.assertNotIn('valid MP4',caught.exception.message)

    def test_timeout_is_distinguished_from_invalid_recording(self):
        with patch.object(worker.subprocess,'run',side_effect=subprocess.TimeoutExpired(['ffmpeg'],30)):
            with self.assertRaises(worker.Problem) as caught:
                worker.command(['ffmpeg'],30)
        self.assertIn('timed out during ffmpeg',caught.exception.message)


if __name__ == '__main__':
    unittest.main()
