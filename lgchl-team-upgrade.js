/* Manual 3D upgrade request for LGCHL standard team rooms. Never treats a request as paid. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const teamId=Number(params.get('team')??412);
const offer=$('roomUpgrade'),dialog=$('roomUpgradeDialog');
if(!offer||!dialog||!Number.isSafeInteger(teamId)||teamId<=0||teamId===412)return;
offer.hidden=false;
const teamName=()=>{
 const name=$('roomName')?.textContent.trim();
 return name&&name!=='Calgary Hitmen'&&name!=='Team not found'?name:'Team #'+teamId;
};
const message=()=>`Hi Elite Chel Media! We'd like to request the $5 CAD one-time 3D locker-room upgrade for ${teamName()} (LGCHL team ID ${teamId}). Please let us know how to pay by e-Transfer or PayPal and arrange activation. Our team room: ${location.origin}/lgchl-team.html?team=${teamId}`;
$('roomUpgradeOpen').addEventListener('click',()=>{
 $('roomUpgradeTeamName').textContent=teamName();
 $('roomUpgradeRequestText').value=message();
 $('roomUpgradeStatus').textContent='';
 dialog.showModal();
});
$('roomUpgradeClose').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
$('roomUpgradeCopy').addEventListener('click',async()=>{
 const field=$('roomUpgradeRequestText');
 try {
   if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
   await navigator.clipboard.writeText(field.value);
   $('roomUpgradeStatus').textContent='Request copied. Send it to Elite Chel Media in Discord.';
 } catch {
   field.focus();field.select();
   $('roomUpgradeStatus').textContent='Select and copy the message above, then send it in Discord.';
 }
});
})();
