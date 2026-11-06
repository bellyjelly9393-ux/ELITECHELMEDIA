/* Pure interactive demo consuming the same fours/sixes rules engine.
   No real contestants, paid prizes, database writes, or submitted lineups. */
(function() {
'use strict';
var api=window.EliteChelFantasyRules,fixture=window.EliteChelFantasyDemo;
if(!api||!fixture){document.body.textContent='Fantasy preview dependencies unavailable.';return;}
var $=function(id){return document.getElementById(id);};
var mode='4',round='a',active='superstar',current={};
function escape(s){return String(s==null?'':s).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[x];});}
function w(){return fixture.weeks[round][mode];}
function key(){return round+':'+mode;}
function picks(){if(!current[key()])current[key()]=Object.assign({},fixture.defaults[mode]);return current[key()];}
function formatLabel(s) {return {superstar:'SUPERSTAR',upcomer:'UP & COMER',wildcard:'WILDCARD',goalie:'GOALIE'}[s]||s;}
function categoryLabel(s){return {upcomer:'Up & Comer',bounceback:'Bounce-Back',sleeper:'Sleeper',underrated:'Underrated',heater:'Heater',superstar:'Superstar',goalie:'Goalie',value:'Value'}[s]||s;}
function nameFor(id){var p=w().pool.find(function(p){return p.id===id;});return p?p.name:null;}
function matching(p,slot) {
 return mode==='4'?slot==='wildcard'?api.wildcardCategories.includes(p.category):p.category===slot
 :p.position===slot;
}
function optionsFor(slot){return w().pool.filter(function(p){return matching(p,slot);});}
var shadow='<svg aria-hidden="true" viewBox="0 0 170 170" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="helmetFade" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#727e8e"/><stop offset="1" stop-color="#181f2c"/></linearGradient></defs><path fill="url(#helmetFade)" stroke="#a6b3be" stroke-width="3" d="M85 10c-30 0-39 22-36 47l8 13 6 14-12 12-30 12-14 52h155l-15-52-30-12-12-12 7-14 8-13C122 32 113 10 85 10Z"/><path d="M46 51l76 0M56 69l59 0M82 30v48" fill="none" stroke="#111927" stroke-width="8"/><path d="M37 130h95" stroke="#bd8d44" stroke-width="9"/></svg>';
function renderRules(){
 var config=w(),b=config.bonus||{type:'none'},type=b.type;
 $('lineup-title').textContent='Pick Your '+mode;
 $('formatExplain').textContent=mode==='4'
 ?'One Superstar, one Up & Comer, one Wildcard and one Goalie. Four different nations.'
 :'Choose LW, C, RW, LD, RD and G. Exactly one Superstar; at least one Up & Comer and one undervalued pick.';
 $('twistTitle').textContent=api.twists[type].name;
 $('twistDesc').textContent=api.twists[type].description;
 $('twistPoints').textContent=type==='none'?'NO BONUS THIS ROUND':'+'+b.points+' FANTASY POINTS AVAILABLE';
 var detail=type==='none'?'Pure weekly fantasy points. No extra category bonus.'
 :type==='bounce_back'?'Select a Bounce-Back player who scores '+b.target+'+ verified weekly fantasy points across '+b.min_games+'+ games.'
 :type==='sleeper_surge'?'A Sleeper/Underrated pick must score '+b.target+'+ points and beat '+b.multiplier+'× their frozen projection.'
 :type==='heater'?'A Heater category player scores '+b.target+'+ points in '+b.min_games+'+ verified games.'
 :'The '+b.position+' pick scores '+b.target+'+ points across '+b.min_games+'+ verified games.';
 $('twistTarget').textContent=detail;
 var list=mode==='4'?[
 'Exactly one player per category, including one rotating Wildcard.',
 'All four picks must represent different nations.',
 'Budget: $'+config.cap+'M.',
 'Player categories, prices and bonus are frozen when the round is published.'
 ]:[
 'Exactly one player each at LW, C, RW, LD, RD and G.',
 'One Superstar, at least one Up & Comer, and at least one Sleeper/Underrated/Bounce-Back player.',
 'No more than two players from one team.',
 'Budget: $'+config.cap+'M; no duplicated players.',
 'This sixes round has its own twist, independent of fours.'
 ];
 $('rulesList').innerHTML='<ul>'+list.map(function(s){return '<li>'+escape(s)+'</li>';}).join('')+'</ul>';
}
function renderSlots(){
 var config=w(),sel=picks(),valid=api.validatePicks(config,sel),cost=valid.cost||0;
 $('capText').textContent='$'+cost+'M / $'+config.cap+'M';
 $('capTrack').setAttribute('aria-valuemax',config.cap);
 $('capTrack').setAttribute('aria-valuenow',cost);
 $('capTrack').classList.toggle('over',cost>config.cap);
 $('capFill').style.width=Math.min(100,cost/config.cap*100)+'%';
 var slots=mode==='4'?api.fourSlots:api.sixSlots;
 $('lineup').innerHTML=slots.map(function(s){
 var p=config.pool.find(function(p){return p.id===sel[s];});
 return '<button type="button" class="slot'+(active===s?' selected':'')+'" data-slot="'+escape(s)+'" aria-pressed="'+(active===s)+'">'+
 '<span class="slotRole">'+escape(mode==='4'?formatLabel(s).split(' ')[0].slice(0,3):s)+'</span>'+
 '<span class="slotMeta"><strong>'+escape(p?p.name:'Choose a player')+'</strong><small>'+
 escape(p?categoryLabel(p.category)+' · '+(p.nation||p.team):formatLabel(s))+'</small></span>'+
 '<span class="slotPrice">'+(p?'$'+p.price+'M':'+')+'</span></button>';
 }).join('');
 $('lineupState').textContent=valid.ok?'VALID DEMO LINEUP':valid.errors.length+' RULE'+(valid.errors.length===1?'':'S')+' TO CHECK';
 $('lineupDetail').textContent=valid.ok?'$'+valid.remaining+'M left. Your roster fits the format and category rules.':
 valid.errors.slice(0,3).join(' ');
 $('lineupState').parentElement.classList.toggle('bad',!valid.ok);
}
function renderPool(){
 var config=w(),sel=picks(),found=optionsFor(active),slotNames=mode==='4'?api.fourSlots:api.sixSlots;
 $('slot').innerHTML=slotNames.map(function(s){return '<option value="'+escape(s)+'"'+(s===active?' selected':'')+'>'+escape(formatLabel(s))+'</option>';}).join('');
 $('poolMessage').textContent='Illustrative featured players eligible for '+formatLabel(active)+'. Prices vary within each category.';
 $('playerPool').innerHTML=found.map(function(p){
  var chosen=sel[active]===p.id;
  return '<button type="button" class="fcard'+(chosen?' active':'')+'" data-player="'+escape(p.id)+'" aria-pressed="'+chosen+'">'+
  '<div class="topline"><span class="tier">'+escape(categoryLabel(p.category))+'</span><span class="cost">$'+p.price+'M</span></div>'+
  '<div class="shadow">'+shadow+'</div><span class="corner">'+escape(p.position)+'</span>'+
  '<div class="namebar"><strong>'+escape(p.name)+'</strong><small>'+escape(p.nation||p.team)+'</small></div></button>';
 }).join('');
}
function render(){renderRules();renderSlots();renderPool();}
function reset(){
 var slots=mode==='4'?api.fourSlots:api.sixSlots;active=slots[0];render();
}
$('format').addEventListener('change',function(){mode=this.value;reset();});
$('round').addEventListener('change',function(){round=this.value;reset();});
$('slot').addEventListener('change',function(){active=this.value;renderSlots();renderPool();});
$('lineup').addEventListener('click',function(e){
 var b=e.target.closest('button[data-slot]');if(!b)return;active=b.dataset.slot;renderSlots();renderPool();
 $('pool-title').scrollIntoView({behavior:'smooth',block:'start'});
});
$('playerPool').addEventListener('click',function(e){
 var b=e.target.closest('button[data-player]');if(!b)return;
 var p=w().pool.find(function(p){return p.id===b.dataset.player;});if(!p||!matching(p,active))return;
 picks()[active]=p.id;
 var slots=mode==='4'?api.fourSlots:api.sixSlots;
 var unfilled=slots.find(function(s){return !picks()[s];});
 if(unfilled)active=unfilled;render();
});
reset();
})();
