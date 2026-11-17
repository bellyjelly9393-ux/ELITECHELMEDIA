"""Deterministic EA NHL score-bug reader (no AI).

FFmpeg crops the top-left score bug every few seconds, plain-Python image code cuts it
into fields (team abbreviations, scores, shots, clock, period, power-play banner rows)
and local Tesseract reads each field. A smoothed game-state timeline is built from the
reads: score increments are goals (the scoring team is whichever row incremented) and a
POWER PLAY banner belongs to the team whose HUD row it is drawn on. No model, no network.

Default geometry was calibrated on an 848x480 EA NHL 26 Twitch VOD (Lethbridge vs
Calgary, 2026-10-13). Boxes are fractions of the full frame so 360p/720p/1080p captures
of the same layout work unchanged; VOD_HUD_LAYOUT_JSON overrides any box.
"""
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

# (left, top, right, bottom) as fractions of the full video frame.
DEFAULT_LAYOUT = {
    'band': (0.0, 0.0, 0.36, 0.115),
    'abbr1': (0.059, 0.033, 0.122, 0.071), 'abbr2': (0.059, 0.073, 0.122, 0.108),
    'score1': (0.130, 0.031, 0.166, 0.071), 'score2': (0.130, 0.071, 0.166, 0.108),
    'sog1': (0.166, 0.031, 0.187, 0.065), 'sog2': (0.166, 0.075, 0.187, 0.108),
    'clock': (0.189, 0.036, 0.247, 0.075), 'period': (0.189, 0.071, 0.247, 0.102),
    'pp1': (0.262, 0.033, 0.356, 0.071), 'pp2': (0.262, 0.073, 0.356, 0.110),
}
BAND_WIDTH = 1280  # band is upscaled before cutting: Tesseract wants ~30px+ glyphs


def layout():
    out = dict(DEFAULT_LAYOUT)
    raw = os.getenv('VOD_HUD_LAYOUT_JSON', '').strip()
    if raw:
        try:
            for key, box in json.loads(raw).items():
                if key in out and len(box) == 4:
                    out[key] = tuple(float(v) for v in box)
        except (ValueError, TypeError, AttributeError):
            pass
    return out


# ---------------------------------------------------------------- tiny PGM toolkit
def read_pgm(path):
    data = Path(path).read_bytes()
    tokens, pos = [], 0
    while len(tokens) < 4:
        while data[pos:pos + 1].isspace():
            pos += 1
        if data[pos:pos + 1] == b'#':
            while data[pos:pos + 1] not in (b'\n', b''):
                pos += 1
            continue
        start = pos
        while not data[pos:pos + 1].isspace():
            pos += 1
        tokens.append(data[start:pos])
    if tokens[0] != b'P5' or int(tokens[3]) > 255:
        raise ValueError('expected an 8-bit binary PGM')
    width, height = int(tokens[1]), int(tokens[2])
    pixels = data[pos + 1:pos + 1 + width * height]
    return width, height, pixels


def write_pgm(path, width, height, pixels):
    Path(path).write_bytes(b'P5\n%d %d\n255\n' % (width, height) + bytes(pixels))


def crop(image, box_px):
    width, height, pixels = image
    x0, y0, x1, y1 = (max(0, int(round(v))) for v in box_px)
    x1, y1 = min(width, x1), min(height, y1)
    rows = [pixels[y * width + x0:y * width + x1] for y in range(y0, y1)]
    return max(0, x1 - x0), max(0, y1 - y0), b''.join(rows)


def otsu(pixels):
    hist = [0] * 256
    for p in pixels:
        hist[p] += 1
    total = len(pixels) or 1
    sum_all = sum(i * h for i, h in enumerate(hist))
    best, threshold, weight_b, sum_b = -1.0, 128, 0, 0
    for i in range(256):
        weight_b += hist[i]
        if not weight_b:
            continue
        weight_f = total - weight_b
        if not weight_f:
            break
        sum_b += i * hist[i]
        mean_b, mean_f = sum_b / weight_b, (sum_all - sum_b) / weight_f
        between = weight_b * weight_f * (mean_b - mean_f) ** 2
        if between > best:
            best, threshold = between, i
    return threshold


