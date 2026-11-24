const czechiaTemplates = require('./_czechia-rehearsal-graphics.cjs');
const SUPABASE = 'https://lrgllzvwgvqagcpiyvfd.supabase.co';
const API_KEY = 'sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
const MANAGEMENT_ROLES = new Set(['owner', 'gm', 'agm']);
const SITE_ROLES = new Set(['admin', 'commissioner']);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !/^Bearer [\w.-]+$/.test(authorization)) {
    return res.status(401).end();
  }

  try {
    const headers = { apikey: API_KEY, authorization };
    const signal = AbortSignal.timeout(6000);
    const get = path => fetch(SUPABASE + path, { headers, signal });
    const auth = await get('/auth/v1/user');
    if ([401, 403].includes(auth.status)) return res.status(401).end();
    if (!auth.ok) return res.status(503).end();
    const user = await auth.json();
    if (user.is_anonymous || !/^[0-9a-f-]{36}$/i.test(user.id)) return res.status(403).end();

    const id = encodeURIComponent(user.id);
    const [profileResponse, membershipResponse] = await Promise.all([
      get('/rest/v1/profiles?select=role&id=eq.' + id),
      get('/rest/v1/team_memberships?select=role,active&user_id=eq.' + id),
    ]);
    if (!profileResponse.ok || !membershipResponse.ok) return res.status(503).end();
    const [profiles, memberships] = await Promise.all([profileResponse.json(), membershipResponse.json()]);
    const role = record => String(record.role || '').toLowerCase();
    if (!profiles.some(p => SITE_ROLES.has(role(p))) &&
        !memberships.some(m => m.active !== false && MANAGEMENT_ROLES.has(role(m)))) {
      return res.status(403).end();
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).end(WORKSPACE.replace('<!-- CZECHIA_TEMPLATES -->', '<script type="application/json" id="czechiaTemplates">' + JSON.stringify(czechiaTemplates) + '</script>').replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="ecm-account" content="' + id + '">'));
  } catch {
    return res.status(503).end();
  }
};

const WORKSPACE = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>ECM Broadcast Control</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0a1018;color:#edf3fa;font:16px system-ui,sans-serif}header{background:#0f1723;border-bottom:1px solid #273747}header>div,main{max-width:1320px;margin:auto;padding:20px 28px}header>div,.row,nav,.actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}header strong{font-size:20px}header label{margin-left:auto}small,.muted{color:#a4b4c7}small{font-size:13px}.brand{color:#69ddfb;font-weight:900;letter-spacing:.12em}nav{margin:14px 0 20px;border-bottom:1px solid #273747;padding-bottom:12px}button,input,select,textarea{font:inherit;color:inherit;border:1px solid #405468;border-radius:7px;background:#101b29;padding:9px 11px}button{cursor:pointer;font-weight:650}button:hover,button[aria-selected=true]{border-color:#69ddfb;color:#8fe6ff}.primary{background:#79def7;color:#061821;border-color:#79def7}.primary:hover{color:#061821;background:#a6eafc}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #79def7;outline-offset:2px}h1{font-size:clamp(30px,5vw,48px);margin:12px 0}h2{font-size:20px;margin:0 0 14px}h3{font-size:16px}p{line-height:1.5}.grid{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(285px,1fr);gap:16px}.card,.stats>div{background:#111b29;border:1px solid #29394a;border-radius:12px;padding:18px;min-width:0}.stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:18px}.stats>div{padding:10px 12px;overflow-wrap:anywhere}.stats small{display:block;margin-bottom:4px}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.field{display:grid;gap:5px;font-size:14px;margin:0 0 10px}.field input,.field select,.field textarea{width:100%;min-width:0}.wide{grid-column:1/-1}textarea{resize:vertical;min-height:72px}.actions{margin:10px 0}.preview{aspect-ratio:16/9;position:relative;overflow:hidden;border-radius:8px;background:#08121e;border:1px solid #34485d;display:grid;place-items:center;text-align:center}.preview iframe,.preview video,.preview img{width:100%;height:100%;border:0;object-fit:contain;position:absolute;inset:0}.ice{position:absolute;inset:16% 9%;border-radius:17%;border:2px solid #54819866;background:linear-gradient(90deg,transparent 28%,#3675bb55 28% 29%,transparent 29% 49.5%,#d970795a 49.5% 50.5%,transparent 50.5% 71%,#3675bb55 71% 72%,transparent 72%);transform:perspective(500px) rotateX(24deg)}.ice::after{content:'';position:absolute;left:44%;top:32%;width:12%;aspect-ratio:1;border:1px solid #6489ac;border-radius:50%}.preview .caption{position:relative;background:#091321eb;padding:12px 20px;border-radius:8px}.checks label{display:flex;gap:9px;margin:12px 0;align-items:center}.checks input{accent-color:#79def7;width:18px;height:18px}.stack{display:grid;gap:10px}details{border-top:1px solid #29394a;padding:12px 0}summary{cursor:pointer}meter{width:100%;height:22px}.pill{color:#ffd28a}.pill[data-ok=true]{color:#91efc3}#notice{min-height:21px;color:#8fe6ff;overflow-wrap:anywhere}.cue{font-size:20px;font-weight:700}@media(max-width:850px){.grid{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){header>div,main{padding:14px}.fields{grid-template-columns:1fr}header label{margin:0}.stats>div:last-child{grid-column:1/-1}}

