/* Opt-in Calgary architecture study. Remove these two assets to revert. */
(()=>{'use strict';
 const params=new URLSearchParams(location.search);
 if(params.get('room')!=='prototype'||Number(params.get('team')||412)!==412)return;
 const themes={
  WHL:{label:'WESTERN HOCKEY LEAGUE',accent:'#df4354',material:'#66462d',image:'assets/lgchl/lockers/s55-saddledome-teamroom.webp'},
  OHL:{label:'ONTARIO HOCKEY LEAGUE',accent:'#69b4ff',material:'#494435',image:null},
  QMJHL:{label:'QUEBEC MARITIMES JUNIOR HOCKEY LEAGUE',accent:'#e7bb63',material:'#5a4630',image:null}
 };
 // Shared theme contract; other clubs stay on their approved room until enabled.
 const theme=themes.WHL;
 document.body.dataset.roomPrototype='true';
 document.body.style.setProperty('--room-light',theme.accent);
 document.body.style.setProperty('--room-wood',theme.material);
 const beam=document.querySelector('.ec-room-beam');
 beam.innerHTML='<span>LGCHL · S55</span><strong>CALGARY / THE LOCKER ROOM</strong><span>DESIGN PREVIEW</span>';
 const displays=document.createElement('div');displays.className='room-displays';
 displays.setAttribute('aria-label','League identity displays');
 displays.innerHTML='<div class="room-display room-display-side"><span>ELITE CHEL MEDIA</span><strong>THIS IS OUR ROOM.</strong><small>SEASON 55 · CALGARY</small></div><div class="room-display room-display-main"><span>'+theme.label+'</span><strong>HITMEN HOCKEY</strong><small>LGCHL · SEASON 55</small></div><div class="room-display room-display-side"><span>THE MAIN ROSTER</span><strong>BUILT AS ONE.</strong><small>OPEN A STALL TO MEET THE PLAYER</small></div>';
 document.querySelector('.ec-locker-theatre').prepend(displays);
 const floor=document.querySelector('.ec-locker-floor');
 floor.innerHTML='<strong>LGCHL</strong><span>ELITE CHEL MEDIA · SEASON 55</span>';
 const note=document.createElement('p');note.className='room-prototype-note';
 note.textContent='Architecture study · Existing Calgary jersey and crest assets. League display artwork and equipment details remain provisional. Roster and cards use the public Season 55 data.';
 document.querySelector('.ec-room-stage').append(note);
})();
