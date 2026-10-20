import assert from 'node:assert/strict';
import { parseGameDecision } from '../supabase/functions/lgchl-league-sync/lib.ts';
// Trimmed from LG's public game pages 917681 (Sarnia 2 @ Calgary 3, F/OT) and 917727 (FINAL), Oct 19 2026.
const page = (label) => '<div class="row lg_main_header_total_row mb-2 desktop_only">\n\t<div class="col">x</div>\n' +
  '<div class="col col-lg-8 lg_main_header_total" style="text-align:center;"><span style="font-weight:bold;font-size:40px;">' + label + '</span>\n<BR>';
Deno.test('LG game header gives the decision', () => {
  assert.equal(parseGameDecision(page('F/OT')), 'OT');
  assert.equal(parseGameDecision(page('FINAL')), 'REG');
  assert.equal(parseGameDecision(page('F/SO')), 'SO');
  assert.equal(parseGameDecision(page('1st 12:00')), null);
  assert.equal(parseGameDecision('<html></html>'), null);
});
