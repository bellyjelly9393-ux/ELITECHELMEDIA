// Deterministic Hitmen recap writer. Every number and name in the output comes from the parsed
// LG game page (parse.mjs) or the official LGCHL game index; nothing is inferred or invented.
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (n) => (n >= 0 && n <= 10 ? WORDS[n] : String(n));
const Word = (n) => { const w = word(n); return w[0].toUpperCase() + w.slice(1); };
const mmss = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const dash = (a, b) => a + '–' + b;
const list = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : word(n) + ' times');
const ord = ['first', 'second', 'third'];

function line(p) {
  const bits = [];
  if (p.goals) bits.push(p.goals + ' G');
  if (p.assists) bits.push(p.assists + ' A');
  return bits.join(', ');
}
function pointsPhrase(p) {
  if (p.goals && p.assists) return (p.goals === 1 ? 'a goal' : word(p.goals) + ' goals') + ' and ' + (p.assists === 1 ? 'an assist' : word(p.assists) + ' assists');
  if (p.goals) return p.goals === 1 ? 'a goal' : p.goals === 3 ? 'a hat trick' : word(p.goals) + ' goals';
  return p.assists === 1 ? 'an assist' : word(p.assists) + ' assists';
}
const rank = (a, b) => (b.points - a.points) || (b.goals - a.goals) || (Number(b.gwg) - Number(a.gwg)) || a.gamertag.localeCompare(b.gamertag);

function scorers(skaters) {
  const s = skaters.filter((p) => p.points > 0).sort(rank);
  if (!s.length) return null;
  return s.map((p) => p.gamertag + ' had ' + pointsPhrase(p)).join('; ') + '.';
}