def binarize(image, dark_text=True, pad=12, major_only=False):
    """Black glyphs on white, border-touching blobs removed, tight crop plus margin.

    dark_text=True keeps pixels darker than the Otsu threshold (dark glyphs on a light
    panel); False keeps the lighter pixels (light glyphs on a dark panel)."""
    width, height, pixels = image
    if not width or not height:
        return 1, 1, b'\xff'
    t = otsu(pixels)
    ink = bytearray(1 if ((p <= t) if dark_text else (p > t)) else 0 for p in pixels)
    # Panel edges, oval rims and neighbouring boxes touch the crop border: flood them away.
    stack = [i for i in range(width)] + [(height - 1) * width + i for i in range(width)]
    stack += [y * width for y in range(height)] + [y * width + width - 1 for y in range(height)]
    while stack:
        i = stack.pop()
        if ink[i]:
            ink[i] = 0
            x, y = i % width, i // width
            if x > 0: stack.append(i - 1)
            if x < width - 1: stack.append(i + 1)
            if y > 0: stack.append(i - width)
            if y < height - 1: stack.append(i + width)
    if major_only:
        # Specks from compression would move the glyph's bounding box: keep big blobs only.
        label = [0] * len(ink)
        sizes = {}
        current = 0
        for seed in range(len(ink)):
            if not ink[seed] or label[seed]:
                continue
            current += 1
            label[seed] = current
            stack, size = [seed], 0
            while stack:
                i = stack.pop()
                size += 1
                x = i % width
                for j in ((i - 1) if x > 0 else -1, (i + 1) if x < width - 1 else -1, i - width, i + width):
                    if 0 <= j < len(ink) and ink[j] and not label[j]:
                        label[j] = current
                        stack.append(j)
            sizes[current] = size
        if sizes:
            keep = {k for k, v in sizes.items() if v >= 0.15 * max(sizes.values())}
            ink = bytearray(1 if label[i] in keep else 0 for i in range(len(ink)))
    xs = [i % width for i, v in enumerate(ink) if v]
    if not xs:
        return 1 + 2 * pad, 1 + 2 * pad, b'\xff' * ((1 + 2 * pad) ** 2)
    ys = [i // width for i, v in enumerate(ink) if v]
    x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
    w2 = (x1 - x0) + 2 * pad
    rows = [b'\xff' * (w2 * pad)]
    for y in range(y0, y1):
        line = ink[y * width + x0:y * width + x1]
        rows.append(b'\xff' * pad + bytes(0 if v else 255 for v in line) + b'\xff' * pad)
    rows.append(b'\xff' * (w2 * pad))
    return w2, (y1 - y0) + 2 * pad, b''.join(rows)


def ink_ratio(image):
    """Share of glyph pixels in a binarized image (0 for an empty field)."""
    _, _, pixels = image
    return sum(1 for p in pixels if p == 0) / max(1, len(pixels))


def mean(image):
    return sum(image[2]) / max(1, len(image[2]))


# ---------------------------------------------------------------- OCR
def ocr_batch(paths, psm=7, whitelist=None, timeout=120):
    """One Tesseract process for many images (list file); returns one string per image."""
    if not paths:
        return []
    if not shutil.which('tesseract'):
        raise RuntimeError('tesseract is not installed')
    with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False) as handle:
        handle.write('\n'.join(str(p) for p in paths) + '\n')
        listing = handle.name
    command = ['tesseract', listing, 'stdout', '--psm', str(psm)]
    if whitelist:
        command += ['-c', f'tessedit_char_whitelist={whitelist}']
    try:
        run = subprocess.run(command, capture_output=True, check=False, timeout=timeout)
    finally:
        os.unlink(listing)
    pages = run.stdout.decode('utf-8', 'ignore').split('\f')
    pages = [p.strip() for p in pages]
    if len(pages) > len(paths):
        pages = pages[:len(paths)]
    return pages + [''] * (len(paths) - len(pages))


# ---------------------------------------------------------------- field parsers
PERIOD_WORDS = {'1ST': 1, '2ND': 2, '3RD': 3, 'OT': 4, '2OT': 5, '3OT': 6}
OCR_DIGIT_FIX = str.maketrans({'O': '0', 'o': '0', 'D': '0', 'Q': '0', 'I': '1', 'l': '1', '|': '1', 'i': '1',
                               'Z': '2', 'z': '2', 'S': '5', 's': '5', 'B': '8', 'G': '6', 'A': '4', 'T': '7'})


def parse_int(text, low=0, high=30):
    cleaned = re.sub(r'[^0-9]', '', str(text or '').translate(OCR_DIGIT_FIX))
    if not cleaned or len(cleaned) > 2:
        return None
    value = int(cleaned)
    return value if low <= value <= high else None


