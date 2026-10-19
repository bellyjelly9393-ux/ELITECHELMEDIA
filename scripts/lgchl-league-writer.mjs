#!/usr/bin/env node
// Writes LGCHL night-wrap drafts to Markdown/JSON. Never publishes, never posts.
//   node scripts/lgchl-league-writer.mjs --night 2026-10-13 --snapshot public.json --out drafts/
//   node scripts/lgchl-league-writer.mjs --night 2026-10-13 --rest   (reads SUPABASE_URL + SUPABASE_ANON_KEY; anon RLS
//                                                                    hides server-only box scores, so coverage is finals/standings/season stats)
// Every read goes through the public-source allowlist (supabase/functions/lgchl-league-writer/public-sources.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { createPublicReader, snapshotBackend } from '../supabase/functions/lgchl-league-writer/public-sources.mjs';
import { loadNight } from '../supabase/functions/lgchl-league-writer/load.mjs';
import { composeNightWrap } from '../supabase/functions/lgchl-league-writer/compose.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : a), []));
if (!args.night) { console.error('--night YYYY-MM-DD required'); process.exit(2); }

function restBackend(url, key) {
  return async (table, columns, filters, opts = {}) => {
    const q = new URLSearchParams({ select: columns.join(',') });
    for (const [c, { op, value }] of Object.entries(filters)) q.append(c, op === 'in' ? 'in.(' + value.join(',') + ')' : op + '.' + value);
    if (opts.order) q.set('order', opts.order + '.asc');
    const out = [];
    for (let from = 0; ; from += 1000) {
      const r = await fetch(url + '/rest/v1/' + table + '?' + q, { headers: { apikey: key, Authorization: 'Bearer ' + key, Range: from + '-' + (from + 999) } });
      if (!r.ok) throw new Error(table + ' ' + r.status);
      const rows = await r.json(); out.push(...rows); if (rows.length < 1000) break;
    }
    return out;
  };
}

const backend = args.snapshot ? snapshotBackend(JSON.parse(fs.readFileSync(args.snapshot, 'utf8')))
  : args.rest ? restBackend(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY) : null;
if (!backend) { console.error('--snapshot FILE or --rest required'); process.exit(2); }
const reader = createPublicReader(backend);
const ctx = await loadNight(reader, { night: args.night, season: Number(args.season || 55) });
if (ctx.empty) { console.log(JSON.stringify({ ok: false, reason: 'no LGCHL games on ' + args.night })); process.exit(0); }
const wrap = composeNightWrap(ctx, { generatedAt: args['generated-at'] || new Date().toISOString(), allowPartial: !!args.partial });
if (!wrap.ok) { console.log(JSON.stringify(wrap)); process.exit(0); }
const out = args.out || '.';
fs.mkdirSync(out, { recursive: true });
const base = path.join(out, 'sample-night-wrap-' + args.night);
fs.writeFileSync(base + '.md', wrap.markdown);
fs.writeFileSync(base + '.json', JSON.stringify({ ...wrap, markdown: undefined, reads: reader.reads.map((r) => r.table) }, null, 2));
console.log(JSON.stringify({ ok: true, title: wrap.title, files: [base + '.md', base + '.json'], metrics: wrap.metrics }, null, 1));
