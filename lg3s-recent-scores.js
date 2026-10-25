/* LG3s recent game-night scores from parser-backed, verified-only public view. */
(()=>{'use strict';const $=id=>document.getElementById(id),box=$('lg3Scores'),archive=$('lg3RecapArchive');if(!box)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const base='https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/';
const key='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
const gameLink=g=>{const id=Number(g.lg_game_id);return Number.isSafeInteger(id)&&id>0?'#game/'+id:null};
fetch(base+'lg3s_public_games?select=lg_game_id,game_night_date,away_nation,home_nation,away_score,home_score,is_verified,status&is_verified=eq.true&order=game_night_date.desc&limit=100',{headers:{apikey:key},cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Verified scores unavailable: '+r.status);return r.json()}).then(games=>{
const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Toronto'});
const dates=[...new Set(games.filter(g=>g.game_night_date<=today&&Number.isFinite(Number(g.away_score))&&Number.isFinite(Number(g.home_score))).map(g=>g.game_night_date))].sort().reverse();
if(!dates.length){box.textContent='No verified final scores available yet.';return}
const date=dates[0],night=games.filter(g=>g.game_night_date===date&&g.away_score!=null&&g.home_score!=null);
box.innerHTML='<p class="lg3-note">LATEST VERIFIED RESULTS · '+esc(date)+' · '+night.length+' GAMES</p>'+night.map(g=>{const url=gameLink(g);const row='<span>'+esc(g.away_nation)+' <strong>'+esc(g.away_score)+'</strong> – <strong>'+esc(g.home_score)+'</strong> '+esc(g.home_nation)+'</span>';return '<div class="lg3-row">'+(url?'<a href="'+url+'">'+row+' ›</a>':row)+'</div>'}).join('');
archive.innerHTML='<p class="lg3-note">GAME-NIGHT ARCHIVE · CURRENT WEEK</p><p>Tap a result for the ECM game page and recap.</p>'+dates.slice(0,7).map(d=>'<a class="lg3-action" style="display:inline-block;margin:4px" href="#lg3Scores" data-night="'+esc(d)+'">'+esc(d)+' RESULTS</a>').join('');
archive.querySelectorAll('[data-night]').forEach(a=>a.addEventListener('click',()=>{const d=a.dataset.night,rows=games.filter(g=>g.game_night_date===d&&g.away_score!=null&&g.home_score!=null);box.innerHTML='<p class="lg3-note">VERIFIED RESULTS · '+esc(d)+'</p>'+rows.map(g=>'<div class="lg3-row"><a href="'+gameLink(g)+'">'+esc(g.away_nation)+' '+esc(g.away_score)+' – '+esc(g.home_score)+' '+esc(g.home_nation)+' ›</a></div>').join('')}));
}).catch(e=>{console.error(e);box.textContent='Verified scores temporarily unavailable.';});
})();