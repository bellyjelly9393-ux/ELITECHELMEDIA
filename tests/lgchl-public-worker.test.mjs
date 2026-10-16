import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {drainPublicBoxes} from '../supabase/functions/lgchl-league-sync/public-box-worker.ts';
const html=fs.readFileSync(new URL('./fixtures/lgchl/public-game.example.html',import.meta.url),'utf8');
const game=JSON.parse(fs.readFileSync(new URL('./fixtures/lgchl/public-game.example.json',import.meta.url)));
function db(){const calls=[];let pending=true;return {calls,rpc:async(name,args)=>{calls.push({name,args});return {data:name==='lgchl_media_claim_box'?(pending?(pending=false,game):null):4,error:null};}};}
test('one claimed final creates one fetch and one atomic save, never a second fetch',async()=>{
 const client=db();let fetched=0;
 const result=await drainPublicBoxes(client,async()=>{fetched++;return html;},()=>false,Date.now()+60000,'owner');
 assert.equal(result.imported,1);assert.equal(fetched,1);
 const saved=client.calls.find(c=>c.name==='lgchl_media_save_box').args;
 assert.equal(saved.p_payload.players.length,12);assert.match(saved.p_sha256,/^[a-f0-9]{64}$/);
});
test('blocked access pauses the job and stops before asking for another page',async()=>{
 const client=db(),blocked=new Error('403 blocked');
 await assert.rejects(drainPublicBoxes(client,async()=>{throw blocked;},e=>e===blocked,Date.now()+60000,'owner'));
 assert.equal(client.calls.filter(c=>c.name==='lgchl_media_claim_box').length,1);
 assert.equal(client.calls.find(c=>c.name==='lgchl_media_fail_box').args.p_challenge,true);
 assert.ok(!client.calls.some(c=>c.name==='lgchl_media_save_box'));
});
test('malformed pages are failed without inventing or saving any player lines',async()=>{
 const client=db();const result=await drainPublicBoxes(client,async()=>'<html>Not ready</html>',()=>false,Date.now()+60000,'owner');
 assert.equal(result.failed,1);assert.ok(!client.calls.some(c=>c.name==='lgchl_media_save_box'));
});
