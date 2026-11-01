/* EliteChel Card Studio beta account collection.
   Discord sign-in uses the site's existing Supabase project.
   All saved card metadata is private under database RLS. Player artwork stays on device.
   No authoritative league stats are written by users. */
(function () {
  'use strict';
  var panel=document.getElementById('accountPanel');
  var collection=document.getElementById('collectionList');
  if (!panel || !collection) return;
  function byId(s){return document.getElementById(s);}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function notice(s){byId('accountStatus').textContent=s;}
  function syncButtons(logged){byId('discordSignin').hidden=logged;byId('discordSignout').hidden=!logged;byId('saveToCollection').disabled=!logged;}
  if (!window.supabase || !window.ecmCardStudio) {
    notice('Account features unavailable. The local card builder still works.');
    syncButtons(false);
    return;
  }
  var db=window.supabase.createClient(
    'https://lrgllzvwgvqagcpiyvfd.supabase.co',
    'sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP',
    {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}}
  );
  var me=null, saved=[];
  var activeRequest=0;
  async function refresh() {
    if (!me) {saved=[];renderCollection();syncButtons(false);return;}
    var request=++activeRequest;
    var res=await db.from('elitechel_player_cards')
      .select('id,league,lg_user_id,player_kind,gamertag_snapshot,finish,self_reported_overall,jersey_number,created_at')
      .eq('user_id',me.id).order('created_at',{ascending:false}).limit(120);
    if(request!==activeRequest) return;
    if(res.error){notice('Could not load your collection: '+res.error.message);return;}
    saved=res.data||[];
    renderCollection();
    applySelected();
    syncButtons(true);
  }
  function renderCollection() {
    if (!me){collection.innerHTML='<p class="hint">Sign in with Discord to keep your selected cards in your private account collection.</p>';return;}
    if (!saved.length){collection.innerHTML='<p class="hint">Your collection is empty. Choose a player above and save your first card.</p>';return;}
    collection.innerHTML=saved.map(function(c){
      var qs=new URLSearchParams({league:c.league,id:String(c.lg_user_id),kind:c.player_kind});
      return '<a class="account-card" href="player-cards.html?'+esc(qs.toString())+'">'+
       '<span><b>'+esc(c.gamertag_snapshot)+'</b><small>'+esc(c.league.toUpperCase())+' · '+esc(c.player_kind)+
       ' · '+esc(c.finish)+' finish</small></span><span class="account-card-arrow">View card ›</span></a>';
    }).join('');
  }
  function applySelected() {
    if(!me || !window.ecmCardStudio)return;
    var p=window.ecmCardStudio.getSelected();
    if(!p)return;
    var c=saved.find(function(row){return row.league===window.ecmCardStudio.getLeague()
       && String(row.lg_user_id)===p.id && row.player_kind===p.kind;});
    if(c)window.ecmCardStudio.applyAccountCustomization({
      finish:c.finish,overall:c.self_reported_overall,jersey:c.jersey_number
    });
  }
  async function setUser(user) {
    me=user||null;
    ++activeRequest;
    syncButtons(!!me);
    byId('accountName').textContent=me
      ? String((me.user_metadata&&(me.user_metadata.full_name||me.user_metadata.name||me.user_metadata.preferred_username))||'Discord member')
      : 'Guest';
    notice(me?'Signed in. Your saved cards are private to your account.':'Sign in to save cards to your account.');
    await refresh();
  }
  byId('discordSignin').addEventListener('click',async function(){
    notice('Connecting to Discord…');
    var target=location.origin+location.pathname+location.search;
    var res=await db.auth.signInWithOAuth({provider:'discord',options:{redirectTo:target,scopes:'identify'}});
    if(res.error) notice('Discord sign-in could not start: '+res.error.message);
  });
  byId('discordSignout').addEventListener('click',async function(){
    var res=await db.auth.signOut();
    if(res.error)notice('Could not sign out: '+res.error.message);
  });
  byId('saveToCollection').addEventListener('click',async function(){
    if(!me){notice('Sign in with Discord first.');return;}
    var p=window.ecmCardStudio.getSelected();
    if(!p || !/^[0-9]+$/.test(p.id)){notice('Choose a player from verified league data first.');return;}
    var o=byId('overall').value,j=byId('jersey').value,f=byId('finish').value;
    var overall=o===''?null:Number(o),jersey=j===''?null:Number(j);
    if((overall!==null&&(!Number.isInteger(overall)||overall<1||overall>99))
      ||(jersey!==null&&(!Number.isInteger(jersey)||jersey<0||jersey>99))){
      notice('Overall must be 1–99 and jersey number 0–99.');return;
    }
    var b=byId('saveToCollection');b.disabled=true;notice('Saving card to your account…');
    var payload={user_id:me.id,league:window.ecmCardStudio.getLeague(),
      lg_user_id:Number(p.id),player_kind:p.kind,gamertag_snapshot:p.tag.slice(0,80),
      finish:f,self_reported_overall:overall,jersey_number:jersey,updated_at:new Date().toISOString()};
    var res=await db.from('elitechel_player_cards').upsert(payload,
      {onConflict:'user_id,league,lg_user_id,player_kind'});
    b.disabled=false;
    if(res.error){notice('Card was not saved: '+res.error.message);return;}
    notice('Card added to My Collection! Your character screenshot remains on this device; export PNG to keep it.');
    await refresh();
  });
  window.addEventListener('ecm:card-selected',function(){applySelected();});
  db.auth.onAuthStateChange(function(_event,session){
    var u=session&&session.user||null;
    if((u&&u.id)!==(me&&me.id))setTimeout(function(){setUser(u);},0);
  });
  db.auth.getUser().then(function(result){
    if(result.error&&result.error.name!=='AuthSessionMissingError'){notice('Sign-in check failed: '+result.error.message);}
    setUser(result.data&&result.data.user||null);
  }).catch(function(){setUser(null);});
})();
