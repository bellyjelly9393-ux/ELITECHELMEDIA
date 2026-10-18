/* Node built-in tests: public-only LGCHL player emblems. */
'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.resolve(__dirname,'../lgchl-player-badges.js'),'utf8');
function setup() {
  const window = {WMDesk:{
    esc: value=>String(value).replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    read: async()=>[]
  }};
  const document = {querySelectorAll:()=>[]};
  vm.runInNewContext(code, {window,document}, {filename:'lgchl-player-badges.js'});
  return window.WMLgPlayerBadges;
}
test('Hot Start requires a credible early scoring sample',()=>{
  const b=setup(), skater={lg_user_id:42,player_kind:'skater',gp:8,points:20};
  assert.ok(b.earned(skater).includes('hot'));
  assert.ok(!b.earned({...skater,gp:4}).includes('hot'));
  assert.ok(!b.earned({...skater,gp:21}).includes('hot'));
  assert.ok(!b.earned({...skater,points:null}).includes('hot'));
});
test('Brick Wall uses recorded goalie save percentage',()=>{
  const b=setup(), goalie={lg_user_id:40,player_kind:'goalie',gp:9,save_pct:.86};
  assert.ok(b.earned(goalie).includes('wall'));
  assert.ok(!b.earned({...goalie,save_pct:.84}).includes('wall'));
  assert.ok(!b.earned({...goalie,gp:7}).includes('wall'));
});
test('Career and rising badges need safe history with stable user ID',async()=>{
  const b=setup(), p={lg_user_id:31,gamertag:'Test',player_kind:'skater',gp:8,points:24};
  assert.ok(!b.earned(p).includes('career'));
  assert.ok(!b.earned(p).includes('rise'));
  await b.load([p],async(table,query)=>{
    assert.equal(table,'lgchl_public_player_badges');
    assert.match(query.lg_user_id,/31/);
    return [{lg_user_id:31,player_kind:'skater',prev_gp:20,prev_ppg:1.4,career_best_ppg:2}];
  });
  assert.ok(b.earned(p).includes('career'));
  assert.ok(b.earned(p).includes('rise'));
  assert.ok(!b.earned({...p,lg_user_id:32}).includes('career'));
  assert.ok(!b.earned({...p,lg_user_id:32}).includes('rise'));
});
test('Streak badge is disabled until a complete verified per-game sequence is available',()=>{
  const b=setup();
  assert.ok(!b.earned({lg_user_id:31,player_kind:'skater',gp:8,points:32}).includes('streak'));
});
test('Legend explains every emblem without invented player claims',()=>{
  const b=setup(), html=b.legend();
  for(const label of ['Hot Start','Career-Year Watch','On the Rise','Point Streak','Brick Wall']){
    assert.ok(html.includes(label));
  }
  assert.match(html,/verified statistics/);
});
test('The client reads only a safe public badge table, not internal history or VOD endpoints',()=>{
  assert.doesNotMatch(code,/reader\(['"]lg_player_season_stats['"]/);
  assert.doesNotMatch(code,/reader\(['"]hitmen_opponent_player_scout_reports['"]/);
  assert.doesNotMatch(code,/reader\(['"]vod_/);
});
