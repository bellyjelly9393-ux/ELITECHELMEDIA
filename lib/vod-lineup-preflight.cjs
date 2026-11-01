'use strict';
// Read-only adapter for saved LG parser output. Never promotes a roster to participation.
const uid=value=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value)?value:
 typeof value==='number'&&Number.isSafeInteger(value)&&value>0?String(value):null;
const positions=new Set(['LW','C','RW','LD','RD','G']);
function prepareNight(input,{league,season}={}){
 if(!/^[A-Z0-9_]+$/.test(league||'')||!Number.isSafeInteger(season)||season<1)throw new Error('Explicit league and season are required');
 if(input?.schema!=='lgchl-pregame-lineups-v1'||!Array.isArray(input.games))throw new Error('Unsupported parser file: expected lgchl-pregame-lineups-v1');
 const seenGames=new Set(),nightly=new Map(),issues=[];
 const games=input.games.map(game=>{
  const gameId=uid(game.lg_game_id);
  if(!gameId||seenGames.has(gameId))throw new Error('Missing, unsafe or duplicate LG game ID');
  seenGames.add(gameId);
  const teams=['away','home'].map(side=>{
   const team=game[side];
   if(!team?.team||!Array.isArray(team.skaters)||!Array.isArray(team.goalies))throw new Error('Missing team roster or goalie list for game '+gameId);
   const players=[...team.skaters,...team.goalies.map(row=>({...row,position:row.position||'G'}))].map(row=>{
    const lgId=uid(row.lg_user_id),name=String(row.player||'').trim(),position=String(row.position||'').toUpperCase();
    const reason=!lgId?'missing_or_unsafe_lg_id':!name?'missing_registered_name':!positions.has(position)?'unknown_position':null;
    const canonicalKey=lgId?JSON.stringify([league,season,lgId]):null;
    return {canonical_key:canonicalKey,lg_user_id:lgId,registered_name:name,position,identity_status:reason?'unresolved':'parser_id_present',reason,
     participation_status:'candidate_only',scouting_eligible:false};
   });
   return {side,team:team.team,players};
  });
  if(teams.filter(t=>t.team==='Calgary Hitmen').length!==1)throw new Error('Only Hitmen games and their opponents are in scope');
  const byId=new Map();
  for(const team of teams)for(const player of team.players){
   if(player.lg_user_id){const entries=byId.get(player.lg_user_id)||[];entries.push(player);byId.set(player.lg_user_id,entries);}
  }
  for(const entries of byId.values())if(entries.length>1)for(const player of entries){player.identity_status='unresolved';player.reason='duplicate_lg_id_in_game';}
  for(const team of teams){
   const counts=Object.fromEntries([...positions].map(p=>[p,team.players.filter(x=>x.position===p).length]));
   issues.push({lg_game_id:gameId,team:team.team,reason:'pregame_list_requires_actual_lineup_confirmation',position_counts:counts});
   for(const player of team.players){
    if(player.identity_status==='unresolved'){issues.push({lg_game_id:gameId,team:team.team,name:player.registered_name,reason:player.reason});continue;}
    const entry=nightly.get(player.canonical_key)||{canonical_key:player.canonical_key,league,season,lg_user_id:player.lg_user_id,registered_names:[],appearances:[],scouting_eligible:false};
    if(!entry.registered_names.includes(player.registered_name))entry.registered_names.push(player.registered_name);
    entry.appearances.push({lg_game_id:gameId,team:team.team,side:team.side,position:player.position,participation_status:'candidate_only'});
    nightly.set(player.canonical_key,entry);
   }
  }
  return {lg_game_id:gameId,puck_drop_et:game.puck_drop_et||null,source_url:'https://www.leaguegaming.com/forums/index.php?leaguegaming/league&action=league&page=game&gameid='+gameId,teams};
 });
 if(games.length!==3)issues.push({reason:'expected_three_games',actual:games.length});
 return {schema:'vod-night-lineup-preflight-v1',date:input.date||null,league,season,games,nightly_players:[...nightly.values()],issues,
  ready_for_scouting:false,next_step:'Confirm actual six-player game lineups and evidence-backed CHEL/broadcast aliases. No roster order or similar-name inference.'};
}
module.exports={prepareNight};
