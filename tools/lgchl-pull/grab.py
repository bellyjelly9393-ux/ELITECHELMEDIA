"""Session transcript reader: pull gzip+base64 chunks (marker TAG|i|n|<b64>|END) out of this session's transcript tool results and decode."""
import json, sys, re, base64, gzip, glob
TAG, OUT = sys.argv[1], sys.argv[2]
chunks, n = {}, None
pat = re.compile(re.escape(TAG) + r'\|(\d+)\|(\d+)\|([A-Za-z0-9+/=]+)\|END')


def texts(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for v in o.values(): yield from texts(v)
    elif isinstance(o, list):
        for v in o: yield from texts(v)


import os
srcs = sorted(glob.glob(os.path.expanduser('~/.claude/projects/*/*.jsonl')) + glob.glob(os.path.expanduser('~/.claude/projects/*/*/tool-results/*')), key=os.path.getmtime)[-40:]
for f in srcs:
    for line in open(f, errors='replace'):
        if TAG not in line: continue
        try:
            objs = [json.loads(line)]
        except Exception:
            objs = [line]
        for o in objs:
            for s in texts(o):
                for m in pat.finditer(s):
                    chunks[int(m.group(1))] = m.group(3); n = int(m.group(2))
missing = [i for i in range(n or 0) if i not in chunks]
if n is None or missing:
    sys.exit(f'missing chunks {missing} of {n}')
data = gzip.decompress(base64.b64decode(''.join(chunks[i] for i in range(n))))
open(OUT, 'wb').write(data)
print('ok', n, 'chunks', len(data), 'bytes')
