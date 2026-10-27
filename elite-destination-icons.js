/* Elitechel Media 3D destination controls.
   Small reusable destination buttons; existing masthead / logos remain untouched. */
(() => {
  'use strict';
  const file = location.pathname.split('/').pop() || 'index.html';
  const icon = (id) => {
    const paths = {
      league: '<path d="M12 2 20 6v12l-8 4-8-4V6Z"/><path d="m4 6 8 4 8-4M12 10v12"/>',
      chart: '<path d="M3 20h18v2H3zM5 12h4v7H5zM10 8h4v11h-4zM15 4h4v15h-4z"/>',
      mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M6 10a6 6 0 0 0 12 0h-2a4 4 0 0 1-8 0ZM11 16h2v4h4v2H7v-2h4z"/>',
      screens: '<rect x="2" y="3" width="9" height="8" rx="1"/><rect x="13" y="3" width="9" height="8" rx="1"/><rect x="2" y="13" width="9" height="8" rx="1"/><rect x="13" y="13" width="9" height="8" rx="1"/>',
      trophy: '<path d="M6 2h12v5c0 4-2 7-5 8v3h5v3H6v-3h5v-3c-3-1-5-4-5-8V2Zm-2 2v4c0 2 1 3 3 4l-1 2C2 13 1 11 1 8V4h3Zm16 0h3v4c0 3-1 5-5 6l-1-2c2-1 3-2 3-4V4Z"/>',
      cards: '<path d="M8 2h13v17H8zM5 5h2v15h12v2H5zM2 8h2v15h12v1H2z"/><path d="m14 5 1.1 3.3H19l-3 2.2 1.1 3.5-3.1-2.1-3.1 2.1 1.1-3.5-3-2.2h3.9Z" fill="#1e2430"/>',
      broadcast: '<circle cx="12" cy="12" r="3"/><path d="M5 4c-7 5-7 11 0 16l2-2c-5-4-5-8 0-12Zm14 0-2 2c5 4 5 8 0 12l2 2c7-5 7-11 0-16Z"/>',
      calendar: '<rect x="2" y="5" width="20" height="17" rx="2"/><path d="M6 2h3v6H6zM15 2h3v6h-3zM5 11h14v2H5z" fill="#18212e"/>',
      shield: '<path d="M12 1 21 5v7c0 6-4 9-9 11-5-2-9-5-9-11V5Z"/><path fill="#19202b" d="m12 6 2 4 4.4.6-3.2 3.1.8 4.4-4-2.1-4 2.1.8-4.4-3.2-3.1L10 10Z"/>',
      puck: '<ellipse cx="12" cy="9" rx="10" ry="5"/><path d="M2 9v7c0 7 20 7 20 0V9c-1 7-19 7-20 0Z"/>',
      scores: '<rect x="2" y="4" width="20" height="16" rx="2"/><path fill="#19202b" d="M5 7h6v4H5zM13 7h6v4h-6zM5 14h14v3H5z"/>',
      players: '<circle cx="12" cy="7" r="5"/><path d="M3 21c0-5 4-8 9-8s9 3 9 8v1H3Z"/>'
    };
    return '<svg class="ecm3d-symbol" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">'+(paths[id] || paths.shield)+'</svg>';
  };
  const tile = (item) => {
    const className = 'ecm3d-link' + (item.red ? ' ecm3d-red' : '') + (item.ice ? ' ecm3d-ice' : '');
    const art = item.img
      ? '<img src="' + item.img + '" loading="lazy" alt="" width="42" height="42">'
      : icon(item.icon);
    return '<a class="'+className+'" href="'+item.href+'"><span class="ecm3d-bezel"><span class="ecm3d-face">'+art+'</span></span><span class="ecm3d-label">'+item.text+'</span></a>';
  };
  const configs = {
    'index.html': {
      anchor: '.desks-band', heading: 'QUICK LAUNCH', description: 'Your shortcuts to every corner of the network',
      items: [
        {text:'LG3s Desk',href:'lg3s-media.html',img:'assets/lg3s/art/lg3s-crest-64.webp',ice:true},
        {text:'Leaderboards',href:'league-leaderboards.html?league=lgchl',icon:'chart'},
        {text:'Hitmen Radio',href:'lgchl-media.html#lgRadioSec',icon:'mic',red:true},
        {text:'Multiview',href:'multiview.html',icon:'screens'},
        {text:'Tournaments',href:'interest.html?program=hut',icon:'trophy'},
        {text:'Superstar Cards',href:'player-cards.html',icon:'cards'}
      ]
    },
    'hitmen-media.html': {
      anchor: '.art-banner', heading: 'HITMEN CONTROL PANEL', description: '',
      items: [
        {text:'Postgame',href:'hitmen-postgame.html',icon:'scores',red:true},
        {text:'Hitmen Live',href:'game-center.html?channel=hitmen',icon:'broadcast',red:true},
        {text:'Standings',href:'#race',icon:'chart',red:true},
        {text:'Superstar Cards',href:'player-cards.html?league=lgchl',icon:'cards',red:true}
      ]
    },
    'lgchl-media.html': {
      anchor: '.lg-hero', heading: 'LGCHL CONTROL PANEL', description: '',
      items: [
        {text:'Leaderboards',href:'league-leaderboards.html?league=lgchl',icon:'chart'},
        {text:'Hitmen Radio',href:'#lgRadioSec',icon:'mic',red:true},
        {text:'Superstar Cards',href:'player-cards.html?league=lgchl',icon:'cards'},
        {text:'Hitmen Desk',href:'hitmen-media.html',img:'assets/lgchl/s55/team412.png',red:true}
      ]
    },
    'lg3s-media.html': {
      anchor: '.th-banner', heading: 'LG3S CONTROL PANEL', description: '',
      items: [
        {text:'Scores',href:'#scoreboard',icon:'scores',ice:true},
        {text:'Standings',href:'#standings',icon:'chart',ice:true},
        {text:'Leaderboards',href:'league-leaderboards.html?league=lg3s',icon:'trophy',ice:true},
        {text:'Superstar Cards',href:'player-cards.html?league=lg3s',icon:'cards',ice:true}
      ]
    },
    'esports-hub.html': {
      anchor: '.lh-hero', heading: 'BROADCAST CONTROLS', description: '',
      items: [
        {text:'Multiview',href:'multiview.html?hub=1',icon:'screens'},
        {text:'Hitmen Live',href:'game-center.html?channel=hitmen',icon:'broadcast',red:true},
        {text:'LG3s Desk',href:'lg3s-media.html',img:'assets/lg3s/art/lg3s-crest-64.webp',ice:true},
        {text:'Superstar Cards',href:'player-cards.html',icon:'cards'}
      ]
    }
  };
  const config = configs[file];
  if (!config) return;
  const section = document.querySelector(config.anchor);
  if (!section) return;
  const h = document.createElement('section');
  h.className = 'ecm3d-destinations band'+(file==='index.html' ? ' ecm3d-home' : ' ecm3d-compact');
  h.setAttribute('aria-label',config.heading);
  h.innerHTML = '<div class="ecm3d-inner"><div class="ecm3d-head"><h2>'+config.heading+'</h2>'+
    (config.description?'<p>'+config.description+'</p>':'')+'</div><nav class="ecm3d-grid" aria-label="3D destination shortcuts">'+config.items.map(tile).join('')+'</nav></div>';
  section.insertAdjacentElement('afterend',h);
})();