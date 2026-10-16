// Allowlisted public game-table fields only; reject unknown/incomplete layouts.
const ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',minus:'−'};
export const clean=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(m,e)=>e[0]==='#'?String.fromCodePoint(parseInt(e.slice(e[1].toLowerCase()==='x'?2:1),e[1].toLowerCase()==='x'?16:10)):ENT[e.toLowerCase()]??m).replace(/\s+/g,' ').trim();
const key=s=>clean(s).toLowerCase().replace(/[. :_%()]/g,'').replace(/−/g,'-');
const number=s=>{const t=clean(s).replace(/,/g,'').replace(/−/g,'-');return /^[-+]?\d+(?:\.\d+)?%?$/.test(t)?Number(t.replace('%','')):null;};
const integer=s=>{const n=number(s);return Number.isInteger(n)?n:null;};
const seconds=s=>{const m=/^(\d+):([0-5]\d)$/.exec(clean(s));return m?Number(m[1])*60+Number(m[2]):null;};
function links(html,name){const re=new RegExp('<a\\b[^>]*href\\s*=\\s*["\\x27]([^"\\x27]*(?:&amp;|[?&])'+name+'=(\\d+)[^"\\x27]*)["\\x27][^>]*>([\\s\\S]*?)<\\/a>','gi');return [...String(html).matchAll(re)].map(m=>({id:Number(m[2]),name:clean(m[3])}));}
function tableRows(html){
 const tables=[],stack=[];let table=null,row=null,cell=null;
 for(const token of String(html).replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi,'').match(/<[^>]+>|[^<]+/g)||[]){
  if(/^<table\b/i.test(token)){stack.push({table,row,cell});table={html:'',rows:[]};row=null;cell=null;continue;}
  if(/^<\/table/i.test(token)){if(table){table.html=table.rows.map(r=>r.map(c=>c.html).join(' ')).join(' ');tables.push(table);}({table,row,cell}=stack.pop()||{table:null,row:null,cell:null});continue;}
  if(!table)continue;
  if(/^<tr\b/i.test(token)){row=[];cell=null;table.rows.push(row);continue;}
  if(/^<\/tr/i.test(token)){row=null;cell=null;continue;}
  if(/^<(td|th)\b/i.test(token)){if(!row){row=[];table.rows.push(row);}cell={html:''};row.push(cell);continue;}
  if(/^<\/(td|th)/i.test(token)){cell=null;continue;}
  if(cell)cell.html+=token;
 }
 return tables;
}
const SKATER={g:'goals',goals:'goals',a:'assists',assists:'assists',p:'points',pts:'points',points:'points','+/-':'plus_minus',plusminus:'plus_minus',toi:'toi_seconds',twp:'twp_seconds',s:'shots',shots:'shots',d:'deflections',pas:'passing_pct',passing:'passing_pct',h:'hits',hits:'hits',ta:'takeaways',ga:'giveaways',bk:'blocked_shots',int:'interceptions',pim:'pim',pos:'position',position:'position'};
const GOALIE={sv:'saves',saves:'saves',sa:'shots_against',sog:'shots_against',shotsagainst:'shots_against',ga:'goals_against',goalsagainst:'goals_against',savepct:'save_pct',svpct:'save_pct',gaa:'gaa',toi:'toi_seconds',pos:'position',position:'position'};
const TEAM={goals:'goals',shots:'shots',hits:'hits',pim:'pim',penaltyminutes:'pim',puckpossession:'possession_seconds',possession:'possession_seconds',passing:'passing_pct',passingpercentage:'passing_pct',faceoffs:'faceoffs_won',faceoffwins:'faceoffs_won',powerplaygoals:'pp_goals',powerplayopportunities:'pp_opportunities'};
function headerKey(s){return /^(sv|save)\s*%$/i.test(clean(s))?'savepct':key(s);}
function value(field,html){
 if(field==='position')return /^(LW|C|RW|LD|RD|G)$/.test(clean(html))?clean(html):null;
 if(field.endsWith('_seconds'))return seconds(html);
 if(field==='passing_pct'||field==='gaa')return number(html);
 if(field==='save_pct'){const n=number(html);return n==null?null:n>1?n/100:n;}
 return integer(html);
}
function validateSourceIdentity(html,game){
 const ids=[];
 for(const tag of String(html).match(/<(?:link|meta)\b[^>]*>/gi)||[]){
  const attrs={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[m[1].toLowerCase()]=clean(m[2]??m[3]);
  const raw=attrs.rel?.toLowerCase().split(/\s+/).includes('canonical')?attrs.href:
   (attrs.property||attrs.name||'').toLowerCase()==='og:url'?attrs.content:null;
  if(!raw)continue;
  let u;try{u=new URL(raw);}catch{throw Error('Invalid canonical game identity');}
  if(u.protocol!=='https:'||!/(^|\.)leaguegaming\.com$/i.test(u.hostname)||u.searchParams.get('page')!=='game')throw Error('Unexpected canonical game source');
  const id=u.searchParams.get('gameid');
  if(!/^\d+$/.test(id||'')||!Number.isSafeInteger(Number(id))||Number(id)!==game.lg_game_id)throw Error('Canonical game identity mismatch');
  if(u.searchParams.has('seasonid')&&Number(u.searchParams.get('seasonid'))!==game.season)throw Error('Canonical season mismatch');
  if(u.searchParams.has('leagueid')&&Number(u.searchParams.get('leagueid'))!==39)throw Error('Canonical league mismatch');
  ids.push(Number(id));
 }
 if(!ids.length)throw Error('Canonical game identity is missing; source layout requires validation');
}
export function parsePublicGame(html,game){
 if(!Number.isSafeInteger(game.lg_game_id)||game.season!==55||game.status!=='final')throw Error('Expected an official Season 55 final');
 if(/Just a moment|cf-chl|challenge-platform|cf-mitigated/i.test(html))throw Error('Cloudflare challenge; no box score parsed');
 if(/type=["']password|name=["']password/i.test(html)&&!/User Stats|Player Stats|Box Score/i.test(html))throw Error('Login page is not a public box score');
 validateSourceIdentity(html,game);
 const sides=[game.away_lg_team_id,game.home_lg_team_id],players=[],teamStats={},periods=[];
 for(const table of tableRows(html)){
  const tableTeams=[...new Set(links(table.html,'teamid').map(l=>l.id).filter(id=>sides.includes(id)))];
  let team=tableTeams.length===1?tableTeams[0]:null,columns=null,kind=null;
  for(const row of table.rows){
   const headers=row.map(c=>headerKey(c.html)),rowTeams=[...new Set(row.flatMap(c=>links(c.html,'teamid')).map(l=>l.id).filter(id=>sides.includes(id)))];
   const hasIdentity=row.some(c=>/player|user|gamertag/i.test(clean(c.html)));
   if(hasIdentity&&(headers.includes('g')||headers.includes('goals'))&&(headers.includes('a')||headers.includes('assists'))&&(headers.includes('p')||headers.includes('pts')||headers.includes('points'))){columns=headers.map(h=>SKATER[h]||null);kind='skater';continue;}
   if(hasIdentity&&(headers.includes('savepct')||headers.includes('gaa'))&&(headers.includes('sa')||headers.includes('sog')||headers.includes('saves')||headers.includes('sv'))){columns=headers.map(h=>GOALIE[h]||null);kind='goalie';continue;}
   if(rowTeams.length===1&&!row.some(c=>links(c.html,'userid').length||links(c.html,'user_id').length)&&row.length<=2){team=rowTeams[0];continue;}
   const identity=row.flatMap(c=>[...links(c.html,'userid'),...links(c.html,'user_id')]).find(p=>p.name);
   if(identity&&(!columns||!kind))throw Error('Unrecognized player row; layout requires validation');
   if(identity&&columns&&kind){
    if(!team||!sides.includes(team))throw Error('Player table has no canonical team ID');
    if(row.length!==columns.length)throw Error('Player row/header width mismatch');
    const p={lg_user_id:identity.id,gamertag:identity.name,lg_team_id:team,player_kind:kind,position:kind==='goalie'?'G':null};
    columns.forEach((field,i)=>{if(field)p[field]=value(field,row[i].html);});
    if(!Number.isSafeInteger(p.lg_user_id)||p.lg_user_id<=0)throw Error('Missing player identity');
    if(kind==='skater'&&(!['goals','assists','points'].every(k=>Number.isInteger(p[k])&&p[k]>=0)||p.points!==p.goals+p.assists))throw Error('Invalid skater scoring totals');
    const required=kind==='skater'?Object.values(SKATER):['saves','shots_against','goals_against','save_pct','gaa','toi_seconds'];
    if(required.some(k=>p[k]==null))throw Error('Missing required player statistics');
    if(kind==='goalie'){
     if(p.saves==null&&p.shots_against!=null&&p.goals_against!=null)p.saves=p.shots_against-p.goals_against;
     if(p.saves!=null&&p.shots_against!=null&&(p.saves<0||p.saves>p.shots_against))throw Error('Invalid goalie totals');
     if(p.save_pct!=null&&(p.save_pct<0||p.save_pct>1))throw Error('Invalid save percentage');
    }
    players.push(p);continue;
   }
   if(tableTeams.length===2&&row.length===3){const field=TEAM[key(row[0].html)];if(field)tableTeams.forEach((id,i)=>{teamStats[id]??={};teamStats[id][field]=value(field,row[i+1].html);});}
  }
  const periodHeader=table.rows.find(r=>r.some(c=>/^(1st|1|period 1)$/i.test(clean(c.html)))&&r.some(c=>/^(total|final)$/i.test(clean(c.html))));
  if(periodHeader){const labels=periodHeader.map(c=>clean(c.html));for(const row of table.rows){const id=row.flatMap(c=>links(c.html,'teamid')).map(x=>x.id).find(x=>sides.includes(x));if(id&&row.length===labels.length)periods.push({lg_team_id:id,periods:labels.slice(1).map((label,i)=>({label,goals:integer(row[i+1].html)}))});}}
 }
 if(!players.length)throw Error('Public player tables not found; layout requires validation');
 const seen=new Set();for(const p of players){const id=p.lg_user_id+'|'+p.player_kind;if(seen.has(id))throw Error('Duplicate player line');seen.add(id);}
 for(const [i,id] of sides.entries()){
  const skaters=players.filter(p=>p.lg_team_id===id&&p.player_kind==='skater'),goalies=players.filter(p=>p.lg_team_id===id&&p.player_kind==='goalie');
  if(skaters.length<5||!goalies.length)throw Error('Both teams require at least five skaters and one goalie for a complete sixes box score');
  const expected=i===0?game.away_score:game.home_score;
  if(skaters.reduce((n,p)=>n+p.goals,0)!==expected)throw Error('Player goals do not reconcile with the official final');
  if(!teamStats[id]||['goals','shots','possession_seconds'].some(k=>teamStats[id][k]==null))throw Error('Both teams require complete team statistics');
  if(teamStats[id].goals!==expected)throw Error('Team goals contradict the official final');
  const period=periods.filter(p=>p.lg_team_id===id);
  if(period.length!==1)throw Error('Both teams require one period-scoring row');
  const values=period[0].periods;
  const totals=values.filter(p=>/^(total|final)$/i.test(p.label)),regular=values.filter(p=>!/^(total|final)$/i.test(p.label));
  const periodKeys=regular.map(p=>p.label.toLowerCase().replace(/^period\s+/,'').replace(/^(1st|2nd|3rd)$/,x=>x[0]));
  if(!['1','2','3'].every(k=>periodKeys.includes(k))||new Set(periodKeys).size!==periodKeys.length)throw Error('Incomplete or duplicate period labels');
  if(totals.length!==1||totals[0].goals!==expected||regular.length<3||regular.some(p=>!Number.isInteger(p.goals)||p.goals<0)||regular.reduce((n,p)=>n+p.goals,0)!==expected)throw Error('Period scoring does not reconcile with the official final');
 }
 return {source_game_id:game.lg_game_id,lg_game_id:game.lg_game_id,season:game.season,week:game.week,game_at:game.game_at,away_lg_team_id:sides[0],home_lg_team_id:sides[1],away_score:game.away_score,home_score:game.home_score,team_stats:teamStats,period_scoring:periods,players};
}
