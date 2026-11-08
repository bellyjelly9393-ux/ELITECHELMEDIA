/* Review uses the real renderer and calculated season data; publication stores appearance only. */
(()=>{'use strict';const id=new URLSearchParams(location.search).get('review');if(!id)return;
document.body.classList.add('card-review-mode');const robots=document.createElement('meta');robots.name='robots';robots.content='noindex,nofollow';document.head.append(robots);const panel=document.getElementById('reviewModeControls');panel.hidden=false;panel.innerHTML='<h2>Finished card review</h2><p id="reviewModeStatus" role="status">Sign in with your authorized manager account to load this private review.</p><div id="reviewModeEditor" hidden><p id="reviewPreparation"></p><label>Image version<select id="reviewImageSource"><option value="prepared">Prepared cutout</option><option value="original">Original upload</option></select></label><label>Scale<input id="reviewScale" type="range" min="50" max="200" value="100"></label><label>Horizontal<input id="reviewX" type="range" min="-150" max="150" value="0"></label><label>Vertical<input id="reviewY" type="range" min="-150" max="150" value="0"></label><button type="button" id="reviewFit">Fit player to card</button><label>Review note<textarea id="reviewPublishNote" maxlength="500"></textarea></label><p>Confirm the player identity, image rights, content and placement. Publishing makes this exact image and placement public; ratings always come from season stats.</p><button id="reviewPublish" type="button" disabled>Approve &amp; publish card</button></div>';
const $=s=>document.getElementById(s);let row,loading=false,loaded=false,source='',imageReady=false,updateTurn=0;
function appearance(){return {imageScale:Number($('reviewScale').value),imageX:Number($('reviewX').value),imageY:Number($('reviewY').value),background:row.submitted_layout.background||'arena',...window.ecmCardStudio.getEarnedStyle()};}
async function update(){const request=++updateTurn;imageReady=false;$('reviewPublish').disabled=true;if(!row)return;const db=window.ecmCardAccount.getClient(),selected=$('reviewImageSource').value;
 try{if(source!==selected){const signed=await db.storage.from('ecm-card-artwork-review').createSignedUrl(selected==='original'?row.original_path:row.object_path,600);if(signed.error)throw signed.error;const response=await fetch(signed.data.signedUrl,{referrerPolicy:'no-referrer'});if(!response.ok)throw Error('Private image unavailable');const blob=await response.blob();let data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});if(selected==='prepared')data=await window.ECMCutout.clean(data);if(request!==updateTurn)return;source=selected;row.previewData=data;}
 if(request!==updateTurn)return;window.ecmCardStudio.applyApprovedArtwork(row.previewData,appearance(),{force:true});await Promise.resolve();const rendered=await window.ECMStudioV2.generate();if(request!==updateTurn)return;if(!rendered)throw Error('Card preview did not finish rendering.');imageReady=true;$('reviewPublish').disabled=false;$('reviewModeStatus').textContent='Drag the player on the card to position them. Use Scale to resize.';
 }catch(e){$('reviewModeStatus').textContent=e.message;}}
async function load(){const db=window.ecmCardAccount?.getClient();if(loading||loaded||!db||!window.ecmCardAccount.getUser()||!window.ecmCardStudio.getSelected())return;loading=true;
 try{const access=await db.rpc('ecm_card_review_access');if(access.error||access.data!==true)throw Error('Authorized artwork reviewer required.');const result=await db.from('ecm_card_artwork_reviews').select('id,league,lg_user_id,player_kind,object_path,original_path,status,submitted_layout,preparation,publication_consent_at').eq('id',id).single();if(result.error)throw result.error;row=result.data;
 const p=window.ecmCardStudio.getSelected();if(row.league!==window.ecmCardStudio.getLeague()||String(row.lg_user_id)!==String(p.id)||row.player_kind!==p.kind)throw Error('Player identity does not match this submission.');if(!['pending','approved'].includes(row.status))throw Error('Submission is no longer available for approval.');if(!row.publication_consent_at)throw Error('This earlier private upload needs to be resubmitted with permission for public display.');
 loaded=true;$('reviewModeEditor').hidden=false;for(const [control,key] of [['reviewScale','imageScale'],['reviewX','imageX'],['reviewY','imageY']])$(control).value=row.submitted_layout[key]??(key==='imageScale'?100:key==='finish'?'ice':0);$('reviewPreparation').textContent=row.preparation==='original-fallback'?'Automatic cutout could not finish. Review the original; do not publish a poor result.':row.preparation==='legacy'?'Earlier upload. Review the image and placement carefully.':'Automatic preparation: '+row.preparation+'. Check equipment and stick edges before approval.';await update();
 }catch(e){$('reviewModeStatus').textContent=e.message;}finally{loading=false;}}
$('reviewFit').addEventListener('click',()=>{
 $('reviewScale').value=100;$('reviewX').value=0;$('reviewY').value=0;update();
});
const canvas=$('cardCanvas');let drag,frame;
canvas.style.touchAction='none';canvas.style.cursor='grab';
canvas.addEventListener('pointerdown',e=>{
 if(!imageReady||drag||e.button!==0||$('reviewX').disabled)return;
 const rect=canvas.getBoundingClientRect(),y=(e.clientY-rect.top)*canvas.height/rect.height;
 if(y<240||y>1280)return;
 drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:+$('reviewX').value,top:+$('reviewY').value,
  unitX:canvas.width/(3*rect.width),unitY:canvas.height/(3*rect.height)};
 canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';
});
canvas.addEventListener('pointermove',e=>{
 if(!drag||drag.id!==e.pointerId)return;
 $('reviewX').value=Math.round(drag.left+(e.clientX-drag.x)*drag.unitX);
 $('reviewY').value=Math.round(drag.top+(e.clientY-drag.y)*drag.unitY);
 $('reviewPublish').disabled=true;imageReady=false;
 cancelAnimationFrame(frame);frame=requestAnimationFrame(update);
});
canvas.addEventListener('lostpointercapture',()=>{if(!drag)return;drag=null;canvas.style.cursor='grab';cancelAnimationFrame(frame);update();});
for(const id of ['reviewScale','reviewX','reviewY'])$(id).addEventListener('change',update);$('reviewImageSource').addEventListener('change',update);
$('reviewPublish').addEventListener('click',async()=>{if(drag||!imageReady||!row)return;$('reviewPublish').disabled=true;document.querySelectorAll('#reviewModeEditor input,#reviewModeEditor select,#reviewModeEditor textarea').forEach(el=>el.disabled=true);const result=await window.ecmCardAccount.getClient().rpc('ecm_card_artwork_publish',{p_id:row.id,p_expected_status:row.status,p_layout:appearance(),p_source:$('reviewImageSource').value,p_note:$('reviewPublishNote').value.trim()});if(result.error){document.querySelectorAll('#reviewModeEditor input,#reviewModeEditor select,#reviewModeEditor textarea').forEach(el=>el.disabled=false);$('reviewModeStatus').textContent='Not published: '+result.error.message;$('reviewPublish').disabled=false;return;}row.status='approved';$('reviewModeStatus').textContent='Approved and published. This card is now available from the player’s locker and profile.';if(window.parent!==window)window.parent.postMessage({type:'ecm-card-published',id:row.id},location.origin);});
window.addEventListener('ecm:card-auth',load);window.addEventListener('ecm:card-selected',()=>{if(loaded){loaded=false;row=null;source='';}load();});load();})();
