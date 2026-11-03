#!/usr/bin/env python3
"""Convert an EliteChel Media LGCHL night-in-review markdown file into assets/lgchl-recaps/<date>.json
and register it in assets/lgchl-recaps/index.json (newest first).
Usage: python3 tools/lgchl-recaps-build.py path/to/2026-11-02.md"""
import json, re, sys, os, html
EMO = re.compile(r'[\u2B50\U0001F300-\U0001FAFF\u2600-\u27BF\uFE0F]+\s*')
def clean(t): return EMO.sub('', t).strip()
def inline(t):
    t = html.escape(clean(t), quote=False)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<!\*)\*(?!\s)(.+?)\*', r'<em>\1</em>', t)
    return re.sub(r'`(.+?)`', r'<code>\1</code>', t)
def block(lines):
    out, ul = [], False
    for l in lines:
        s = l.strip()
        if s.startswith('- '):
            if not ul: out.append('<ul>'); ul = True
            out.append('<li>' + inline(s[2:]) + '</li>'); continue
        if ul: out.append('</ul>'); ul = False
        if not s or s == '---': continue
        if s.startswith('> '): out.append('<blockquote>' + inline(s[2:]) + '</blockquote>')
        elif re.match(r'^\d+\. ', s): out.append('<p class="rc-num">' + inline(s) + '</p>')
        else: out.append('<p>' + inline(s) + '</p>')
    if ul: out.append('</ul>')
    return ''.join(out)
def stars(lines):
    st = []
    for l in lines:
        m = re.match(r'-\s*(?:⭐+\s*)?(\d)(?:st|nd|rd) Star:\s*\*\*(.+?)\*\*\s*\((.+?)\):\s*(.*)', clean(l) if False else l.strip())
        if m: st.append({'n': int(m.group(1)), 'player': m.group(2), 'team': m.group(3), 'line': clean(m.group(4))})
    return st
def game(title, lines):
    g = {'title': clean(title)}
    body, sl, inst = [], [], False
    for l in lines:
        m = re.match(r'\*\*(.+?)\*\*\s*·\s*Game (\d+)', l.strip())
        if m and 'matchup' not in g: g['matchup'] = m.group(1); g['game'] = m.group(2); continue
        if l.strip().startswith('**3 Stars'):
            inst = True
            if ':' in l.strip()[9:]: g['starsNote'] = clean(re.sub(r'\*\*3 Stars:?\*\*:?', '', l.strip()))
            continue
        (sl if inst else body).append(l)
    g['html'] = block(body); g['stars'] = stars(sl)
    return g
def main(p):
    txt = open(p, encoding='utf-8').read().split('\n')
    date = os.path.basename(p)[:10]
    d = {'date': date, 'title': '', 'subtitle': '', 'intro': '', 'threeStars': '', 'hitmen': {'html': '', 'games': []}, 'slots': []}
    h1 = None; buf = []; sub = None; cur_slot = None
    secs = []  # (level, title, lines)
    for l in txt:
        m = re.match(r'^(#{1,3}) (.*)', l)
        if m: secs.append([len(m.group(1)), m.group(2), []])
        elif secs: secs[-1][2].append(l)
    mode = None
    for lvl, t, ls in secs:
        tc = clean(t)
        if lvl == 1 and not d['title']: d['title'] = tc; d['intro'] = block(ls); continue
        if lvl == 2 and not d['subtitle'] and mode is None: d['subtitle'] = tc; d['intro'] += block(ls); continue
        if lvl == 1:
            low = tc.lower()
            mode = 'stars' if 'three stars' in low else 'hitmen' if low.startswith('hitmen watch') else 'games' if 'recap' in low else 'other'
            if mode == 'stars': d['threeStarsTitle'] = tc; d['threeStars'] = block(ls)
            elif mode == 'hitmen': d['hitmen']['title'] = tc; d['hitmen']['html'] = block(ls)
            continue
        if lvl == 2 and mode == 'games':
            cur_slot = {'slot': re.sub(r'\s*Slot$', '', tc), 'games': []}; d['slots'].append(cur_slot); continue
        if lvl == 3:
            g = game(t, ls)
            if mode == 'hitmen': d['hitmen']['games'].append(g)
            elif cur_slot is not None: cur_slot['games'].append(g)
    out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'lgchl-recaps')
    json.dump(d, open(os.path.join(out, date + '.json'), 'w'), ensure_ascii=False, indent=1)
    ip = os.path.join(out, 'index.json')
    idx = json.load(open(ip)) if os.path.exists(ip) else {'nights': []}
    idx['nights'] = [n for n in idx['nights'] if n['date'] != date] + [{'date': date, 'label': d['subtitle'] or date, 'file': date + '.json'}]
    idx['nights'].sort(key=lambda n: n['date'], reverse=True)
    json.dump(idx, open(ip, 'w'), ensure_ascii=False, indent=1)
    print(date, sum(len(s['games']) for s in d['slots']), 'games;', len(d['hitmen']['games']), 'hitmen')
main(sys.argv[1])
