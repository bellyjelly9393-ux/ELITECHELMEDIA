/* LG3s recent game-night scores from parser-backed, verified-only public view. */
(()=>{'use strict';const $=id=>document.getElementById(id),box=$('lg3Scores'),archive=$('lg3RecapArchive');if(!box)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const base='https://lrgllzvwgvqagcpiyvfd.supabase.co/rest/v1/';
const key='sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
const gameLink=g=>{const id=Number(g.lg_game_id);return Number.isSafeInteger(id)&&id>0?'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid='+id:null};
fetch(base+'lg3s_public_games?select=lg_game_id,game_night_date,away_nation,home_nation,away_score,home_score,is_verified,status&is_verified=eq.true&order=game_night_date.desc&limit=100',{headers:{apikey:key},cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Verified scores unavailable: '+r.status);return r.json()}).then(games=>{
const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Toronto'});
const finals=games.filter(g=>g.is_verified===true&&g.game_night_date<=today&&g.away_score!=null&&g.home_score!=null&&Number.isFinite(Number(g.away_score))&&Number.isFinite(Number(g.home_score))&&Number(g.away_score)>=0&&Number(g.home_score)>=0&&/^(final|completed|complete|verified)$/i.test(String(g.status)));
const dates=[...new Set(finals.map(g=>g.game_night_date))].sort().reverse();
if(!dates.length){box.textContent='No verified final scores available yet.';archive.textContent='Reviewed game-night recaps will appear after verified reports are available.';return}
const date=dates[0],night=finals.filter(g=>g.game_night_date===date&&g.away_score!=null&&g.home_score!=null);
box.innerHTML='<p class="lg3-note">LATEST VERIFIED RESULTS · '+esc(date)+' · '+night.length+' GAMES</p>'+night.map(g=>{const url=gameLink(g);const row='<span>'+esc(g.away_nation)+' <strong>'+esc(g.away_score)+'</strong> – <strong>'+esc(g.home_score)+'</strong> '+esc(g.home_nation)+'</span>';return '<div class="lg3-row">'+(url?'<a href="'+url+'" target="_blank" rel="noopener noreferrer">'+row+' ↗</a>':row)+'</div>'}).join('');
archive.innerHTML='<p class="lg3-note">VERIFIED GAME-NIGHT ARCHIVE</p><p>Verified results are linked to their official game reports. ECM editorial recaps will appear here only after review and publication.</p>'+dates.slice(0,7).map(d=>'<a class="lg3-action" style="display:inline-block;margin:4px" href="#lg3Scores" data-night="'+esc(d)+'">'+esc(d)+' RESULTS</a>').join('');
archive.querySelectorAll('[data-night]').forEach(a=>a.addEventListener('click',()=>{const d=a.dataset.night,rows=finals.filter(g=>g.game_night_date===d&&g.away_score!=null&&g.home_score!=null);box.innerHTML='<p class="lg3-note">VERIFIED RESULTS · '+esc(d)+'</p>'+rows.map(g=>'<div class="lg3-row"><a target="_blank" rel="noopener noreferrer" href="'+gameLink(g)+'">'+esc(g.away_nation)+' '+esc(g.away_score)+' – '+esc(g.home_score)+' '+esc(g.home_nation)+' ↗</a></div>').join('')}));
}).catch(e=>{console.error(e);box.textContent='Verified scores temporarily unavailable. No unverified results are shown.';archive.textContent='Game-night archive is temporarily unavailable.';});
})();
