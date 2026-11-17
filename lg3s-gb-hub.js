/* GB Hockey Hub pilot. Public feed list is intentionally read-only: manual approval via JSON config.
 * Local additions are never uploaded. No Twitch API secrets or VOD capture in this module. */
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'ecm.lg3s.gb-hub.local.v1';
const CONFIG_URL = 'assets/lg3s/gb-hub-config.json';
const LIMIT = 4;
const state = {config:null, approved:[], local:[], selected:[], view:'featured', activeKey:null, loaded:new Set()};
const setText = (id,value) => { const el=$(id); if(el) el.textContent=String(value??''); };

function parseStream(value) {
  try {
    const url = new URL(String(value||'').trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const h=url.hostname.toLowerCase().replace(/^www\./,'');
    const p=url.pathname.split('/').filter(Boolean);
    if (h==='twitch.tv' || h==='m.twitch.tv') {
      if (p.length!==1 || !/^[a-z0-9_]{3,25}$/i.test(p[0]) || /^(videos|directory|search|settings)$/i.test(p[0])) return null;
      const id=p[0].toLowerCase();
      return {provider:'twitch',id,url:'https://www.twitch.tv/'+id};
    }
    if (h==='youtube.com' || h==='m.youtube.com' || h==='youtu.be' || h==='youtube-nocookie.com') {
      const id=h==='youtu.be'?p[0]:url.searchParams.get('v') || (['live','embed'].includes(p[0])?p[1]:null);
      if (!/^[A-Za-z0-9_-]{11}$/.test(id||'')) return null;
      return {provider:'youtube',id,url:'https://www.youtube.com/watch?v='+id};
    }
  } catch (_) {}
  return null;
}
function goodLink(value,fallback) {
  try {
    const u=new URL(String(value||''),location.href);
    if (u.protocol==='https:' || (u.protocol==='http:' && u.hostname==='localhost')) return u.href;
    if (u.origin===location.origin) return u.href;
  } catch(_){}
  return fallback;
}
function setLink(id,value,fallback) {
  const el=$(id); if(el)el.href=goodLink(value,fallback);
}
function readLocal() {
  try {
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
    if(!Array.isArray(raw)) return;
    state.local=raw.slice(0,8).map((s) => {
      const stream=parseStream(s.url);
      if(!stream) return null;
      return {key:'local:'+stream.provider+':'+stream.id,title:String(s.title||stream.id).slice(0,40),role:String(s.role||'Player POV').slice(0,25),local:true,...stream};
    }).filter(Boolean);
  } catch(_) {}
}
function storeLocal() {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state.local.map(({url,title,role})=>({url,title,role})))); } catch(_){}
}
function allStreams(){return [...state.approved,...state.local];}
function streamByKey(key){return allStreams().find(s=>s.key===key);}
function formatTime(value) {
  if(!value)return 'Next verified matchup will appear here';
  const d=new Date(value);if(!Number.isFinite(d.getTime()))return 'Next verified matchup will appear here';
  return new Intl.DateTimeFormat('en-CA',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Toronto',timeZoneName:'short'}).format(d);
}
function approvedFromConfig(config) {
  const entries=Array.isArray(config.streams)?config.streams:[];
  const seen=new Set();const result=[];
  entries.forEach(s=>{
    if(s?.approved!==true || s?.consent!==true)return;
    const parsed=parseStream(s.url);if(!parsed)return;
    const key='approved:'+parsed.provider+':'+parsed.id;
    if(seen.has(key))return;seen.add(key);
    result.push({key,...parsed,title:String(s.displayName||parsed.id).slice(0,40),role:String(s.role||'Player POV').slice(0,25),local:false});
  });
  return result.slice(0,8);
}
function refreshEditorial(config) {
  const status=['pregame','live','final'].includes(config.status)?config.status:'pregame';
  setText('gameState',status==='live'?'LIVE · CONFIRMED':status==='final'?'FINAL':'PREGAME');
  $('gameState').className='state'+(status==='live'?' live':status==='final'?' final':'');
  const opponent=String(config.opponent||'TO BE CONFIRMED').slice(0,40);
  setText('opponentName',opponent);
  setText('opponentFlag',config.opponentFlag||'🏒');
  setText('matchDate',formatTime(config.startsAt));
  setLink('matchSource',config.sourceUrl,'lg3s-media.html');
  setText('previewLead',config.preview?.lead||'Pregame analysis is being prepared.');
  setText('formWatch',config.preview?.formWatch||'Awaiting verified results');
  setText('keyMatchup',config.preview?.keyMatchup||'Awaiting opponent');
  setLink('previewLink',config.preview?.url,'lg3s-media.html');
  const verified=config.postgame?.verified===true;
  setText('postgameLead',config.postgame?.lead||'Awaiting official final and ECM recap.');
  setText('finalScore',verified&&config.postgame?.score?config.postgame.score:'Awaiting official final');
  setText('reportState',verified?'Verified results available':'Pending');
  setLink('postgameLink',config.postgame?.url,'lg3s-media.html');
  const n=state.approved.length;
  setText('streamCount',n+' approved public '+(n===1?'feed':'feeds'));
  setText('statusMessage',status==='live'?'Game status marked live by ECM. Individual channel availability may differ.':status==='final'?'Game marked final. Consult official box score for confirmation.':'Pregame desk ready · stream lineup awaiting approved submissions.');
}
function newNode(tag,className,text) {
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined)el.textContent=text;
  return el;
}
function embedUrl(s) {
  if(s.provider==='youtube')return 'https://www.youtube-nocookie.com/embed/'+encodeURIComponent(s.id)+'?playsinline=1&autoplay=0&mute=1';
  if(s.provider==='twitch'){
    const parent=location.hostname;
    if(!parent) return null;
    return 'https://player.twitch.tv/?channel='+encodeURIComponent(s.id)+'&parent='+encodeURIComponent(parent)+'&muted=true&autoplay=false';
  }
  return null;
}
function openFullMultiview(s) {
  const href='multiview.html?hub=1&league=lg3s'+(s?'&add='+encodeURIComponent(s.url):'');
  return href;
}
function feedTile(s) {
  const tile=newNode('article','feed-tile');
  const head=newNode('div','feed-head');const titlebox=newNode('div');
  titlebox.append(newNode('strong','',s.title),newNode('small','',s.role+' · '+(s.local?'LOCAL TEST · NOT PUBLIC':'APPROVED LISTING · LIVE UNVERIFIED')));
  const focus=newNode('button','','Feature');focus.type='button';focus.addEventListener('click',()=>{state.activeKey=s.key;state.view='featured';state.loaded.clear();updateViewButtons();render();});
  head.append(titlebox,focus);tile.append(head);
  const video=newNode('div','feed-video');
  const narrow=window.matchMedia('(max-width: 440px)').matches;
  if(state.loaded.has(s.key)&&!narrow){
    const src=embedUrl(s);
    if(src){
      const iframe=document.createElement('iframe');iframe.src=src;iframe.title=s.title+' live stream';iframe.loading='lazy';iframe.allow='autoplay; fullscreen; picture-in-picture';iframe.allowFullscreen=true;
      video.append(iframe);
    }
  }
  if(!video.childElementCount){
    const fallback=newNode('div','fallback');
    fallback.append(newNode('strong','',narrow?'Mobile playback':'Player ready'));
    fallback.append(newNode('span','',narrow?'Open on the streaming platform. Twitch needs at least 400px of player width.':'Open the player when you are ready. Twitch and YouTube provide the video.'));
    if(!narrow){
      const load=newNode('button','button secondary','LOAD PLAYER');load.type='button';load.addEventListener('click',()=>{state.loaded.add(s.key);render();});fallback.append(load);
    }
    const link=newNode('a','','WATCH ON '+s.provider.toUpperCase());link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';fallback.append(link);
    video.append(fallback);
  }
  tile.append(video);
  const actions=newNode('div','feed-actions');
  const full=newNode('a','','Add to full 8-stream desk ↗');full.href=openFullMultiview(s);
  const external=newNode('a','','Open stream ↗');external.href=s.url;external.target='_blank';external.rel='noopener noreferrer';
  actions.append(full,external);
  if(s.local){
    const remove=newNode('button','','Remove local test');remove.type='button';
    remove.addEventListener('click',()=>{state.local=state.local.filter(x=>x.key!==s.key);state.selected=state.selected.filter(x=>x!==s.key);state.loaded.delete(s.key);storeLocal();render();});
    actions.append(remove);
  }
  tile.append(actions);
  return tile;
}
function updateViewButtons(){
  const featured=state.view==='featured';
  $('viewFeatured').classList.toggle('active',featured);$('viewFeatured').setAttribute('aria-pressed',String(featured));
  $('viewGrid').classList.toggle('active',!featured);$('viewGrid').setAttribute('aria-pressed',String(!featured));
}
function render() {
  const feeds=allStreams(),grid=$('playerGrid'),picker=$('streamPicker');
  grid.replaceChildren();picker.replaceChildren();
  setText('feedCounter',feeds.length);
  if(!feeds.length){
    const empty=newNode('div','empty');empty.append(newNode('strong','','FEEDS AWAITING REGISTRATION'),newNode('p','','Add authorized public streams below. No feeds are automatically assumed to be live.'));
    grid.append(empty);setText('watchNotice','No public channels registered yet. Connect a public stream below to test locally.');return;
  }
  if(!streamByKey(state.activeKey))state.activeKey=feeds[0].key;
  if(!state.selected.length || !state.selected.some(k=>streamByKey(k)))state.selected=feeds.slice(0,LIMIT).map(s=>s.key);
  for(const s of feeds){
    const label=newNode('label','pick');const input=document.createElement('input');input.type='checkbox';input.checked=state.selected.includes(s.key);
    input.addEventListener('change',()=>{
      if(input.checked){if(state.selected.length>=LIMIT){input.checked=false;setText('watchNotice','Four feeds is the GB pilot limit. Remove one first.');return;}state.selected.push(s.key);}
      else {state.selected=state.selected.filter(k=>k!==s.key);}
      if(state.selected.length&&!state.selected.includes(state.activeKey))state.activeKey=state.selected[0];
      state.loaded.clear();render();
    });
    label.append(input,newNode('span','',s.title+' · '+s.role+(s.local?' (local)':'')));picker.append(label);
  }
  const visible=state.view==='grid'?state.selected.map(streamByKey).filter(Boolean):[streamByKey(state.activeKey)].filter(Boolean);
  grid.className='player-grid'+(state.view==='grid'?' grid':'');
  if(!visible.length)grid.append(newNode('div','empty','Select a stream above.'));
  else visible.forEach(s=>grid.append(feedTile(s)));
  setText('watchNotice',state.approved.length+' public channel(s) approved · '+state.local.length+' local test(s). Published does not mean currently live. Multiple feeds may have different delays.');
}
function readForm() {
  const name=$('playerName').value.trim(),raw=$('streamUrl').value.trim(),role=$('streamRole').value;
  const parsed=parseStream(raw);
  if(!name || name.length>40)return {error:'Enter your gamertag or public display name.'};
  if(!parsed)return {error:'Use a public Twitch channel URL or a YouTube watch/live link.'};
  if(!$('streamConsent').checked)return {error:'Confirm that you are authorized to share this public stream.'};
  return {name,role,stream:parsed};
}
function submitLocal(e) {
  e.preventDefault();const v=readForm();
  if(v.error){setText('formStatus',v.error);return;}
  const key='local:'+v.stream.provider+':'+v.stream.id;
  if(!state.local.some(x=>x.key===key))state.local.unshift({key,...v.stream,title:v.name,role:v.role,local:true});
  state.local=state.local.slice(0,8);
  if(!state.selected.includes(key)){if(state.selected.length>=LIMIT)state.selected.pop();state.selected.unshift(key);}
  state.activeKey=key;state.view='featured';state.loaded.clear();storeLocal();updateViewButtons();render();
  setText('formStatus','Added to your browser only. To request a public listing, use Copy Listing Request and send it to ECM.');
  $('watch').scrollIntoView({behavior:'smooth',block:'start'});
}
async function copyRequest() {
  const v=readForm();if(v.error){setText('formStatus',v.error);return;}
  const message='ECM Hockey Hub · Great Britain streamer listing request\nGamertag: '+v.name+'\nPerspective: '+v.role+'\nPublic channel: '+v.stream.url+'\nConsent: I am authorized to submit this stream for public linking/embedding only.\nGame: Great Britain LG3s · fixture to be confirmed.\nRequested action: ECM admin verify and approve before public listing.';
  try{
    if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(message);
    setText('formStatus','Listing request copied. Send it to your ECM administrator for approval. Nothing was submitted automatically.');
  }catch(_){
    const field=document.createElement('textarea');field.value=message;field.readOnly=true;field.rows=7;field.style.width='100%';
    const out=$('formStatus');out.replaceChildren(field);field.select();out.append(newNode('span','','Copy the text above and send it to your ECM administrator.'));
  }
}
async function init() {
  readLocal();
  $('viewFeatured').addEventListener('click',()=>{state.view='featured';state.loaded.clear();updateViewButtons();render();});
  $('viewGrid').addEventListener('click',()=>{state.view='grid';state.loaded.clear();updateViewButtons();render();});
  $('streamForm').addEventListener('submit',submitLocal);
  $('copyRequest').addEventListener('click',copyRequest);
  try {
    const result=await fetch(CONFIG_URL,{cache:'no-store'});
    if(!result.ok)throw new Error('Config unavailable: '+result.status);
    const config=await result.json();
    if(config?.teamId!==1446)throw new Error('Invalid team configuration');
    state.config=config;state.approved=approvedFromConfig(config);
    refreshEditorial(config);
  } catch(err) {
    console.error('Great Britain Hockey Hub configuration failed',err);
    setText('statusMessage','Matchup configuration unavailable. Showing local testing only; fixtures and live status cannot be verified.');
  }
  render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
