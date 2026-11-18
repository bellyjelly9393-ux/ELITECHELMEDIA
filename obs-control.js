(function(){
  'use strict';
  var PRODUCTION_ORIGIN='https://wildmanhockey-elitechelmedia.app';
  var CARBON_ORIGIN='http://127.0.0.1:4180';
  var CARBON_PREVIEW=CARBON_ORIGIN+'/broadcast.html?preview=desk';
  var carbonTimeout=0;
  var OBS_CFG=window.WM_OBS_CONFIG||{defaultFeedFor:function(){return '';}};
  var SCENES=window.WM_OBS_SCENES||null;
  var MEDIA_TEAM_ID='5f36117c-7a51-4514-bf70-d4c672b41e48';
  var GBR_STUDIO=MEDIA_TEAM_ID+':gbr';
  var TEAM_CONFIG={
    '5f36117c-7a51-4514-bf70-d4c672b41e48':{name:'Elitechel Media',brand:'wildman',channel:'wildman-main'},
    [GBR_STUDIO]:{name:'LG3s Team Great Britain',shortName:'GBR',brand:'wildman',channel:'lg3s-gbr',teamId:MEDIA_TEAM_ID},
    'b0bcbdda-da9d-419d-8f61-b34937966d49':{name:'Calgary Hitmen',brand:'hitmen',channel:'hitmen-main'}
  };
  var currentTeamId='';
  var currentScene='game';
  var currentPresetId='game-matchup';
  var initialized=false;
  var stateRef=null;
  var lastUserId='';
  var previewMode='program';
  var stateRequest=0;
  var channelReady=false;
  var editCount=0;        // bumps on every manual edit; protects unsaved typing from auto refills
  var savedEditCount=0;
  var publishing=false;
  var publishQueued=false;
  var clockState={running:false,baseSeconds:1200,startedAt:'',rate:5};
  var clockUiTimer=null;
  var gbrGoalTrigger='';
  var gbrStarsUntil='';
  var gbrRinkVisible=true;

  function byId(id){return document.getElementById(id);}
  function val(id){return (byId(id)?.value||'').trim();}
  function clampInt(v,min,max,fallback){var n=parseInt(v,10);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
  function numberVal(id){var n=parseInt(byId(id)?.value||'0',10);return Number.isFinite(n)&&n>=0?n:0;}
  function parseClock(value,fallback){
    var raw=String(value||'').trim();
    var parts=raw.split(':');
    if(parts.length===2){
      var m=parseInt(parts[0],10),s=parseInt(parts[1],10);
      if(Number.isFinite(m)&&Number.isFinite(s)&&m>=0&&s>=0&&s<60)return m*60+s;
    }
    var n=parseInt(raw,10);
    return Number.isFinite(n)&&n>=0?n:(fallback==null?1200:fallback);
  }
  function formatClock(seconds){
    var total=Math.max(0,Math.round(Number(seconds)||0));
    var m=Math.floor(total/60),s=total%60;
    return String(m)+':'+String(s).padStart(2,'0');
  }
  function clockSecondsNow(){
    var base=Math.max(0,Number(clockState.baseSeconds)||0);
    if(!clockState.running||!clockState.startedAt)return base;
    var start=Date.parse(clockState.startedAt);
    if(!Number.isFinite(start))return base;
    var elapsed=Math.max(0,(Date.now()-start)/1000);
    return Math.max(0,base-elapsed*(Number(clockState.rate)||1));
  }
  function syncClockUi(){
    var seconds=clockSecondsNow();
    var display=byId('obsClockDisplay');
    var status=byId('obsClockStatus');
    if(display)display.textContent=formatClock(seconds);
    if(status){
      var active=clockState.running&&seconds>0;
      status.textContent=active?'RUNNING · '+(Number(clockState.rate)||1)+'×':'PAUSED';
      status.classList.toggle('running',active);
    }
    if(clockState.running&&seconds<=0){clockState.running=false;clockState.baseSeconds=0;clockState.startedAt='';}
  }
  function setClockFromPayload(payload){
    var p=payload||{};
    var fallback=parseClock(p.clock||'20:00',1200);
    clockState.rate=[1,4,5,6].includes(Number(p.clockRate))?Number(p.clockRate):5;
    clockState.baseSeconds=Number.isFinite(Number(p.clockBaseSeconds))?Math.max(0,Number(p.clockBaseSeconds)):fallback;
    clockState.startedAt=String(p.clockStartedAt||'');
    clockState.running=p.clockRunning===true&&!!clockState.startedAt;
    if(byId('obsClockRate'))byId('obsClockRate').value=String(clockState.rate);
    if(byId('obsClock'))byId('obsClock').value=formatClock(clockSecondsNow());
    syncClockUi();
  }
  function clockSnapshot(){
    var seconds=clockSecondsNow();
    var active=clockState.running&&seconds>0;
    return {
      clock:formatClock(seconds),
      clockRunning:active,
      clockBaseSeconds:active?Math.max(0,Number(clockState.baseSeconds)||0):Math.max(0,seconds),
      clockStartedAt:active?clockState.startedAt:'',
      clockRate:Number(clockState.rate)||1
    };
  }
  function setStatus(message,isError){
    var status=byId('publishStatus');
    status.textContent=message;
    status.dataset.tone=isError?'error':message==='Published'?'saved':'working';
  }
  function updateDeskActions(){
    byId('publishObsState').disabled=!channelReady||publishing;
    byId('reloadObsState').disabled=!currentTeamId||publishing;
    byId('obsTeamSelect').disabled=publishing||!allowedTeamIds(stateRef||{}).length;
    byId('obsDeskControls').inert=!channelReady;
  }
  function updatePublished(row){
    var scene=SCENES?.infer(row?.scene||'game',row?.payload||{});
    byId('obsPublishedScene').textContent=row?.updated_at?(scene?.label||row.scene||'Gameplay'):'—';
    byId('stateUpdated').textContent=row?.updated_at
      ? 'Saved '+new Date(row.updated_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'})
      : 'No state published';
  }
  function isGbr(){return currentTeamId===GBR_STUDIO;}
  function config(){return TEAM_CONFIG[currentTeamId]||TEAM_CONFIG['5f36117c-7a51-4514-bf70-d4c672b41e48'];}
  function gbrOverlayUrl(){return location.origin+'/lg3s-gb?mode=obs';}
  function stageUrl(){return (currentTeamId===GBR_STUDIO?location.origin:PRODUCTION_ORIGIN)+'/obs-stage.html?channel='+encodeURIComponent(config().channel);}
  function overlayUrl(){if(currentTeamId===GBR_STUDIO)return gbrOverlayUrl();return PRODUCTION_ORIGIN+'/obs-overlay.html?channel='+encodeURIComponent(config().channel);}
  function feedLayerUrl(){return stageUrl()+'&layer=feed';}
  function isDirty(){return editCount!==savedEditCount;}
  function providerFor(url,provided){
    var p=String(provided||'').toLowerCase();
    if(p&&p!=='auto')return p;
    var raw=String(url||'').toLowerCase();
    if(raw.includes('twitch.tv'))return 'twitch';
    if(raw.includes('youtube.com')||raw.includes('youtu.be'))return 'youtube';
    if(/\.mp4(?:$|\?)/i.test(raw))return 'video';
    return 'external';
  }
  function feedSummary(){
    var url=val('obsStreamUrl');
    var status=byId('streamFeedStatus');
    if(!status)return;
    if(!url){status.textContent='No feed attached yet.';return;}
    var provider=providerFor(url,val('obsStreamProvider'));
    status.textContent='Attached · '+provider.toUpperCase()+(byId('obsStreamMuted')?.checked?' · MUTED':' · AUDIO ON')+
      (provider==='twitch'?' · In OBS use the Feed Layer source under the Overlay source (Twitch pauses under graphics)':'');
  }
  function fitPreviewCanvas(){
    var frame=byId('obsPreviewFrame'),canvas=byId('obsPreviewCanvas');
    if(!frame||!canvas)return;
    var width=frame.clientWidth||0;
    if(!width)return;
    var scale=width/(isGbr()?1920:1280);
    canvas.style.transform='scale('+scale+')';
  }
  function watchPreviewSize(){
    fitPreviewCanvas();
    if(window.ResizeObserver){
      var frame=byId('obsPreviewFrame');
      if(frame&&!frame.__obsResizeBound){
        frame.__obsResizeBound=true;
        new ResizeObserver(fitPreviewCanvas).observe(frame);
      }
    }else{
      window.addEventListener('resize',fitPreviewCanvas);
    }
  }
  function setCarbonPreview(state){
    clearTimeout(carbonTimeout);
    byId('obsCarbonPreviewStatus').hidden=!state||state==='ready';
    if(!state)return;
    var messages={
      connecting:['Connecting to Carbon Arena','Allow local network access if your browser asks.'],
      loading:['Loading the Elite Labs rink','The warmup preview opens when the arena renders.'],
      unreachable:['Carbon Arena is unavailable','Start the updated Elite Labs server on this computer, then try again or open the monitor in a new tab.'],
      'renderer-error':['The rink could not render','Enable browser hardware acceleration, then try again.']
    };
    var message=messages[state];
    byId('obsMonitorNote').textContent=state==='ready'?'Elite Labs Carbon Arena · Off-air preview':'Carbon Arena · Off-air';
    if(state==='ready')return;
    byId('obsCarbonHeading').textContent=message[0];
    byId('obsCarbonDetail').textContent=message[1];
    byId('obsRetryCarbon').hidden=state==='connecting'||state==='loading';
    if(state==='connecting'||state==='loading'){
      carbonTimeout=setTimeout(function(){setCarbonPreview('unreachable');},state==='loading'?20000:12000);
    }
  }
  function updatePreview(){
    var channel=encodeURIComponent(config().channel);
    if(!isGbr()&&['sample','pregame'].includes(previewMode))previewMode='program';
    var program='/obs-stage.html?channel='+channel+'&preview=1';
    var graphics=isGbr()?'/lg3s-gb?mode=obs&audio=off':'/obs-overlay.html?channel='+channel;
    var carbon=previewMode==='pregame';
    var source=carbon?CARBON_PREVIEW:previewMode==='sample'?graphics+'&preview=true':previewMode==='graphics'?graphics:program;
    var monitor=byId('obsPreview');
    var width=isGbr()?1920:1280;
    var height=isGbr()?1080:720;
    var canvas=byId('obsPreviewCanvas');
    canvas.style.width=width+'px';
    canvas.style.height=height+'px';
    monitor.width=width;
    monitor.height=height;
    monitor.title=carbon?'Elite Labs Carbon Arena pregame monitor':previewMode==='program'?'OBS program monitor':'OBS graphics monitor';
    if(carbon)monitor.setAttribute('allow','local-network-access '+CARBON_ORIGIN+'; loopback-network '+CARBON_ORIGIN);
    else monitor.removeAttribute('allow');
    if(monitor.getAttribute('src')!==source){
      setCarbonPreview(carbon?'connecting':'');
      monitor.src=source;
    }
    byId('obsPreviewFrame').dataset.mode=previewMode;
    byId('obsPreviewDimensions').textContent=width+' × '+height+(isGbr()?' · 60 FPS source':'');
    if(!carbon)byId('obsMonitorNote').textContent=previewMode==='sample'?'Sample GBR graphics · Muted'
      :previewMode==='graphics'?'Transparent graphics · Muted':'Game feed and graphics · Muted';
    byId('obsOpenMonitor').href=source;
    document.querySelectorAll('[data-preview]').forEach(function(button){
      button.hidden=['sample','pregame'].includes(button.dataset.preview)&&!isGbr();
      button.setAttribute('aria-pressed',String(button.dataset.preview===previewMode));
    });
    fitPreviewCanvas();
  }
  function updateSourceLinks(){
    var stage=stageUrl(),overlay=overlayUrl();
    byId('obsSourceUrl').value=stage;
    byId('openObsUrl').href=stage;
    byId('obsOverlayOnlyUrl').value=overlay;
    byId('openOverlayUrl').href=overlay;
    byId('openCombinedStage').href=stage+'&preview=1';
    byId('obsFeedLayerUrl').value=feedLayerUrl();
    byId('openFeedLayerUrl').href=feedLayerUrl();
    byId('heroChannel').textContent=config().channel.toUpperCase();
    for(var id of ['obsGbrSource','obsGbrCues','obsGbrTactics'])byId(id).hidden=!isGbr();
    for(var id of ['obsStandardCopy','obsStandardSetup','obsStandardGraphics'])byId(id).hidden=isGbr();
    document.querySelectorAll('[data-standard-graphics]').forEach(function(el){el.hidden=isGbr();});
    byId('obsHomeName').readOnly=isGbr();
    byId('obsAwayName').maxLength=isGbr()?3:80;
    byId('obsAwayName').placeholder=isGbr()?'Three-letter code, e.g. SWE':"Blank = tonight’s opponent";
    updatePreview();
  }
  function activateTab(next){
    document.querySelectorAll('.obs-tabs [role="tab"]').forEach(function(tab){
      var active=tab===next;
      tab.setAttribute('aria-selected',String(active));
      tab.tabIndex=active?0:-1;
      byId(tab.getAttribute('aria-controls')).hidden=!active;
    });
  }
  function allowedTeamIds(state){
    var role=String(state.profile?.role||'').toLowerCase();
    if(role==='admin'||role==='commissioner') return Object.keys(TEAM_CONFIG);
    var ids=(state.memberships||[])
      .filter(function(m){return m.active!==false&&['owner','gm','agm'].includes(String(m.role||'').toLowerCase());})
      .map(function(m){return m.team_id;});
    return Object.keys(TEAM_CONFIG).filter(function(id){return ids.includes(TEAM_CONFIG[id].teamId||id);});
  }
  function populateTeams(state){
    var select=byId('obsTeamSelect');
    var ids=allowedTeamIds(state);
    if(!ids.length) return false;
    select.innerHTML=ids.map(function(id){return '<option value="'+id+'">'+TEAM_CONFIG[id].name+'</option>';}).join('');
    var preferred=ids.includes(currentTeamId)?currentTeamId:((new URLSearchParams(location.search).get('channel')==='lg3s-gbr'&&ids.includes(GBR_STUDIO))?GBR_STUDIO:(ids.includes(state.teamId)?state.teamId:ids[0]));
    select.value=preferred;
    currentTeamId=preferred;
    return true;
  }
  // Player Stream dropdown: the list lives in obs-config.js (playerStreams); "Custom" = typed URL.
  function populateStreams(){
    var select=byId('obsPlayerStream');if(!select)return;
    var list=(OBS_CFG.playerStreams||[]);
    select.innerHTML=list.map(function(s,i){return '<option value="'+i+'">'+String(s.label).replace(/[<>&"]/g,'')+'</option>';}).join('')+'<option value="custom">Custom URL (type below)</option>';
  }
  function syncStreamSelect(){
    var select=byId('obsPlayerStream');if(!select)return;
    var url=val('obsStreamUrl').toLowerCase().replace(/\/+$/,'');
    var i=(OBS_CFG.playerStreams||[]).findIndex(function(s){return String(s.url).toLowerCase().replace(/\/+$/,'')===url;});
    select.value=i>=0?String(i):'custom';
  }
  function updateScoreDisplay(){
    byId('homeScoreDisplay').textContent=numberVal('obsHomeScore');
    byId('awayScoreDisplay').textContent=numberVal('obsAwayScore');
  }
  function renderSceneButtons(){
    var strip=byId('obsSceneStrip');
    if(!strip)return;
    var list=SCENES&&Array.isArray(SCENES.all)?SCENES.all:[];
    if(!list.length){
      strip.innerHTML='<button type="button" data-preset="game-matchup" data-scene="game"><b>Gameplay</b><small>Matchup Panel</small></button>';
      return;
    }
    strip.innerHTML=list.map(function(item){
      return '<button type="button" data-preset="'+item.id+'" data-scene="'+item.scene+'">'+
        '<b>'+item.label+'</b><small>'+item.sublabel+'</small></button>';
    }).join('');
  }
  function setSceneButtons(){
    document.querySelectorAll('#obsSceneStrip [data-preset]').forEach(function(button){
      var selected=button.dataset.preset===currentPresetId;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
      button.hidden=isGbr()? !['game-matchup','pregame-gbr','starting','intermission','final','brb'].includes(button.dataset.preset)
        :button.dataset.preset==='pregame-gbr'||(button.dataset.preset==='starting-hitmen-bobbleheads'&&config().channel!=='hitmen-main');
    });
  }
  function setValue(id,value){var node=byId(id);if(node)node.value=value;}
  function setChecked(id,value){var node=byId(id);if(node)node.checked=Boolean(value);}
  function applyScenePreset(presetId){
    var definition=SCENES&&SCENES.get?SCENES.get(presetId):null;
    if(!definition){
      definition={id:'game-matchup',scene:'game',preset:{
        feedLayout:'panel',sidePanel:'matchup',bugPosition:'hidden',
        showScoreboard:false,logoBug:'auto',logoPreset:'ea',logoSize:48,streamMuted:false
      }};
    }
    var preset=definition.preset||{};
    currentPresetId=definition.id;
    currentScene=definition.scene||'game';

    if(preset.feedLayout!==undefined)setValue('obsFeedLayout',preset.feedLayout);
    if(preset.sidePanel!==undefined)setValue('obsSidePanel',preset.sidePanel);
    if(preset.bugPosition!==undefined)setValue('obsBugPosition',preset.bugPosition);
    if(preset.showScoreboard!==undefined)setChecked('obsShowScoreboard',preset.showScoreboard);
    if(preset.logoBug!==undefined)setValue('obsLogoBug',preset.logoBug);
    if(preset.logoPreset!==undefined)setValue('obsLogoPreset',preset.logoPreset);
    if(preset.logoSize!==undefined)setValue('obsLogoSize',preset.logoSize);
    if(preset.streamMuted!==undefined)setChecked('obsStreamMuted',preset.streamMuted);

    editCount++;
    setSceneButtons();
    feedSummary();
  }
  function fill(row){
    row=row||{scene:'game'};
    var p=row.payload||{};
    currentScene=row.scene||'game';
    var savedPreset=SCENES&&SCENES.infer?SCENES.infer(currentScene,p):null;
    currentPresetId=savedPreset?savedPreset.id:'game-matchup';
    byId('obsEvent').value=p.event||'';
    byId('obsHomeName').value=isGbr()?'GBR':p.homeName||config().name;
    // 'OPPONENT' was the old placeholder; blank lets the overlay use tonight's opponent.
    byId('obsAwayName').value=String(p.awayName||'').trim().toUpperCase()==='OPPONENT'?'':(p.awayName||'');
    byId('obsBugPosition').value=['left','right','hidden'].includes(p.bugPosition)?p.bugPosition:'hidden';
    byId('obsShowScoreboard').checked=p.showScoreboard===true;
    byId('obsLogoBug').value=['auto','on','off'].includes(p.logoBug)?p.logoBug:'auto';
    byId('obsLogoPreset').value=['ea','top-left','top-right','bottom-right'].includes(p.logoPreset)?p.logoPreset:'ea';
    byId('obsLogoSize').value=Number.isFinite(Number(p.logoSize))&&p.logoSize!==''&&p.logoSize!=null?p.logoSize:48;
    byId('obsLogoX').value=Number(p.logoX)||0;
    byId('obsLogoY').value=Number(p.logoY)||0;
    byId('obsHomeScore').value=Number(p.homeScore||0);
    byId('obsAwayScore').value=Number(p.awayScore||0);
    byId('obsPeriod').value=p.period||'1ST';
    setClockFromPayload(p);
    byId('obsRecord').value=p.record||'';
    byId('obsMessage').value=p.message||'';
    byId('obsIntShotsHome').value=p.intShotsHome||'';
    byId('obsIntShotsAway').value=p.intShotsAway||'';
    byId('obsIntHitsHome').value=p.intHitsHome||'';
    byId('obsIntHitsAway').value=p.intHitsAway||'';
    byId('obsIntFaceoffsHome').value=p.intFaceoffsHome||'';
    byId('obsIntFaceoffsAway').value=p.intFaceoffsAway||'';
    byId('obsFinalShotsHome').value=p.finalShotsHome||'';
    byId('obsFinalShotsAway').value=p.finalShotsAway||'';
    byId('obsFinalPpHome').value=p.finalPpHome||'';
    byId('obsFinalPpAway').value=p.finalPpAway||'';
    byId('obsFinalSavesHome').value=p.finalSavesHome||'';
    byId('obsFinalSavesAway').value=p.finalSavesAway||'';
    byId('obsPlayerName').value=p.playerName||'PLAYER';
    byId('obsPlayerNumber').value=p.playerNumber||'00';
    byId('obsPlayerRole').value=p.playerRole||'PLAYER';
    // Channel default feed (obs-config.js) fills the field when nothing is attached yet.
    byId('obsStreamUrl').value=p.streamUrl||OBS_CFG.defaultFeedFor(config().channel)||'';
    byId('obsStreamProvider').value=['auto','twitch','youtube','video'].includes(String(p.streamProvider||'auto'))?String(p.streamProvider||'auto'):'auto';
    byId('obsStreamMuted').checked=p.streamMuted===true;
    byId('obsFeedLayout').value=p.feedLayout==='panel'?'panel':'full';
    byId('obsSidePanel').value=['brand','matchup','league','socials'].includes(p.sidePanel)?p.sidePanel:'brand';
    syncStreamSelect();
    updateScoreDisplay();
    setSceneButtons();
    feedSummary();
    gbrGoalTrigger=isGbr()?p.goalHornTrigger||'':'';
    gbrStarsUntil=isGbr()?p.threeStarsUntil||'':'';
    setValue('obsGbrCamera',p.rinkCamera||'ice');
    setValue('obsGbrFormation',p.rinkFormation||'trap');
    setValue('obsGbrHighlight',p.rinkHighlight||88);
    gbrRinkVisible=p.rinkVisible!==false;
    byId('obsToggleGbrRink').setAttribute('aria-pressed',String(gbrRinkVisible));
    updatePublished(row);
    savedEditCount=editCount;
  }
  function collectPayload(){
    var streamUrl=val('obsStreamUrl');
    var selectedProvider=val('obsStreamProvider')||'auto';
    var clock=clockSnapshot();
    return {
      presetId:currentPresetId,
      event:val('obsEvent'),
      homeName:val('obsHomeName')||config().name,
      awayName:val('obsAwayName'),
      bugPosition:val('obsBugPosition')||'hidden',
      feedLayout:val('obsFeedLayout')==='full'?'full':'panel',
      sidePanel:val('obsSidePanel')||'brand',
      showScoreboard:Boolean(byId('obsShowScoreboard')?.checked),
      logoBug:val('obsLogoBug')||'auto',
      logoPreset:val('obsLogoPreset')||'ea',
      logoSize:clampInt(val('obsLogoSize'),32,160,48),
      logoX:clampInt(val('obsLogoX'),-400,400,0),
      logoY:clampInt(val('obsLogoY'),-400,400,0),
      homeScore:numberVal('obsHomeScore'),
      awayScore:numberVal('obsAwayScore'),
      period:val('obsPeriod')||'1ST',
      clock:clock.clock,
      clockRunning:clock.clockRunning,
      clockBaseSeconds:clock.clockBaseSeconds,
      clockStartedAt:clock.clockStartedAt,
      clockRate:clock.clockRate,
      record:val('obsRecord'),
      message:val('obsMessage'),
      intShotsHome:val('obsIntShotsHome'),
      intShotsAway:val('obsIntShotsAway'),
      intHitsHome:val('obsIntHitsHome'),
      intHitsAway:val('obsIntHitsAway'),
      intFaceoffsHome:val('obsIntFaceoffsHome'),
      intFaceoffsAway:val('obsIntFaceoffsAway'),
      finalShotsHome:val('obsFinalShotsHome'),
      finalShotsAway:val('obsFinalShotsAway'),
      finalPpHome:val('obsFinalPpHome'),
      finalPpAway:val('obsFinalPpAway'),
      finalSavesHome:val('obsFinalSavesHome'),
      finalSavesAway:val('obsFinalSavesAway'),
      playerName:val('obsPlayerName')||'PLAYER',
      playerNumber:val('obsPlayerNumber')||'00',
      playerRole:val('obsPlayerRole')||'PLAYER',
      streamUrl:streamUrl,
      streamProvider:selectedProvider==='auto'?providerFor(streamUrl,'auto'):selectedProvider,
      streamMuted:Boolean(byId('obsStreamMuted')?.checked),
      ...(isGbr()?{
        goalHornTrigger:gbrGoalTrigger||null,threeStarsUntil:gbrStarsUntil||null,
        rinkCamera:val('obsGbrCamera')||'ice',rinkFormation:val('obsGbrFormation')||'trap',
        rinkHighlight:numberVal('obsGbrHighlight')||88,rinkVisible:gbrRinkVisible
      }:{})
    };
  }
  async function loadState(force){
    if(!currentTeamId||!window.VVHLBackend?.db||publishing) return;
    if(!force&&isDirty()) return;
    var request=++stateRequest;
    var channel=config().channel;
    channelReady=false;
    updateDeskActions();
    setStatus('Loading channel');
    try{
      var result=await window.VVHLBackend.db.from('obs_broadcast_state').select('*').eq('channel',channel).maybeSingle();
      if(request!==stateRequest)return;
      if(result.error)throw result.error;
      fill(result.data);
      channelReady=true;
      setStatus(result.data?'Ready':'Channel ready to publish');
    }catch(err){
      if(request===stateRequest)setStatus('Load failed · '+(err?.message||'network'),true);
    }finally{
      if(request===stateRequest)updateDeskActions();
    }
  }
  async function publish(sceneOverride){
    if(!channelReady||!stateRef?.user||!allowedTeamIds(stateRef).includes(currentTeamId))return;
    if(sceneOverride)currentScene=sceneOverride;
    currentScene=currentScene||'game';
    setSceneButtons();
    if(publishing){publishQueued=true;return;}
    publishing=true;
    var channelAtSend=currentTeamId;
    var requestAtSend=stateRequest;
    var editsAtSend=editCount;
    setStatus('Publishing');
    updateDeskActions();
    var row={
      channel:config().channel,
      team_id:config().teamId||currentTeamId,
      brand:config().brand,
      scene:currentScene,
      payload:collectPayload(),
      is_public:true,
      updated_by:stateRef.user.id,
      updated_at:new Date().toISOString()
    };
    try{
      var result=await window.VVHLBackend.db.from('obs_broadcast_state').upsert(row,{onConflict:'channel'}).select('channel,updated_at').single();
      if(channelAtSend!==currentTeamId||requestAtSend!==stateRequest)return;
      if(result.error)throw result.error;
      savedEditCount=editsAtSend;
      updatePublished({...row,updated_at:result.data?.updated_at||row.updated_at});
      setStatus(isDirty()?'Unpublished changes':'Published');
    }catch(err){
      if(channelAtSend===currentTeamId&&requestAtSend===stateRequest)setStatus('Publish failed · '+(err?.message||'network'),true);
    }finally{
      publishing=false;
      updateDeskActions();
      if(publishQueued&&channelAtSend===currentTeamId&&requestAtSend===stateRequest){publishQueued=false;publish();}
      else {
        publishQueued=false;
        if(requestAtSend!==stateRequest&&currentTeamId&&!channelReady&&allowedTeamIds(stateRef||{}).includes(currentTeamId))loadState(true);
      }
    }
  }
  async function copyText(inputId,value){
    try{await navigator.clipboard.writeText(value);setStatus('URL copied');}
    catch{
      var input=byId(inputId);input.select();
      setStatus(document.execCommand('copy')?'URL copied':'URL selected for copying');
    }
  }
  function wire(){
    var tabs=Array.from(document.querySelectorAll('.obs-tabs [role="tab"]'));
    tabs.forEach(function(tab,index){
      tab.addEventListener('click',function(){activateTab(tab);});
      tab.addEventListener('keydown',function(event){
        var next=event.key==='Home'?tabs[0]:event.key==='End'?tabs[tabs.length-1]
          :event.key==='ArrowRight'?tabs[(index+1)%tabs.length]:event.key==='ArrowLeft'?tabs[(index+tabs.length-1)%tabs.length]:null;
        if(next){event.preventDefault();activateTab(next);next.focus();}
      });
    });
    document.querySelectorAll('[data-preview]').forEach(function(button){
      button.addEventListener('click',function(){previewMode=button.dataset.preview;updatePreview();});
    });
    byId('obsRetryCarbon').addEventListener('click',function(){
      setCarbonPreview('connecting');
      byId('obsPreview').src=CARBON_PREVIEW;
    });
    window.addEventListener('message',function(event){
      var data=event.data;
      if(previewMode==='pregame'&&event.origin===CARBON_ORIGIN&&event.source===byId('obsPreview').contentWindow
          &&data?.protocol==='icevision:desk-preview:1'&&['loading','ready','renderer-error'].includes(data.state)){
        setCarbonPreview(data.state);
      }
    });
    function markChanged(event){
      if(!event.target.matches('input:not([readonly]),select,textarea'))return;
      editCount++;
      setStatus('Unpublished changes');
    }
    document.querySelector('.obs-control-card').addEventListener('input',markChanged);
    document.querySelector('.obs-control-card').addEventListener('change',markChanged,true);
    byId('obsTeamSelect').addEventListener('change',async function(e){
      if(publishing){e.target.value=currentTeamId;return;}
      currentTeamId=e.target.value;
      window.localStorage.setItem('vvhl-team-context',config().teamId||currentTeamId);
      updateSourceLinks();
      setSceneButtons();
      await loadState(true);
    });
    document.querySelectorAll('#obsSceneStrip [data-preset]').forEach(function(button){
      button.addEventListener('click',async function(){
        applyScenePreset(button.dataset.preset);
        await publish(currentScene);
      });
    });
    document.querySelectorAll('[data-score][data-delta]').forEach(function(button){
      button.addEventListener('click',async function(){
        var id=button.dataset.score==='home'?'obsHomeScore':'obsAwayScore';
        var input=byId(id);
        input.value=Math.max(0,numberVal(id)+parseInt(button.dataset.delta,10));
        editCount++;
        updateScoreDisplay();
        await publish();
      });
    });
    byId('obsClockRate').addEventListener('change',function(){
      var current=clockSecondsNow();
      clockState.baseSeconds=current;
      clockState.startedAt=clockState.running?new Date().toISOString():'';
      clockState.rate=Number(byId('obsClockRate').value)||1;
      editCount++;
      syncClockUi();
      publish();
    });
    byId('obsClockSet').addEventListener('click',function(){
      clockState.running=false;
      clockState.startedAt='';
      clockState.baseSeconds=parseClock(val('obsClock'),clockState.baseSeconds);
      editCount++;
      byId('obsClock').value=formatClock(clockState.baseSeconds);
      syncClockUi();
      publish();
    });
    byId('obsClockStart').addEventListener('click',function(){
      if(clockState.running)return;
      clockState.baseSeconds=parseClock(val('obsClock'),clockState.baseSeconds);
      clockState.rate=Number(byId('obsClockRate').value)||1;
      clockState.startedAt=new Date().toISOString();
      clockState.running=clockState.baseSeconds>0;
      editCount++;
      syncClockUi();
      publish();
    });
    byId('obsClockPause').addEventListener('click',function(){
      clockState.baseSeconds=clockSecondsNow();
      clockState.running=false;
      clockState.startedAt='';
      byId('obsClock').value=formatClock(clockState.baseSeconds);
      editCount++;
      syncClockUi();
      publish();
    });
    byId('obsClockMinus').addEventListener('click',function(){
      clockState.baseSeconds=Math.max(0,clockSecondsNow()-5);
      clockState.startedAt=clockState.running?new Date().toISOString():'';
      byId('obsClock').value=formatClock(clockState.baseSeconds);
      editCount++;
      syncClockUi();
      publish();
    });
    byId('obsClockPlus').addEventListener('click',function(){
      clockState.baseSeconds=Math.max(0,clockSecondsNow()+5);
      clockState.startedAt=clockState.running?new Date().toISOString():'';
      byId('obsClock').value=formatClock(clockState.baseSeconds);
      editCount++;
      syncClockUi();
      publish();
    });
    byId('obsClockReset').addEventListener('click',function(){
      clockState.running=false;
      clockState.startedAt='';
      clockState.baseSeconds=1200;
      byId('obsClock').value='20:00';
      editCount++;
      syncClockUi();
      publish();
    });
    if(!clockUiTimer)clockUiTimer=setInterval(syncClockUi,250);
    byId('obsBugPosition').addEventListener('change',function(){publish();});
    byId('obsFeedLayout').addEventListener('change',function(){publish();});
    byId('obsSidePanel').addEventListener('change',function(){publish();});
    byId('obsPlayerStream').addEventListener('change',function(e){
      var pick=(OBS_CFG.playerStreams||[])[Number(e.target.value)];
      if(!pick){byId('obsStreamUrl').focus();return;}
      byId('obsStreamUrl').value=pick.url;
      byId('obsStreamProvider').value='auto';
      feedSummary();
      publish();
    });
    byId('obsStreamUrl').addEventListener('input',syncStreamSelect);
    byId('obsShowScoreboard').addEventListener('change',function(){publish();});
    ['obsLogoBug','obsLogoPreset','obsLogoSize','obsLogoX','obsLogoY'].forEach(function(id){
      byId(id).addEventListener('change',function(){publish();});
    });
    byId('obsLogoReset').addEventListener('click',function(){
      byId('obsLogoSize').value=48;byId('obsLogoX').value=0;byId('obsLogoY').value=0;editCount++;publish();
    });
    byId('obsStreamUrl').addEventListener('input',feedSummary);
    byId('obsStreamProvider').addEventListener('change',feedSummary);
    byId('obsStreamMuted').addEventListener('change',feedSummary);
    byId('attachStreamFeed').addEventListener('click',function(){publish();});
    byId('clearStreamFeed').addEventListener('click',async function(){
      byId('obsStreamUrl').value='';
      byId('obsStreamProvider').value='auto';
      byId('obsStreamMuted').checked=false;
      feedSummary();
      await publish();
    });
    byId('publishObsState').addEventListener('click',function(){publish();});
    byId('reloadObsState').addEventListener('click',function(){loadState(true);});
    byId('triggerGbrGoal').addEventListener('click',function(){
      if(currentTeamId!==GBR_STUDIO)return;
      gbrGoalTrigger=new Date().toISOString();
      publish();
    });
    byId('triggerGbrStars').addEventListener('click',function(){
      if(!isGbr())return;
      gbrStarsUntil=new Date(Date.now()+15000).toISOString();
      publish();
    });
    byId('obsToggleGbrRink').addEventListener('click',function(){
      if(!isGbr())return;
      gbrRinkVisible=!gbrRinkVisible;
      byId('obsToggleGbrRink').setAttribute('aria-pressed',String(gbrRinkVisible));
      publish();
    });
    byId('copyGbrObsUrl').addEventListener('click',function(){copyText('gbrObsUrl',gbrOverlayUrl());});
    byId('copyCarbonObsUrl').addEventListener('click',function(){copyText('carbonObsUrl',byId('carbonObsUrl').value);});
    byId('gbrObsUrl').value=gbrOverlayUrl();
    byId('openGbrObsUrl').href=gbrOverlayUrl();
    byId('copyObsUrl').addEventListener('click',function(){copyText('obsSourceUrl',stageUrl());});
    byId('copyOverlayUrl').addEventListener('click',function(){copyText('obsOverlayOnlyUrl',overlayUrl());});
    byId('copyFeedLayerUrl')?.addEventListener('click',function(){copyText('obsFeedLayerUrl',feedLayerUrl());});
  }
  function closeDesk(message){
    ++stateRequest;
    currentTeamId='';
    channelReady=false;
    byId('obsDeskControls').hidden=true;
    byId('obsPreview').removeAttribute('src');
    setCarbonPreview('');
    byId('obsTeamSelect').replaceChildren(new Option('No available channel',''));
    byId('heroChannel').textContent='NO CHANNEL';
    updatePublished(null);
    updateDeskActions();
    setStatus(message,true);
  }
  byId('obsAccountToggle').addEventListener('click',function(){
    var open=document.body.classList.toggle('obs-account-open');
    this.setAttribute('aria-expanded',String(open));
  });
  async function init(state){
    stateRef=state||window.VVHLBackend?.state||{};
    var authorized=Boolean(window.VVHLManagementGuard?.hasAccess(stateRef));
    byId('obsAccountToggle').hidden=!authorized;
    if(!authorized){
      document.body.classList.remove('obs-account-open');
      byId('obsAccountToggle').setAttribute('aria-expanded','false');
      if(initialized)closeDesk('Access restricted');
      return;
    }
    var userId=stateRef.user?.id||'';
    var previousTeam=currentTeamId;
    if(!populateTeams(stateRef)){closeDesk('No Studio channel assigned');return;}
    if(!initialized){
      populateStreams();
      renderSceneButtons();
      wire();
      watchPreviewSize();
      initialized=true;
    }else if(userId===lastUserId&&currentTeamId===previousTeam){
      return;
    }
    lastUserId=userId;
    byId('obsDeskControls').hidden=false;
    updateSourceLinks();
    setSceneButtons();
    if(publishing){++stateRequest;channelReady=false;updateDeskActions();}
    else await loadState(true);
  }
  window.addEventListener('vvhl-auth-change',function(event){init(event.detail);});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){init(window.VVHLBackend?.state);});
  else init(window.VVHLBackend?.state);
})();
