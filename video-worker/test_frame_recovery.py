"""Real MPEG-TS seek and short-tail frame recovery regressions."""
from pathlib import Path
import subprocess
import tempfile
import unittest
import worker


class FrameRecoveryTests(unittest.TestCase):
    def test_transport_stream_nonzero_start_and_short_tail(self):
        with tempfile.TemporaryDirectory(prefix='vod seek ') as tmp:
            root = Path(tmp)
            source = root / 'slice named source.mp4'
            subprocess.run([
                'ffmpeg', '-v', 'error', '-y', '-f', 'lavfi',
                '-i', 'testsrc2=size=320x180:rate=10', '-t', '12',
                '-c:v', 'libx264', '-g', '250', '-output_ts_offset', '2800',
                '-f', 'mpegts', str(source)
            ], check=True, capture_output=True)
            for index, (start, end, step) in enumerate([(6, 12, 6), (11, 11.8, 6), (2, 8, .5)]):
                frames = worker.extract_frames(source, root / str(index), start, end, step, '640:360')
                self.assertTrue(frames)
                for frame in frames:
                    self.assertGreater(frame.stat().st_size, 0)
                    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(frame),
                                    '-f', 'null', '-'], check=True, capture_output=True)
            with self.assertRaises(worker.Problem) as error:
                worker.extract_frames(source, root / 'outside', 30, 35)
            self.assertEqual(error.exception.code, 'no_video_frames')


if __name__ == '__main__':
    unittest.main()
