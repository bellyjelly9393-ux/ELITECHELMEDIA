/* Explicit, private submission only. The renderer never loads shared artwork. */
(function(){
'use strict';
const button=document.getElementById('submitArtwork'),status=document.getElementById('artworkReviewStatus'),rights=document.getElementById('artworkRights');
if(!button)return;
let busy=false,revision=0;
function identity(){const api=window.ecmCardStudio,p=api?.getSelected();return p?{league:api.getLeague(),id:String(p.id),kind:p.kind}:null;}
async function refresh(){
 const turn=++revision,account=window.ecmCardAccount,who=account?.getUser(),p=identity();
 button.disabled=busy||!who;
 if(busy)return;
 if(!who){status.textContent='Sign in with Discord to submit artwork.';return;}
 if(!p){status.textContent='Choose a verified player first.';return;}
 const result=await account.getClient().from('ecm_card_artwork_reviews').select('status,review_note,created_at').eq('user_id',who.id).eq('league',p.league).eq('lg_user_id',p.id).eq('player_kind',p.kind).neq('status','withdrawn').order('created_at',{ascending:false}).limit(1);
 if(turn!==revision)return;
 status.textContent=result.error?'Review status unavailable. Try again later.':result.data?.[0]?'Latest submission: '+result.data[0].status+'. '+(result.data[0].review_note||'')+' Public artwork display is not enabled.':'No artwork submitted for this player.';
}
button.addEventListener('click',async()=>{
 if(busy)return;
 const account=window.ecmCardAccount,who=account?.getUser(),p=identity(),art=window.ecmCardStudio?.getArtwork();
 if(!who||!p||!rights.checked||!art){status.textContent='Sign in, choose a player, upload a photo and confirm image permission first.';return;}
 const db=account.getClient(),id=crypto.randomUUID();let started=false,submitted=false;
 busy=true;++revision;button.disabled=true;status.textContent='Submitting privately for manager review…';
 try{
  if(!/^data:image\/png;base64,/.test(art))throw Error('Upload a PNG, JPG or WebP through the photo picker first.');
  const bytes=Uint8Array.from(atob(art.split(',')[1]),c=>c.charCodeAt(0));
  if(!bytes.length||bytes.length>8388608)throw Error('Review image must be smaller than 8 MB.');
  const draft=await db.rpc('ecm_card_artwork_start',{p_id:id,p_league:p.league,p_lg_user_id:Number(p.id),p_kind:p.kind,p_confirm_rights:true});
  if(draft.error)throw draft.error;
  started=true;const row=Array.isArray(draft.data)?draft.data[0]:draft.data;
  const upload=await db.storage.from('ecm-card-artwork-review').upload(row.object_path,new Blob([bytes],{type:'image/png'}),{contentType:'image/png',upsert:false});
  if(upload.error)throw upload.error;
  const result=await db.rpc('ecm_card_artwork_submit',{p_id:id});
  if(result.error)throw result.error;
  submitted=true;rights.checked=false;
  status.textContent='Submitted privately. Waiting for manager approval. Public artwork display is not enabled.';
 }catch(error){
  if(started&&!submitted)await db.rpc('ecm_card_artwork_withdraw',{p_id:id}).catch(()=>{});
  status.textContent='Artwork was not submitted: '+error.message;
 }finally{busy=false;button.disabled=!account.getUser();if(JSON.stringify(p)!==JSON.stringify(identity()))refresh();}
});
window.addEventListener('ecm:card-auth',refresh);window.addEventListener('ecm:card-selected',()=>{rights.checked=false;refresh();});
refresh();
})();
