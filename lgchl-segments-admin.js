/* Season 55 playoff editorial manager.
   Existing VVHL auth + explicit editor assignment. No admin role is trusted from client
   state alone: database RLS is final authority for every write. */
(()=>{'use strict';
const C=window.ECMPlayoffSegments,backend=window.VVHLBackend;if(!C||!backend)return;
const $=id=>document.getElementById(id),db=backend.db;
const state={data:null,rows:[],polls:[],editor:false,user:null,ready:false};
const label=x=>String(x??'').trim();
const setStatus=t=>{$('psaStatus').textContent=t};
const setPollStatus=t=>{$('psaPollNotice').textContent=t};
const ids=()=>state.data?Object.values(state.data.teams).sort((a,b)=>a.name.localeCompare(b.name)):[];
const series=()=>state.data?C.allSeries(state.data):[];
function selectedKey(){return{kind:$('psaKind').value,target_id:Number($('psaTarget').value)||null};}
function selectedRow(){const k=selectedKey();return state.rows.find(r=>r.kind===k.kind&&Number(r.target_id)===k.target_id);}
function publishedMomentFromForm(){
 const id=Number($('psaMomentGame').value)||null,verified=$('psaMomentVerified').checked;
 if(!id)return{};
 return{game_id:id,period:label($('psaMomentPeriod').value),clock:label($('psaMomentClock').value),
  url:label($('psaMomentUrl').value),description:label($('psaMomentDescription').value),verified};
}
function fillEditor(){
 const k=selectedKey(),r=selectedRow();
 $('psaLabel').value=r?.label||'';$('psaReason').value=r?.reason||'';$('psaBody').value=r?.body||'';
 $('psaFeatured').checked=!!r?.featured;$('psaPublished').checked=!!r?.published;
 $('psaPlayers').value=JSON.stringify(r?.players||[],null,2);
 const m=r?.moment||{};$('psaMomentGame').value=m.game_id||'';$('psaMomentPeriod').value=m.period||'';
 $('psaMomentClock').value=m.clock||'';$('psaMomentUrl').value=m.url||'';
 $('psaMomentDescription').value=m.description||'';$('psaMomentVerified').checked=!!m.verified;
 $('psaLabel').disabled=k.kind!=='pressure';
 $('psaFeatured').disabled=k.kind!=='rivalry';
 setStatus(r?'Loaded '+(r.published?'published editorial':'unpublished draft')+' · last updated '+(r.updated_at||'unknown'):'No existing editorial. This is an unpublished draft.');
}
function setTargets(){
 const kind=$('psaKind').value,options=kind==='rivalry'?series().map(s=>({id:s.id,name:s.league+' · '+s.roundTitle+' · '+C.slotTeams(s).map(id=>state.data.teams[id]?.name||'TBD').join(' vs ')})):
 ids().map(t=>({id:t.id,name:t.league+' · '+t.name}));
 const sel=$('psaTarget'),previous=sel.value;
 sel.innerHTML='<option value="">Choose a verified '+(kind==='rivalry'?'series':'team')+'</option>'+
  options.map(x=>'<option value="'+Number(x.id)+'">'+C.escape(x.name)+'</option>').join('');
 if(options.some(x=>String(x.id)===previous))sel.value=previous;
 fillEditor();
}
function validHttps(url){
 try{const u=new URL(url);return u.protocol==='https:'&&['www.leaguegaming.com','leaguegaming.com','clips.twitch.tv','www.twitch.tv','twitch.tv','www.youtube.com','youtube.com','youtu.be'].includes(u.hostname)}catch{return false}
}
function validatedPayload(draftOnly=false){
 const {kind,target_id}=selectedKey();if(!target_id)throw Error('Choose a verified team or series.');
 const targetValid=kind==='rivalry'?series().some(s=>Number(s.id)===target_id):ids().some(t=>Number(t.id)===target_id);
 if(!targetValid)throw Error('Selected target is not in the official playoff bracket.');
 const pressureLabel=kind==='pressure'?label($('psaLabel').value)||null:null;
 const reason=label($('psaReason').value),body=label($('psaBody').value);
 const published=draftOnly?false:$('psaPublished').checked;
 if(published&&kind==='pressure'&&(!pressureLabel||reason.length<8))throw Error('Publishing a pressure label requires an editorial category and explanation.');
 let players;
 try{players=JSON.parse($('psaPlayers').value||'[]');}catch{throw Error('Player spotlights must be a valid JSON array.')}
 if(!Array.isArray(players)||players.length>8||players.some(p=>!C.validId(p.player_id)||!C.validId(p.team_id)))throw Error('Player spotlight entries require valid player and team IDs (maximum eight).');
 let moment=publishedMomentFromForm();
 if(moment.game_id){
  if(kind!=='rivalry')throw Error('Verified VOD moments belong to a Rivalry Report.');
  if(moment.verified){
   const slot=series().find(s=>Number(s.id)===target_id);
   if(!C.finalGames(slot).some(g=>Number(g.id)===moment.game_id))throw Error('The VOD moment game must be a verified final in this series.');
   if(!moment.description||!validHttps(moment.url))throw Error('Verified moments require an evidence URL and description.');
  }else moment={};
 }
 return{season:55,kind,target_id,label:pressureLabel,reason:reason.slice(0,500),body:body.slice(0,7000),
  players:players.map(p=>({player_id:Number(p.player_id),team_id:Number(p.team_id),role:label(p.role).slice(0,80),note:label(p.note).slice(0,220)})),
  moment,featured:kind==='rivalry'&&$('psaFeatured').checked,published};
}
async function reloadEditors(){
 const {data,error}=await db.from('ecm_s55_segment_editorial').select('*').eq('season',55).order('updated_at',{ascending:false});
 if(error)throw error;state.rows=data||[];fillEditor();
}
async function save(draftOnly){
 if(!state.editor)return setStatus('No editorial permission. Database writes are blocked.');
 try{
  const payload=validatedPayload(draftOnly);setStatus('Saving through authenticated, RLS-protected editor…');
  const {error}=await db.from('ecm_s55_segment_editorial').upsert(payload,{onConflict:'season,kind,target_id'});
  if(error)throw error;await reloadEditors();setStatus(draftOnly?'Saved unpublished draft.':'Editorial saved. Published content only is visible to visitors.');
 }catch(err){setStatus('Not saved: '+(err.message||'Unknown error'))}
}
async function remove(){
 if(!state.editor)return;const row=selectedRow();if(!row){setStatus('No existing editorial for this target.');return;}
 if(!confirm('Remove this editorial? Verified game scores remain unchanged.'))return;
 const {error}=await db.from('ecm_s55_segment_editorial').delete().eq('id',row.id);
 if(error)setStatus('Removal failed: '+error.message);else{await reloadEditors();setStatus('Editorial removed; official results untouched.')}
}
function fillPollTargets(){
 const select=$('psaPollSeries');
 select.innerHTML='<option value="">Choose verified series</option>'+series().map(s=>'<option value="'+Number(s.id)+'">'+C.escape(s.league+' · '+C.slotTeams(s).map(id=>state.data.teams[id]?.name||'TBD').join(' vs '))+'</option>').join('');
}
async function loadPolls(){
 const {data,error}=await db.from('ecm_s55_rivalry_polls').select('*').eq('season',55).order('updated_at',{ascending:false});
 if(error){setPollStatus('Poll backend not configured: '+error.message);return;}
 state.polls=data||[];
 const selected=$('psaPollSelect').value;
 $('psaPollSelect').innerHTML='<option value="">Create a new poll</option>'+state.polls.map(p=>'<option value="'+C.escape(p.id)+'">'+C.escape(p.question)+' · '+p.status+'</option>').join('');
 if(state.polls.some(p=>p.id===selected))$('psaPollSelect').value=selected;
 fillPoll();
}
function fillPoll(){
 const p=state.polls.find(x=>x.id===$('psaPollSelect').value);
 if(p){$('psaPollSeries').value=p.series_id;$('psaPollQuestion').value=p.question;$('psaPollOptions').value=(p.options||[]).join('\n');$('psaPollStatus').value=p.status;$('psaPollPublished').checked=p.published;}
 else{$('psaPollQuestion').value='';$('psaPollOptions').value='';$('psaPollStatus').value='closed';$('psaPollPublished').checked=false;}
}
async function savePoll(){
 if(!state.editor)return;
 const opts=$('psaPollOptions').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const seriesId=Number($('psaPollSeries').value);
 if(!series().some(s=>Number(s.id)===seriesId))return setPollStatus('Choose a verified series.');
 if(opts.length<2||opts.length>5||opts.some(x=>x.length>150)||new Set(opts.map(x=>x.toLowerCase())).size!==opts.length)return setPollStatus('Use two to five different answer choices, each under 150 characters.');
 const question=label($('psaPollQuestion').value);if(question.length<8)return setPollStatus('The question must be at least eight characters.');
 const id=$('psaPollSelect').value;
 const payload={season:55,series_id:seriesId,question,options:opts,status:$('psaPollStatus').value,published:$('psaPollPublished').checked};
 if(id)payload.id=id;else payload.created_by=state.user?.id;
 const {error}=await db.from('ecm_s55_rivalry_polls').upsert(payload);
 if(error)return setPollStatus('Poll not saved: '+error.message);
 setPollStatus('Poll saved. Voting is separate from the Predictor Challenge.');await loadPolls();
}
async function closePoll(){
 const id=$('psaPollSelect').value;if(!id)return setPollStatus('Choose a poll to close.');
 const {error}=await db.from('ecm_s55_rivalry_polls').update({status:'closed'}).eq('id',id);
 if(error)setPollStatus('Could not close poll: '+error.message);else{setPollStatus('Poll closed.');await loadPolls();}
}
async function resetPoll(){
 const id=$('psaPollSelect').value;if(!id)return setPollStatus('Choose a poll to reset.');
 if(!confirm('Delete all votes in this poll and CLOSE it? This cannot be undone.'))return;
 const {error}=await db.rpc('ecm_s55_editor_reset_poll',{p_poll_id:id});
 if(error)setPollStatus('Reset denied: '+error.message);else{setPollStatus('Votes reset and poll closed.');await loadPolls();}
}
async function fetchBracket(){
 for(const u of ['/api/lgchl-playoffs','assets/lgchl/playoffs/s55.json']){
  try{const r=await fetch(u,{cache:'no-cache',signal:AbortSignal.timeout(12000)});if(!r.ok)continue;const j=await r.json();if(j.teams&&j.leagues&&j.matchups){state.data=j;return true;}}catch{}
 }
 return false;
}
let checkNo=0;
async function checkAccess(s=backend.state){
 const current=++checkNo;
 state.user=s?.user||null;state.editor=false;state.ready=false;
 $('psaEditor').hidden=true;$('psaPollEditor').hidden=true;
 if(!s?.user){$('psaPermission').textContent='Sign in through the existing EliteChel account panel. No editor access yet.';return;}
 if(!window.VVHLManagementGuard?.hasAccess(s)){$('psaPermission').textContent='This account does not have general management access.';return;}
 const {data,error}=await db.from('ecm_s55_segment_editors').select('user_id').eq('user_id',s.user.id).maybeSingle();
 if(current!==checkNo)return;
 if(error){$('psaPermission').textContent='Editorial database not enabled yet. This preview is read-only until approved: '+error.message;return;}
 if(!data){$('psaPermission').textContent='Signed in, but not assigned as a Season 55 playoff editor. Explicit database permission is required.';return;}
 state.editor=true;$('psaPermission').textContent='AUTHORIZED EDITOR · Save and publish actions enforced by database RLS.';
 if(!await fetchBracket()){$('psaPermission').textContent='Official bracket unavailable. Editing is blocked to prevent incorrect team/series assignments.';return;}
 $('psaEditor').hidden=false;$('psaPollEditor').hidden=false;state.ready=true;
 setTargets();fillPollTargets();await Promise.allSettled([reloadEditors(),loadPolls()]);
}
$('psaKind').addEventListener('change',setTargets);$('psaTarget').addEventListener('change',fillEditor);
$('psaSaveDraft').addEventListener('click',()=>save(true));$('psaSave').addEventListener('click',()=>save(false));$('psaDelete').addEventListener('click',remove);
$('psaPollSelect').addEventListener('change',fillPoll);$('psaPollSave').addEventListener('click',savePoll);
$('psaPollClose').addEventListener('click',closePoll);$('psaPollReset').addEventListener('click',resetPoll);
window.addEventListener('vvhl-auth-change',e=>checkAccess(e.detail));
checkAccess(backend.state);
})();