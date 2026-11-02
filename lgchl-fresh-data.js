/* Verified LG captures bridge a stalled remote importer. Never invent missing rows. */
(()=>{
 'use strict';
 const get=path=>fetch(path,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Capture unavailable');return r.json()}).catch(()=>null);
 const leaders=get('data/lgchl/leaders-current.json'),night=get('data/lgchl/night-current.json');
 async function board(metric,rows){
  const data=await leaders;
  const latest=(rows||[]).map(p=>p.fetched_at).filter(Boolean).sort().pop();
  if(data?.boards?.[metric]?.length&&(!latest||Date.parse(data.captured_at)>Date.parse(latest)))return {rows:data.boards[metric],capture:data};
  return {rows:rows||[],capture:null};
 }
 window.LGCHLFresh={board,night:()=>night};
})();
