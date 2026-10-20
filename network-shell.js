(() => {
  const body = document.body;
  body?.classList.add('wm-ds','wm-theme-wildman');

  if (!document.querySelector('link[href*="network-v2.css"]')) {
    const polish = document.createElement('link');
    polish.rel = 'stylesheet';
    polish.href = 'network-v2.css?v=20261001nav1';
    document.head.appendChild(polish);
  }

  if (!document.querySelector('link[href*="brand-refresh.css"]')) {
    const brandRefresh = document.createElement('link');
    brandRefresh.rel = 'stylesheet';
    brandRefresh.href = 'brand-refresh.css?v=20260928-channel-split';
    document.head.appendChild(brandRefresh);
  }

  const isPrivate = body?.classList.contains('management-protected');
  const path = location.pathname.split('/').pop() || 'index.html';

  const groups = {
    'index.html':'index.html',
    'team.html':'team.html','history.html':'team.html',
    'esports-hub.html':'esports-hub.html','esports-team.html':'esports-hub.html','services.html':'esports-hub.html',
    'events.html':'events.html','event-format.html':'events.html','pro-series.html':'events.html','caps-gaming.html':'events.html',
    'game-center.html':'game-center.html','live-channel.html':'game-center.html','multiview.html':'game-center.html','vod-center.html':'game-center.html','reports.html':'game-center.html','game.html':'game-center.html','live-game.html':'game-center.html','postgame.html':'game-center.html',
    
    'academy.html':'academy.html','academy-training.html':'academy.html',
    'signup.html':'interest.html','interest.html':'interest.html','lgchl-leaders.html':'lgchl-leaders.html',
    'management.html':'management.html',
    'hitmen-media.html':'hitmen-media.html','lgchl-media.html':'hitmen-media.html'
  };
  const activePath = groups[path] || path;

  const simpleLink=(href,label)=>`<a href="${href}"${activePath===href?' class="active-nav"':''}>${label}</a>`;
  const dropdown=(label,key,items)=>`
    <div class="nav-menu ${activePath===key?'active-nav-group':''}">
      <button class="nav-menu-trigger" type="button" aria-haspopup="true" aria-expanded="false">${label}<span>⌄</span></button>
      <div class="nav-menu-panel">
        ${items.map(([href,title,sub])=>`<a href="${href}"><b>${title}</b><small>${sub}</small></a>`).join('')}
      </div>
    </div>`;

  if (!isPrivate) {
    const header = document.querySelector('.site-header');
    if (header) {
      header.innerHTML = `
        <a class="brand" href="index.html" aria-label="Elitechel Media home">
          <span class="wm-brand-mark">E</span>
          <span class="brand-copy wm-brand-copy">ELITECHEL<br><b>MEDIA</b></span>
        </a>
        <button class="menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false">☰</button>
        <nav class="main-nav">
          ${simpleLink('index.html','Home')}
          ${dropdown('Live Hub','esports-hub.html',[
            ['esports-hub.html#lgchl','LGCHL Games','Public league broadcasts'],
            ['esports-hub.html#hitman','Hitman Live','Elitechel Media broadcast channel'],
            ['esports-hub.html#lg3s','LG Threes','Public LG Threes streams'],
            ['multiview.html','Multiview','Build your own multi-stream view']
          ])}
          ${dropdown('Media','hitmen-media.html',[
            ['hitmen-media.html','Hitmen Desk','Calgary Hitmen coverage'],
            ['lgchl-media.html','LG CHL Desk','League news, stats and power rankings'],
            ['lgchl-media.html#lgRadioSec','Hitmen Radio','The Elitechel Media video show']
          ])}
          ${simpleLink('lgchl-leaders.html','Stats')}
          ${simpleLink('interest.html?program=hut','HUT Tournament')}
          ${simpleLink('management.html','Management')}
        </nav>
        <a class="wm-join-btn" href="interest.html?program=hut">Register Interest</a>
      `;

      header.querySelectorAll('.nav-menu-trigger').forEach(trigger=>{
        trigger.addEventListener('click',()=>{
          const group=trigger.closest('.nav-menu');
          const next=!group.classList.contains('open');
          header.querySelectorAll('.nav-menu.open').forEach(x=>{
            x.classList.remove('open');
            x.querySelector('.nav-menu-trigger')?.setAttribute('aria-expanded','false');
          });
          group.classList.toggle('open',next);
          trigger.setAttribute('aria-expanded',String(next));
        });
      });
      header.querySelectorAll('.nav-menu-panel a').forEach(a=>a.addEventListener('click',()=>{
        header.querySelectorAll('.nav-menu.open').forEach(x=>x.classList.remove('open'));
      }));
      document.addEventListener('click',e=>{
        if(!e.target.closest('.nav-menu')){
          header.querySelectorAll('.nav-menu.open').forEach(x=>{
            x.classList.remove('open');
            x.querySelector('.nav-menu-trigger')?.setAttribute('aria-expanded','false');
          });
        }
      });
    }

    document.querySelector('.wm-network-strip')?.remove();
  }

  document.querySelectorAll('a[href="#"]').forEach(a => {
    a.addEventListener('click', e => e.preventDefault());
  });

  if (!document.querySelector('link[href*="network-cleanup.css"]')) {
    const clean=document.createElement('link'); clean.rel='stylesheet'; clean.href='network-cleanup.css?v=20261010-2'; document.head.appendChild(clean);
  }

  if (!document.querySelector('script[src*="ui-polish.js"]')) {
    const s=document.createElement('script');
    s.src='ui-polish.js?v=20260920a';
    s.async=false;
    document.body.appendChild(s);
  }
})();