export function composeRecap(g, ctx) {
  const C = ctx.calgaryId, O = g.away_lg_team_id === C ? g.home_lg_team_id : g.away_lg_team_id;
  if (![g.away_lg_team_id, g.home_lg_team_id].includes(C)) throw new Error('Not a Calgary game');
  const T = ctx.teams, cName = T[C].name, oName = T[O].name;
  // Opponent by city ("Lethbridge"), the way the existing recaps read; falls back to the full name.
  const oNick = (T[O].nickname && oName.endsWith(' ' + T[O].nickname) ? oName.slice(0, -T[O].nickname.length - 1) : oName);
  const home = g.home_lg_team_id === C;
  const cs = home ? g.home_score : g.away_score, os = home ? g.away_score : g.home_score;
  const win = cs > os, ot = g.status !== 'REG', otWord = g.status === 'SO' ? 'a shootout' : 'overtime';
  const cp = g.periods[C], op = g.periods[O];
  const cSk = g.skaters.filter((p) => p.lg_team_id === C), oSk = g.skaters.filter((p) => p.lg_team_id === O);
  const cG = g.goalies.filter((p) => p.lg_team_id === C), oG = g.goalies.filter((p) => p.lg_team_id === O);
  const ct = g.team[C], ot_ = g.team[O];
  const day = new Date(ctx.game_at).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Toronto' });
  const gameDate = new Date(ctx.game_at).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const record = g.records[C] || null;
  const winner = win ? 'Calgary' : oNick;
  const wTop = (win ? cSk : oSk).slice().sort(rank)[0];
  const shutoutG = (win ? cG : oG).find((x) => x.goals_against === 0 && (win ? os : cs) === 0);

  // Running score after each regulation period, from Calgary's side.
  const after = [0, 1, 2].map((i) => [cp.slice(0, i + 1).reduce((a, b) => a + b, 0), op.slice(0, i + 1).reduce((a, b) => a + b, 0)]);
  const state = ([c, o]) => (c > o ? 'Calgary led ' + dash(c, o) : c < o ? oNick + ' led ' + dash(o, c) : 'It was ' + dash(c, o));
  const blewLead = !win && (after[1][0] > after[1][1] || after[0][0] > after[0][1]);
  const comeback = win && (after[1][0] < after[1][1] || after[0][0] < after[0][1]);

  // Headline
  let title;
  if (shutoutG && !win) title = shutoutG.gamertag + ' Blanks Calgary as ' + oNick + ' Wins ' + dash(os, 0);
  else if (shutoutG) title = shutoutG.gamertag + ' Shuts Out ' + oNick + ' in ' + dash(cs, 0) + ' Hitmen Win';
  else if (blewLead) title = oNick + ' Rallies Past Calgary ' + dash(os, cs) + (ot ? ' in ' + (g.status === 'SO' ? 'a Shootout' : 'Overtime') : '');
  else if (comeback) title = 'Hitmen Come Back to Beat ' + oNick + ' ' + dash(cs, os) + (ot ? ' in ' + (g.status === 'SO' ? 'a Shootout' : 'Overtime') : '');
  else if (win) title = wTop.gamertag + "'s " + (wTop.goals >= 3 ? 'Hat Trick' : wTop.points + '-Point Night') + ' Leads Hitmen Past ' + oNick + ', ' + dash(cs, os);
  else title = oNick + ' Beats Calgary ' + dash(os, cs) + (ot ? ' in ' + (g.status === 'SO' ? 'a Shootout' : 'Overtime') : '') + (wTop && wTop.points ? ' Behind ' + wTop.gamertag : '');

  // Lede
  const venue = home ? 'at home' : 'on the road';
  const lede = (win
    ? 'The Hitmen beat the ' + oName + ' ' + dash(cs, os) + (ot ? ' in ' + otWord : '') + ' ' + venue + ' on ' + day + '.'
    : 'The ' + oName + ' beat Calgary ' + dash(os, cs) + (ot ? ' in ' + otWord : '') + ' on ' + day + ', with the Hitmen ' + (home ? 'at home' : 'on the road') + '.')
    + (wTop && wTop.points ? ' ' + wTop.gamertag + ' led ' + (win ? 'Calgary' : oNick) + ' with ' + pointsPhrase(wTop) + '.' : '')
    + (shutoutG ? ' ' + shutoutG.gamertag + ' stopped all ' + shutoutG.shots_against + ' shots.' : '');

  // How it unfolded
  const leader = ([c, o]) => (c > o ? 'Calgary' : c < o ? oNick : null);
  const sc = ([c, o]) => (c >= o ? dash(c, o) : dash(o, c));
  let unfolded;
  if (leader(after[0]) && leader(after[0]) === leader(after[1])) unfolded = leader(after[0]) + ' led ' + sc(after[0]) + ' after one period and ' + sc(after[1]) + ' after two.';
  else unfolded = state(after[0]) + ' after one period, and ' + state(after[1]).replace(/^It was/, 'it was') + ' after two.';
  const c3 = cp[2], o3 = op[2];
  if (!ot) unfolded += ' ' + (c3 === o3 ? (c3 ? 'Both teams scored ' + times(c3) + ' in the third.' : 'Neither team scored in the third.') : (c3 > o3 ? 'Calgary' : oNick) + ' won the third period ' + dash(Math.max(c3, o3), Math.min(c3, o3)) + '.');
  else {
    const tie = dash(after[2][0], after[2][1]);
    if (!c3 && !o3) unfolded += ' Neither team scored in the third, and it went to ' + otWord + ' tied ' + tie + '.';
    else if (!c3 || !o3) unfolded += ' ' + (c3 ? 'Calgary' : oNick) + ' scored ' + times(c3 || o3) + ' in the third to force ' + otWord + ' at ' + tie + '.';
    else unfolded += ' Calgary scored ' + times(c3) + ' and ' + oNick + ' ' + times(o3) + ' in the third, leaving it ' + tie + ' after regulation.';
    const otPeriods = g.period_labels.length - 3;
    unfolded += ' ' + winner + ' won it in ' + otWord + (otPeriods > 1 && g.status === 'OT' ? '; the LG log lists ' + word(otPeriods) + ' periods after regulation' : '') + '.';
  }
  const gwg = (win ? cSk : oSk).find((p) => p.gwg);
  if (gwg) unfolded += ' ' + gwg.gamertag + ' was credited with the game-winner.';

  // Numbers
  const ppC = ct.pp, ppO = ot_.pp;
  const numbers = [
    (ct.shots >= ot_.shots ? 'Calgary out-shot ' + oNick + ' ' + dash(ct.shots, ot_.shots) : oNick + ' out-shot Calgary ' + dash(ot_.shots, ct.shots)) + ', and ' +
      (ct.toa_seconds >= ot_.toa_seconds ? 'Calgary' : oNick) + ' had more time on attack (' + mmss(Math.max(ct.toa_seconds, ot_.toa_seconds)) + ' to ' + mmss(Math.min(ct.toa_seconds, ot_.toa_seconds)) + ').',
    ct.hits != null && ot_.hits != null ? 'Hits went ' + (ct.hits >= ot_.hits ? 'to Calgary ' + dash(ct.hits, ot_.hits) : 'to ' + oNick + ' ' + dash(ot_.hits, ct.hits)) + '.' : '',
    ct.faceoffs_won != null && ot_.faceoffs_won != null ? (ct.faceoffs_won === ot_.faceoffs_won ? 'Faceoffs were split ' + dash(ct.faceoffs_won, ot_.faceoffs_won) + '.' : (ct.faceoffs_won > ot_.faceoffs_won ? 'Calgary' : oNick) + ' won the faceoff count ' + dash(Math.max(ct.faceoffs_won, ot_.faceoffs_won), Math.min(ct.faceoffs_won, ot_.faceoffs_won)) + '.') : '',
    'On the power play, Calgary went ' + ppC[0] + '-for-' + ppC[1] + ' and ' + oNick + ' went ' + ppO[0] + '-for-' + ppO[1] + '.',
  ].filter(Boolean).join(' ');

  const goalieLine = (gs) => gs.map((x) => x.gamertag + ' made ' + x.saves + ' save' + (x.saves === 1 ? '' : 's') + ' on ' + x.shots_against + ' shot' + (x.shots_against === 1 ? '' : 's')).join('; ');
  const cScore = scorers(cSk), oScore = scorers(oSk);
  const calgarySection = (cScore ? cScore : 'No Calgary skater recorded a point.') + ' ' + goalieLine(cG) + ' for Calgary.';
  const oppSection = (oScore ? oScore : 'No ' + oNick + ' skater recorded a point.') + ' ' + goalieLine(oG) + ' for ' + oNick + '.';

  // The number
  let number, numberText;
  const loserPP = win ? ppO : ppC, winnerPP = win ? ppC : ppO;
  if (shutoutG) { number = String(shutoutG.saves); numberText = 'Saves by ' + shutoutG.gamertag + ', with none allowed.'; }
  else if (winnerPP[1] >= 2 && winnerPP[0] === winnerPP[1]) { number = winnerPP[0] + '/' + winnerPP[1]; numberText = winner + ' scored on every power play ' + (win ? 'it' : 'it') + ' had.'; }
  else if (Math.abs(ct.shots - ot_.shots) >= 8) { number = dash(Math.max(ct.shots, ot_.shots), Math.min(ct.shots, ot_.shots)); numberText = 'The shot count, in ' + (ct.shots > ot_.shots ? 'Calgary' : oNick) + "'s favour" + ((ct.shots > ot_.shots) === win ? '.' : ', in a game ' + (win ? 'Calgary' : oNick) + ' still won.'); }
  else if (wTop && wTop.goals >= 3) { number = String(wTop.goals); numberText = 'Goals by ' + wTop.gamertag + '.'; }
  else { number = String(winnerPP[0] + loserPP[0]); numberText = 'Power-play goals between the two teams (' + (win ? 'Calgary ' : oNick + ' ') + winnerPP[0] + ', ' + (win ? oNick + ' ' : 'Calgary ') + loserPP[0] + ').'; }
  
  const recLine = record ? 'Calgary ' + (win ? 'improves' : ot ? 'gets a point and moves' : 'falls') + ' to ' + record + '.' : '';

  // Three stars: points (goals weighted), then goalies by shutout/saves.
  const cand = g.skaters.map((p) => ({ p, s: p.goals * 3 + p.assists * 2 + (p.gwg ? 1 : 0), line: line(p) + (p.gwg ? ', GWG' : '') }))
    // A shutout needs the goalie's team to concede nothing: goalie GA can be below the final (empty-net goals).
    .concat(g.goalies.map((x) => ({ x, so: x.goals_against === 0 && (x.lg_team_id === C ? os : cs) === 0 }))
      .map(({ x, so }) => ({ p: x, s: (so ? 9 : 0) + x.saves / 4 + ((x.lg_team_id === C) === win ? 1 : 0), line: x.saves + ' saves' + (so ? ', shutout' : ' on ' + x.shots_against) })))
    .filter((c) => c.s > 0).sort((a, b) => (b.s - a.s) || a.p.gamertag.localeCompare(b.p.gamertag)).slice(0, 3);
  const stars = cand.map((c) => ({ player: c.p.gamertag, team: T[c.p.lg_team_id].abbr, line: c.line }));

  // Optional evidence (EA match data + approved film review) from evidence.mjs; absent => unchanged output.
  const ev = ctx.evidence && Array.isArray(ctx.evidence.sections) ? ctx.evidence : null;
  const source = 'LeagueGaming Game ' + g.lg_game_id + ' public box score (official final ' + dash(Math.max(cs, os), Math.min(cs, os)) + ' ' + (win ? 'Calgary' : oNick) + (ot ? ', F/' + g.status : '') + ').';
  const body = [
    lede,
    '## How it unfolded\n' + unfolded,
    '## By the numbers\n' + numbers,
    "## Calgary's scorers\n" + calgarySection,
    '## ' + oNick + "'s scorers\n" + oppSection,
    ...(ev ? ev.sections : []),
    '## The number: ' + number + '\n' + numberText,
    recLine,
    'Source: ' + source + (ev && ev.sourceNote ? ' ' + ev.sourceNote : ''),
  ].filter(Boolean).join('\n\n') + '\n\nThree stars\n' + stars.map((s, i) => (i + 1) + '. ' + s.player + ' (' + s.team + '): ' + s.line).join('\n');

  const dek = (win ? 'Calgary beat ' + oNick + ' ' + dash(cs, os) : oNick + ' beat Calgary ' + dash(os, cs)) + (ot ? ' in ' + otWord : '') + '; ' +
    (ct.shots >= ot_.shots ? 'Calgary out-shot them ' + dash(ct.shots, ot_.shots) : oNick + ' out-shot Calgary ' + dash(ot_.shots, ct.shots)) + '.';
  const metrics = {
    dek, team: cName, league: 'LGCHL', season: 55, week: ctx.week ?? null,
    final: cs + '-' + os + (ot ? ' ' + g.status : ''), record, result: win ? 'W' : 'L', source: 'LG', game_no: ctx.game_no,
    sort_at: new Date(ctx.game_at).toISOString().replace(/\.\d{3}Z$/, 'Z'), opponent: oName, game_date: gameDate,
    key_stats: {
      shots: ct.shots + '-' + ot_.shots,
      faceoffs: ct.faceoffs_won != null ? ct.faceoffs_won + '-' + ot_.faceoffs_won : undefined,
      power_play: ppC[0] + '/' + ppC[1] + ' - ' + ppO[0] + '/' + ppO[1],
      zone_time: mmss(ct.toa_seconds) + ' - ' + mmss(ot_.toa_seconds),
      passing: ct.passing_pct != null ? ct.passing_pct + '% - ' + ot_.passing_pct + '%' : undefined,
    },
    lg_game_id: g.lg_game_id, three_stars: stars, source_label: 'LeagueGaming public box score',
    model: 'hitmen-recap-autowriter · deterministic from LG box score', calgary_score: cs, opponent_score: os,
    vod_available: false, schedule_game_id: ctx.schedule_game_id || null, source_url: ctx.source_url, auto: true,
  };
  if (ev && ev.metrics) Object.assign(metrics, ev.metrics);
  for (const k of Object.keys(metrics.key_stats)) if (metrics.key_stats[k] === undefined) delete metrics.key_stats[k];
  return { title: title.slice(0, 160), body, metrics };
}
