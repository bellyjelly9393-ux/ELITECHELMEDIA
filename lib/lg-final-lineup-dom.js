(() => {
  const url=new URL(location.href),query=url.searchParams;
  const gameId=query.get('gameid'),league=query.get('leagueid'),season=query.get('seasonid');
  const text=document.body?.innerText||document.body?.textContent||'';
  if(/checking your browser|verify you are human|just a moment|security verification/i.test(document.title+' '+text.slice(0,1200)))return {blocked:true};
  if(!/^[1-9][0-9]*$/.test(gameId||'')||league!=='39'||season!=='55'||query.get('page')!=='game')return {error:'unexpected_game_scope'};
  if(![...document.querySelectorAll('td,th,span,div,p')].some(el=>/^(?:FINAL|F\/(?:OT|SO))$/i.test(el.textContent.trim())))return {error:'game_not_explicitly_final'};
  const players=[],teams=new Set(),teamNames=new Map();
  for(const heading of ['Player Stats','Goalie Stats']){
    const tables=[...document.querySelectorAll('table')].filter(t=>t.querySelector('th')?.textContent.trim()===heading);
    if(tables.length!==1)return {error:'missing_or_ambiguous_stats_table'};
    let team='';
    for(const row of tables[0].querySelectorAll('tr')){
      if(row.cells.length===1){
        if(row.textContent.trim()!==heading){
          team=row.textContent.trim();
          const id=row.cells[0].className.match(/\bteam_bar([0-9]+)\b/)?.[1];
          if(!id)return {error:'missing_team_header_identity'};
          teamNames.set(id,team);
        }
        continue;
      }
      const links=[...row.querySelectorAll('a[href]')].filter(a=>{
        try{return new URL(a.getAttribute('href'),url).searchParams.get('page')==='team_user';}catch{return false;}
      });
      if(!links.length)continue;
      if(links.length!==1)return {error:'ambiguous_player_row'};
      const a=links[0],profile=new URL(a.getAttribute('href'),url),q=profile.searchParams;
      const logos=[...a.closest('td').querySelectorAll('img[src]')].map(i=>i.getAttribute('src').match(/\/team([0-9]+)\.png(?:\?|$)/)?.[1]).filter(Boolean);
      if(logos.length!==1||!teamNames.has(logos[0]))return {error:'missing_player_team_identity'};
      const rowTeam=teamNames.get(logos[0]);
      if(heading==='Player Stats'&&rowTeam!==team)return {error:'player_team_header_mismatch'};
      const uid=q.get('userid'),position=row.textContent.match(/\((LW|C|RW|LD|RD|G)\)/)?.[1];
      if(!/^[1-9][0-9]*$/.test(uid||'')||q.get('leagueid')!==league||q.get('seasonid')!==season||!position)return {error:'missing_player_identity'};
      if(heading==='Goalie Stats'&&position!=='G'||heading==='Player Stats'&&position==='G')return {error:'position_table_mismatch'};
      const ranking=[...row.querySelectorAll('a[href]')].map(a=>new URL(a.getAttribute('href'),url)).filter(u=>u.searchParams.get('page')==='game_user_power_ranking_detail');
      if(ranking.length!==1||ranking[0].searchParams.get('gameid')!==gameId||ranking[0].searchParams.get('userid')!==uid)return {error:'game_row_identity_mismatch'};
      teams.add(rowTeam);
      players.push({lg_user_id:uid,player:a.textContent.trim(),team:rowTeam,lg_team_id:logos[0],position,source_profile_url:profile.href,source:'LG final-game player statistics row'});
    }
  }
  if(teams.size!==2||!teams.has('Calgary Hitmen')||players.length!==12||new Set(players.map(p=>p.lg_user_id)).size!==12)return {error:'incomplete_or_ambiguous_game_roster'};
  for(const team of teams){const rows=players.filter(p=>p.team===team);if(rows.length!==6||rows.filter(p=>p.position==='G').length!==1)return {error:'incomplete_team_lineup'};}
  return {schema:'lg-final-game-lineup-v1',league:'LGCHL',season:55,lg_game_id:gameId,source_url:url.href,players};
})()