.hero{position:relative;overflow:hidden;isolation:isolate;background:linear-gradient(115deg,#162743,#0b1625 55%,#3f1b31);border:1px solid #3c5069;border-top:3px solid #79def7;border-radius:12px;padding:18px 22px;margin:12px 0;box-shadow:0 14px 32px #03080f65}.hero::before{content:'';position:absolute;inset:0;z-index:-1;background:repeating-linear-gradient(117deg,transparent 0 28px,#c2e9ff0c 29px 30px);mask-image:linear-gradient(90deg,transparent 0%,black)}.hero h1{margin:0}.hero .match-name{font-weight:850;letter-spacing:.025em}.matchup{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:10px;align-items:center;margin:12px 0}.score-side{background:linear-gradient(150deg,#173453,#101c2b 75%);border:1px solid #3c5571;border-left:4px solid #79def7;border-radius:9px;padding:12px;overflow-wrap:anywhere;min-width:0;box-shadow:0 6px 14px #02050a60}.score-side.away{background:linear-gradient(220deg,#462138,#171b2a 75%);border-left:1px solid #65455b;border-right:4px solid #f68baf;text-align:right}.score-side strong,.score-side small{display:block}.score-side img{width:80px;height:68px;object-fit:contain}.faceoff{font-size:14px;color:#c0d8ea;font-weight:850}.jerseys{display:flex;gap:5px;flex-wrap:wrap}.away .jerseys{justify-content:flex-end}.compact{margin-top:10px}.camera{width:100%;max-height:180px;background:#08121e;border-radius:8px}.caster-feed iframe{pointer-events:auto}.uniform{display:inline-grid;place-items:center;width:75px;height:65px;font-size:12px;font-weight:900;clip-path:polygon(24% 5%,40% 0,50% 9%,60% 0,76% 5%,100% 32%,85% 56%,76% 48%,76% 100%,24% 100%,24% 48%,15% 56%,0 32%);background:linear-gradient(180deg,var(--base) 0 62%,var(--trim) 63% 70%,#fff 71% 75%,var(--base) 76%);text-shadow:0 1px 4px #000;color:white}
</style>
<header><div><span class="brand">ECM</span><strong>Broadcast Control</strong><small>Private draft</small><label>Setup <select id="team"></select></label></div></header>
<main><div class="hero"><h1 id="title"></h1><div id="match-title" class="match-name"></div></div><div id="stats" class="stats"></div><nav role="tablist" aria-label="Workspace"></nav><div id="panel"></div><p id="notice" role="status"></p></main>
<!-- CZECHIA_TEMPLATES -->
<script>
'use strict';
const teams={cz:'Czechia',gb:'Great Britain',cal:'Calgary Hitmen'};
const sections=['Setup','Matchup','Lineup & cards','Graphics','Commentary','Troubleshoot'];
const catalog={'Czechia':'🇨🇿','Great Britain':'🇬🇧','Calgary Hitmen':'🇨🇦','Canada':'🇨🇦','USA':'🇺🇸','Finland':'🇫🇮','Sweden':'🇸🇪','Germany':'🇩🇪','Japan':'🇯🇵','Italy':'🇮🇹','Switzerland':'🇨🇭','Latvia':'🇱🇻','Poland':'🇵🇱','Slovakia':'🇸🇰','Kazakhstan':'🇰🇿'};
const uniforms={'Czechia':['#b81c36','#193f77'],'Great Britain':['#153676','#cb233d'],'Calgary Hitmen':['#161923','#ad7d42'],'Canada':['#c31028','#191d28'],'USA':['#123975','#e32340'],'Finland':['#2467a6','#a4c3e8'],'Sweden':['#ffc82e','#1a60b0'],'Germany':['#202022','#f3bc3b'],'Japan':['#a71535','#1d2235'],'Italy':['#2279bb','#27a16f'],'Switzerland':['#d32632','#202128'],'Latvia':['#821f37','#ddc2c7'],'Poland':['#da2849','#8d152f'],'Slovakia':['#2554a5','#e6344a'],'Kazakhstan':['#139db4','#f8d543']};
const blankPage=document.documentElement.cloneNode(true);
blankPage.querySelector('meta[name=ecm-account]')?.remove();
blankPage.querySelector('#czechiaTemplates')?.remove();
const casterMode=!!document.querySelector('meta[name=ecm-caster]')||new URLSearchParams(location.search).has('caster');
const casterKey='ecm-obs-caster-v1';
const statuses=['Needs verification','Working','Wrong scene','Stale source','Needs refresh','Blocked'];
const presets=['Gameplay','Carbon rink','3D hockey cards','Starting soon','Intermission','Finals / special event','Custom'];
const checks=['Base and output resolution set to 1920 × 1080','FPS set to 60','Browser source dimensions set to 1920 × 1080','Control audio via OBS enabled','Audio levels and scene switching verified in OBS'];
const fixes={
'Needs verification':'Load the intended source in OBS and confirm the scene, feed, and audio.',
'Working':'Run a quick scene switch and audio check before going live.',
'Wrong scene':'Compare the nation and scene with the browser-source URL, then test the intended source.',
'Stale source':'Use Refresh cache of current page in OBS Browser Source properties.',
'Needs refresh':'Reload the source and confirm the visible layout and current lineup.',
'Blocked':'Open the source in a signed-in browser and record the first failure.'};
const issues={
'Wrong rink scene':['Select the intended setup and Carbon rink preset. Compare its URL with OBS Browser Source properties.','Load the source and check the rink, jersey and roster labels. Record what displayed.'],
'Stale browser source':['Confirm the browser-source URL points to the intended version.','In OBS Browser Source properties, select Refresh cache of current page and check the stage again.'],
'Failed redirect':['Open the intended URL directly in a signed-in browser. Record the destination or exact error.','Check whether the correct URL requires a session that OBS does not have. Test the authorized source before switching the live scene.'],
'Main site shows the wrong setup':['Compare the address, selected nation and scene with the intended workspace preset.','Use the intended source directly in OBS. Record the public route separately for review before any site change.']};
const account=document.querySelector('meta[name=ecm-account]')?.content;
const key='ecm-obs-draft-v1'+(account?':'+account:'');
let state={team:'cz',teams:{}};
try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.teams&&teams[saved.team])state=saved;}catch{}
let tab='Setup',mic=null,audio=null,micTimer=null,preview=null,shotRead=0,micRequest=0,camera=null,cameraRequest=0;
let casterPacket=null;
try{casterPacket=JSON.parse(localStorage.getItem(casterKey));}catch{}
const by=id=>document.getElementById(id);
const tag=(name,content,cls)=>{const node=document.createElement(name);if(content!==undefined)node.textContent=content;if(cls)node.className=cls;return node;};
function data(){return state.teams[state.team]??=( {scene:'Gameplay',status:statuses[0],issue:Object.keys(issues)[0],sources:{},players:{},checks:{},audioChecks:{},cue:'Stand by'} );}
function source(){const d=data();return d.sources[d.scene]??={kind:'Browser page'};}
function roles(){return state.team==='cal'?['LW','C','RW','LD','RD','G']:['LW','C','RW','G'];}
function message(text){by('notice').textContent=text;}
function save(){try{localStorage.setItem(key,JSON.stringify(state));return true;}catch{message('Browser storage could not save this change. It remains available until this page closes.');return false;}}
function field(holder,label,model,key,opts={}){
 const wrap=tag('label',undefined,'field'+(opts.wide?' wide':''));wrap.append(tag('span',label));
 const input=tag(opts.options?'select':opts.area?'textarea':'input');
 if(opts.options)for(const item of opts.options)input.add(new Option(item,item));
 if(opts.type)input.type=opts.type;
 if(opts.placeholder)input.placeholder=opts.placeholder;
 input.value=model[key]??'';
 input.addEventListener('input',()=>{model[key]=input.value;if(opts.verify)data().status=statuses[0]; save();summary();});
 if(opts.redraw)input.addEventListener('change',render);
 wrap.append(input);holder.append(wrap);return input;
}
function button(holder,label,click,primary=false){const b=tag('button',label,primary?'primary':'');b.type='button';b.onclick=click;holder.append(b);return b;}
function card(holder,title){const c=tag('section',undefined,'card');c.append(tag('h2',title));holder.append(c);return c;}
function block(holder,cls){const el=tag('div',undefined,cls);holder.append(el);return el;}
function checkList(holder,labels,store){const list=block(holder,'checks');labels.forEach(label=>{const l=tag('label');const i=tag('input');i.type='checkbox';i.checked=!!store[label];i.onchange=()=>{store[label]=i.checked;save();};l.append(i,tag('span',label));list.append(l);});}
function summary(){
 const d=data(),s=d.sources[d.scene]??{};
 by('title').textContent=teams[state.team];
 const m=d.matchup;
 by('match-title').textContent=m?.name?flag(teams[state.team])+' '+teams[state.team]+' vs '+flag(m.name)+' '+m.name:'';
 const lineup=roles().map(role=>d.players[role]?.label?role+' '+d.players[role].label:'').filter(Boolean).join(' · ');
 const verified=d.verified?d.verified.status+' · '+d.verified.scene+(d.verified.source?' / '+d.verified.source:'')+' · '+new Date(d.verified.at).toLocaleString('en-CA',{timeZone:'America/Toronto'}):'Pending OBS check';
 by('stats').replaceChildren();
 for(const [label,value] of [['Active setup',teams[state.team]],['Lineup',lineup||'Unassigned'],['Scene / source',d.scene+' · '+(s.name||'Source unset')],['Last verified',verified],['Smallest next fix',d.fix||fixes[d.status]]]){
  const tile=block(by('stats'),'');tile.append(tag('small',label),tag('span',value));
 }
}
function getUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function displayPreview(holder){
 holder.replaceChildren();holder.append(tag('div',undefined,'ice'));
 if(!preview){const caption=tag('div',undefined,'caption');caption.append(tag('strong','Preview idle'),tag('br'),tag('small','Choose which source to load below.'));holder.append(caption);return;}
 const el=tag(preview.kind==='Direct video'?'video':preview.kind==='Image'?'img':'iframe');
 if(el.tagName==='IFRAME'){el.title='Selected broadcast source';el.referrerPolicy='no-referrer';const url=new URL(preview.url);const carbon=/^\\/(?:lg3s-gb|czechia)\\/arena\\//.test(url.pathname);
  el.sandbox='allow-scripts allow-presentation'+(url.origin!==window.origin||carbon?' allow-same-origin':'');el.allow='autoplay; fullscreen';}
 if(el.tagName==='VIDEO'){el.controls=true;el.autoplay=true;el.muted=true;el.playsInline=true;}
 if(el.tagName==='IMG'){el.alt='Selected broadcast graphic';el.referrerPolicy='no-referrer';}
 el.src=preview.url;holder.append(el);
}
function setup(panel,d){
 const g=block(panel,'grid'),left=card(g,'Live preview'),right=card(g,'Scene & source');
 const viewport=block(left,'preview');displayPreview(viewport);
 const controls=block(left,'actions');
 const load=(value,kind)=>{const url=getUrl(value);if(!url){message('Enter a valid HTTP or HTTPS URL for this source.');return;}preview={url,kind};displayPreview(viewport);message('Preview requested. Confirm playback and audio independently in OBS.');};
 const s=source();
 button(controls,'Preview OBS source',()=>load(s.url,'Browser page'),true);
 button(controls,'Preview stream feed',()=>load(s.feed,s.kind));
 button(controls,'Unload',()=>{preview=null;displayPreview(viewport);message('Preview unloaded.');});
 left.append(tag('small','Feeds load only when requested. Some providers block embedded previews or require their own embed URL.','muted'));
 field(right,'Scene preset',d,'scene',{options:presets,redraw:true,verify:true});
 field(right,'Source name',s,'name',{verify:true});
 field(right,'OBS browser-source URL',s,'url',{type:'password',verify:true});
 field(right,'Private or custom feed URL',s,'feed',{type:'password',verify:true});
 field(right,'Feed type',s,'kind',{options:['Browser page','Direct video','Image'],verify:true});
 button(right,'Copy OBS URL',async()=>{if(!getUrl(s.url)){message('Enter a valid OBS URL first.');return;}try{await navigator.clipboard.writeText(s.url.trim());message('OBS URL copied.');}catch{message('Clipboard unavailable. Use the reveal control to copy the URL manually.');}});
 const urls=right.querySelectorAll('input[type=password]');
 let shown=false;button(right,'Reveal URLs',e=>{shown=!shown;urls.forEach(input=>input.type=shown?'text':'password'); e.target.textContent=shown?'Hide URLs':'Reveal URLs';});
 const checklist=card(panel,'OBS preflight');checkList(checklist,checks,d.checks);
 const footer=card(panel,'Pregame matchup');
 const match=d.matchup;
 if(match?.statSource)footer.append(tag('small',match.statSource));
 const away=match?.opponents['team:'+match.name]||{};
 matchupCards(footer,{...withArtwork(teams[state.team],d.graphics),name:teams[state.team],players:d.players},{...withArtwork(match?.name,away),name:match?.name},roles(),true);
 button(footer,'Edit matchup',()=>{tab='Matchup';render();});
}
function lineup(panel,d){
 const listing=card(panel,'Roster and player-card mapping');
 listing.append(tag('small','Use verified aliases to match rostered players to their jersey and 3D card.'));
 const grid=block(listing,'fields');
 for(const role of roles()){
  const player=d.players[role]??={};const c=tag('details');c.open=!player.label;grid.append(c);
  const heading=tag('summary',role+(player.label?' · '+player.label:''));c.append(heading);
  const f=block(c,'fields');
  const label=field(f,'Rostered player label',player,'label',{verify:true});label.onchange=()=>{heading.textContent=role+(player.label?' · '+player.label:'');};
  field(f,'Verified alias',player,'alias',{verify:true});field(f,'Jersey number',player,'number',{verify:true});field(f,'Jersey asset reference',player,'jersey',{verify:true});field(f,'3D hockey card title',player,'cardTitle',{verify:true});field(f,'3D hockey card asset reference',player,'card',{verify:true});
 }
}
function graphics(panel,d){
 const c=card(panel,'Scene graphics'),f=block(c,'fields');
 const art=d.graphics??={};
 for(const [label,k] of [['Carbon 3D rink scene URL','rink'],['Home jersey asset','home'],['Away jersey asset','away'],['Finals graphic','finals'],['Special-event graphic','special'],['Event title','event']]) field(f,label,art,k,{verify:true});
 const a=block(c,'actions');
 for(const [label,k] of [['Preview finals graphic','finals'],['Preview special-event graphic','special']]){
  button(a,label,()=>{const url=getUrl(art[k]);if(!url){message('Enter a valid graphic URL.');return;}preview={url,kind:'Image'};displayPreview(graphicPreview);});
 }
 const graphicPreview=block(c,'preview');displayPreview(graphicPreview);
 if(state.team==='cz'){
  const templates=JSON.parse(by('czechiaTemplates')?.textContent||'{}');
  for(const [label,url] of Object.entries(templates))button(a,label+' template',()=>{preview={url,kind:'Image'};displayPreview(graphicPreview);message('Static graphic template.');});
 }
 button(a,'Use rink URL in Carbon preset',()=>{if(!getUrl(art.rink)){message('Enter a valid Carbon rink scene URL first.');return;}d.scene='Carbon rink';source().url=art.rink;d.status=statuses[0];save();tab='Setup';render();message('Carbon URL set in this workspace preset.');});
}
function stopMic(){micRequest++;clearInterval(micTimer);micTimer=null;mic?.getTracks().forEach(track=>track.stop());mic=null;audio?.close().catch(()=>{});audio=null;}

