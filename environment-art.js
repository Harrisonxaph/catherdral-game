import * as THREE from './vendor/three.module.min.js';
import {material,envMaterial,shapes,mesh} from './art-materials.js';
const blockShape=new THREE.Shape();blockShape.moveTo(-.46,-.46);blockShape.lineTo(.46,-.46);blockShape.lineTo(.46,.46);blockShape.lineTo(-.46,.46);blockShape.closePath();
const bevel=new THREE.ExtrudeGeometry(blockShape,{depth:.88,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.035});bevel.translate(0,0,-.44);
const archShape=new THREE.Shape();archShape.moveTo(-1,0);archShape.lineTo(-1,1.15);archShape.quadraticCurveTo(-.75,2.1,0,2.55);archShape.quadraticCurveTo(.75,2.1,1,1.15);archShape.lineTo(1,0);archShape.lineTo(.77,0);archShape.lineTo(.77,1.13);archShape.quadraticCurveTo(.6,1.88,0,2.24);archShape.quadraticCurveTo(-.6,1.88,-.77,1.13);archShape.lineTo(-.77,0);archShape.closePath();
const archGeometry=new THREE.ExtrudeGeometry(archShape,{depth:.22,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:1,steps:1});
// Chamfered cornice: a flat-shaded square frustum (unit height) replacing the flat cap slab.
const cornice=(()=>{const g=new THREE.CylinderGeometry(.62,.7071,1,4,1).toNonIndexed();g.rotateY(Math.PI/4);g.computeVertexNormals();return g;})();
// Low-poly flush details: 30-triangle ash mound and 12-triangle puddle.
const flatRing=shapes.ring.clone().rotateX(-Math.PI/2),mound=new THREE.SphereGeometry(1,6,3,0,Math.PI*2,0,Math.PI/2),puddle=new THREE.CircleGeometry(1,12);
const clothShape=new THREE.Shape();clothShape.moveTo(-.4,.7);clothShape.lineTo(.4,.7);clothShape.lineTo(.36,-.54);clothShape.lineTo(.12,-.39);clothShape.lineTo(-.05,-.72);clothShape.lineTo(-.37,-.53);clothShape.closePath();const clothGeometry=new THREE.ShapeGeometry(clothShape);
// Shared additive light-pool decal under torches (64px radial gradient, generated in code).
const poolTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const p=c.getContext('2d'),g=p.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#ffffffb0');g.addColorStop(.45,'#ffffff40');g.addColorStop(1,'#ffffff00');p.fillStyle=g;p.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;})();
export const poolTexture=poolTex;
const poolMaterial=new THREE.MeshBasicMaterial({map:poolTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2});
// Torch halos face the fixed orthographic camera direction (pitch ~53.5 degrees), so no per-frame billboarding is needed.
const haloMaterial=new THREE.MeshBasicMaterial({map:poolTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),haloPitch=-Math.atan2(17,12.6);
const hash=(x,y,n=0)=>{const v=Math.sin(x*127.1+y*311.7+n*17.7)*43758.5453;return v-Math.floor(v)};
export function buildEnvironment(world,torches,stair,theme,preset){
 const G=window.VesperGraphics,n=world.config.number,tint=new THREE.Color(),lights=torches.slice();
 const chunkSize=preset.detail===0?20:preset.detail===1?12:10;const root=new THREE.Group(),batches=new Map(),chunks=new Map(),flames=[],shafts=[];
 // The texture doubles as roughness map: dark grout would read as polished and shine as bright lines, so the floor uses a uniform roughness close to the old map's average sheen.
 // Wall-capable materials use the cutaway shader; floors, puddles and ash never occlude, so they stay plain.
 const stone=envMaterial(theme.stone),floorMat=n===3?material(theme.floor,'marble'):material(theme.floor,'flagstone',{roughnessMap:null,roughness:.55,bumpScale:.02}),relief=envMaterial(theme.stone,'relief'),water=material('#1a2b20','stone',{roughness:.18,metalness:.25}),ash=material('#4f4b47'),trim=envMaterial(theme.trim),metal=envMaterial(theme.metal,'metal'),iron=envMaterial('#554a40','metal'),cloth=envMaterial(theme.cloth,'fabric',{side:THREE.DoubleSide}),black=envMaterial('#1b2025');
 const glow=envMaterial(theme.accent,'stone',{emissive:theme.accent,emissiveIntensity:.6}),fire=new THREE.MeshBasicMaterial({color:world.config.number===4?'#93d5ef':'#ffba65'});fire.userData.floorOwned=true;
 function add(g,mat,x,y,z,sx,sy,sz,rz=0,ry=0,wall=false,ao=1){const cx=Math.floor(x/chunkSize),cz=Math.floor(z/chunkSize),key=[cx,cz,g.id,mat.id,wall].join(':');if(!batches.has(key))batches.set(key,{g,mat,rows:[],cx,cz,wall});batches.get(key).rows.push([x,y,z,sx,sy,sz,rz,ry,ao]);}
 const block=preset.detail?bevel:shapes.box,walk=world.walk,rich=preset.detail>0,dense=preset.detail===2;
 // Worn walkways along each room's centre lines and through corridors (lighter instance colour only).
 const inRoom=new Set(),worn=new Set();for(const r of world.rooms)for(let yy=r.y;yy<r.y+r.h;yy++)for(let xx=r.x;xx<r.x+r.w;xx++){inRoom.add(xx+','+yy);if(Math.abs(xx-r.cx)<=0||Math.abs(yy-r.cy)<=0)worn.add(xx+','+yy);}
 for(let y=1;y<world.H-1;y++)for(let x=1;x<world.W-1;x++){
  const h=hash(x,y);
  if(walk(x,y)){
   const k=x+','+y,ao=G.occlusion(walk,x,y)*(worn.has(k)?1.12:inRoom.has(k)?1:1.06),base=-.1-h*.018,p=hash(x,y,3);
   const wallX=!walk(x-1,y)||!walk(x+1,y),wallY=!walk(x,y-1)||!walk(x,y+1);
   // Slab layout varies by cell; every piece is the shared floor batch, flush and non-colliding.
   // Quarter/half/cracked splits are High-only to keep Medium triangle headroom for later increments (owner decision, 2026-10-28).
   if(hash(x,y,5)>.975)add(block,floorMat,x+.5,base-.05,y+.5,.94,.15,.94,0,0,false,ao*.55);
   else if(wallX!==wallY)for(const s of [-.25,.25])add(block,floorMat,x+.5+(wallX?s:0),base-(s>0?.004:0),y+.5+(wallX?0:s),wallX?.475:.985,.15,wallX?.985:.475,0,0,false,ao*(s<0?1:.93));
   else if(dense&&p<.1)for(const [dx,dz]of [[-.25,-.25],[.25,-.25],[-.25,.25],[.25,.25]])add(block,floorMat,x+.5+dx,base-hash(x+dx,y+dz)*.012,y+.5+dz,.475,.15,.475,0,0,false,ao*(.9+hash(x+dx,y+dz,2)*.18));
   else if(dense&&p<.22){const along=p<.16;for(const s of [-.25,.25])add(block,floorMat,x+.5+(along?s:0),base,y+.5+(along?0:s),along?.475:.985,.15,along?.985:.475,0,0,false,ao*(s<0?1:.94));}
   else if(dense&&hash(x,y,4)>.93){add(block,floorMat,x+.3,base-.006,y+.5,.58,.15,.985,0,.03,false,ao*.95);add(block,floorMat,x+.8,base-.016,y+.5,.385,.15,.985,0,-.04,false,ao*.86);}
   else add(block,floorMat,x+.5,base,y+.5,.985,.15,.985,0,(Math.floor(h*4))*Math.PI/2,false,ao);
   // Floor identity details, all flush (under 0.06 high).
   if(n===2&&hash(x,y,7)>.93&&!wallX&&!wallY)add(puddle,water,x+.5,.004,y+.5,.22+hash(x,y,8)*.24,.16+hash(x,y,9)*.2,1);
   if(n===5&&(wallX||wallY)&&hash(x,y,7)>(rich?.45:.78))add(mound,ash,x+.5+(hash(x,y,8)-.5)*.5,0,y+.5+(hash(x,y,9)-.5)*.5,.24,.035,.18,0,h*6,false,.8);
   // Dirt, chips and flush inlays stay below ankle height and never change collision.
   if(preset.detail&&h>.86){add(shapes.sphere,world.config.number===2?glow:black,x+.25,.005,y+.35,.16,.012,.09);add(shapes.box,stone,x+.72,.012,y+.66,.12,.035,.08,0,h*6);}
   if(preset.detail&&world.config.number===1&&h>.94){add(shapes.cylinder,trim,x+.5,.035,y+.5,.025,.35,.025,Math.PI/2);add(shapes.cylinder,trim,x+.48,.04,y+.54,.025,.28,.025,1.15);add(shapes.sphere,trim,x+.68,.07,y+.5,.08,.075,.065);}
   if(world.config.number===5&&h>.6)add(shapes.plane,trim,x+.5,.001,y+.5,.12,.12,1,-Math.PI/2);
  }else if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>world.walk(x+dx,y+dy))){
   const broken=h>.92,face=walk(x,y+1),top=broken?.65:1.02;
   for(let row=0;row<(broken?2:3);row++)for(let col=0;col<2;col++)add(block,stone,x+.25+col*.5+(row%2?.06:0),.16+row*.31,y+.5,.46,.29,.95,0,0,true,G.lighting.wallRows[row]);
   add(cornice,trim,x+.5,top,y+.5,1.04,.14,1.04,0,0,true,.42);
   if(h>.7&&preset.detail)add(shapes.sphere,black,x+.5,.4,y+.5,.48,.3,.48,0,0,true);
   // Rubble and fallen drums stay inside the broken (blocked) wall cell.
   if(broken&&rich){for(let i=0;i<4;i++)add(block,stone,x+.2+hash(x,y,20+i)*.6,top+.1+i*.035,y+.2+hash(x,y,30+i)*.6,.14+hash(x,y,40+i)*.14,.1+hash(x,y,50+i)*.08,.14+hash(x,y,60+i)*.12,hash(x,y,70+i)*.6,hash(x,y,80+i)*3,true,.8);
    if(h>.965)add(shapes.cylinder,stone,x+.5,.88,y+.5,.2,.7,.2,Math.PI/2,h*9,true,.85);}
   if(face&&rich){const v=hash(x,y,11),z=y+.97;
    // Back-wall faces seen by the camera: reliefs, then one signature feature per floor.
    if(v>.5&&v<.6)add(shapes.box,relief,x+.5,.5,y+.985,.82,.5,.02,0,0,true);
    else if(v>.6&&v<.74){
     if(n===1){add(shapes.box,black,x+.5,.56,y+.99,.36,.3,.03,0,0,true);add(shapes.sphere,trim,x+.5,.56,y+.95,.1,.11,.06,0,0,true);for(const e of [-1,1])add(shapes.sphere,black,x+.5+e*.035,.58,y+.995,.022,.022,.01,0,0,true);}
     else if(n===2){for(let c=0;c<3;c++)add(shapes.ring,iron,x+.5,1.72-c*.13,y+.9,.05,.07,1,0,c%2*Math.PI/2,true);add(shapes.cone,metal,x+.5,1.32,y+.9,.12,.18,.12,Math.PI,0,true);}
     else if(n===3){add(shapes.box,cloth,x+.5,.5,y+.985,.56,.62,.02,0,0,true);if(!broken){add(shapes.cylinder,metal,x+.5,top+.2,y+.5,.03,.32,.03,0,0,true);add(shapes.box,metal,x+.5,top+.36,y+.5,.42,.025,.025,0,0,true);for(const e of [-1,0,1])add(shapes.sphere,fire,x+.5+e*.2,top+.42,y+.5,.025,.045,.025,0,0,true);}}
     else if(n===4)for(let i=0;i<3;i++)add(block,stone,x+.3+i*.2,1.55+i*.38+hash(x,y,90+i)*.2,y+.5,.22,.16,.2,hash(x,y,95+i)*.8,hash(x,y,99+i)*3,true,.8);
     else if(!broken){add(shapes.cone,metal,x+.5,top+.16,y+.5,.2,.18,.2,Math.PI,0,true);add(shapes.sphere,fire,x+.5,top+.27,y+.5,.12,.07,.12,0,0,true);lights.push({x:x+.5,y:y+.5});}
    }
    else if(v>.74&&v<.82&&n===1)for(let r=0;r<3;r++)for(let c=0;c<3;c++)add(shapes.cylinder,trim,x+.25+c*.25,.3+r*.14,z,.025,.2,.025,Math.PI/2,0,true,.9);
    else if(v>.82&&v<.88&&!broken)for(let c=0;c<3;c++){const cx=x+.3+c*.2,ch=.08+hash(x,y,100+c)*.1;add(shapes.cylinder,trim,cx,top+.07+ch/2,y+.55,.025,ch,.025,0,0,true,1.1);add(shapes.sphere,fire,cx,top+.1+ch,y+.55,.02,.035,.02,0,0,true);}
    if(n===2&&h>.3&&h<.45)for(let i=0;i<3;i++)add(shapes.cone,glow,x+.3+i*.2,.08,y+.985,.035,.16,.035,0,0,true);
   }
  }
 }
 for(const r of world.rooms){
  const back=r.y-.5;
  if(n===3)for(let yy=r.y+1;yy<r.y+r.h-1;yy++){add(shapes.box,cloth,r.cx+.5,.004,yy+.5,.7,.006,1,0,0,false,.9);}
  if(n===4){add(flatRing,metal,r.cx+.5,.006,r.cy+.5,1.7,1,1.7,0,0,false,.5);add(flatRing,metal,r.cx+.5,.007,r.cy+.5,1.05,1,1.05,0,0,false,.5);}
  for(const side of [-1,1]){const x=side<0?r.x-.5:r.x+r.w+.5;if(world.walk(Math.floor(x),Math.floor(back)))continue;
   for(const [y,s,dy]of [[.14,.68,.28],[.4,.54,.2],[1.45,.36,1.9],[2.44,.5,.16],[2.6,.65,.22]])add(shapes.cylinder,y===1.45?stone:trim,x,y,back,s,dy,s,0,0,true);
   if(preset.detail)for(let n=0;n<6;n++){const a=n*Math.PI/3;add(shapes.cylinder,trim,x+Math.cos(a)*.29,1.45,back+Math.sin(a)*.29,.055,1.8,.055,0,0,true);}
  }
  const x=[r.cx+.5,r.x+2.3,r.x+r.w-2.3].find(x=>[-1,0,1].every(dx=>!world.walk(Math.floor(x+dx),Math.floor(back))))??r.cx+.5;if(!world.walk(Math.floor(x),Math.floor(back))){
   add(archGeometry,trim,x,1.05,back+.3,1,1,1,0,0,true);
   // Recessed lancet, metal tracery and stained glass on the non-walkable back wall.
   add(shapes.box,black,x,1.95,back+.4,1.4,2,.08,0,0,true);
   for(const side of [-1,0,1]){add(shapes.box,world.config.number===3?glow:cloth,x+side*.32,1.95,back+.46,.25,1.5,.035,0,0,true);add(shapes.cylinder,metal,x+side*.32,1.95,back+.49,.025,1.6,.025,0,0,true);}
   add(shapes.box,metal,x,2,back+.46,1.2,.045,.04,0,0,true);
   const solid=cx=>[-1,0,1].every(d=>!walk(Math.floor(cx+d*.5),Math.floor(back)));
   if(preset.detail&&solid(x+2)){add(clothGeometry,cloth,x+2,1.9,back+.46,1,1.1,1,0,0,true);add(shapes.box,metal,x+2,2.75,back+.46,1,.045,.06,0,0,true);}
   // High-quality broken vault ribs only on the far wall; never roof over the player.
   if(preset.detail===2)for(const side of [-1,1])if(solid(x+side*2.2))add(archGeometry,stone,x+side*2.2,2.1,back-.2,.9,.6,1,side*.35,0,true);
  }
  // Tomb niches/statues project into blocked wall cells, not the playable chamber.
  for(const side of [-1,1]){const z=r.y+2.5,xx=side<0?r.x-.42:r.x+r.w+.42;if(world.walk(Math.floor(xx),Math.floor(z)))continue;
   if(world.config.number<=2){add(block,stone,xx,.63,z,.78,1.25,1.65,0,0,true);add(cornice,trim,xx,1.34,z,.9,.15,1.8,0,0,true);add(shapes.sphere,trim,xx,1.46,z,.18,.08,.45,0,0,true);
    if(world.config.number===2)for(let n=0;n<3;n++)add(shapes.cone,glow,xx,1.2+n*.05,z+n*.27,.09,.4,.09,side*.4,0,true);
   }else{add(cornice,trim,xx,.25,z,.8,.5,.8,0,0,true);add(shapes.cone,stone,xx,.9,z,.28,1,.25,0,0,true);add(shapes.sphere,stone,xx,1.55,z,.17,.22,.17,0,0,true);for(const arm of [-1,1])add(shapes.cylinder,stone,xx+arm*.2,1.12,z,.08,.6,.08,arm*.5,0,true);}
  }
  if(preset.detail){
   // Wall-hung iron chains and cobweb fans, built as thin shared primitives.
   for(let n=0;n<4;n++)add(shapes.ring,iron,r.x+.35,1.4+n*.18,back+.46,.085,.11,1,0,n%2*Math.PI/2,true);
   for(let n=0;n<4;n++)add(shapes.cylinder,trim,r.x+.3+n*.16,.7+n*.16,back+.45,.005,.9,.005,-.7,0,true);
  }
 }
 // Final room gets monumental open doorposts, a staircase and a throne-shaped recess.
 const r=world.exit;for(const side of [-1,1]){const x=r.cx+.5+side*1.5,z=r.y-.48;if(!world.walk(Math.floor(x),Math.floor(z))){add(block,metal,x,1.2,z,.3,2.4,.35,0,0,true);for(let n=0;n<4;n++)add(shapes.cone,metal,x,2.5,z+n*.08,.15,.35,.15,0,0,true);}}
 if(world.config.number===5){const x=r.cx+.5,z=r.y-.48;add(block,metal,x,1.45,z,1.4,2.8,.4,0,0,true);add(shapes.cone,metal,x,3,z,.5,.8,.3,0,0,true);}
 // Floor-five corner ritual markers are ornamental only, with no King/candle gameplay.
 if(world.config.number===5)for(const [x,z]of [[r.x+1.3,r.y+1.3],[r.x+r.w-1.3,r.y+1.3],[r.x+1.3,r.y+r.h-1.3],[r.x+r.w-1.3,r.y+r.h-1.3]])add(shapes.disk,metal,x,.003,z,.4,.4,1,-Math.PI/2);
 const portal=new THREE.Group();root.add(portal);portal.position.set(stair.x,.02,stair.y);for(let i=0;i<5;i++)mesh(portal,shapes.box,trim,0,i*.04,.42-i*.21,1,.08,.2);const portalRing=mesh(portal,shapes.ring,glow,0,.05,0,.75,.75,1);portalRing.rotation.x=-Math.PI/2;
 // Torch stands sit on floor cells and never hide anything, so they use plain (uncut) materials.
 const torchIron=material('#554a40','metal'),torchMetal=material(theme.metal,'metal');
 for(const t of torches){const tgroup=new THREE.Group();tgroup.position.set(t.x,0,t.y);root.add(tgroup);mesh(tgroup,shapes.cylinder,torchIron,0,.43,0,.07,.85,.07);mesh(tgroup,shapes.cone,torchMetal,0,.83,0,.18,.17,.18);const flame=mesh(tgroup,shapes.sphere,fire,0,1,0,.105,.26,.105);flames.push({mesh:flame,phase:t.phase,root:tgroup});}
 const light=G.lightField(lights,theme.torch,theme.lightBase),dummy=new THREE.Object3D();for(const {g,mat,rows,cx,cz,wall}of batches.values()){const key=cx+':'+cz;if(!chunks.has(key)){const group=new THREE.Group();group.userData.center={x:cx*chunkSize+chunkSize/2,y:cz*chunkSize+chunkSize/2};root.add(group);chunks.set(key,group);}const m=new THREE.InstancedMesh(g,mat,rows.length);for(let i=0;i<rows.length;i++){const [x,y,z,sx,sy,sz,rz,ry]=rows[i];dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);const flat=g===shapes.plane||g===shapes.disk||g===puddle;dummy.rotation.set(flat?-Math.PI/2:0,ry,flat?0:rz);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);const shade=(mat===stone||mat===floorMat?.85+hash(x,z)*.3:1)*rows[i][8],[lr,lg,lb]=light(x,y,z);m.setColorAt(i,tint.setRGB(lr*shade,lg*shade,lb*shade));}m.computeBoundingSphere();m.userData.wall=wall;chunks.get(key).add(m);}
 root.updateMatrixWorld(true);for(const group of chunks.values())group.userData.box=new THREE.Box3().setFromObject(group).expandByScalar(.5);
 // One extra instance is the hero's lantern pool, so every preset keeps light around the player.
 const pools=new THREE.InstancedMesh(shapes.plane,poolMaterial,torches.length+1);pools.count=torches.length+1;pools.frustumCulled=false;pools.renderOrder=1;pools.userData.color=new THREE.Color(theme.torch);for(let i=0;i<torches.length;i++){dummy.position.set(torches[i].x,.015,torches[i].y);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(4.2,4.2,1);dummy.updateMatrix();pools.setMatrixAt(i,dummy.matrix);pools.setColorAt(i,pools.userData.color);}pools.setColorAt(torches.length,pools.userData.color);root.add(pools);
 const halos=new THREE.InstancedMesh(shapes.plane,haloMaterial,Math.max(1,torches.length));halos.count=torches.length;halos.visible=torches.length>0;halos.frustumCulled=false;halos.renderOrder=2;for(let i=0;i<torches.length;i++){dummy.position.set(torches[i].x,1,torches[i].y);dummy.rotation.set(haloPitch,0,0);dummy.scale.set(.95,1.2,1);dummy.updateMatrix();halos.setMatrixAt(i,dummy.matrix);halos.setColorAt(i,pools.userData.color);}root.add(halos);
 if(preset.detail===2){for(const r of world.rooms){const mat=new THREE.MeshBasicMaterial({color:theme.accent,transparent:true,opacity:.035,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});mat.userData.floorOwned=true;const shaft=mesh(root,shapes.cone,mat,r.cx+.5,1.9,r.y+1.5,1.2,3.5,1.2);shaft.rotation.z=.35;shafts.push(shaft);}}
 return {root,chunks,flames,shafts,portalRing,theme,pools,halos,torches,tint:new THREE.Color(),dummy:new THREE.Object3D(),lantern:window.VesperGraphics.lighting.lantern};
}
const frustum=new THREE.Frustum(),frustumMatrix=new THREE.Matrix4();
export function updateEnvironment(env,player,time,camera=null){
 // Pools flicker with the same phase as their flame and switch off beyond the flame culling range.
 const p=env.pools,c=p.userData.color;for(let i=0;i<env.torches.length;i++){const t=env.torches[i],near=Math.hypot(t.x-player.x,t.y-player.y)<16,k=near?.55+Math.sin(time*13+t.phase)*.08:0;p.setColorAt(i,env.tint.setRGB(c.r*k,c.g*k,c.b*k));if(env.halos.count)env.halos.setColorAt(i,env.tint.setRGB(c.r*k*.9,c.g*k*.9,c.b*k*.9));}if(env.halos.instanceColor)env.halos.instanceColor.needsUpdate=true;const lantern=env.torches.length,dummy=env.dummy,k=env.lantern;dummy.position.set(player.x,.014,player.y);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(6,6,1);dummy.updateMatrix();p.setMatrixAt(lantern,dummy.matrix);p.setColorAt(lantern,env.tint.setRGB(c.r*k,c.g*k,c.b*k));p.instanceMatrix.needsUpdate=true;p.instanceColor.needsUpdate=true;// Chunks are culled against the real camera frustum (falls back to the old box when no camera is given).
 if(camera){camera.updateMatrixWorld();frustumMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(frustumMatrix);}
 for(const group of env.chunks.values()){const c=group.userData.center;group.visible=camera?frustum.intersectsBox(group.userData.box):Math.abs(c.x-player.x)<22&&Math.abs(c.y-player.y)<26;}
 for(const f of env.flames){f.root.visible=Math.hypot(f.root.position.x-player.x,f.root.position.z-player.y)<16;f.mesh.scale.y=.26*(1+Math.sin(time*13+f.phase)*.16);}
 for(const s of env.shafts)s.visible=Math.hypot(s.position.x-player.x,s.position.z-player.y)<18;
}
export function disposeEnvironment(env){if(!env)return;env.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.material?.userData.floorOwned)o.material.dispose();});env.root.removeFromParent();}