def parse_clock(text):
    """'16:41' -> 1001; ':32.8' / '32.8' (last minute) -> 32.8; None when unreadable."""
    raw = str(text or '').strip().replace(' ', '').translate(str.maketrans({'O': '0', 'o': '0', 'l': '1', 'I': '1', ';': ':'}))
    match = re.fullmatch(r'(\d{1,2})[:.](\d{2})', raw)
    if match:
        minutes, seconds = int(match.group(1)), int(match.group(2))
        if minutes <= 20 and seconds < 60 and minutes * 60 + seconds <= 1200:
            return float(minutes * 60 + seconds)
        return None
    match = re.fullmatch(r':?(\d{1,2})\.(\d)', raw)
    if match and int(match.group(1)) < 60:
        return float(f'{int(match.group(1))}.{match.group(2)}')
    return None


def parse_period_text(text):
    raw = re.sub(r'[^A-Z0-9]', '', str(text or '').upper())
    raw = raw.replace('Z', '2').replace('O', '0') if raw[:1] in ('Z',) else raw
    fixes = {'1ST': ('1ST', 'IST', 'LST', '1S7', 'TST'), '2ND': ('2ND', 'ZND', '2N0', 'ZN0', '2HD'),
             '3RD': ('3RD', '3R0', '3RO', 'SRD', '3PD'), 'OT': ('OT', '0T')}
    for word, variants in fixes.items():
        if raw in variants:
            return PERIOD_WORDS[word]
    return None


def parse_abbr(text):
    raw = re.sub(r'[^A-Z]', '', str(text or '').upper())
    return raw if 2 <= len(raw) <= 4 else None


def parse_pp(text):
    """A power-play/penalty banner row: returns (kind, seconds_left) or None."""
    raw = re.sub(r'[^A-Z0-9:. ]', ' ', str(text or '').upper())
    compact = re.sub(r'\s+', ' ', raw).strip()
    kind = None
    if re.search(r'POWER\s*PLAY|POWERPLAY|P0WER|POWER|PLAY', compact):
        kind = 'power_play'
    elif re.search(r'PENALTY|SHORT\s*HANDED|5\s*ON\s*3|4\s*ON\s*3', compact):
        kind = 'penalty'
    if not kind:
        return None
    left = None
    match = re.search(r'(\d)[:.\s-]?(\d{2})\b', compact)
    if match and int(match.group(2)) < 60:
        left = int(match.group(1)) * 60 + int(match.group(2))
    return kind, left


# ---------------------------------------------------------------- frame extraction
def extract_bands(source, folder, start=0.0, end=None, step=2.0):
    """Grayscale, upscaled score-bug bands as PGM, one every `step` seconds."""
    folder = Path(folder)
    shutil.rmtree(folder, ignore_errors=True)
    folder.mkdir(parents=True, exist_ok=True)
    left, top, right, bottom = layout()['band']
    vf = (f'fps=1/{step},crop=iw*{right - left}:ih*{bottom - top}:iw*{left}:ih*{top},'
          f'scale={BAND_WIDTH}:-2:flags=lanczos,format=gray')
    command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-y']
    if start:
        command += ['-ss', f'{float(start):.3f}']
    command += ['-i', str(source)]
    if end is not None:
        command += ['-t', f'{max(0.1, float(end) - float(start or 0)):.3f}']
    command += ['-vf', vf, str(folder / 'band_%05d.pgm')]
    subprocess.run(command, check=True, timeout=1800)
    bands = sorted(folder.glob('band_*.pgm'))
    # fps=1/step emits its first frame at the midpoint of the first interval.
    return [(round(float(start or 0) + i * step + step / 2, 2), path) for i, path in enumerate(bands)]


def field_boxes(band_size):
    """Pixel boxes of every field inside an upscaled band image."""
    width, height = band_size
    spec = layout()
    bl, bt, br, bb = spec['band']
    sx, sy = width / (br - bl), height / (bb - bt)
    return {name: ((l - bl) * sx, (t - bt) * sy, (r - bl) * sx, (b - bt) * sy)
            for name, (l, t, r, b) in spec.items() if name != 'band'}


