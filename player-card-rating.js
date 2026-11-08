/* Independent ECM beta rating: role-relative season statistics, never an EA/LG rating. */
(function(root){'use strict';
const version='eco-beta-20261108-r2',MIN_GP=6,MIN_PEERS=20,PRIOR_GP=6,MAX_AGE_MS=48*3600000;
const weights={C:{Goals:15,Assists:20,Interceptions:15,Takeaways:10,'Puck security':15,Passing:10,Faceoffs:10,Discipline:5},W:{Goals:25,Assists:25,Interceptions:10,Takeaways:10,'Puck security':15,Passing:10,Discipline:5},D:{Goals:5,Assists:15,Interceptions:25,Takeaways:15,'Puck security':20,Passing:10,Discipline:10},G:{'Save percentage':80,'Goals against per 60':20}};
const number=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const roleOf=p=>p?.kind==='goalie'?'G':p?.pos==='C'?'C':['LW','RW'].includes(p?.pos)?'W':['LD','RD','D'].includes(p?.pos)?'D':null;
function time(v){if(typeof v!=='string'||!/^\d+:[0-5]\d$/.test(v))return null;const [m,s]=v.split(':').map(Number);return m*60+s;}
function percentage(v){const n=number(v);return n===null||n<0||n>100?null:n/100;}
function median(values){const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;}
function percentile(v,values,lower=false){let below=0,equal=0;for(const x of values){if(x<v)below++;else if(x===v)equal++;}const score=100*(below+equal/2)/values.length;return lower?100-score:score;}
function metrics(p){const role=roleOf(p),s=p?.ratingStats,gp=number(p?.gp);if(!role||!s||gp===null||gp<MIN_GP)return null;
 const nonnegative=k=>{const n=number(s[k]);return n!==null&&n>=0?n:null;};
 if(role==='G'){const sa=nonnegative('sog'),ga=nonnegative('ga'),seconds=time(s.toi);if(sa===null||ga===null||sa<100||ga>sa||!seconds)return null;return {'Save percentage':{value:(sa-ga)/sa,exposure:sa,prior:100,lower:false},'Goals against per 60':{value:ga/seconds*3600,exposure:gp,prior:PRIOR_GP,lower:true}};}
 if(s.legacy_extras_as_of)return null;
 const goals=nonnegative('goals'),assists=nonnegative('assists'),points=nonnegative('points'),ints=nonnegative('interceptions'),takes=nonnegative('takeaway'),gives=nonnegative('giveaway'),passing=percentage(s.passp),attempts=nonnegative('pass_att'),fo=percentage(s.fop);
 let pim=number(s.pim);if(typeof s.pim==='string'&&s.pim.includes(':')){const seconds=time(s.pim);pim=seconds===null?null:seconds/60;}
 if([goals,assists,points,ints,takes,gives,passing,attempts,pim].some(v=>v===null)||pim<0||attempts===0||points!==goals+assists||(role==='C'&&fo===null))return null;
 const rate=(n,lower=false)=>({value:n/gp,exposure:gp,prior:PRIOR_GP,lower});
 const out={Goals:rate(goals),Assists:rate(assists),Interceptions:rate(ints),Takeaways:rate(takes),'Puck security':rate(gives,true),Passing:{value:passing,exposure:attempts,prior:200,lower:false},Discipline:rate(pim,true)};
 if(role==='C')out.Faceoffs={value:fo,exposure:gp,prior:PRIOR_GP,lower:false};return out;
}
function cardScale(score){return Number.isFinite(score)?Math.round(60+39*Math.max(0,Math.min(100,score))/100):null;}
function assess(p,players=[],options={}){const role=roleOf(p),base={version,approved:false,status:'pending',overall:null,performanceScore:null,role,weights:weights[role]||{},factorsUsed:[],peers:0};const pending=reason=>({...base,reason});
 if(options.league&&options.league!=='lgchl')return pending('Automatic ratings are available for the LGCHL Season 55 beta only.');
 if(!p||!role)return pending('Select a player with a supported position.');
 if(!p.ratingStats)return pending('Detailed season statistics are unavailable. No automatic rating assigned.');
 if(number(p.gp)===null||number(p.gp)<MIN_GP)return pending('At least 6 games are required before an ECM beta rating appears.');
 const latest=Math.max(...players.map(x=>Date.parse(x.updated)||0));
 const fresh=x=>Number.isFinite(Date.parse(x.updated))&&latest-Date.parse(x.updated)<=MAX_AGE_MS&&!x.ratingStats?.current_source_missing;
 if(!latest||!fresh(p))return pending('This player’s source record is older than the current cohort or marked unavailable.');
 const own=metrics(p);if(!own)return pending(role==='G'?'Goalie rating needs valid shots, goals against, time played and at least 100 shots faced.':'A required season metric is missing or invalid. Missing statistics are never scored as zero.');
 // Canonical IDs prevent renamed gamertags from receiving multiple peer votes.
 const unique=new Map();for(const x of players){const key=x.kind+':'+x.id,old=unique.get(key);if(!old||Date.parse(x.updated)>Date.parse(old.updated))unique.set(key,x);}
 const peers=[...unique.values()].filter(x=>roleOf(x)===role&&fresh(x)).map(x=>({p:x,m:metrics(x)})).filter(x=>x.m);
 if(!peers.some(x=>x.p.id===p.id&&x.p.kind===p.kind))return pending('Player is not in the eligible comparison cohort.');
 if(peers.length<MIN_PEERS)return pending('At least 20 eligible players in the same role are needed for a comparison.');
 const factors=[];let overall=0;
 for(const [name,weight] of Object.entries(weights[role])){const center=median(peers.map(x=>x.m[name].value));const shrink=m=>(m.value*m.exposure+center*m.prior)/(m.exposure+m.prior);const value=shrink(own[name]),score=percentile(value,peers.map(x=>shrink(x.m[name])),own[name].lower);overall+=score*weight/100;factors.push({name,weight,percentile:Math.round(score*10)/10,raw:own[name].value,adjusted:value});}
 const lowest=[...factors].sort((a,b)=>a.percentile-b.percentile)[0];const cues={Goals:'Review two missed scoring chances and practice the release you needed.',Assists:'Look for a supporting passing option before entering traffic.',Interceptions:'Protect a passing lane with your stick before chasing the puck.',Takeaways:'Wait for an exposed puck before making a controlled poke.',
 'Puck security':'Use a short outlet or reset when the forward lane is closed.',Passing:'Choose a clear short outlet before trying a contested cross-ice pass.',Faceoffs:'Practice your counter for the draw you lost most often.',Discipline:'Avoid the extra poke or hit after the puck has moved.',
 'Save percentage':'Review the goals allowed and identify one repeatable positioning adjustment.', 'Goals against per 60':'Review a conceded sequence with your defense; this metric also depends on team play.'};
 return {...base,status:'beta',nextGame:lowest.name+': '+cues[lowest.name],overall:cardScale(overall),performanceScore:Math.round(overall*10)/10,peers:peers.length,factorsUsed:factors,reason:'ECM beta OVR is shown on a 60–99 card scale. Its separate performance index combines weighted component percentiles within '+({C:'centers',W:'wingers',D:'defensemen',G:'goalies'}[role])+'. Small samples are pulled toward the role median. This is an experimental season-stat rating, not an EA or LG rating.'};
}
const api={version,weights,assess,roleOf,metrics,cardScale};root.ECMRating=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
