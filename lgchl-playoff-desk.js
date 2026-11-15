'use strict';
const legacySections = ["lgPowerSec","lgNightSec","lgRecaps","lgWriteups","lgNewsSec","lgRaceSec","lgStreakSec","lgUpsetSec","lgBreakoutSec","lgTrendSec","lgPlayersWeekSec","lgMatchSec","lgWeeklySec"];
if (legacySections.includes(location.hash.slice(1))) location.replace('lgchl-regular-season.html'+location.hash);
async function updateDesk() {
  const status = document.getElementById('desk-status');
  for (const source of ['/api/lgchl-playoffs','assets/lgchl/playoffs/s55.json']) {
    try {
      const response = await fetch(source,{cache:'no-cache',signal:AbortSignal.timeout(9000)});
      if (!response.ok) continue;
      const data = await response.json();
      const series = data.leagues.flatMap(l => [...l.conferences.flatMap(c=>c.rounds.flatMap(r=>r.slots)), l.final]);
      series.push(data.championship?.semi,data.championship?.final);
      const games = series.flatMap(s=>s?.games || []).filter(g=>g.at && data.teams[g.away] && data.teams[g.home]);
      const final = g=>g.status==='final'||(g.away_score!=null && g.home_score!=null);
      const results = games.filter(final).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
      const upcoming = games.filter(g=>!final(g)&&Date.parse(g.at)>=Date.now()).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
      const selection = [...results.slice(0,upcoming.length?3:6),...upcoming].slice(0,6);
      const cards = selection.map(g=>{
        const p=document.createElement('p'), label=document.createElement('small');
        label.textContent=(final(g)?'FINAL':'SCHEDULED')+' · '+new Date(g.at).toLocaleString('en-CA',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Toronto'})+' ET';
        const score=(side)=>final(g)&&g[side+'_score']!=null?' '+g[side+'_score']:'';
        p.append(label,data.teams[g.away].name+score('away')+' at '+data.teams[g.home].name+score('home'));
        return p;
      });
      document.getElementById('desk-games').replaceChildren(...cards);
      status.textContent=(source[0]!=='/'||data.stale?'Saved bracket · ':'')+(cards.length?(results.length?'Recent finals and scheduled games':'Next scheduled games'):'Awaiting playoff results and schedules');
      return;
    } catch {}
  }
  status.textContent='Game updates are unavailable. Open the full scoreboard below.';
}
updateDesk();setInterval(updateDesk,120000);