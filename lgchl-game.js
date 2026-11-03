/* Public Game Centre. Never reads, signs, or embeds private scouting assets. */
(()=>{'use strict';
const D=window.WMDesk;if(!D)return;
const {esc,read,F}=D,$=id=>document.getElementById(id);
const storage='https://lrgllzvwgvqagcpiyvfd.supabase.co/storage/v1/object/public/lgchl-public-highlights/';
const id=Number(new URLSearchParams(location.search).get('id'));
const validId=n=>Number.isSafeInteger(Number(n))&&Number(n)>0;
const path=(v,ext)=>typeof v==='string'&&new RegExp('^[A-Za-z0-9][A-Za-z0-9/_-]*[.]('+ext+')$').test(v)?storage+v:null;
const source=v=>{try{const u=new URL(v);return u.protocol==='https:'&&(u.hostname==='leaguegaming.com'||u.hostname==='www.leaguegaming.com')?u.href:null}catch{return null}};
const logo=n=>validId(n)?'assets/lgchl/s55/team'+Number(n)+'.png':'assets/wildman/home/lgchl-logo.webp';
function highlight(c){
 const video=path(c.video_path,'mp4');if(!video||Number(c.lg_game_id)!==id||!c.verified_at||!c.published_at||!Number.isFinite(Date.parse(c.published_at))||Date.parse(c.published_at)>Date.now())return '';
 const poster=path(c.poster_path,'jpg|webp');
 return '<article class="highlight"><h3>'+esc(c.title)+'</h3><video controls playsinline preload="none"'+(poster?' poster="'+esc(poster)+'"':'')+' src="'+esc(video)+'" aria-label="'+esc(c.title)+'"></video><p>'+esc([c.period?'Period '+c.period:'',c.clock_label||''].filter(Boolean).join(' · '))+'</p></article>';
}
async function load(){
 if(!validId(id)){$('gameStatus').textContent='Choose a game from Last Night’s Finals.';$('gameRecap').textContent='No game selected.';$('gameClips').textContent='No game selected.';return;}
 try{
 const rows=await read('lgchl_games_board',{select:'*',lg_game_id:'eq.'+id,season:'eq.55',limit:1}),g=rows[0];
 if(!g)throw Error('Game not found');
 const final=String(g.status).toLowerCase()==='final';
 const hasScores=g.away_score!==null&&g.home_score!==null&&Number.isFinite(Number(g.away_score))&&Number.isFinite(Number(g.home_score));
 const a=g.away_nick||g.away_abbr||'Away team',h=g.home_nick||g.home_abbr||'Home team';
 document.title=a+' vs '+h+' | LGCHL Game Centre';
 $('gameStatus').textContent=[g.league,g.game_at&&Number.isFinite(Date.parse(g.game_at))?F.longDay.format(new Date(g.game_at)):'',final?'Final':g.status].filter(Boolean).join(' · ');
 $('gameScore').hidden=false;$('gameScore').innerHTML='<div class="scoreline"><div><img src="'+logo(g.away_lg_team_id)+'" alt=""><strong>'+esc(a)+'</strong></div><b>'+esc(hasScores?g.away_score+' – '+g.home_score:'vs')+'</b><div><img src="'+logo(g.home_lg_team_id)+'" alt=""><strong>'+esc(h)+'</strong></div></div>';
 let recap='The official final result is not available yet.';
 if(final&&hasScores){const aw=Number(g.away_score),ho=Number(g.home_score);recap=aw===ho?a+' and '+h+' are listed level at '+aw+'–'+ho+'.':(aw>ho?a:h)+' defeated '+(aw>ho?h:a)+' '+Math.max(aw,ho)+'–'+Math.min(aw,ho)+(g.decided_in?' ('+g.decided_in+')':'')+'. '+(Math.min(aw,ho)===0?'A shutout finish. ':Math.abs(aw-ho)===1?'A one-goal finish. ':'The winning margin was '+Math.abs(aw-ho)+' goals. ');}
 const link=source(g.source_url);
 $('gameRecap').innerHTML='<p>'+esc(recap)+'</p><p class="game-note">Result summary from the official score. Scorers and turning points will appear when verified event details are available.</p>'+(link?'<a class="game-link" href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">Official box score ↗</a>':'');
 try{const clips=await read('lgchl_game_highlights',{select:'lg_game_id,title,video_path,poster_path,period,clock_label,verified_at,published_at',lg_game_id:'eq.'+id,order:'period.asc.nullslast,id.asc',limit:50});$('gameClips').innerHTML=clips.map(highlight).join('')||'<p class="game-empty">No published highlights for this game yet.</p>';}
 catch{$('gameClips').innerHTML='<p class="game-empty">Highlights could not be loaded. Try again later.</p>';}
 $('gameClips').querySelectorAll('video').forEach(v=>v.addEventListener('error',()=>{const note=document.createElement('p');note.textContent='This clip is temporarily unavailable.';v.replaceWith(note);},{once:true}));
 }catch{$('gameStatus').textContent='This game could not be loaded.';$('gameRecap').textContent='Return to the Media Desk to select a game.';$('gameClips').textContent='Highlights unavailable.';}
}
load();
})();
