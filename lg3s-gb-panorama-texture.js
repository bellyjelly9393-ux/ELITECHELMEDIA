/* Great Britain public panorama texture compositor.
   Renders concept jerseys directly into the existing equirectangular locker-room
   photographs. Pannellum hit areas are transparent and only handle interaction.
   Source images, public roster and camera geometry are the only inputs. No
   player numbers, real-world equipment brands, scouting data or VOD are used. */
(()=>{
'use strict';
const toRadians=d=>d*Math.PI/180;
const clamp=(v,low,high)=>Math.max(low,Math.min(high,v));
function loadImage(source){
 return new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>resolve(image);
  image.onerror=()=>reject(Error('Cannot load scene artwork: '+source));
  image.decoding='async';
  image.src=source;
 });
}
function drawMountedJersey(ctx,textureWidth,textureHeight,jersey,point,{goalie=false}={}){
 const yaw=point[0],pitch=point[1];
 const x=textureWidth*(0.5+yaw/360);
 const y=textureHeight*(0.5-pitch/180);
 // Tuned to the physical bays in the existing Calgary room scene: these are
 // angular sizes within a 360 x 180-degree equirectangular texture.
 const width=textureWidth*6.1/360;
 const height=textureHeight*11.0/180;
 ctx.save();
 ctx.shadowColor='rgba(0,0,0,.7)';
 ctx.shadowBlur=width*.11;
 ctx.shadowOffsetY=width*.07;
 ctx.drawImage(jersey,x-width/2,y-height/2,width,height);
 ctx.restore();
 // A discrete gold dot denotes the goalie position. This is only a position
 // marker, never a claim about a real equipment model or jersey number.
 if(goalie){
  ctx.save();
  ctx.fillStyle='#d3ad67';
  ctx.beginPath();
  ctx.arc(x+width*.43,y-height*.49,Math.max(3,width*.07),0,Math.PI*2);
  ctx.fill();
  ctx.restore();
 }
 return {x,y,width,height};
}
function drawTeamSign(ctx,textureWidth,textureHeight,scene,crest,ecm){
 // Embedded into the room's actual black wall sign, not a Pannellum HUD.
 const pitch=scene==='centre'?23:12;
 const cx=textureWidth*.5;
 const cy=textureHeight*(.5-pitch/180);
 const width=textureWidth*(scene==='centre'?38:35)/360;
 const height=textureHeight*7.8/180;
 const x=cx-width/2,y=cy-height/2;
 ctx.save();
 ctx.fillStyle='rgba(3,11,22,.92)';
 ctx.fillRect(x,y,width,height);
 ctx.strokeStyle='#728db4';ctx.lineWidth=Math.max(2,width*.006);
 ctx.strokeRect(x,y,width,height);
 const pad=height*.15,brand=height*.72;
 ctx.drawImage(crest,x+pad,y+(height-brand)/2,brand,brand);
 ctx.drawImage(ecm,x+width-pad-brand,y+(height-brand)/2,brand,brand);
 ctx.textAlign='center';
 ctx.textBaseline='middle';
 ctx.fillStyle='#f6f8fd';
 ctx.font='900 '+Math.round(height*.32)+'px Arial, sans-serif';
 ctx.fillText('GREAT BRITAIN',cx,cy-height*.09,width-brand*2-pad*3);
 ctx.fillStyle='#c9d7e9';
 ctx.font='700 '+Math.round(height*.105)+'px Arial, sans-serif';
 ctx.fillText('LG3S  •  PUBLIC LOCKER ROOM',cx,cy+height*.24,width-brand*2-pad*3);
 ctx.restore();
}
async function composeScenes({scenes,players,jerseyPath,crestPath,ecmPath}){
 if(!Array.isArray(players)||players.length===0)throw Error('Cannot compose without a verified roster');
 if(!scenes?.entrance||!scenes?.centre)throw Error('Both GB camera viewpoints are required');
 const [jersey,crest,ecm]=await Promise.all([loadImage(jerseyPath),loadImage(crestPath),loadImage(ecmPath)]);
 const textures={};
 for(const name of ['entrance','centre']){
  const scene=scenes[name];
  if(scene.coords.length!==players.length)throw Error(name+' bay count does not match verified roster');
  const background=await loadImage(scene.image);
  // Downsample huge source textures if needed; maintain full 2:1 panorama.
  const scale=Math.min(1,4096/background.naturalWidth);
  const width=Math.round(background.naturalWidth*scale);
  const height=Math.round(background.naturalHeight*scale);
  if(!(width>1000&&height>500))throw Error('Invalid 360 room texture');
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('Canvas 2D rendering is unavailable');
  ctx.drawImage(background,0,0,width,height);
  for(let index=0;index<players.length;index++){
   drawMountedJersey(ctx,width,height,jersey,scene.coords[index],{goalie:players[index].position==='G'});
  }
  drawTeamSign(ctx,width,height,name,crest,ecm);
  textures[name]=canvas.toDataURL('image/jpeg',.90);
  // Drop references as each scene finishes. Data URLs remain local to this page.
  canvas.width=0;canvas.height=0;
 }
 return textures;
}
window.GBPanoramaTextures={composeScenes};
})();
