/* Japan LG3s | actual WebGL 3D prototype (Three.js r162)
 * No private Great Britain app assets, no official-number guesses, no writes.
 * Mobile canvas stays noninteractive until visitor explicitly enables touch.
 */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const shell=window.ECMJapanLocker;
const host=document.getElementById('japanScene');
const status=document.getElementById('sceneStatus');
const $=id=>document.getElementById(id);
const mobile=window.matchMedia('(pointer:coarse)').matches;
const reducedMotion=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
const isFiniteNumber=n=>typeof n==='number'&&Number.isFinite(n);
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
let renderer=null,scene=null,camera=null,controls=null,clock=null;
let selected=null,turnBack=false,interactionOn=!mobile,frame=0,cameraTransition=true;
const groups=new Map(),pickables=[],lights=[],focus=new THREE.Vector3(0,2.5,-2.4);
let cameraGoal=new THREE.Vector3(0,7.1,16.7),targetGoal=focus.clone();

const mats={
 wall:new THREE.MeshStandardMaterial({color:0x151b25,metalness:.24,roughness:.76}),
 wallEdge:new THREE.MeshStandardMaterial({color:0x4d5661,metalness:.65,roughness:.36}),
 black:new THREE.MeshStandardMaterial({color:0x0d1016,metalness:.13,roughness:.86}),
 red:new THREE.MeshStandardMaterial({color:0xd51b36,metalness:.14,roughness:.58,emissive:0x170307}),
 gold:new THREE.MeshStandardMaterial({color:0xc8a56b,metalness:.60,roughness:.29}),
 wood:new THREE.MeshStandardMaterial({color:0x39313a,metalness:.13,roughness:.70}),
 metal:new THREE.MeshStandardMaterial({color:0x7f8b96,metalness:.82,roughness:.25}),
 ice:new THREE.MeshStandardMaterial({color:0x141a25,metalness:.18,roughness:.42}),
 pale:new THREE.MeshStandardMaterial({color:0xd7dce2,metalness:.27,roughness:.51}),
 darkRubber:new THREE.MeshStandardMaterial({color:0x0c0d11,metalness:.03,roughness:.98}),
 redGlow:new THREE.MeshStandardMaterial({color:0xf02d45,metalness:.1,roughness:.31,emissive:0xb6162f,emissiveIntensity:.58})
};
function mesh(parent,geometry,material,x=0,y=0,z=0){
 const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function cube(parent,w,h,d,material,x,y,z){
 return mesh(parent,new THREE.BoxGeometry(w,h,d),material,x,y,z);
}
function cylinder(parent,rTop,rBottom,height,material,x,y,z,segments=14){
 return mesh(parent,new THREE.CylinderGeometry(rTop,rBottom,height,segments),material,x,y,z);
}
function ball(parent,r,material,x,y,z,sx=1,sy=1,sz=1){
 const m=mesh(parent,new THREE.SphereGeometry(r,14,10),material,x,y,z);m.scale.set(sx,sy,sz);return m;
}
function canvasTexture(draw,w=768,h=512){
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)throw Error('Canvas 2D unavailable');
 draw(ctx,w,h);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return texture;
}
function fabric(ctx,w,h){
 ctx.fillStyle='#101217';ctx.fillRect(0,0,w,h);
 const grad=ctx.createRadialGradient(w*.45,h*.12,20,w*.5,h*.55,w*.65);
 grad.addColorStop(0,'#38343a');grad.addColorStop(.32,'#1c1c22');grad.addColorStop(1,'#090b10');
 ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
 ctx.lineWidth=1;ctx.strokeStyle='rgba(245,250,255,.045)';
 for(let i=0;i<65;i++){const x=i*w/65;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+w*.04,h);ctx.stroke();}
 ctx.strokeStyle='rgba(0,0,0,.20)';
 for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(w*.27+i*w*.036,115);ctx.quadraticCurveTo(w*.44+i*w*.019,h*.72,w*.27+i*w*.037,h);ctx.stroke();}
}
function drawJapanFront(ctx,w,h){
 fabric(ctx,w,h);
 ctx.fillStyle='#c9152e';ctx.fillRect(0,h*.25,w*.29,h*.055);ctx.fillRect(w*.71,h*.25,w*.29,h*.055);
 ctx.fillStyle='#f12b42';ctx.fillRect(0,h*.52,w*.255,h*.065);ctx.fillRect(w*.745,h*.52,w*.255,h*.065);
 ctx.fillRect(0,h*.645,w*.26,h*.067);ctx.fillRect(w*.74,h*.645,w*.26,h*.067);
 ctx.strokeStyle='#e72b46';ctx.lineWidth=9;ctx.beginPath();ctx.ellipse(w*.5,h*.475,w*.145,h*.21,0,0,Math.PI*2);ctx.stroke();
 const rim=ctx.createLinearGradient(0,h*.29,0,h*.67);rim.addColorStop(0,'#f04960');rim.addColorStop(1,'#8d091d');
 ctx.fillStyle=rim;ctx.beginPath();ctx.ellipse(w*.5,h*.475,w*.132,h*.192,0,0,Math.PI*2);ctx.fill();
 ctx.save();ctx.beginPath();ctx.ellipse(w*.5,h*.475,w*.129,h*.189,0,0,Math.PI*2);ctx.clip();
 ctx.fillStyle='#b6162f';
 for(let i=0;i<11;i++)ctx.fillRect(w*.37,h*.30+i*17,w*.27,8);
 ctx.restore();
 ctx.fillStyle='rgba(255,255,255,.12)';
 ctx.fillRect(w*.49,h*.035,w*.018,h*.12);
}
function drawJapanBack(ctx,w,h,player,number){
 fabric(ctx,w,h);
 ctx.fillStyle='#ef334c';ctx.fillRect(0,h*.24,w*.26,h*.056);ctx.fillRect(w*.74,h*.24,w*.26,h*.056);
 ctx.fillRect(0,h*.53,w*.25,h*.07);ctx.fillRect(w*.75,h*.53,w*.25,h*.07);
 ctx.fillRect(0,h*.66,w*.25,h*.065);ctx.fillRect(w*.75,h*.66,w*.25,h*.065);
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 const tag=String(player.gamertag||'JAPAN').toUpperCase();
 ctx.font='900 53px Arial,sans-serif';ctx.lineWidth=7;ctx.strokeStyle='#05060a';ctx.strokeText(tag,w/2,h*.28,w*.49);
 ctx.fillStyle='#fff';ctx.fillText(tag,w/2,h*.28,w*.49);
 if(number!==''){
  ctx.font='900 240px Impact,Arial,sans-serif';ctx.lineWidth=23;ctx.strokeStyle='#1a1820';
  ctx.strokeText(number,w/2,h*.61,w*.52);
  ctx.fillStyle='#f5f3f5';ctx.fillText(number,w/2,h*.61,w*.52);
 }
}
function textureFace(player,side,number=''){
 return canvasTexture((ctx,w,h)=>side==='front'?drawJapanFront(ctx,w,h):drawJapanBack(ctx,w,h,player,number),768,566);
}
function shapeGeometry(shape){
 const geo=new THREE.ShapeGeometry(shape,20),pos=geo.getAttribute('position'),uv=geo.getAttribute('uv');
 for(let i=0;i<pos.count;i++){
  uv.setXY(i,(pos.getX(i)+1.28)/2.56,(pos.getY(i)+.92)/1.69);
 }
 uv.needsUpdate=true;return geo;
}
function jerseyShape(){
 const s=new THREE.Shape();
 s.moveTo(-.27,.71);s.lineTo(-.74,.67);s.lineTo(-1.13,.47);
 s.lineTo(-1.26,-.24);s.lineTo(-.83,-.31);s.lineTo(-.68,.19);
 s.lineTo(-.72,-.86);s.lineTo(.72,-.86);s.lineTo(.68,.19);
 s.lineTo(.83,-.31);s.lineTo(1.26,-.24);s.lineTo(1.13,.47);
 s.lineTo(.74,.67);s.lineTo(.27,.71);
 s.quadraticCurveTo(0,.40,-.27,.71);s.closePath();return s;
}
const jerseyOutline=jerseyShape(),shirtGeo=shapeGeometry(jerseyOutline);
const shirtVolume=new THREE.ExtrudeGeometry(jerseyOutline,{depth:.19,steps:1,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:2,curveSegments:18});
function createJersey(player){
 const jersey=new THREE.Group(),body=mesh(jersey,shirtVolume,mats.black);
 body.position.z=-.095;
 const frontTexture=textureFace(player,'front');
 const backTexture=textureFace(player,'back');
 const front=mesh(jersey,shirtGeo,new THREE.MeshStandardMaterial({map:frontTexture,side:THREE.DoubleSide,roughness:.90,metalness:.01,transparent:false}),0,0,.15);
 const back=mesh(jersey,shirtGeo,new THREE.MeshStandardMaterial({map:backTexture,side:THREE.DoubleSide,roughness:.90,metalness:.01}),0,0,-.15);
 back.rotation.y=Math.PI;
 const collar=mesh(jersey,new THREE.TorusGeometry(.255,.053,9,28,Math.PI),mats.black,0,.685,.205);collar.rotation.z=Math.PI;
 const sleevePatch=ball(jersey,.06,mats.red,.83,.42,.23,.8,1.25,.2);
 const hanger=cube(jersey,.015,.27,.016,mats.metal,0,.87,-.06);hanger.rotation.z=.17;
 const hook=mesh(jersey,new THREE.TorusGeometry(.12,.018,6,14,Math.PI*1.4),mats.metal,.01,1.03,-.06);
 hook.rotation.z=-.12;
 jersey.userData={playerId:player.id,front,back,player,number:'',isBack:false};
 return jersey;
}
function retextureBack(entry,number){
 const back=entry.jersey.userData.back;
 const old=back.material.map;
 back.material.map=textureFace(entry.player,'back',number);
 back.material.needsUpdate=true;
 old?.dispose();
 entry.jersey.userData.number=number;
}
function makePlateText(player){
 return canvasTexture((ctx,w,h)=>{
  ctx.fillStyle='#131821';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#cd9d6c';ctx.lineWidth=12;ctx.strokeRect(7,7,w-14,h-14);
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#fff';ctx.font='900 57px Arial,sans-serif';
  ctx.fillText(player.gamertag.toUpperCase(),w/2,h*.43,w*.87);
  ctx.fillStyle='#ff7a85';ctx.font='800 22px Arial,sans-serif';
  ctx.fillText(player.position+' · MAIN ROSTER · NO VERIFIED JERSEY #',w/2,h*.77,w*.90);
 },768,170);
}
function namePlate(parent,player){
 const plate=cube(parent,2.68,.64,.11,mats.black,0,5.25,.08);
 const face=mesh(parent,new THREE.PlaneGeometry(2.56,.53),
  new THREE.MeshBasicMaterial({map:makePlateText(player),transparent:false}),0,5.25,.151);
 return face;
}
function goalieEquipment(bay){
 const padL=cube(bay,.44,1.04,.32,mats.pale,-.72,1.06,.50);
 const padR=cube(bay,.44,1.04,.32,mats.pale,.72,1.06,.50);
 for(const p of [padL,padR])p.rotation.z=p===padL?.05:-.05;
 for(const x of [-.72,.72]){cube(bay,.41,.09,.33,mats.red,x,1.27,.70);cube(bay,.40,.08,.33,mats.red,x,.81,.70)}
 ball(bay,.34,mats.pale,.92,4.56,.46,1,.82,.89);
 ball(bay,.17,mats.red,.93,4.53,.67,1,1,.28);
}
function skaterEquipment(bay){
 for(const x of [-.82,.82]){
  const boot=cube(bay,.42,.23,.73,mats.darkRubber,x,.72,.64);boot.rotation.z=x<0?-.10:.10;
  cube(bay,.40,.12,.70,mats.metal,x,.59,.73);
 }
 ball(bay,.30,mats.black,-.84,4.6,.5,1,.74,.83);
 const seam=mesh(bay,new THREE.TorusGeometry(.22,.023,8,24),mats.red,-.84,4.61,.75);seam.scale.y=.7;
}
function buildBay(player,position,rotation){
 const root=new THREE.Group();scene.add(root);root.position.copy(position);root.rotation.y=rotation;
 cube(root,3.17,5.8,.40,mats.wall,0,2.88,-.38);
 cube(root,3.26,.13,.49,mats.metal,0,5.78,-.34);
 cube(root,.16,5.85,.52,mats.wallEdge,-1.61,2.90,-.25);
 cube(root,.16,5.85,.52,mats.wallEdge,1.61,2.90,-.25);
 cube(root,3.05,.12,.68,mats.wood,0,4.52,.11);
 cube(root,2.91,.10,.70,mats.wood,0,1.43,.42);
 cube(root,2.70,.11,.40,mats.black,0,.43,.10);
 const underGlow=cube(root,2.75,.065,.16,mats.redGlow,0,1.33,.75);
 underGlow.castShadow=false;
 const light=cube(root,2.77,.065,.30,mats.redGlow,0,5.69,.18);light.castShadow=false;
 const baseFrame=cube(root,2.80,3.44,.095,mats.black,0,3.03,-.12);
 baseFrame.receiveShadow=true;
 const jersey=createJersey(player);jersey.position.set(0,3.18,.39);jersey.scale.set(.97,.97,.97);root.add(jersey);
 const plate=namePlate(root,player);
 if(player.kind==='goalie')goalieEquipment(root);else skaterEquipment(root);
 const accent=cube(root,3.02,.08,.33,mats.gold,0,5.53,.22);accent.visible=false;
 const pick=[plate,jersey.userData.front,jersey.userData.back,baseFrame];
 for(const m of pick){m.userData.playerId=player.id;pickables.push(m)}
 const entry={player,root,jersey,accent,normal:new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),rotation),baseFront:rotation};
 groups.set(player.id,entry);
 return entry;
}
function stageText(parent,text,w,h,x,y,z,color='#fff'){
 const texture=canvasTexture((ctx,W,H)=>{
  ctx.clearRect(0,0,W,H);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='900 92px Arial,sans-serif';ctx.fillText(text,W/2,H/2,W*.95);
 },1024,256);
 const m=mesh(parent,new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}),x,y,z);
 m.castShadow=false;
 return m;
}
function buildRoom(players){
 const floorTex=canvasTexture((ctx,w,h)=>{
  ctx.fillStyle='#171c26';ctx.fillRect(0,0,w,h);
  for(let x=0;x<w;x+=60){ctx.strokeStyle='#61677427';ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
  for(let y=0;y<h;y+=60){ctx.strokeStyle='#61677427';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  ctx.fillStyle='#7c1827';ctx.fillRect(w*.44,0,w*.12,h);
  ctx.fillStyle='#9b7e5188';ctx.fillRect(w*.495,0,w*.01,h);
 },1024,1024);
 floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping;floorTex.repeat.set(1.8,1.5);
 const floor=mesh(scene,new THREE.PlaneGeometry(32,27),new THREE.MeshStandardMaterial({map:floorTex,roughness:.89,metalness:.07}),0,-.03,.6);
 floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.castShadow=false;
 cube(scene,32,10,.6,mats.wall,0,4.7,-11.2);
 cube(scene,.6,10,27,mats.wall,-15.4,4.7,.9);
 cube(scene,.6,10,27,mats.wall,15.4,4.7,.9);
 // Backlit, geometric Japan-inspired architecture. No official team branding claim.
 cube(scene,27,.18,.28,mats.red,0,8.87,-10.88);
 stageText(scene,'JAPAN  •  LG3s',13,2,0,7.54,-10.80,'#f1edf0');
 for(const x of [-14.8,14.8]){
  for(let z=-9;z<=10;z+=4){
   cube(scene,.28,8,.34,mats.redGlow,x,4.6,z);
  }
 }
 const rug=cube(scene,7,.045,16,mats.black,0,.012,.2);
 rug.receiveShadow=true;
 cube(scene,5,.08,4,mats.red,0,.07,-1.1);
 cube(scene,4.5,.09,3.5,mats.black,0,.14,-1.1);
 stageText(scene,'🇯🇵 JAPAN',4.5,.75,0,.18,-1.1,'#ff5264').rotation.x=-Math.PI/2;
 // Central island with matte wood bench tops, equipment space and warm edge LEDs.
 for(const x of [-2.7,2.7]){
  cube(scene,1.18,.19,8,mats.wood,x,.66,1.0);
  for(const z of [-2.2,1.0,4.2])cube(scene,.14,.63,.12,mats.metal,x,.29,z);
 }
 const baySlots=[];
 for(const x of [-6.8,-3.4,0,3.4,6.8])baySlots.push({x,z:-9.5,rotation:0});
 for(const z of [-5,0,5])baySlots.push({x:-12.5,z,rotation:Math.PI/2});
 for(const z of [-5,0,5])baySlots.push({x:12.5,z,rotation:-Math.PI/2});
 if(players.length!==11)throw Error('Japan roster count differs from the inspected 11-player source snapshot');
 for(let i=0;i<players.length;i++){
  const p=baySlots[i];buildBay(players[i],new THREE.Vector3(p.x,0,p.z),p.rotation);
 }
 // Low-cost architectural lighting: ceiling panels and red strips instead of expensive postprocessing.
 for(const z of [-7,-2,3,8]){
  const panel=cube(scene,4,.09,.65,mats.pale,0,9.4,z);panel.castShadow=false;
 }
 const hemi=new THREE.HemisphereLight(0xbfcfe6,0x17101a,2.0);scene.add(hemi);
 const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(4,13,12);
 key.castShadow=!mobile;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-21;key.shadow.camera.right=21;key.shadow.camera.top=19;key.shadow.camera.bottom=-19;key.shadow.camera.far=60;key.shadow.bias=-.0006;scene.add(key);
 const red=new THREE.PointLight(0xf4244b,80,32,2);red.position.set(-11,7,-5);scene.add(red);
 const amber=new THREE.PointLight(0xf0c28f,62,26,2);amber.position.set(9,7,4);scene.add(amber);
}
function moveToOverview(){
 cameraGoal.set(0,7.3,17.3);targetGoal.set(0,2.8,-2.0);cameraTransition=true;
}
function focusPlayer(id){
 const entry=groups.get(Number(id));if(!entry)return;
 if(selected&&selected!==entry){
  selected.jersey.rotation.y=0;
  turnBack=false;
 }
 selected=entry;
 $('rotateJersey').textContent='Show jersey back';
 for(const e of groups.values())e.accent.visible=e===entry;
 const target=entry.root.position.clone().add(new THREE.Vector3(0,3.12,0));
 cameraGoal.copy(target.clone().addScaledVector(entry.normal,5.9).add(new THREE.Vector3(0,1.05,0)));
 targetGoal.copy(target);cameraTransition=true;
 if(shell.previewNumber!==entry.jersey.userData.number)retextureBack(entry,shell.previewNumber);
}
function toggleJersey(){
 if(!selected)return;
 turnBack=!turnBack;
 selected.jersey.rotation.y=turnBack?Math.PI:0;
 $('rotateJersey').textContent=turnBack?'Show jersey front':'Show jersey back';
 if(turnBack&&shell.previewNumber!==selected.jersey.userData.number)retextureBack(selected,shell.previewNumber);
}
function enableMobileInteraction(active){
 interactionOn=active;
 if(mobile&&renderer){renderer.domElement.style.pointerEvents=active?'auto':'none';renderer.domElement.style.touchAction=active?'none':'pan-y'}
 $('toggleInteraction').setAttribute('aria-pressed',String(active));
 $('toggleInteraction').textContent=active?'Return to page scrolling':'Enable touch view';
}
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();let down=null;
function pick(event){
 if(mobile&&!interactionOn)return;
 if(!renderer||event.target!==renderer.domElement)return;
 const rect=renderer.domElement.getBoundingClientRect();
 if(rect.width<=0||rect.height<=0)return;
 mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
 raycaster.setFromCamera(mouse,camera);
 for(const hit of raycaster.intersectObjects(pickables,true)){
  const id=hit.object.userData.playerId;
  if(id&&groups.has(Number(id))){shell.selectPlayer(Number(id));break;}
 }
}
function resize(){
 if(!renderer||!camera)return;
 const w=Math.max(1,host.clientWidth),h=Math.max(300,host.clientHeight);
 camera.aspect=w/h;camera.updateProjectionMatrix();
 renderer.setSize(w,h,false);
}
function animate(){
 frame=requestAnimationFrame(animate);
 if(cameraTransition){
  const speed=reducedMotion?1:.12;
  camera.position.lerp(cameraGoal,speed);
  controls.target.lerp(targetGoal,speed);
  if(camera.position.distanceToSquared(cameraGoal)<.0009&&controls.target.distanceToSquared(targetGoal)<.0009){
   cameraTransition=false;
  }
 }
 controls.update();
 renderer.render(scene,camera);
}
function init(players){
 if(!window.WebGLRenderingContext)throw Error('WebGL not available');
 scene=new THREE.Scene();scene.background=new THREE.Color(0x070a0e);
 scene.fog=new THREE.Fog(0x070a0e,19,54);
 camera=new THREE.PerspectiveCamera(48,1,.15,120);camera.position.copy(cameraGoal);
 renderer=new THREE.WebGLRenderer({antialias:!mobile,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,mobile?1.15:1.65));
 renderer.setClearColor(0x070a0e);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.16;
 renderer.shadowMap.enabled=!mobile;
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 host.textContent='';host.appendChild(renderer.domElement);host.dataset.ready='true';
 resize();
 controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=!reducedMotion;controls.dampingFactor=.10;
 controls.maxPolarAngle=Math.PI*.57;controls.minPolarAngle=Math.PI*.17;
 controls.minDistance=3.6;controls.maxDistance=30;
 controls.enablePan=true;controls.target.copy(targetGoal);
 controls.screenSpacePanning=false;
 controls.addEventListener('start',()=>{cameraTransition=false});
 buildRoom(players);
 if(mobile)enableMobileInteraction(false);
 $('viewOverview').disabled=false;$('viewPlayer').disabled=!shell.selected;$('rotateJersey').disabled=!shell.selected;
 $('rotateJersey').textContent='Show jersey back';
 $('toggleInteraction').disabled=false;
 const touchBtn=$('toggleInteraction');
 if(!mobile){touchBtn.hidden=true;}
 else touchBtn.addEventListener('click',()=>enableMobileInteraction(!interactionOn));
 $('viewOverview').addEventListener('click',moveToOverview);
 $('viewPlayer').addEventListener('click',()=>{if(shell.selected)focusPlayer(shell.selected.id)});
 $('rotateJersey').addEventListener('click',toggleJersey);
 window.addEventListener('ecm-japan-player-select',event=>{
  focusPlayer(event.detail.player.id);
  $('viewPlayer').disabled=false;$('rotateJersey').disabled=false;
 });
 window.addEventListener('ecm-japan-number-preview',event=>{
  if(selected)retextureBack(selected,event.detail.number);
 });
 renderer.domElement.addEventListener('pointerdown',event=>{
  down={x:event.clientX,y:event.clientY};
 });
 renderer.domElement.addEventListener('pointerup',event=>{
  if(down&&Math.hypot(event.clientX-down.x,event.clientY-down.y)<7)pick(event);
  down=null;
 });
 const observer=new ResizeObserver(()=>resize());observer.observe(host);
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}
  else if(!document.hidden&&!frame)animate();
 });
 renderer.domElement.addEventListener('webglcontextlost',event=>{
  event.preventDefault();if(frame){cancelAnimationFrame(frame);frame=0;}
  status.textContent='WebGL context interrupted. Use the accessible player roster below.';
 });
 renderer.domElement.addEventListener('webglcontextrestored',()=>{status.textContent='WebGL restored. Reload the page to reconnect the 3D view.'});
 clock=new THREE.Clock();
 moveToOverview();
 if(shell.selected)focusPlayer(shell.selected.id);
 animate();
 status.textContent='Japan 3D room ready · '+players.length+' verified main-roster stalls · '+(mobile?'page scrolling stays enabled until touch view is selected':'click a stall or player name to explore');
}
if(!shell?.ready){
 status.textContent='Roster integration unavailable. Use the accessible team room below.';
}else{
 shell.ready.then(init).catch(error=>{
  console.warn('Japan 3D view could not start:',error);
  status.textContent='3D viewer unavailable. The roster and Hockey Card links remain available below.';
  if(!host.querySelector('.scene-placeholder')){
    host.innerHTML='<div class="scene-placeholder"><p>3D rendering unavailable on this device.</p><a href="lg3s-team.html?team=591&amp;fallback=1">Open Japan 2D player stalls →</a></div>';
  }
 });
}
