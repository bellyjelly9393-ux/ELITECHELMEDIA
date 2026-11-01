// Executed by the LG client's existing QWebEnginePage parser API. No session data.
(() => {
 const text=n=>String(n?.innerText||n?.textContent||'').replace(/\s+/g,' ').trim();
 const url=new URL(location.href),body=text(document.body);
 const safeUrl=u=>{
  // LG's router requires its bare leaguegaming/league query key unchanged.
  const parts=['leaguegaming/league','action=league'];
  const page=u.searchParams.get('page');if(page)parts.push('page='+encodeURIComponent(page));
  for(const k of ['userid','teamid','gameid','leagueid','seasonid']){const v=u.searchParams.get(k);if(v&&/^\d+;?$/.test(v))parts.push(k+'='+v.replace(/;$/,''));}
  return 'https://www.leaguegaming.com/forums/index.php?'+parts.join('&');
 };
 const result={source_url:safeUrl(url),title:document.title,blocked:false};
 if(!/^https:$/.test(url.protocol)||!/(^|\.)leaguegaming\.com$/.test(url.hostname))return {...result,error:'unexpected_source'};
 if(/just a moment|verify you are human|checking your browser|attention required.*cloudflare/i.test(document.title+' '+body.slice(0,1500)))return {...result,blocked:true,error:'verification_required'};
 const page=url.searchParams.get('page');
 if(page==='team_user'){
  result.kind='profile';result.lg_user_id=url.searchParams.get('userid');result.accounts=[];
  const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const heading=headings.find(h=>text(h)==='Career Info');
  if(!heading)return {...result,error:'career_info_missing'};
  const end=headings.find(h=>(heading.compareDocumentPosition(h)&Node.DOCUMENT_POSITION_FOLLOWING)&&h!==heading);
  const range=document.createRange();range.setStartAfter(heading);if(end)range.setEndBefore(end);else range.setEndAfter(document.body.lastChild);
  const career=range.cloneContents();
  for(const li of career.querySelectorAll('li,dl')){
   const value=text(li),match=value.match(/^(Xbox GamerTag|PSN ID|PSN GamerTag|PlayStation Network ID):\s*(.+)$/i);
   if(!match)continue;
   const gamertag=match[2].trim();
   if(!gamertag||/^(none|n\/a|not (?:set|provided)|-)$/i.test(gamertag))continue;
   result.accounts.push({platform:/^Xbox/i.test(match[1])?'xbox':'playstation',account_gamertag:gamertag,evidence:match[1]+': '+gamertag});
  }
  return result;
 }
 const teamId=url.searchParams.get('teamid');result.team_id=teamId;
 if(page==='team_page'){
  result.kind='roster';result.players=[];
  const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')],start=headings.find(h=>text(h)==='Roster');
  const end=headings.find(h=>start&&(start.compareDocumentPosition(h)&Node.DOCUMENT_POSITION_FOLLOWING)&&text(h)==='Schedule');
  if(!start||!end)return {...result,error:'roster_section_missing'};
  const range=document.createRange();range.setStartAfter(start);range.setEndBefore(end);const section=range.cloneContents(),ids=new Map();
  for(const a of section.querySelectorAll('a[href]')){
   let u;try{u=new URL(a.getAttribute('href'),location.href);}catch{continue;}
   const id=u.searchParams.get('userid');
   if(u.hostname!==url.hostname||u.searchParams.get('page')!=='team_user'||!id||!/^\d+$/.test(id)||!text(a))continue;
   ids.set(id,{lg_user_id:id,registered_name:text(a),profile_url:safeUrl(u)});
  }
  result.players=[...ids.values()];if(!result.players.length)result.error='empty_roster';return result;
 }
 if(page==='team_page_schedule'){
  result.kind='schedule';result.games=[];
  for(const table of document.querySelectorAll('table'))for(const row of table.querySelectorAll('tr')){
   const links=[...row.querySelectorAll('a[href]')].map(a=>{try{return {url:new URL(a.getAttribute('href'),location.href),name:text(a)};}catch{return null;}}).filter(Boolean);
   const game=links.find(x=>x.url.searchParams.get('page')==='game'&&/^\d+$/.test(x.url.searchParams.get('gameid')||''));
   const teams=links.filter(x=>x.url.searchParams.get('page')==='team_page'&&/^\d+$/.test(x.url.searchParams.get('teamid')||''));
   if(!game||teams.length!==2)continue;
   const date=[...row.cells].map(text).join(' ').match(/\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{1,2}:\d{2}[ap]m)\b/i);
   if(!date)continue;
   result.games.push({lg_game_id:game.url.searchParams.get('gameid'),source_url:safeUrl(game.url),date_text:date[0],month:date[1],day:Number(date[2]),time_text:date[3],teams:teams.map(t=>({lg_team_id:t.url.searchParams.get('teamid'),name:t.name.replace(/^(.+) \1$/,'$1'),source_url:safeUrl(t.url)}))});
  }
  if(!result.games.length)result.error='empty_schedule';return result;
 }
 return {...result,error:'unsupported_page'};
})();
