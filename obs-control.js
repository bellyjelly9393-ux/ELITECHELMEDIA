(function(){
  'use strict';
  var PRODUCTION_ORIGIN='https://wildmanhockey-elitechelmedia.app';
  var CARBON_PATH='/lg3s-gb/arena/';
  var CARBON_PREVIEW=CARBON_PATH+'broadcast.html?preview=desk';
  var carbonTimeout=0;
  var carbonRequest=0;
  var czechiaLinkRequest=0;
  var czechiaView='arena';
  var czechiaFixtures=[];
  var czechiaAppliedFeed='';
  var OBS_CFG=window.WM_OBS_CONFIG||{defaultFeedFor:function(){return '';}};
  var SCENES=window.WM_OBS_SCENES||null;
  var MEDIA_TEAM_ID='5f36117c-7a51-4514-bf70-d4c672b41e48';
  var GBR_STUDIO=MEDIA_TEAM_ID+':gbr';
  var CZECHIA_STUDIO=MEDIA_TEAM_ID+':czechia';
  var TEAM_CONFIG={
    '5f36117c-7a51-4514-bf70-d4c672b41e48':{name:'Elitechel Media',brand:'wildman',channel:'wildman-main'},
    [CZECHIA_STUDIO]:{name:'World Juniors · Czechia',channel:'wjhc-czechia',brand:'wildman',teamId:MEDIA_TEAM_ID},
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
    byId('obsSceneStrip').inert=!channelReady;
    byId('publishObsState').disabled=!channelReady||publishing;
    byId('reloadObsState').disabled=!currentTeamId||publishing;
    byId('obsTeamSelect').disabled=publishing||!allowedTeamIds(stateRef||{}).length;
    byId('obsDeskControls').inert=!(channelReady||isCzechia());
  }
  function updatePublished(row){
    var scene=SCENES?.infer(row?.scene||'game',row?.payload||{});
    byId('obsPublishedScene').textContent=row?.updated_at?(scene?.label||row.scene||'Gameplay'):'—';
    byId('stateUpdated').textContent=row?.updated_at
      ? 'Saved '+new Date(row.updated_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'})
      : 'No state published';
  }
  function isCzechia(){return currentTeamId===CZECHIA_STUDIO;}
  function czechiaGame(){return isCzechia()?val('obsCzechiaGame'):'';}
  function carbonPath(game){return game?'/czechia/arena/'+encodeURIComponent(game)+'/':CARBON_PATH;}
  function carbonPreviewUrl(){
    var game=czechiaGame();
    if(game&&previewMode==='pregame')return carbonPath(game)+'broadcast.html?preview=desk&team=czechia&game='+encodeURIComponent(game);
    return isGbr()&&previewMode==='pregame'?CARBON_PREVIEW:'';
  }
  function czechiaUrl(){
    if(!czechiaGame())return '';
    var url=new URL('/czechia-obs.html',location.origin);
    url.searchParams.set('game',czechiaGame());
    if(byId('obsIncludeCrew')?.checked){
      for(var [param,id] of [['pbp','obsCzechiaPlayByPlay'],['analyst','obsCzechiaAnalyst']]){
        if(val(id))url.searchParams.set(param,val(id));
      }
    }
    return url.href;
  }
  function updateCzechiaFeed(){
    var stream=OBS_CFG.czechiaFeedUrl(czechiaAppliedFeed);
    var url=stream?location.origin+'/obs-stage.html?channel=wjhc-czechia&layer=feed&stream='+encodeURIComponent(stream):'';
    byId('obsCzechiaFeedUrl').value=url;
    byId('copyCzechiaFeedUrl').disabled=!url;
    byId('openCzechiaFeedUrl').hidden=!url;
    if(url)byId('openCzechiaFeedUrl').href=url+'&preview=1';
  }
  function renderCzechiaMatchup(){
    var panel=byId('obsCzechiaMatchupDock');
    if(!panel)return;
    panel.hidden=!isCzechia();
    if(panel.hidden)return;
    var game=czechiaFixtures.find(function(item){return item.key===czechiaGame();});
    var heading=byId('obsCzechiaMatchupTitle');
    var rows=byId('obsCzechiaMatchupRows');
    heading.textContent=game?'Czechia vs '+game.opponent+' · '+game.time:'Pregame matchup';
    rows.replaceChildren();
    if(!game){rows.textContent='Select a fixture to load posted lineups.';return;}
    var table=document.createElement('table');
    table.style.cssText='width:100%;text-align:left;border-spacing:0 .4rem';
    function row(values,cell){
      var line=table.insertRow();
      values.forEach(function(value){var item=document.createElement(cell);item.textContent=value;line.append(item);});
    }
    row(['Position','Czechia',game.opponent],'th');
    ['LW','C','RW','LD','RD','G'].forEach(function(position){
      function name(players){return players.find(function(player){return player.position===position;})?.name||'—';}
      row([position,name(game.czech),name(game.away)],'td');
    });
    rows.append(table);
  }
  function updateCzechiaSource(){
    var game=czechiaGame();
    var url=czechiaUrl();
    var input=byId('obsCzechiaCarbonUrl');
    if(input.dataset.game!==game){
      ++czechiaLinkRequest;
      input.dataset.game=game;
      input.value='';
    }
    byId('copyCzechiaCarbonUrl').disabled=!game;
    byId('copyCzechiaUrl').disabled=!game;
    byId('obsCzechiaCarbonStatus').textContent=game?'Private link for the selected matchup. Valid for 90 days.':'The private link is available when a matchup is selected.';
    byId('obsCzechiaUrl').value=url;
    byId('openCzechiaUrl').href=url;
    byId('openCzechiaUrl').hidden=!game;
    renderCzechiaMatchup();
    updatePreview();
  }
  async function loadCzechiaGames(request){
    var select=byId('obsCzechiaGame');
    var previous=select.value;
    var status=byId('obsCzechiaScheduleStatus');
    select.disabled=true;
    try{
      var feed=window.ECMCzechiaPregame;
      var snapshot=await feed.load();
      if(request!==stateRequest||!isCzechia())return;
      var today=feed.today();
      var games=snapshot.games.filter(function(game){return game.date===today;});
      czechiaFixtures=games;
      select.replaceChildren(...games.map(function(game){return new Option(game.time+' · '+game.opponent,game.key);}));
      if(!games.length)select.add(new Option('No game listed tonight',''));
      if(games.some(function(game){return game.key===previous;}))select.value=previous;
      select.disabled=!games.length;
      status.textContent=(snapshot.usingSeed?'Saved schedule · ':'LeagueGaming · ')+
        (games.length?games.length+' '+(games.length===1?'matchup':'matchups')+' tonight. Posted lineups refresh at 11 a.m. ET.':'No Czechia game is listed tonight.');
      byId('stateUpdated').textContent=games.length?games.length+' game sources':'No game sources tonight';
      updateCzechiaSource();
    }catch{
      if(request!==stateRequest||!isCzechia())return;
      czechiaFixtures=[];
      select.replaceChildren(new Option('Schedule unavailable',''));
      status.textContent='The tournament schedule could not load. Refresh the desk to retry.';
      updateCzechiaSource();
    }
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
    var scale=width/((isGbr()||isCzechia())?1920:1280);
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
      connecting:['Connecting to Carbon Arena','Checking your OBS Desk access.'],
      loading:['Loading the Elite Labs rink','The warmup preview opens when the arena renders.'],
      unreachable:['Carbon Arena is unavailable','Try again to reload the arena from Elite Chel Media.'],
      unauthorized:['Carbon Arena access required','Sign in with an OBS Desk management account, then try again.'],
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
  async function requestCarbon(route,game){
    var {data}=await window.VVHLBackend.db.auth.getSession();
    if(!data?.session?.access_token)return {ok:false,status:401};
    return fetch(carbonPath(game)+route,{
      method:'POST',
      headers:{Authorization:'Bearer '+data.session.access_token}
    });
  }
  async function openCarbonPreview(){
    var url=carbonPreviewUrl();
    if(!url)return;
    var request=++carbonRequest;
    var monitor=byId('obsPreview');
    monitor.removeAttribute('src');
    byId('obsOpenMonitor').removeAttribute('href');
    setCarbonPreview('connecting');
    try{
      var response=await requestCarbon('preview-session',czechiaGame());
      if(request!==carbonRequest||url!==carbonPreviewUrl())return;
      if(!response.ok){
        setCarbonPreview([401,403].includes(response.status)?'unauthorized':'unreachable');
        return;
      }
      setCarbonPreview('loading');
      monitor.src=url;
      byId('obsOpenMonitor').href=url;
    }catch{
      if(request===carbonRequest&&url===carbonPreviewUrl())setCarbonPreview('unreachable');
    }
  }
  function updatePreview(){
    var channel=encodeURIComponent(config().channel);
    if(!isGbr()&&!isCzechia()&&['sample','pregame','lineup'].includes(previewMode))previewMode='program';
    var program='/obs-stage.html?channel='+channel+'&preview=1';
    var graphics=isGbr()?'/lg3s-gb?mode=obs&audio=off':'/obs-overlay.html?channel='+channel;
    var carbon=carbonPreviewUrl();
    var source=isCzechia()?(czechiaView==='gameplay'?(val('obsCzechiaFeedUrl')?val('obsCzechiaFeedUrl')+'&preview=1':'about:blank'):(czechiaUrl()||'/czechia-obs.html')):previewMode==='lineup'?'/lg3s-gb/pregame?mode=obs':previewMode==='sample'?graphics+'&preview=true':previewMode==='graphics'?graphics:program;
    if(isCzechia()){
      source=({feed:val('obsCzechiaFeedUrl')+'&preview=1',program:program,graphics:graphics,pregame:czechiaUrl(),lineup:czechiaUrl(),sample:'/czechia-obs.html?game=germany'})[previewMode]||'/czechia-obs.html';
    }
    var monitor=byId('obsPreview');
    var frame=byId('obsPreviewFrame');
    var width=(isGbr()||isCzechia())?1920:1280;
    var height=(isGbr()||isCzechia())?1080:720;
    var canvas=byId('obsPreviewCanvas');
    canvas.style.width=width+'px';
    canvas.style.height=height+'px';
    monitor.width=width;
    monitor.height=height;
    monitor.title=isCzechia()?'Czechia private Carbon Arena pregame monitor':carbon?'Elite Labs Carbon Arena pregame monitor':previewMode==='lineup'?'Great Britain 3D rink starting lineup':previewMode==='program'?'OBS program monitor':'OBS graphics monitor';
    if(carbon){
      if(frame.dataset.carbonTarget!==carbon)openCarbonPreview();
    }else{
      ++carbonRequest;
      setCarbonPreview('');
      if(monitor.getAttribute('src')!==source)monitor.src=source;
      byId('obsOpenMonitor').href=source;
    }
    frame.dataset.carbonTarget=carbon;
    frame.dataset.mode=previewMode;
    byId('obsPreviewDimensions').textContent=width+' × '+height+((isGbr()||isCzechia())?' · 60 FPS source':'');
    if(!carbon)byId('obsMonitorNote').textContent=isCzechia()?({feed:'Gameplay feed · Off-air preview',program:'Program monitor',graphics:'Graphics · Off-air preview',lineup:'Web tactics · Posted lineups',sample:'Sample matchup · Off-air preview',pregame:'Carbon Arena · Off-air preview'}[previewMode]):previewMode==='lineup'?'Current GBR starting four · 3D rink · Off-air preview':previewMode==='sample'?'Sample GBR graphics · Muted'
      :previewMode==='graphics'?'Transparent graphics · Muted':'Game feed and graphics · Muted';
    document.querySelectorAll('[data-preview]').forEach(function(button){
      button.hidden=['sample','pregame','lineup'].includes(button.dataset.preview)&&!isGbr()&&!isCzechia();
      button.setAttribute('aria-pressed',String(button.dataset.preview===previewMode));
    });
    fitPreviewCanvas();
  }
  function updateSourceLinks(){
    var czechia=isCzechia();
    for(var id of ['obsLiveControls','obsPreviewSwitch','publishObsState','reloadObsState'])byId(id).hidden=czechia;
    byId('obsCzechiaControls').hidden=!czechia;
    renderCzechiaMatchup();
    if(czechia){
      previewMode='pregame';
      byId('czechProgramSource').value=stageUrl();
      byId('heroChannel').textContent='WORLD JUNIORS · CZECHIA';
      byId('obsGbrCues').hidden=true;
      updateCzechiaSource();
      updateCzechiaFeed();
      return;
    }
    var stage=stageUrl(),overlay=overlayUrl();
    byId('obsSourceUrl').value=stage;
    byId('openObsUrl').href=stage;
    byId('obsOverlayOnlyUrl').value=overlay;
    byId('openOverlayUrl').href=overlay;
    byId('openCombinedStage').href=stage+'&preview=1';
    byId('obsFeedLayerUrl').value=feedLayerUrl();
    byId('openFeedLayerUrl').href=feedLayerUrl();
    byId('testGameplayFeed').href=feedLayerUrl()+'&preview=1';
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
    var requested=new URLSearchParams(location.search).get('channel');
    var requestedId=ids.find(function(id){return TEAM_CONFIG[id].channel===requested;});
    var preferred=ids.includes(currentTeamId)?currentTeamId:(requestedId||(ids.includes(state.teamId)?state.teamId:ids[0]));
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
      if(button.dataset.preset==='pregame-gbr'){
        button.querySelector('b').textContent=isCzechia()?'Carbon Rink':'Pregame';
      }
      button.hidden=(isGbr()||isCzechia())? !['game-matchup','pregame-gbr','starting','intermission','final','brb'].includes(button.dataset.preset)
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
    if(isCzechia())setValue('czechIntermissionImage',p.intermissionImage||'');
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
    setValue('obsGbrHighlight',[1,2,3,4].includes(Number(p.rinkHighlight))?Number(p.rinkHighlight):1);
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
        rinkHighlight:numberVal('obsGbrHighlight')||1,rinkVisible:gbrRinkVisible
      }:{})
    };
  }
  async function loadState(force){
    if(!currentTeamId||!window.VVHLBackend?.db||publishing) return;
    if(!force&&isDirty()) return;
    var request=++stateRequest;
    var channel=config().channel;
    if(isCzechia())loadCzechiaGames(request);
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
      payload:isCzechia()?Object.assign(collectPayload(),{
        gameKey:czechiaGame(),homeName:'Czechia',
        intermissionImage:val('czechIntermissionImage'),
        awayName:czechiaFixtures.find(function(g){return g.key===czechiaGame();})?.opponent||'Opponent',
        streamUrl:OBS_CFG.czechiaFeedUrl(czechiaAppliedFeed),streamProvider:providerFor(czechiaAppliedFeed,'auto')
      }):collectPayload(),
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
    var message;
    try{await navigator.clipboard.writeText(value);message='URL copied';}
    catch{
      var input=byId(inputId);input.select();
      message=document.execCommand('copy')?'URL copied':'URL selected for copying';
    }
    setStatus(message);
    return message;
  }
  async function copyCzechiaCarbonUrl(){
    var game=czechiaGame();
    if(!game)return;
    var request=++czechiaLinkRequest;
    var button=byId('copyCzechiaCarbonUrl');
    var input=byId('obsCzechiaCarbonUrl');
    var status=byId('obsCzechiaCarbonStatus');
    button.disabled=true;
    try{
      if(!input.value){
        var response=await requestCarbon('program-link',game);
        if(!response.ok)throw new Error('Link unavailable');
        var {token}=await response.json();
        if(request!==czechiaLinkRequest||game!==czechiaGame())return;
        input.value=location.origin+'/lg3s-carbon-source.html?game='+encodeURIComponent(game)+'#'+token;
      }
      var message=await copyText(input.id,input.value);
      if(request===czechiaLinkRequest)status.textContent=message+'. Set the OBS source to 1920 × 1080 at 60 FPS.';
    }catch{
      if(request===czechiaLinkRequest)status.textContent='Could not generate the private OBS URL. Check your OBS Desk access and try again.';
    }finally{
      if(request===czechiaLinkRequest)button.disabled=false;
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
    byId('obsRetryCarbon').addEventListener('click',openCarbonPreview);
    byId('previewCarbonObs').addEventListener('click',function(){
      previewMode='pregame';
      updatePreview();
      byId('obsPreviewFrame').scrollIntoView({block:'nearest'});
    });
    window.addEventListener('message',function(event){
      var data=event.data;
      if(carbonPreviewUrl()&&event.origin===location.origin&&event.source===byId('obsPreview').contentWindow
          &&(!isCzechia()||data?.game===czechiaGame())
          &&data?.protocol==='icevision:desk-preview:1'&&['loading','ready','renderer-error'].includes(data.state)){
        setCarbonPreview(data.state);
      }
    });
    function markChanged(event){
      if(!event.target.matches('input:not([readonly]),select,textarea'))return;
      editCount++;
      setStatus('Unpublished changes');
    }
    ['obsCzechiaPlayByPlay','obsCzechiaAnalyst'].forEach(function(id){
      var input=byId(id);
      if(!input)return;
      var key='ecm-czechia-commentary:'+id;
      try{input.value=localStorage.getItem(key)||'';}catch{}
      input.addEventListener('change',function(){try{localStorage.setItem(key,input.value.trim());}catch{}});
    });
    ['obsIncludeCrew','obsCzechiaPlayByPlay','obsCzechiaAnalyst'].forEach(function(id){
      byId(id)?.addEventListener('change',function(){if(isCzechia())updateCzechiaSource();});
    });
    var czechiaInput=byId('obsCzechiaStream');
    var fetchButton=byId('fetchCzechiaFeed');
    try{czechiaInput.value=localStorage.getItem('ecm-czechia-gameplay-v1')||czechiaInput.value;}catch{}
    czechiaAppliedFeed=val('obsCzechiaStream');
    if(!fetchButton)czechiaInput.addEventListener('input',function(){czechiaAppliedFeed=val('obsCzechiaStream');updateCzechiaFeed();});
    function applyCzechiaFeed(){
      var value=val('obsCzechiaStream');
      if(!OBS_CFG.czechiaFeedUrl(value)){byId('obsCzechiaFeedStatus').textContent='Enter a valid Twitch or YouTube link.';return;}
      czechiaAppliedFeed=value;
      try{localStorage.setItem('ecm-czechia-gameplay-v1',value);}catch{}
      updateCzechiaFeed();
      previewMode='feed';
      updatePreview();
      byId('obsCzechiaFeedStatus').textContent='Feed selected for preview. Press Gameplay to send it to the program source.';
    }
    fetchButton?.addEventListener('click',applyCzechiaFeed);
    czechiaInput.addEventListener('change',function(){if(isCzechia()&&val('obsCzechiaStream')!==czechiaAppliedFeed)applyCzechiaFeed();});
    czechiaInput.addEventListener('paste',function(){setTimeout(function(){if(isCzechia())applyCzechiaFeed();},0);});
    document.querySelectorAll('[data-czechia-view]').forEach(function(button){
      button.addEventListener('click',function(){czechiaView=button.dataset.czechiaView;updatePreview();});
    });
    byId('refreshCzechiaFixtures')?.addEventListener('click',function(){loadCzechiaGames(++stateRequest);});
    byId('copyCzechiaFeedUrl').addEventListener('click',function(){copyText('obsCzechiaFeedUrl',val('obsCzechiaFeedUrl'));});
    byId('obsCzechiaGame').addEventListener('change',updateCzechiaSource);
    byId('copyCzechCombined').addEventListener('click',async function(){
      var game=czechiaGame();
      var status=byId('czechCombinedStatus');
      if(!game){status.textContent='Select a matchup first.';return;}
      var button=this;
      button.disabled=true;
      try{
        var response=await requestCarbon('program-link',game);
        if(!response.ok)throw new Error('Carbon access unavailable');
        var {token}=await response.json();
        if(!token||game!==czechiaGame())return;
        var url=new URL(stageUrl());
        url.searchParams.set('carbonGame',game);
        url.hash=token;
        byId('czechProgramSource').value=url.href;
        status.textContent=await copyText('czechProgramSource',url.href);
      }catch{
        status.textContent='Could not create the Carbon program link. Check management access and retry.';
      }finally{button.disabled=false;}
    });
    byId('copyCzechProgram').onclick=function(){
      byId('czechProgramSource').value=stageUrl();
      copyText('czechProgramSource',stageUrl());
    };
    byId('copyCzechiaUrl').addEventListener('click',function(){copyText('obsCzechiaUrl',czechiaUrl());});
    byId('copyCzechiaCarbonUrl').addEventListener('click',copyCzechiaCarbonUrl);
    byId('obsLiveControls').addEventListener('input',markChanged);
    byId('obsLiveControls').addEventListener('change',markChanged,true);
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
    byId('copyCarbonObsUrl').addEventListener('click',async function(){
      var button=this;
      var input=byId('carbonObsUrl');
      if(input.value){await copyText(input.id,input.value);return;}
      button.disabled=true;
      try{
        var response=await requestCarbon('program-link');
        if(!response.ok)throw new Error('Link unavailable');
        var {token}=await response.json();
        input.value=location.origin+'/lg3s-carbon-source.html#'+token;
        await copyText(input.id,input.value);
      }catch{
        setStatus('Could not generate the Carbon Arena URL. Check your sign-in and try again.',true);
      }finally{
        button.disabled=false;
      }
    });
    byId('gbrObsUrl').value=gbrOverlayUrl();
    byId('openGbrObsUrl').href=gbrOverlayUrl();
    byId('copyObsUrl').addEventListener('click',function(){copyText('obsSourceUrl',stageUrl());});
    byId('copyOverlayUrl').addEventListener('click',function(){copyText('obsOverlayOnlyUrl',overlayUrl());});
    byId('copyFeedLayerUrl')?.addEventListener('click',function(){copyText('obsFeedLayerUrl',feedLayerUrl());});
  }
  function closeDesk(message){
    ++stateRequest;
    ++carbonRequest;
    ++czechiaLinkRequest;
    previewMode='program';
    currentTeamId='';
    channelReady=false;
    byId('obsDeskControls').hidden=true;
    byId('obsPreview').removeAttribute('src');
    byId('obsPreviewFrame').dataset.carbonTarget='';
    byId('carbonObsUrl').value='';
    byId('obsCzechiaCarbonUrl').removeAttribute('data-game');
    byId('obsCzechiaCarbonUrl').value='';
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
