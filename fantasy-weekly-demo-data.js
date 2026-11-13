/* Fictional players, teams, prices and performances for UI development only.
   NEVER connect these records to real leaderboard pages. Weekly categories and bonuses must
   be editor-approved snapshots based on verified real-world league records before release. */
(function(global){
'use strict';
var four=[
{id:'S1',name:'Northern Ace',team:'Team Maple',nation:'Canada',position:'F',category:'superstar',price:13},
{id:'S2',name:'Iron Rush',team:'Team Liberty',nation:'USA',position:'F',category:'superstar',price:11},
{id:'U1',name:'Rising Edge',team:'Team Crown',nation:'Sweden',position:'F',category:'upcomer',price:8},
{id:'U2',name:'Quick Step',team:'Team Sakura',nation:'Japan',position:'F',category:'upcomer',price:7},
{id:'W1',name:'The Rebound',team:'Team Lions',nation:'Great Britain',position:'F',category:'bounceback',price:6,projected_week_points:8},
{id:'W2',name:'Quiet Threat',team:'Team Azzurri',nation:'Italy',position:'F',category:'sleeper',price:5,projected_week_points:8},
{id:'W3',name:'Hidden Spark',team:'Team Riga',nation:'Latvia',position:'F',category:'underrated',price:6,projected_week_points:7},
{id:'W4',name:'Flashpoint',team:'Team Suomi',nation:'Finland',position:'F',category:'heater',price:7},
{id:'G1',name:'Ice Wall',team:'Team Berlin',nation:'Germany',position:'G',category:'goalie',price:8},
{id:'G2',name:'Last Stand',team:'Team Alps',nation:'Switzerland',position:'G',category:'goalie',price:9}
];
var six=[
{id:'L1',name:'Apex',team:'Northern Club',position:'LW',category:'superstar',price:14},
{id:'L2',name:'Velo',team:'Atlantic Club',position:'LW',category:'upcomer',price:8},
{id:'C1',name:'Reset',team:'Western Club',position:'C',category:'bounceback',price:7,projected_week_points:8},
{id:'C2',name:'Titan',team:'Capital Club',position:'C',category:'superstar',price:15},
{id:'R1',name:'Spark',team:'Prairie Club',position:'RW',category:'upcomer',price:8},
{id:'R2',name:'Echo',team:'Metro Club',position:'RW',category:'sleeper',price:6,projected_week_points:9},
{id:'R3',name:'Blaze',team:'Bay Club',position:'RW',category:'heater',price:7},
{id:'D1',name:'Anchor',team:'Steel Club',position:'LD',category:'value',price:7},
{id:'D2',name:'Pulse',team:'Royal Club',position:'LD',category:'underrated',price:5,projected_week_points:7},
{id:'D3',name:'Underdog',team:'River Club',position:'RD',category:'sleeper',price:6,projected_week_points:8},
{id:'D4',name:'Shield',team:'Lake Club',position:'RD',category:'value',price:9},
{id:'G1',name:'The Wall',team:'Pacific Club',position:'G',category:'goalie',price:10},
{id:'G2',name:'Clutch',team:'Valley Club',position:'G',category:'goalie',price:8}
];
var baseDate='2026-11-01T17:00:00-05:00';
var weeks={
a:{
 '4':{format:'4',league:'lg3s',week:1,cap:36,published_at:baseDate,lock_at:'2026-11-04T20:00:00-05:00',finalized:false,pool:four,
 bonus:{type:'bounce_back',points:5,target:16,min_games:2}},
 '6':{format:'6',league:'lgchl',week:1,cap:55,published_at:baseDate,lock_at:'2026-11-04T20:00:00-05:00',finalized:false,pool:six,
 bonus:{type:'none'}}
},
b:{
 '4':{format:'4',league:'lg3s',week:2,cap:36,published_at:'2026-11-08T18:00:00-05:00',lock_at:'2026-11-11T20:00:00-05:00',finalized:false,pool:four,
 bonus:{type:'none'}},
 '6':{format:'6',league:'lgchl',week:2,cap:55,published_at:'2026-11-08T18:00:00-05:00',lock_at:'2026-11-11T20:00:00-05:00',finalized:false,pool:six,
 bonus:{type:'position_spotlight',points:4,target:12,min_games:2,position:'RD'}}
}
};
var defaults={'4':{superstar:'S1',upcomer:'U1',wildcard:'W1',goalie:'G1'},
              '6':{LW:'L1',C:'C1',RW:'R1',LD:'D1',RD:'D3',G:'G1'}};
if(global)global.EliteChelFantasyDemo={weeks:weeks,defaults:defaults,fictional:true};
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null);
