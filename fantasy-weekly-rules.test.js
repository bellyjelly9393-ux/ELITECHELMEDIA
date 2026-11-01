/* Developer regression suite for EliteChel Fantasy rules. Run from browser devtools:
   EliteChelFantasyRuleTests.run(). Or include in a tiny test HTML page.
   Uses FICTIONAL demo records. Never submits real league entries. */
(function(root){
'use strict';
var api=root.EliteChelFantasyRules,fixture=root.EliteChelFantasyDemo;
function run(){
 if(!api||!fixture)return {passed:0,total:1,failures:['Missing engine/fixtures']};
 var cases=[],fA=fixture.weeks.a['4'],fB=fixture.weeks.b['4'],
 sA=fixture.weeks.a['6'],sB=fixture.weeks.b['6'],
 fPick=fixture.defaults['4'],sPick=fixture.defaults['6'];
 function t(name,fn){try{cases.push({name:name,pass:!!fn()});}catch(e){cases.push({name:name,pass:false,why:String(e)});}}
 t('Fours configuration valid',function(){return api.validateWeek(fA).ok;});
 t('Sixes configuration valid',function(){return api.validateWeek(sA).ok;});
 t('No-bonus fours valid',function(){return api.validateWeek(fB).ok;});
 t('Spotlight sixes valid',function(){return api.validateWeek(sB).ok;});
 t('Fours valid at $35M',function(){var v=api.validatePicks(fA,fPick);return v.ok&&v.cost===35;});
 t('Sixes valid at $52M',function(){var v=api.validatePicks(sA,sPick);return v.ok&&v.cost===52;});
 t('Over cap fails',function(){return api.validatePicks(fA,{superstar:'S1',upcomer:'U1',wildcard:'W4',goalie:'G2'}).errors.some(function(x){return x.includes('Over');});});
 t('Two stars fail',function(){return api.validatePicks(sA,Object.assign({},sPick,{C:'C2'})).errors.some(function(x){return x.includes('exactly one');});});
 t('Zero stars fail',function(){return api.validatePicks(sA,Object.assign({},sPick,{LW:'L2'})).errors.some(function(x){return x.includes('exactly one');});});
 t('No up-and-comer fails',function(){return api.validatePicks(sA,Object.assign({},sPick,{RW:'R2'})).errors.some(function(x){return x.includes('Up & Comer');});});
 t('Position mismatch fails',function(){return api.validatePicks(sA,Object.assign({},sPick,{LD:'R2'})).errors.some(function(x){return x.includes('eligible');});});
 t('Fours category mismatch fails',function(){return api.validatePicks(fA,Object.assign({},fPick,{wildcard:'U2'})).errors.some(function(x){return x.includes('Wildcard');});});
 var sameNation=JSON.parse(JSON.stringify(fA));sameNation.pool.filter(function(x){return x.id==='W1';})[0].nation='Canada';
 t('Fours same nation fails',function(){return api.validatePicks(sameNation,fPick).errors.some(function(x){return x.includes('different nation');});});
 var fScores={S1:{points:30,games:2,verified:true},U1:{points:14,games:3,verified:true},W1:{points:17,games:2,verified:true},G1:{points:20,games:2,verified:true}};
 t('Unfinalized week pending',function(){return api.scoreEntry(fA,fPick,fScores).status==='pending';});
 t('Fours bounceback bonus +5',function(){var r=api.scoreEntry(Object.assign({},fA,{finalized:true}),fPick,fScores);return r.ok&&r.base===81&&r.bonus===5&&r.total===86;});
 t('Bounceback below target +0',function(){return api.scoreEntry(Object.assign({},fA,{finalized:true}),fPick,Object.assign({},fScores,{W1:{points:15,games:2,verified:true}})).bonus===0;});
 t('Unverified results stay pending',function(){return api.scoreEntry(Object.assign({},fA,{finalized:true}),fPick,Object.assign({},fScores,{W1:{points:17,games:2,verified:false}})).status==='pending';});
 t('Fours no bonus week +0',function(){return api.scoreEntry(Object.assign({},fB,{finalized:true}),fPick,fScores).bonus===0;});
 var sScores={L1:{points:14,games:2,verified:true},C1:{points:19,games:2,verified:true},R1:{points:17,games:2,verified:true},D1:{points:9,games:2,verified:true},D3:{points:13,games:2,verified:true},G1:{points:21,games:2,verified:true}};
 t('Sixes no bonus even with bounceback player',function(){return api.scoreEntry(Object.assign({},sA,{finalized:true}),sPick,sScores).bonus===0;});
 t('Sixes RD spotlight +4',function(){return api.scoreEntry(Object.assign({},sB,{finalized:true}),sPick,sScores).bonus===4;});
 t('Sixes RD spotlight below target +0',function(){return api.scoreEntry(Object.assign({},sB,{finalized:true}),sPick,Object.assign({},sScores,{D3:{points:11,games:2,verified:true}})).bonus===0;});
 t('Unknown twist rejected',function(){return !api.validateWeek(Object.assign({},sA,{bonus:{type:'unknown',points:4,target:10}})).ok;});
 t('Oversized bonus rejected',function(){return !api.validateWeek(Object.assign({},sA,{bonus:{type:'heater',points:100,target:10}})).ok;});
 return {passed:cases.filter(function(c){return c.pass;}).length,total:cases.length,failures:cases.filter(function(c){return !c.pass;}),cases:cases};
}
root.EliteChelFantasyRuleTests={run:run};
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:{});
