(function(){
'use strict';
const $=id=>document.getElementById(id),db=window.VVHLBackend?.db;let revision=0,allowed=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function access(){
 const turn=++revision;allowed=false;$('reviewWorkspace').hidden=true;$('reviewList').replaceChildren();
 if(!db){$('reviewAccess').textContent='Account connection unavailable.';return;}
 const result=await db.rpc('ecm_card_review_access');if(turn!==revision)return;
 allowed=!result.error&&result.data===true;
 $('reviewAccess').textContent=allowed?'Authorized artwork reviewer.':'Sign in with an authorized management account to review artwork.';
 $('reviewWorkspace').hidden=!allowed;if(allowed)load();
}
async function load(){
 if(!allowed)return;const turn=++revision;$('reviewList').replaceChildren();$('reviewStatus').textContent='Loading private submissions…';
 const result=await db.from('ecm_card_artwork_reviews').select('id,league,lg_user_id,player_kind,gamertag_snapshot,object_path,status,created_at,reviewed_at,review_note,preparation').eq('status',$('reviewFilter').value).order('created_at',{ascending:true}).limit(50);
 if(turn!==revision)return;
 if(result.error){$('reviewStatus').textContent='Could not load queue: '+result.error.message;return;}
 $('reviewStatus').textContent=result.data.length?result.data.length+' submissions shown (maximum 50). Images are private; preview links expire after 10 minutes.':'No submissions in this queue.';
 for(const row of result.data){
  const card=document.createElement('article');card.className='review-item';
  card.innerHTML='<div class="review-preview"></div><div><h2>'+esc(row.gamertag_snapshot)+'</h2><small>'+esc(row.league.toUpperCase())+' · '+esc(row.player_kind)+' · LG ID '+esc(row.lg_user_id)+'</small><p>'+esc(row.status.toUpperCase())+' · Submitted '+esc(new Date(row.created_at).toLocaleString())+'</p><label>Review note (required to reject)<textarea maxlength="500"></textarea></label><div class="review-buttons"></div><p role="status" class="decision-status"></p></div>';
  card.querySelector('textarea').value=row.review_note||'';
  const actions=card.querySelector('.review-buttons');
  if(['pending','approved'].includes(row.status)){
   for(const [label,edit] of [[row.status==='approved'?'Review placement / publish':'Review finished card',''],['Refine player cutout','cutout']]){
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.onclick=()=>{const query=new URLSearchParams({review:row.id,league:row.league,id:String(row.lg_user_id),kind:row.player_kind});
     if(edit)query.set('edit',edit);$('cardReviewFrame').src='player-cards.html?'+query;$('cardReviewDialog').showModal();};
    actions.append(button);
   }
  }
  for(const decision of ['pending','approved'].includes(row.status)?['rejected']:[]){
   const button=document.createElement('button');button.type='button';button.disabled=true;button.className=decision==='approved'?'approve':'reject';button.textContent=decision==='approved'?'Approve image':row.status==='approved'?'Revoke approval':'Reject image';
   button.addEventListener('click',async()=>{
    const note=card.querySelector('textarea').value.trim(),message=card.querySelector('.decision-status');
    if(decision==='rejected'&&note.length<3){message.textContent='Add a short reason before rejecting.';return;}
    actions.querySelectorAll('button').forEach(b=>b.disabled=true);
    const result=await db.rpc('ecm_card_artwork_review',{p_id:row.id,p_decision:decision,p_expected_status:row.status,p_note:note});
    if(result.error){message.textContent='Decision not saved: '+result.error.message;actions.querySelectorAll('button').forEach(b=>b.disabled=false);return;}
    card.remove();$('reviewStatus').textContent='Image '+decision+'. Decision recorded. Any publication for this image has been removed.';
   });actions.append(button);
  }
  $('reviewList').append(card);
  const signed=await db.storage.from('ecm-card-artwork-review').createSignedUrl(row.object_path,600);
  if(turn!==revision)return;
  if(signed.error){card.querySelector('.review-preview').textContent='Private preview unavailable. Refresh before approving.';actions.querySelectorAll('button').forEach(b=>b.disabled=true);}
  else{const img=document.createElement('img');img.alt='Submitted artwork for '+row.gamertag_snapshot;img.referrerPolicy='no-referrer';img.addEventListener('load',()=>actions.querySelectorAll('button').forEach(b=>b.disabled=false));const url=signed.data.signedUrl;img.src=window.ECMCutout?await window.ECMCutout.clean(url).catch(()=>url):url;img.addEventListener('error',()=>{actions.querySelectorAll('button').forEach(b=>b.disabled=true);card.querySelector('.decision-status').textContent='Image did not load. Refresh before reviewing.';});card.querySelector('.review-preview').append(img);}
 }
}
$('closeCardReview').addEventListener('click',()=>{$('cardReviewDialog').close();$('cardReviewFrame').src='about:blank';});
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===$('cardReviewFrame').contentWindow&&event.data?.type==='ecm-card-published'){load();}});
setInterval(()=>{if(allowed&&!document.hidden&&!$('cardReviewDialog').open&&![...document.querySelectorAll('.review-item textarea')].some(el=>el.value.trim()))load();},30000);
$('reviewFilter').addEventListener('change',load);$('reviewRefresh').addEventListener('click',access);
window.addEventListener('vvhl-auth-change',access);access();
})();