function flag(name){return catalog[name]||'🏒';}
const leagueJerseys = {'Canada':341,'USA':342,'Sweden':343,'Switzerland':404,'Kazakhstan':531,'Germany':532,'Japan':591,'Italy':822,'Slovakia':1079,'Latvia':1439,'Poland':1444};
const worldFlags = {'Canada':'ca','USA':'us','Sweden':'se','Switzerland':'ch','Germany':'de','Great Britain':'gb','Czechia':'cz','Finland':'fi'};
const leagueFlags = {'Kazakhstan':'kz','Japan':'jp','Italy':'it','Slovakia':'sk','Latvia':'lv','Poland':'pl'};

function teamArtwork(name) {
 const asset = path => path && new URL(path, window.origin).href;
 const world = worldFlags[name];
 const league = leagueFlags[name];
 const jerseyId = leagueJerseys[name];
 return {
  logo: asset(name === 'Calgary Hitmen' ? '/assets/lgchl/room-360/hitmen-crest-vector.svg' : world ? '/assets/lg3s-world/flags/'+world+'.svg' : league ? '/assets/lg3s/flags/'+league+'.png' : ''),
  home: asset(name === 'Calgary Hitmen' ? '/assets/war-room/jersey-home.webp' : name === 'Czechia' ? '/assets/lg3s/jerseys/czechia-home.webp' : jerseyId ? '/assets/lg3s/jerseys/'+jerseyId+'.webp' : ''),
  away: asset(name === 'Calgary Hitmen' ? '/assets/war-room/jersey-away.webp' : ''),
 };
}
function withArtwork(name, edits) {
 return {...edits,...Object.fromEntries(Object.entries(teamArtwork(name)).map(([key,value])=>[key,edits?.[key]||value]))};
}
function statLine(p){
 const numbers=[['GP','gp'],['G','g'],['A','a'],['PTS','pts'],['SV%','sv']].filter(([,k])=>p[k]!==undefined&&p[k]!=='');
 return numbers.map(([name,k])=>name+' '+p[k]).join(' · ')||'Stats pending';
}
function artImage(holder,value,alt){const url=getUrl(value);if(!url)return;const image=tag('img');image.src=url;image.alt=alt;image.referrerPolicy='no-referrer';holder.append(image);}
function jersey(holder,team,side,showArt){
 const asset=showArt&&getUrl(team[side]);
 if(asset){artImage(holder,asset,team.name+' '+side+' jersey');return;}
 if(!team.name)return;
 const [first,second]=uniforms[team.name]||['#253b55','#a1bad3'];
 const j=tag('span',side==='home'?'HOME':'AWAY','uniform');
 j.title=team.name+' '+side+' concept jersey';
 j.style.setProperty('--base',side==='home'?first:'#e4eaf5');
 j.style.setProperty('--trim',side==='home'?second:first);
 if(side==='away'){j.style.color='#0a1727';j.style.textShadow='none';}
 holder.append(j);
}
function matchupCards(parent,home,away,positions,showArt){
 const band=block(parent,'matchup');
 const branding=(team,side)=>{const t=block(band,'score-side '+side);t.append(tag('strong',flag(team.name)+' '+(team.name||'Opponent pending')));const art=block(t,'jerseys');if(showArt)artImage(art,team.logo,'Team logo');jersey(art,team,'home',showArt);jersey(art,team,'away',showArt);};
 branding(home,'home');band.append(tag('div','VS','faceoff'));branding(away,'away');
 for(const position of positions){
  const pair=block(parent,'matchup');
  const player=(p,side)=>{const t=block(pair,'score-side '+side);t.append(tag('strong',p.label||'Unassigned'),tag('small',statLine(p)));};
  player(home.players?.[position]||{},'home');pair.append(tag('div',position,'faceoff'));player(away.players?.[position]||{},'away');
 }
}
function matchup(panel,d){
 const c=card(panel,'Head-to-head');
 const match=d.matchup??={name:'',opponents:{}};
 const opp=match.opponents['team:'+match.name]??={players:{}};
 const f=block(c,'fields');
 const choice=field(f,'Opponent team name',match,'name');choice.setAttribute('list','opponent-teams');choice.onchange=render;
 const names=tag('datalist');names.id='opponent-teams';for(const name of Object.keys(catalog))names.append(new Option(name));c.append(names);
 const home=d.graphics??={};
 const row=block(c,'fields');
 for(const [label,k] of [['logo / flag art URL','logo'],['home jersey URL','home'],['away jersey URL','away']]){
  field(row,teams[state.team]+' '+label,home,k,{placeholder:teamArtwork(teams[state.team])[k]?'Using team artwork':''});field(row,'Opponent '+label,opp,k,{placeholder:teamArtwork(match.name)[k]?'Using team artwork':''});
 }
 const previewArea=block(c,'compact');
 const paint=art=>{previewArea.replaceChildren();matchupCards(previewArea,{...withArtwork(teams[state.team],home),name:teams[state.team],players:d.players},{...withArtwork(match.name,opp),name:match.name},roles(),art);};
 const repaint=()=>paint(true);
 paint(true);
 row.addEventListener('change',repaint);
 const e=card(panel,'Matchup stats');field(e,'Stats source / sample period',match,'statSource');
 const points=[['Games played','gp'],['Goals','g'],['Assists','a'],['Points','pts']];
 for(const position of roles()){
  const pair=tag('details');pair.append(tag('summary',position+' vs '+position));e.append(pair);
  const editor=block(pair,'fields');
  const homePlayer=d.players[position]??={};const awayPlayer=opp.players[position]??={};
  for(const [label,k] of [['Player label','label'],...(position==='G'?[['Games played','gp'],['Save percentage','sv']]:points)]){
   field(editor,'Home '+label,homePlayer,k).addEventListener('input',repaint);
   field(editor,'Opponent '+label,awayPlayer,k).addEventListener('input',repaint);
  }
 }
}
function packetFor(d){
 const match=d.matchup;const opp=match?.opponents['team:'+match.name]||{};
 const positions=roles();
 const trimTeam=(name,art,players)=>({name,...withArtwork(name,art),players:Object.fromEntries(positions.map(pos=>[pos,Object.fromEntries(['label','gp','g','a','pts','sv'].map(k=>[k,players?.[pos]?.[k]??'']))]))});
 return {format:1,positions,home:trimTeam(teams[state.team],d.graphics,d.players),away:trimTeam(match?.name||'',opp,opp.players),statSource:match?.statSource,booth:Object.fromEntries(['pbp','colour','producer','game','room','notes'].map(k=>[k,d.booth?.[k]??''])),cue:d.cue,feed:d.booth?.casterFeed||source().feed,kind:d.booth?.casterFeed?'Browser page':source().kind};
}
function download(name,content,type){
 const url=URL.createObjectURL(new Blob([content],{type}));
 const link=tag('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function casterPage(){
 const original=blankPage.cloneNode(true);
 const marker=document.createElement('meta');
 marker.name='ecm-caster';marker.content='true';original.querySelector('head').append(marker);
 return '<!doctype html>'+original.outerHTML;
}
function downloadCaster(){
 download('ecm-caster-booth.html',casterPage(),'text/html');
 message('Caster page downloaded. Send it privately with the caster brief.');
}
function previewCaster(){
 const url=URL.createObjectURL(new Blob([casterPage()],{type:'text/html'}));
 window.open(url,'_blank','noopener,noreferrer');
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function downloadPacket(d){
 const packet=packetFor(d);
 download('ecm-caster-brief.json',JSON.stringify(packet,null,2),'application/json');
 message('Caster brief downloaded. It may include private links and matchup labels. Share it only with your casters.');
}
function stopCamera(){cameraRequest++;camera?.getTracks().forEach(track=>track.stop());camera=null;}
function cameraControls(holder){
 const v=tag('video',undefined,'camera');v.autoplay=true;v.muted=true;v.playsInline=true;v.hidden=true;holder.append(v);
 const a=block(holder,'actions');
 button(a,'Test optional camera',async()=>{stopCamera();v.hidden=true;const request=cameraRequest;try{const stream=await navigator.mediaDevices.getUserMedia({video:true});if(request!==cameraRequest||!v.isConnected){stream.getTracks().forEach(t=>t.stop());return;}camera=stream;v.srcObject=stream;v.hidden=false;}catch{if(request===cameraRequest)message('Camera unavailable. Check this browser’s permission and camera device.');}});
 button(a,'Stop camera',()=>{stopCamera();v.srcObject=null;v.hidden=true;});
 holder.append(tag('small','Camera test is local. Join your voice room to share camera, or give the producer your approved camera-return URL.'));
}
function renderCaster(){
 stopMic();stopCamera();preview=null;message('');
 document.querySelector('header label').hidden=true;by('stats').hidden=true;by('stats').style.display='none';document.querySelector('nav').hidden=true;document.querySelector('nav').style.display='none';
 by('title').textContent='Caster booth';by('match-title').textContent=casterPacket?.home?.name?'On the call · '+casterPacket.home.name+' vs '+(casterPacket.away?.name||'Opponent pending'):'';
 const panel=by('panel');panel.replaceChildren();
 const top=card(panel,'Join the broadcast');
 const upload=tag('input');upload.type='file';upload.accept='.json,application/json';const l=tag('label','Load caster brief','field');l.append(upload);top.append(l);
 upload.onchange=async()=>{try{const item=upload.files[0];if(!item)return;if(item.size>100000)throw Error();const next=JSON.parse(await item.text());if(next.format!==1||typeof next.home?.name!=='string'||!Array.isArray(next.positions))throw Error();casterPacket=next;try{localStorage.setItem(casterKey,JSON.stringify(next));}catch{}renderCaster();}catch{message('Choose a valid caster brief exported from Broadcast Control.');}};
 if(!casterPacket){top.append(tag('small','Ask your producer for the private caster brief. Open it here, then join the voice room using your computer headset.'));return;}
 const packet=casterPacket,b=packet.booth||{};
 const hero=block(top,'actions');
 button(hero,'Join private voice room',()=>{const url=getUrl(b.room);if(url)window.open(url,'_blank','noopener,noreferrer');else message('The producer needs to provide a voice room URL.');},true);
 button(hero,'Clear caster brief',()=>{casterPacket=null;try{localStorage.removeItem(casterKey);}catch{}renderCaster();});
 const g=block(panel,'grid'),stage=card(g,'Game feed'),desk=card(g,'On-air rundown');
 const view=block(stage,'preview caster-feed');displayPreview(view);
 button(stage,'Load game feed',()=>{const url=getUrl(packet.feed);if(!url){message('No playable feed was included in the caster brief.');return;}preview={url,kind:packet.kind};displayPreview(view);});
 button(stage,'Unload feed',()=>{preview=null;displayPreview(view);});
 for(const [k,label] of [['game','Game'],['pbp','Play-by-play'],['colour','Colour'],['producer','Producer']])if(b[k])desk.append(tag('p',label+' · '+b[k]));
 if(b.notes)desk.append(tag('p',b.notes));
 desk.append(tag('p','Opening cue · '+(packet.cue||'Stand by')),tag('small','Use the private voice room for live producer cues.'));
 const quick=block(desk,'actions');button(quick,'Headset check',()=>{by('caster-audio').scrollIntoView({behavior:'smooth'});});
 cameraControls(desk);
 const cards=card(panel,'Matchup cards');if(packet.statSource)cards.append(tag('small',packet.statSource));matchupCards(cards,packet.home,packet.away||{},packet.positions.filter(x=>['LW','C','RW','LD','RD','G'].includes(x)),true);
 const audioCard=card(panel,'Headset & mic');audioCard.id='caster-audio';audioCard.append(tag('p','On the caster computer, select your connected headset as the input and output in the voice room. If your headset is paired only with Xbox, use a compatible computer connection or a second headset for the room.'));
 micControls(audioCard);
}
function commentary(panel,d){
 const g=block(panel,'grid'),c=card(g,'Commentary booth'),a=card(g,'Audio check');
 const booth=d.booth??={};const f=block(c,'fields');
 field(f,'Play-by-play',booth,'pbp');field(f,'Colour commentator',booth,'colour');field(f,'Producer / observer',booth,'producer');field(f,'Game / matchup',booth,'game');
 field(f,'Private voice room URL',booth,'room',{type:'password',wide:true});
 field(f,'Caster game feed URL',booth,'casterFeed',{type:'password',wide:true});
 field(f,'Optional OBS camera-return URL',booth,'cameraReturn',{type:'password',wide:true});
 button(c,'Open voice room',()=>{const url=getUrl(booth.room);if(url)window.open(url,'_blank','noopener,noreferrer');else message('Enter a valid voice room URL.');});
 field(c,'Opening read / talking points',booth,'notes',{area:true});
 field(c,'Producer cue',d,'cue',{options:['Stand by','Open mics','Toss to intermission','Back in 30 seconds','Postgame','Wrap'],redraw:true});
 c.append(tag('div',d.cue,'cue'));
 const actions=block(c,'actions');
 button(actions,'Preview caster view',previewCaster,true);
 button(actions,'Download caster page',downloadCaster);
 button(actions,'Download caster brief',()=>downloadPacket(d));
 button(actions,'Copy OBS camera URL',async()=>{const url=getUrl(booth.cameraReturn);if(!url){message('Enter an approved camera-return URL first.');return;}try{await navigator.clipboard.writeText(url);message('Camera URL copied. Add it as an OBS browser source.');}catch{message('Clipboard unavailable in this browser.');}});
 c.append(tag('small','For a caster on another computer, send the caster page and brief privately. They open the page, import the brief, and join the voice room. Keep live cues in the voice room. Share a separate camera-return source only when the caster opts in.'));
 micControls(a);
 checkList(a,['Local microphone checked','Remote caster heard in OBS','Headphones on and echo checked','Game and caster levels balanced','Private cue channel confirmed'],d.audioChecks);
}
function micControls(a){
 const meter=tag('meter');meter.max=1;meter.value=0;meter.setAttribute('aria-label','Microphone level');a.append(meter);
 const buttons=block(a,'actions');
 const start=button(buttons,'Test microphone',async()=>{
  if(!navigator.mediaDevices?.getUserMedia){message('Microphone access requires a secure browser context.');return;}
  start.disabled=true;
  const request=++micRequest;
  let input;
  try{
   input=await navigator.mediaDevices.getUserMedia({audio:true});
   if(!meter.isConnected||request!==micRequest){input.getTracks().forEach(t=>t.stop());return;}
   mic=input;audio=new AudioContext();await audio.resume();
   if(!meter.isConnected||mic!==input)return;
   const analyser=audio.createAnalyser(),samples=new Float32Array(analyser.fftSize);
   audio.createMediaStreamSource(mic).connect(analyser);
   micTimer=setInterval(()=>{analyser.getFloatTimeDomainData(samples);meter.value=Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length);},80);
   message('Local mic meter active. Speak to check the input.');
  }catch{if(meter.isConnected&&request===micRequest){stopMic();message('Mic unavailable. Check browser permission and your input device.');}}
  finally{start.disabled=false;}
 });
 button(buttons,'Stop mic test',()=>{stopMic();meter.value=0;message('Mic test stopped.');});
 a.append(tag('small','The meter checks this device only. Route the caster voice room into OBS for the broadcast.'));
}
function troubleshoot(panel,d){
 const g=block(panel,'grid'),c=card(g,'Troubleshooting'),a=card(g,'Verification log');
 field(c,'Symptom',d,'issue',{options:Object.keys(issues),redraw:true});
 const list=tag('ol');for(const step of issues[d.issue])list.append(tag('li',step));c.append(list);
 field(c,'Current status',d,'status',{options:statuses});field(c,'Smallest next fix',d,'fix');
 field(a,'Observed behavior',d,'observed',{area:true});field(a,'Notes',d,'notes',{area:true});
 const label=tag('label','Screenshot evidence','field'),file=tag('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';label.append(file);a.append(label);
 function displayShot(){a.querySelector('.evidence')?.remove();if(d.shot){const img=tag('img',undefined,'evidence');img.src=d.shot;img.alt='Saved troubleshooting screenshot';img.style.maxWidth='100%';a.append(img);}}
 file.onchange=()=>{const item=file.files[0];if(!item)return;if(!['image/png','image/jpeg','image/webp'].includes(item.type)||item.size>1000000){message('Use a PNG, JPEG or WebP screenshot under 1 MB.');return;}const read=new FileReader(),id=++shotRead;read.onload=()=>{if(id!==shotRead)return;d.shot=read.result;if(save()&&file.isConnected)message('Screenshot stored in this browser.');if(file.isConnected)displayShot();};read.onerror=()=>message('Screenshot could not be read.');read.readAsDataURL(item);};
 const buttons=block(a,'actions');
 button(buttons,'Record OBS check',()=>{d.verified={status:d.status,scene:d.scene,source:d.sources[d.scene]?.name,at:new Date().toISOString()};if(save())message('OBS check recorded for '+teams[state.team]+'.');summary();},true);
 button(buttons,'Remove screenshot',()=>{shotRead++;delete d.shot;save();file.value='';displayShot();});
 displayShot();
}
function render(){
 stopMic();stopCamera();preview=null;message('');summary();
 const nav=document.querySelector('nav');nav.replaceChildren();
 for(const section of sections){const b=button(nav,section,()=>{tab=section;render();document.querySelector('[aria-selected=true]').focus();});b.setAttribute('role','tab');b.setAttribute('aria-selected',String(section===tab));b.id='tab-'+sections.indexOf(section);b.setAttribute('aria-controls','panel');}
 const panel=by('panel');panel.replaceChildren();panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','tab-'+sections.indexOf(tab));[setup,matchup,lineup,graphics,commentary,troubleshoot][sections.indexOf(tab)](panel,data());
}
for(const [id,name] of Object.entries(teams))by('team').add(new Option(name,id));
by('team').value=state.team;by('team').onchange=e=>{state.team=e.target.value;save();render();};
window.addEventListener('pagehide',()=>{stopMic();stopCamera();});
if(casterMode)renderCaster();else render();
</script></html>
`;
