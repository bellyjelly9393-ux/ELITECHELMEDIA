'use strict';
const one = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const trophies = {
  WHL: ['a99efb2fb253b534ae24cadf6ce95b08.webp','Ed Chynoweth Cup'],
  OHL: ['c458800421301353d09f1728b488ba85.webp','J. Ross Robertson Cup'],
  QMJHL: ['c5881317762ea259cc25990002284e90.webp','Gilles-Courteau Trophy']
};
let bracket, league = 'WHL', filter = 'ALL', saved = false;
function node(tag, cls, value) {
  const el = document.createElement(tag);
  el.className = cls;
  el.textContent = value ?? '';
  return el;
}
function logo(team, size) {
  const im = document.createElement('img');
  im.width = im.height = size;
  im.alt = '';
  im.style.objectFit = 'contain';
  if (/^assets\/[\w/-]+\.(png|webp|jpg)$/i.test(team?.logo)) im.src = team.logo;
  return im;
}
function slot(series) {
  const linkable=series?.kind==='series'&&Number.isSafeInteger(Number(series?.id))&&Number(series.id)>0;
  const card=node(linkable?'a':'div','slot');
  if(linkable){
    card.href='rivalry-report.html?series='+Number(series.id);
    card.title='Open the verified Rivalry Report for this series';
    card.setAttribute('aria-label','Open Rivalry Report for series '+Number(series.id));
    card.style.display='block';
    card.style.textDecoration='none';
    card.style.color='inherit';
  }
  for (const i of [0,1]) {
    const side = series?.sides?.[i];
    const team = bracket.teams[side?.team_id];
    const row = node('div','sr' + (team ? '' : ' tbd'));
    row.title = team?.name || side?.from || '';
    row.append(node('span','sd',side?.seed));
    if (team) row.append(logo(team,16));
    row.append(node('span','ab',team?.abbr || (series?.kind === 'bye' ? 'BYE' : 'TBD')),node('span','w',team && series?.score?.[i]));
    card.append(row);
  }
  return card;
}
function drawBracket() {
  const cup = league === 'CUP';
  one('#cup-view').hidden = !cup;
  one('#league-view').hidden = cup;
  if (cup) {
    const slots = all('#cup-view .slot');
    [bracket.championship?.semi,bracket.championship?.final].forEach((s,i) => {
      if (s?.sides?.some(v=>v.team_id)) slots[i].replaceChildren(...slot(s).children);
    });
    return;
  }
  const data = bracket.leagues.find(l=>l.name===league);
  if (!data) return;
  for (const column of all('[data-round]')) {
    const key = column.dataset.round;
    const final = key==='fin';
    const conf = data.conferences.find(c=>c.name.toLowerCase().startsWith(key[0]));
    const matches = final ? [data.final] : conf?.rounds.find(r=>r.label===key.slice(1))?.slots || [];
    column.replaceChildren();
    for (const series of matches) {
      const cell=node('div', 'bc ' + (final ? 'bf' : key.endsWith('1') ? '' : key[0]==='e' ? 'bl' : 'br'));
      if (final) {
        const cap=node('div','fin-cap'), im=document.createElement('img');
        im.src='assets/s55-design/'+trophies[league][0];im.alt='';cap.append(im);
        const stand=node('div','plinth');stand.append(node('div','plate',league+' final'),slot(series));
        cell.append(cap,stand,node('div','fin-name',trophies[league][1]));
      } else cell.append(slot(series));
      column.append(cell);
    }
  }
}
function drawScores() {
  const games=[];
  for (const l of bracket.leagues.filter(l=>filter==='ALL'||filter===l.name)) {
    for (const c of l.conferences) for (const r of c.rounds) for (const s of r.slots)
      for (const g of s.games || []) if(g.at) games.push({...g,lg:l.name,round:r.label});
    for(const g of l.final?.games || []) if(g.at) games.push({...g,lg:l.name,round:'Final'});
  }
  const now=Date.now();
  games.sort((a,b)=>Math.abs(Date.parse(a.at)-now)-Math.abs(Date.parse(b.at)-now));
  const list=one('#game-list');list.replaceChildren();
  for(const g of games.slice(0,5)) {
    const card=node('div','gm'), copy=node('div','');
    copy.append(node('div','gm-l',g.lg+' · '+g.round+' · GAME '+g.n));
    for(const side of ['away','home']) {
      const team=bracket.teams[g[side]], row=node('div','gm-t');
      row.append(logo(team,24),node('b','',team?.abbr),node('i','',team?.nick),node('em','',g[side+'_score']??'–'));
      copy.append(row);
      const mark=logo(team,80);mark.className='wm '+(side==='away'?'a':'h');card.append(mark);
    }
    const label=node('div','well gm-s'),date=new Date(g.at);
    label.append(node('div','gm-time',g.status==='final'?'Final':date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/Toronto'}).split(' ')[0]),node('div','gm-sfx',date.toLocaleString('en-US',{weekday:'short',hour:'numeric',hour12:true,timeZone:'America/Toronto'}).replace(/\d+\s*/, '')+' ET'));
    card.append(copy,label);list.append(card);
  }
  one('#scores p.mono').textContent=(saved?'Saved bracket · ':'')+(games.length?'Five nearest scheduled games · Eastern time':'Schedule pending');
}
function choose(key,id) {
  for(const button of all('button[data-'+key+']')) {
    const active=button.dataset[key]===id;
    button.classList.toggle('on',active); button.setAttribute('aria-pressed',String(active));
  }
}
for(const el of all('[data-league]')) el.addEventListener('click',()=>{
  league=el.dataset.league;choose('league',league);if(bracket)drawBracket();
});
for(const el of all('[data-filter]')) el.addEventListener('click',()=>{
  filter=el.dataset.filter;choose('filter',filter);if(bracket)drawScores();
});
const menu=one('.nl details');
document.addEventListener('click',e=>{if(!menu.contains(e.target))menu.open=false});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.open){menu.open=false;menu.querySelector('summary').focus()}});
async function refresh() {
  for(const url of ['/api/lgchl-playoffs','assets/lgchl/playoffs/s55.json']) {
    try {
      const res=await fetch(url,{cache:'no-cache',signal:AbortSignal.timeout(10000)});
      if(!res.ok)continue;
      const data=await res.json();if(!data.leagues?.length||!data.teams)continue;
      bracket=data;saved=url.startsWith('assets')||data.stale;drawBracket();drawScores();return;
    } catch {}
  }
  one('#scores p.mono').textContent='Schedule update unavailable';
}
refresh();setInterval(refresh,120000);

// Keep previously shared homepage links pointed at the full, interactive tools.
const fullPageSections = ['playoffs','scoreboard','community'];
if (fullPageSections.includes(location.hash.slice(1))) location.replace('playoff-hq.html'+location.hash);

function showCupFromLink() {
  if(location.hash!=='#memorial-cup')return;
  league='CUP';choose('league',league);if(bracket)drawBracket();one('#bracket').scrollIntoView();
}
showCupFromLink();window.addEventListener('hashchange',showCupFromLink);
