'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname,'..');
const script = fs.readFileSync(path.join(root,'lg3s-auth-browser-sync.js'),'utf8');
const html = fs.readFileSync(path.join(root,'lg-capture.html'),'utf8');
const server = fs.readFileSync(path.join(root,'supabase/functions/lg3s-auth-browser-sync/index.ts'),'utf8');

function ui() {
  const elements = {};
  const listeners = {};
  const posted = [];
  const bridge = {postMessage: (data,origin) => posted.push({data,origin})};
  const db = {
    auth: {getSession: async () => ({data:{session:{access_token:'fake-test-jwt'}}})},
    functions: {invoke: async (_name,{body}) => ({data: body.action === 'pending'
      ? {ok:true,pending:[{gameId:921788},{gameId:921790}]}
      : {ok:true,action:'provisional',needsSecondPass:true}})}
  };
  const element = id => elements[id] ||= {
    textContent:'',href:'',disabled:false,style:{},
    handlers:{},
    addEventListener(type,callback){this.handlers[type]=callback;}
  };
  const sandbox = {
    location:{origin:'https://wildmanhockey-elitechelmedia.app'},
    window:{addEventListener:(type,callback)=>listeners[type]=callback,VVHLBackend:{db}},
    document:{getElementById:element,readyState:'complete'},
    navigator:{clipboard:{writeText:async()=>{}}},
    console,URL,Promise,setTimeout,clearTimeout
  };
  vm.runInNewContext(script,sandbox,{timeout:2500});
  return {elements,element,listeners,posted,bridge,db};
}

test('LG3S recovery controls are wired and the browser bookmarklet compiles',()=>{
  const app = ui();
  assert.match(html,/id="lg3sBrowserSync"/);
  assert.match(html,/src="lg3s-auth-browser-sync.js"/);
  assert.match(app.element('lg3sBrowserBookmarklet').href,/^javascript:\(/);
  new vm.Script(app.element('lg3sBrowserBookmarklet').href.slice('javascript:'.length));
  assert.equal(typeof app.element('lg3sFetchMissing').handlers.click,'function');
});

test('bookmarklet fetches only approved, user-requested game IDs and never sends cookies',async()=>{
  const app = ui(), code=app.element('lg3sBrowserBookmarklet').href.slice('javascript:'.length);
  const messages=[], listeners={}, fetched=[];
  const bridge={postMessage:(data,origin)=>messages.push({data,origin})};
  const lg={
    location:{protocol:'https:',hostname:'www.leaguegaming.com',origin:'https://www.leaguegaming.com'},
    window:{open:()=>bridge,addEventListener:(type,fn)=>listeners[type]=fn},
    fetch:async(url,options)=>{fetched.push({url,options});return{ok:false,status:403}},
    setTimeout:callback=>{callback();return 1;},
    alert:message=>{throw Error(message);},
    URL,Promise,Set,Number,DOMParser:class{},console
  };
  vm.runInNewContext(code,lg,{timeout:2500});
  assert.equal(fetched.length,0,'no unsolicited LeagueGaming fetching');
  assert.equal(messages[0].data.type,'ECM_LG3S_CONNECTED');
  await listeners.message({source:bridge,origin:'https://wildmanhockey-elitechelmedia.app',
    data:{type:'ECM_LG3S_FETCH',gameIds:[921788,31,'fake',921790]}});
  assert.equal(fetched.length,2);
  assert(fetched.every(x=>x.options.credentials==='include'));
  assert(fetched.every(x=>x.url.startsWith('https://www.leaguegaming.com/forums/index.php?')));
  assert(messages.filter(x=>x.data.type==='ECM_LG3S_ERROR').length===2);
  assert(messages.every(x=>x.origin==='https://wildmanhockey-elitechelmedia.app'));
  assert(messages.every(x=>!JSON.stringify(x.data).includes('fake-test-jwt')));
});

test('bridge requires a connected signed-in LG tab before requesting a batch',async()=>{
  const app=ui();
  await app.element('lg3sFetchMissing').handlers.click();
  assert.match(app.element('lg3sAuthMessage').textContent,/click the LG3S Browser Sync bookmark/i);
  assert.equal(app.posted.length,0);
  app.listeners.message({source:app.bridge,origin:'https://www.leaguegaming.com',data:{type:'ECM_LG3S_CONNECTED'}});
  await app.element('lg3sFetchMissing').handlers.click();
  assert.equal(app.posted.length,1);
  assert.equal(app.posted[0].data.type,'ECM_LG3S_FETCH');
  assert.deepEqual(Array.from(app.posted[0].data.gameIds),[921788,921790]);
  assert.equal(app.element('lg3sFetchMissing').disabled,true);
  app.listeners.message({source:app.bridge,origin:'https://www.leaguegaming.com',data:{type:'ECM_LG3S_DONE'}});
  await Promise.resolve();
  assert.equal(app.element('lg3sFetchMissing').disabled,false);
});

test('server endpoint is restricted, validates source, and reuses the existing verification gate',()=>{
  assert.match(server,/auth\.getUser\(bearer\)/);
  assert.match(server,/profiles"\)\.select\("role"\)/);
  assert.match(server,/admin","commissioner/);
  assert.match(server,/verification\.passed/);
  assert.match(server,/lg3s_ingest_game/);
  assert.match(server,/game\.away_lg_team_id/);
  assert.match(server,/last_fetched_at/);
  assert.match(server,/14 \* 86400000/);
  assert.doesNotMatch(server,/console\.log\(html\)|JSON\.stringify\(html\)/);
});
