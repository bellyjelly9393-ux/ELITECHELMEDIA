/* EliteChel Fantasy weekly rule engine v0.1: league-agnostic. No automatic hidden/random rule changes.
   Both formats use a curated, frozen weekly pool and one published bonus policy.
   Fantasy scoring inputs MUST be aggregated from verified games only by a trusted server. */
(function(global,factory) {
  var api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(global)global.EliteChelFantasyRules=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function() {
  'use strict';
  var fourSlots=['superstar','upcomer','wildcard','goalie'];
  var sixSlots=['LW','C','RW','LD','RD','G'];
  var wildcardCategories=['sleeper','underrated','bounceback','heater'];
  var twists={
    none:{name:'Standard Week',description:'No bonus this week. Best value wins.'},
    bounce_back:{name:'Bounce-Back Bet',description:'A struggling player can earn a bonus by beating the announced weekly target.'},
    sleeper_surge:{name:'Sleeper Surge',description:'A nominated sleeper earns a bonus for beating a frozen projection.'},
    heater:{name:'Stay Hot',description:'Back a heater to maintain their form.'},
    position_spotlight:{name:'Position Spotlight',description:'The announced position can earn the bonus by reaching its target.'}
  };
  function num(x){return Number(x);}
  function id(x){return String(x==null?'':x);}
  function slots(w){return w.format==='4'?fourSlots:sixSlots;}
  function fail(msg){return {ok:false,errors:[msg]};}
  function validateWeek(w) {
    var err=[];
    if(!w||!['4','6'].includes(w.format))return fail('Unknown fantasy format.');
    if((w.format==='4'&&w.league!=='lg3s')||(w.format==='6'&&w.league!=='lgchl'))err.push('League/format mismatch.');
    if(!Number.isInteger(w.week)||w.week<1)err.push('Invalid week.');
    if(!Number.isInteger(w.cap)||w.cap<1)err.push('Invalid salary cap.');
    if(!Array.isArray(w.pool)||!w.pool.length)err.push('The weekly pool is empty.');
    if(!w.published_at||!w.lock_at||!Number.isFinite(Date.parse(w.published_at))||!Number.isFinite(Date.parse(w.lock_at))||Date.parse(w.lock_at)<=Date.parse(w.published_at))err.push('Publish and lock timestamps must be ordered.');
    var bonus=w.bonus||{type:'none'},typ=bonus.type;
    if(!Object.prototype.hasOwnProperty.call(twists,typ))err.push('Unknown weekly twist.');
    var pts=typ==='none'?0:num(bonus.points);
    if(typ!=='none'&&(!Number.isInteger(pts)||pts<1||pts>8))err.push('Bonus points must be 1-8.');
    if(typ==='position_spotlight'&&!sixSlots.includes(bonus.position))err.push('Spotlight position must be a sixes position.');
    if(typ!=='none'&&(!Number.isFinite(num(bonus.target))||num(bonus.target)<=0))err.push('Bonus requires a published positive target.');
    if(typ==='sleeper_surge'&&(!Number.isFinite(num(bonus.multiplier))||num(bonus.multiplier)<1))err.push('Sleeper bonus requires a valid projection multiplier.');
    if(!Array.isArray(w.pool))return {ok:false,errors:err};
    var seen=new Set(),byPos={};w.pool.forEach(function(p){
      if(!p||!id(p.id)||seen.has(id(p.id)))err.push('Duplicate or empty pool player ID.');
      seen.add(id(p&&p.id));
      if(!p||!p.name||!p.team||!p.category||!p.position)err.push('Player identity/category/position missing.');
      if(!Number.isInteger(num(p&&p.price))||num(p&&p.price)<1)err.push('Invalid player price.');
      if(w.format==='4') {
        if(!p.nation)err.push('LG3S player has no nation.');
        if(!['superstar','upcomer','goalie'].concat(wildcardCategories).includes(p.category))err.push('Invalid fours category.');
      } else {
        if(!sixSlots.includes(p.position))err.push('Invalid sixes position.');
        if(!['superstar','upcomer','sleeper','underrated','bounceback','heater','value','goalie'].includes(p.category))err.push('Invalid sixes category.');
        if((p.position==='G')!==(p.category==='goalie'))err.push('Sixes goalies must be in G and goalie category.');
      }
      byPos[p.position]=(byPos[p.position]||0)+1;
    });
    if(w.format==='6')sixSlots.forEach(function(s){if(!byPos[s])err.push('No eligible players for '+s);});
    return {ok:!err.length,errors:err};
  }
  function pickMap(w){var m=new Map();(w.pool||[]).forEach(function(p){m.set(id(p.id),p);});return m;}
  function validatePicks(w,picks){
    var check=validateWeek(w);if(!check.ok)return check;
    var errors=[],list=[],cost=0,byId=pickMap(w),seen=new Set();
    slots(w).forEach(function(s){
      var p=byId.get(id(picks&&picks[s]));if(!p){errors.push('Choose a player for '+s+'.');return;}
      if(seen.has(id(p.id)))errors.push('The same player cannot be selected twice.');
      seen.add(id(p.id));
      if(w.format==='4'){
        if(s!=='wildcard'&&p.category!==s)errors.push('Choose a '+s+' for this slot.');
        if(s==='wildcard'&&!wildcardCategories.includes(p.category))errors.push('Wildcard must be an eligible sleeper/underrated/bounceback/heater.');
      }else if(p.position!==s)errors.push(p.name+' is not eligible at '+s+'.');
      list.push(p);cost+=num(p.price);
    });
    if(cost>w.cap)errors.push('Over the $'+w.cap+'M cap by $'+(cost-w.cap)+'M.');
    if(w.format==='4'){
      var nations=new Set(list.map(function(p){return p.nation;}));
      if(nations.size!==list.length)errors.push('Fours requires a different nation for every pick.');
    } else if(list.length===6) {
      var stars=list.filter(function(p){return p.category==='superstar';}).length;
      var risers=list.filter(function(p){return p.category==='upcomer';}).length;
      var undervalued=list.filter(function(p){return ['sleeper','underrated','bounceback'].includes(p.category);}).length;
      if(stars!==1)errors.push('Sixes requires exactly one Superstar.');
      if(risers<1)errors.push('Sixes requires at least one Up & Comer.');
      if(undervalued<1)errors.push('Sixes requires at least one Sleeper/Underrated/Bounce-Back player.');
      var byTeam={};list.forEach(function(p){byTeam[p.team]=(byTeam[p.team]||0)+1;});
      if(Object.values(byTeam).some(function(n){return n>2;}))errors.push('Sixes allows at most two picks from the same team.');
    }
    return {ok:!errors.length,errors:errors,cost:cost,remaining:w.cap-cost,players:list};
  }
  function qualified(w,p,stats,slot){
    var b=w.bonus||{type:'none'},v=num(stats.points),gp=num(stats.games),t=num(b.target);
    if(!stats.verified||!Number.isFinite(v)||gp<(Number.isInteger(b.min_games)?b.min_games:1))return false;
    switch(b.type){
      case 'none':return false;
      case 'bounce_back':return p.category==='bounceback'&&v>=t;
      case 'sleeper_surge':return ['sleeper','underrated'].includes(p.category)
        &&Number.isFinite(num(p.projected_week_points))&&num(p.projected_week_points)>0
        &&v>=t&&v>=num(p.projected_week_points)*num(b.multiplier);
      case 'heater':return p.category==='heater'&&v>=t;
      case 'position_spotlight':return w.format==='6'&&slot===b.position&&v>=t;
      default:return false;
    }
  }
  function scoreEntry(w,picks,verifiedStats) {
    var v=validatePicks(w,picks);if(!v.ok)return Object.assign({status:'invalid'},v);
    if(!w.finalized)return {ok:false,status:'pending',reason:'Week has not been finalized from verified results.'};
    var map=pickMap(w),all=slots(w).map(function(slot){
      var player=map.get(id(picks[slot])),stats=verifiedStats&&verifiedStats[id(player.id)];
      return {slot:slot,player:player,stats:stats};
    });
    if(all.some(function(x){return !x.stats||x.stats.verified!==true||!Number.isFinite(num(x.stats.points))||!Number.isInteger(num(x.stats.games))||num(x.stats.games)<0;}))
      return {ok:false,status:'pending',reason:'At least one selected player lacks finalized verified-week statistics.'};
    var base=all.reduce(function(n,x){return n+num(x.stats.points);},0),b=w.bonus||{type:'none'},awarded=null;
    all.some(function(x){if(qualified(w,x.player,x.stats,x.slot)){awarded=x.player.name;return true;}return false;});
    var bonus=awarded?num(b.points):0;
    return {ok:true,status:'final',base:base,bonus:bonus,total:base+bonus,awarded_to:awarded};
  }
  function isLocked(w,now){return Date.parse(now||new Date().toISOString())>=Date.parse(w.lock_at);}
  return {fourSlots:fourSlots,sixSlots:sixSlots,wildcardCategories:wildcardCategories,twists:twists,
    validateWeek:validateWeek,validatePicks:validatePicks,scoreEntry:scoreEntry,isLocked:isLocked};
});
