import { parsePublicGame } from './public-box-score.mjs';
type DB = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{data: any; error: {message: string}|null}> };
async function call(db: DB, name: string, args: Record<string,unknown>) {
 const {data,error}=await db.rpc(name,args);if(error)throw new Error(error.message);return data;
}
export async function drainPublicBoxes(db: DB, getHtml: (url:string)=>Promise<string>, isBlocked: (error:unknown)=>boolean, deadline:number, owner:string) {
 let imported=0,failed=0;
 while(Date.now()<deadline-25000) {
  const game=await call(db,'lgchl_media_claim_box',{p_owner:owner});
  if(!game)break;
  try {
   const source='https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid='+game.lg_game_id;
   const html=await getHtml(source); // same serial, identified, 1.5-second-paused fetcher as standings/schedules
   const payload=parsePublicGame(html,game);
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(html)))].map(b=>b.toString(16).padStart(2,'0')).join('');
   await call(db,'lgchl_media_save_box',{p_owner:owner,p_payload:payload,p_fetched_at:new Date().toISOString(),p_sha256:hash});
   imported++;
  } catch(error) {
   await call(db,'lgchl_media_fail_box',{p_owner:owner,p_lg_game_id:game.lg_game_id,p_error:String((error as Error).message||error).slice(0,500),p_challenge:isBlocked(error)});
   if(isBlocked(error))throw error;
   failed++;
  }
 }
 return {imported,failed,remaining:'Queued games resume on the next approved worker call; failed pages need explicit review.'};
}