FIELDS = {
    # name: (psm, whitelist, polarities to OCR). Scores and period labels are not OCR'd:
    # the EA glyphs defeat Tesseract, so they are compared as glyph signatures instead.
    'abbr': (7, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ('light',)),
    'sog': (7, '0123456789', ('light',)),
    'clock': (7, '0123456789:.', ('light',)),
    'pp': (7, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.', ('light', 'dark')),
}
SIGNATURE_FIELDS = ('abbr1', 'abbr2', 'score1', 'score2', 'period')
SIG_W, SIG_H = 16, 24


def signature(binary):
    """Glyph occupancy on a fixed grid (aspect kept as one extra feature); None when empty."""
    width, height, pixels = binary
    if ink_ratio(binary) < 0.01 or width < 4 or height < 4:
        return None
    grid = []
    for gy in range(SIG_H):
        y0, y1 = gy * height // SIG_H, max(gy * height // SIG_H + 1, (gy + 1) * height // SIG_H)
        for gx in range(SIG_W):
            x0, x1 = gx * width // SIG_W, max(gx * width // SIG_W + 1, (gx + 1) * width // SIG_W)
            total = ink = 0
            for y in range(y0, y1):
                row = pixels[y * width + x0:y * width + x1]
                total += len(row)
                ink += row.count(0)
            grid.append(round(ink / max(1, total), 3))
    grid.append(round(min(4.0, width / height) / 4, 3))
    return grid


def sig_distance(a, b):
    if a is None or b is None:
        return 1.0
    shape = abs(a[-1] - b[-1]) * 2
    return min(1.0, sum(abs(x - y) for x, y in zip(a[:-1], b[:-1])) / (len(a) - 1) + shape)


def read_bands(bands, workdir, keep_crops=False):
    """OCR/signature every field of every band. Returns raw per-sample reads (no smoothing)."""
    workdir = Path(workdir)
    crops = workdir / 'fields'
    shutil.rmtree(crops, ignore_errors=True)
    crops.mkdir(parents=True, exist_ok=True)
    jobs = {}  # (kind, polarity) -> [(sample_index, field, path)]
    sigs = {}
    for index, (_, path) in enumerate(bands):
        image = read_pgm(path)
        sigs[index] = {}
        for field, box in field_boxes(image[:2]).items():
            kind = re.sub(r'\d$', '', field)
            piece = crop(image, box)
            if not piece[0] or not piece[1]:
                continue
            if field in SIGNATURE_FIELDS:
                # Light glyphs on the dark bug; a white score oval leaves its digit as a hole,
                # which still gives a stable (if different) signature per digit.
                sigs[index][field] = signature(binarize(piece, dark_text=False, pad=0, major_only=True))
            if kind not in FIELDS:
                continue
            for polarity in FIELDS[kind][2]:
                out = crops / f'{index:05d}_{field}_{polarity}.pgm'
                write_pgm(out, *binarize(piece, dark_text=(polarity == 'dark')))
                jobs.setdefault((kind, polarity), []).append((index, field, out))
    texts = {}
    for (kind, polarity), items in jobs.items():
        psm, whitelist, _ = FIELDS[kind]
        for (index, field, _), text in zip(items, ocr_batch([p for _, _, p in items], psm, whitelist)):
            texts.setdefault(index, {}).setdefault(field, {})[polarity] = text
    reads = [parse_sample(at, texts.get(index, {}), sigs.get(index, {})) for index, (at, _) in enumerate(bands)]
    if not keep_crops:
        shutil.rmtree(crops, ignore_errors=True)
    return reads


def _first(values, parser, *args):
    for value in values:
        parsed = parser(value, *args)
        if parsed is not None:
            return parsed
    return None


def parse_sample(at, fields, sigs=None):
    def texts(name):
        return [fields.get(name, {}).get(p, '') for p in ('light', 'dark') if fields.get(name, {}).get(p)]
    pp = [_first(texts('pp1'), parse_pp), _first(texts('pp2'), parse_pp)]
    pp_row = None
    if pp[0] and not pp[1]:
        pp_row = 0
    elif pp[1] and not pp[0]:
        pp_row = 1
    banner = pp[pp_row] if pp_row is not None else None
    return {
        'at': at,
        'abbr': [_first(texts('abbr1'), parse_abbr), _first(texts('abbr2'), parse_abbr)],
        'sog': [_first(texts('sog1'), parse_int, 0, 99), _first(texts('sog2'), parse_int, 0, 99)],
        'clock': _first(texts('clock'), parse_clock),
        'pp_row': pp_row,
        'pp_kind': banner[0] if banner else None,
        'pp_left': banner[1] if banner else None,
        'sig': dict(sigs or {}),
        'raw': {k: v.get('light', '') or v.get('dark', '') for k, v in fields.items()},
    }


def read_video(source, start=0.0, end=None, step=2.0, keep_crops=False, workdir=None):
    """Raw HUD reads for [start, end) of a recording (seconds of that file)."""
    own = workdir is None
    workdir = Path(workdir or tempfile.mkdtemp(prefix='hud-'))
    try:
        bands = extract_bands(source, workdir / 'bands', start, end, step)
        return read_bands(bands, workdir, keep_crops=keep_crops)
    finally:
        if own:
            shutil.rmtree(workdir, ignore_errors=True)
