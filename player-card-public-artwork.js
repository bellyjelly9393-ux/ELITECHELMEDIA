/* Read approved publications only. Local personal edits remain private. */
(()=>{'use strict';let turn=0;const api=window.ecmCardStudio;
async function load(){const request=++turn,p=api.getSelected();if(!p||new URLSearchParams(location.search).has('review'))return;const league=api.getLeague(),db=window.ecmCardAccount?.getClient();if(!db)return;
 try{const result=await db.from('ecm_card_publications').select('object_path,layout,published_at').eq('league',league).eq('lg_user_id',p.id).eq('player_kind',p.kind).limit(1);if(result.error||request!==turn||!result.data?.length)return;const published=result.data[0],signed=await db.storage.from('ecm-card-artwork-review').createSignedUrl(published.object_path,300);if(signed.error||request!==turn)return;
 const image=await fetch(signed.data.signedUrl,{referrerPolicy:'no-referrer'});if(!image.ok)throw Error('Approved image unavailable');const blob=await image.blob(),data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});if(request!==turn)return;
 if(api.applyApprovedArtwork(data,published.layout)){await window.ECMStudioV2?.generate();document.getElementById('savedSnapshotStatus').textContent='Manager-approved artwork loaded. Season stats and overall update automatically. Personal edits are private.';}
 }catch(error){console.warn('Approved card artwork unavailable:',error.message);}}
window.addEventListener('ecm:card-selected',load);load();})();
