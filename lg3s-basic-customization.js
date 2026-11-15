/* EliteChel Media | LG3s basic locker customization v1
 * One browser-local, team/player-scoped cosmetic record. No verified roster or
 * Hockey Card mutation, no global publication, no premium entitlement claims.
 */
(function(root){
 'use strict';
 const PREFIX='ecm:lg3s:s1:team:';
 const positive=id=>Number.isSafeInteger(Number(id))&&Number(id)>0?Number(id):null;
 const cleanName=value=>String(value??'').normalize('NFC')
  .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'')
  .replace(/\s+/g,' ').trim().slice(0,18);
 const cleanNumber=value=>{
  const text=String(value??'').trim();
  return text===''||/^[0-9]{1,2}$/.test(text)?text:null;
 };
 const key=(teamId,playerId)=>{
  const team=positive(teamId),player=positive(playerId);
  return team&&player?PREFIX+team+':player:'+player:null;
 };
 const defaults=player=>({name:cleanName(player?.gamertag||player?.n||'PLAYER')||'PLAYER',number:''});
 function read(teamId,player){
  const fallback=defaults(player),storageKey=key(teamId,player?.id);
  if(!storageKey)return fallback;
  try{
   const saved=JSON.parse(root.localStorage?.getItem(storageKey)||'null');
   const name=cleanName(saved?.name),number=cleanNumber(saved?.number);
   return{name:name||fallback.name,number:number===null?'':number};
  }catch{return fallback;}
 }
 function save(teamId,player,nameInput,numberInput){
  const storageKey=key(teamId,player?.id);
  if(!storageKey)return{ok:false,reason:'Choose a verified roster player first.'};
  const name=cleanName(nameInput),number=cleanNumber(numberInput);
  if(!name)return{ok:false,reason:'Enter at least one character for the nameplate.'};
  if(number===null)return{ok:false,reason:'Jersey number must be blank or 0 to 99.'};
  const value={name,number};
  let persisted=false;
  try{
   root.localStorage?.setItem(storageKey,JSON.stringify(value));
   persisted=root.localStorage?.getItem(storageKey)===JSON.stringify(value);
  }catch{}
  return{ok:true,value,persisted};
 }
 function reset(teamId,player){
  const storageKey=key(teamId,player?.id);
  if(storageKey)try{root.localStorage?.removeItem(storageKey)}catch{}
  return defaults(player);
 }
 root.ECMLG3SBasic=Object.freeze({key,cleanName,cleanNumber,defaults,read,save,reset});
})(window);
