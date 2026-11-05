/* V3 preview. Runs only on hitmen-stall-v3-preview.html; does not mutate existing game/locker data. */
(() => {
"use strict";
if (!document.body.classList.contains("v3-preview") || !window.HitmenStall) return;
const E = id => document.getElementById(id);
const x = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const blank = src => '<img class="v3-photo" src="'+src+'" alt="" draggable="false" decoding="async">';
const active = () => {
  const app=E("hqApp")||document.querySelector("[data-locker-content]");
  return Boolean(app && !app.hidden);
};
/* The photographic shell comes from the approved master image, not the old mismatched stall.
   Metal, illumination, two jerseys and physical gear remain a coherent artwork layer.
   Editable name/number fields and user gear slots are independent elements above it. */
const scene = () => '<div class="v3-stage v3-master-scene" role="group" aria-label="Calgary Hitmen double jersey locker. Front jersey on the left, back jersey on the right.">'+
  '<img class="v3-master-photo" src="assets/hitmen-v3/locker-photo-master.webp?v=20261105-mobile-jersey-1" alt="" draggable="false" decoding="async">'+
  '<div class="v3-plate"><strong data-v3="plateName">PLAYER</strong><span class="sep" aria-hidden="true">/</span><span class="number" data-v3="plateNumber">--</span></div>'+
  '<span class="v3-master-backname" data-v3="jerseyName" aria-hidden="true">PLAYER</span>'+
  '<span class="v3-master-backnumber" data-v3="jerseyNumber" aria-hidden="true">--</span>'+
  '<span class="v3-master-sleeve a" data-v3="frontSleeve" aria-hidden="true">--</span>'+
  '<span class="v3-master-sleeve b" data-v3="frontSleeve" aria-hidden="true">--</span>'+
  '<span class="v3-master-sleeve c" data-v3="backSleeve" aria-hidden="true">--</span>'+
  '<span class="v3-master-sleeve d" data-v3="backSleeve" aria-hidden="true">--</span>'+
  '<span class="v3-master-helmetnum" data-v3="helmetNumber" aria-hidden="true">--</span>'+
  '<span class="v3-gear helmet" aria-hidden="true"></span>'+
  '<span class="v3-gear gloves" aria-hidden="true"></span>'+
  '<span class="v3-gear skateleft" aria-hidden="true"></span>'+
  '</div>';
const stateFor = (opts={}) => ({
 name:String(opts.name ?? "").toUpperCase().replace(/\s+/g," ").trim().slice(0,18)||"PLAYER",
 number:String(opts.number??"").replace(/\D/g,"").slice(0,2)||"--"
});
const fit = (el,max=18) => {
 if (!el) return;
 const n=(el.textContent||"").length;
 el.style.fontSize=n>max?'min(3cqw, 20px)':'';
 el.title=el.textContent;
};
function paint(host,opts={}) {
 const stage=host.classList?.contains("v3-stage")?host:host.querySelector(".v3-stage");
 if (!stage) return;
 const data=stateFor(opts);
 stage.querySelectorAll('[data-v3="plateName"],[data-v3="jerseyName"]').forEach(el => {el.textContent=data.name;fit(el,12)});
 stage.querySelectorAll('[data-v3="plateNumber"],[data-v3="jerseyNumber"],[data-v3="frontSleeve"],[data-v3="backSleeve"],[data-v3="helmetNumber"]').forEach(el => el.textContent=data.number);
 stage.setAttribute("aria-label", "Calgary Hitmen locker. Jersey name "+data.name+", number "+data.number+". Front jersey left and back jersey right.");
 const pictureName=E("v3HeroName");if(pictureName)pictureName.textContent=data.name;
 const bigNum=E("v3HeroNumber");if(bigNum)bigNum.textContent=data.number;
}
function mount(host,opts={}) {
 host.innerHTML=scene();
 paint(host,opts);
 return host;
}
function update(host,opts={}) {paint(host,opts);}
window.HitmenStall={...window.HitmenStall, mount, update, setBack(){},fitAll(){}};
/* Existing hitmen-player-locker.js continues to own auth, data loading, editing and profile reports. */
function buildFrame() {
 const body=E("roomBody"), hero=E("stall");
 if (!body || !hero || E("v3WarroomBanner")) return;
 const banner=document.createElement("section");
 banner.className="v3-banner";banner.id="v3WarroomBanner";
 banner.setAttribute("aria-label","Elite Chel Media Calgary Hitmen War Room");
 banner.innerHTML='<div class="v3-team"><img src="assets/lgchl/s55/team412.png" alt="" width="62" height="62"><div><small>CALGARY</small><strong>HITMEN</strong></div></div>'+
 '<img class="v3-crest" src="assets/brand/ecm-crest.webp" alt="Elite Chel Media" width="160" height="110">'+
 '<div class="v3-warroom"><b>HITMEN</b>WAR ROOM</div>';
 body.insertBefore(banner,hero);
 const title=document.createElement("div");
 title.className="v3-titlebar";
 title.innerHTML='<h1>MY STALL</h1><span class="slashes" aria-hidden="true">//</span><span class="sub">PLAYER LOCKER / PERSONAL OPERATIONS</span><span class="season">SEASON 55</span>';
 body.insertBefore(title,hero);
 const dashboard=body.querySelector(".reference-dashboard-row");
 if(dashboard){
  const dev=document.createElement("article");dev.className="card stall-dashboard-card v3-development-card";
  dev.innerHTML='<div class="stall-card-title"><h2>DEVELOPMENT</h2></div><p class="v3-trend-sub">CURRENT TREND</p><p class="v3-trend">NOT YET RATED</p>'+
  '<div class="v3-segments" aria-hidden="true">'+Array.from({length:7},()=>'<i></i>').join('')+'</div>'+
  '<p class="v3-preview-note">A verified progress model is required before showing a player development score.</p>';
  dashboard.appendChild(dev);
  const tools=document.createElement("section");tools.className="v3-tools";tools.setAttribute("aria-label","Player tools");
  tools.innerHTML='<h2>⚒ &nbsp;PLAYER TOOLS</h2>'+
  '<button type="button" id="v3Customize">CUSTOMIZE</button>'+
  '<a href="hitmen-lineup.html">LINEUP ASSIGN</a>'+
  '<a href="#games">PLAYER REPORT</a>'+
  '<button type="button" id="v3Export">EXPORT STATS</button>';
  dashboard.insertAdjacentElement("afterend",tools);
  E("v3Customize")?.addEventListener("click",()=>document.querySelector('[data-stall-tab="settings"]')?.click());
  E("v3Export")?.addEventListener("click",()=>{
    if(!active())return;
    const pairs=[["Gamertag",E("playerTitle")?.textContent],["Position",E("profileBioPosition")?.textContent],
      ["Games played",E("profileGP")?.textContent],["Goals",E("profileGoals")?.textContent],
      ["Assists",E("profileAssists")?.textContent],["Points",E("profilePoints")?.textContent],
      ["Plus-minus",E("profilePlusMinus")?.textContent]];
    const cell=value=>'"'+String(value??"").replace(/"/g,'""')+'"';
    const csv="Field,Value\r\n"+pairs.map(a=>a.map(cell).join(",")).join("\r\n")+"\r\n";
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="hitmen-player-stat-summary.csv";
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
 }
 const tabs=document.querySelector(".reference-player-pane .stall-profile-tabs");
 if(tabs)tabs.setAttribute("aria-label","Hitmen player dashboard sections");
 const settings=E("editLockerBox");
 if(settings){
  const upload=document.createElement("fieldset");upload.className="v3-equipment-upload";
  upload.style.cssText="margin:16px 0;padding:15px;border:1px solid #716366;background:#101015;color:#eee";
  upload.innerHTML='<legend style="font-weight:800;color:#e5c272">EQUIPMENT PHOTO · LOCAL PREVIEW ONLY</legend>'+
   '<label for="v3EquipmentTarget">Gear slot</label> <select id="v3EquipmentTarget"><option value="helmet">Helmet</option><option value="gloves">Gloves</option><option value="skateleft">Skate</option></select>'+
   '<label for="v3EquipmentFile">Screenshot</label> <input id="v3EquipmentFile" type="file" accept="image/jpeg,image/png,image/webp">'+
   '<p id="v3EquipmentMessage">This local preview never uploads or saves equipment.</p>';
  settings.appendChild(upload);
  let oldUrl=null;
  E("v3EquipmentFile")?.addEventListener("change",event=>{
   const file=event.target.files?.[0],target=E("v3EquipmentTarget")?.value;
   if(!file||!["helmet","gloves","skateleft"].includes(target))return;
   if(file.size>6*1024*1024||!["image/png","image/jpeg","image/webp"].includes(file.type)){
    E("v3EquipmentMessage").textContent="Select a PNG, JPG or WebP image smaller than 6 MB.";return;
   }
   const node=document.querySelector(".v3-gear."+target);if(!node)return;
   if(oldUrl)URL.revokeObjectURL(oldUrl);oldUrl=URL.createObjectURL(file);
   node.style.backgroundImage='url("'+oldUrl+'")';node.style.backgroundSize="contain";node.style.backgroundPosition="center";
   node.style.backgroundRepeat="no-repeat";node.textContent="";node.classList.add("has-photo");
   E("v3EquipmentMessage").textContent="Screenshot displayed in the "+target+" slot locally. No data saved.";
  });
 }
 /* Preserve the existing player bio and fields, but move them below the visual dashboard.
    The approved reference shows the statistical modules immediately beneath the primary strip. */
 const bio=body.querySelector(".reference-bio-card");
 const reports=body.querySelector(".reference-secondary");
 if(bio&&reports)reports.appendChild(bio);
 /* Render recent individual results from the game's existing, approved report DOM.
    No new network request, no guessed player identity and no fabricated stat rows. */
 function renderRecentGameLines(){
   const recent=body.querySelector(".recent-stat-list");
   const reportRoot=E("playerGameReports");
   if(!recent||!reportRoot)return;
   const reports=Array.from(reportRoot.querySelectorAll(".player-report")).slice(0,3);
   if(!reports.length)return;
   const isGoalie=String(E("profileBioPosition")?.textContent||"").trim().toUpperCase()==="G";
   const wanted=isGoalie?["SV","SA","GA","SV%"]:["G","A","PTS"];
   const rows=reports.map(report=>{
     const heading=report.querySelector(".player-report-head");
     const date=heading?.querySelector("small")?.textContent?.trim()||"—";
     const opponent=heading?.querySelector("h3")?.textContent?.split(" · ")[0]?.trim()||"Opponent";
     const stats={};
     report.querySelectorAll(".player-report-statline span").forEach(span=>{
       const label=span.querySelector("small")?.textContent?.trim();
       if(label) stats[label]=span.querySelector("b")?.textContent?.trim()||"—";
     });
     return [date,opponent,...wanted.map(label=>stats[label]??"—")];
   });
   const ths=["DATE","OPPONENT",...wanted];
   recent.innerHTML='<table class="v3-recent-table" aria-label="Recent individual game statistics"><thead><tr>'+
      ths.map(value=>'<th scope="col">'+x(value)+'</th>').join("")+'</tr></thead><tbody>'+
      rows.map(row=>'<tr>'+row.map(value=>'<td>'+x(value)+'</td>').join("")+'</tr>').join("")+'</tbody></table>';
 }
 const gameReportRoot=E("playerGameReports");
 if(gameReportRoot){
   new MutationObserver(renderRecentGameLines).observe(gameReportRoot,{childList:true});
   renderRecentGameLines();
 }
 const caption=document.createElement("p");caption.className="v3-preview-note";
 caption.textContent=document.body.classList.contains("v3-live")?"Equipment photo selections are local visual previews only and are NOT saved to your locker. Team statistics and reports are sourced from the existing War Room.":"Design preview, not production. Equipment images selected here are not stored or shared. Final visual approval is required.";
 const toolsBar=body.querySelector(".v3-tools");
 if(toolsBar)toolsBar.insertAdjacentElement("afterend",caption);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",buildFrame,{once:true});
else buildFrame();
})();
