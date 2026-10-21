import * as THREE from './vendor/three.module.min.js';
import {material,shapes,mesh} from './art-materials.js';
const blockShape=new THREE.Shape();blockShape.moveTo(-.46,-.46);blockShape.lineTo(.46,-.46);blockShape.lineTo(.46,.46);blockShape.lineTo(-.46,.46);blockShape.closePath();
const bevel=new THREE.ExtrudeGeometry(blockShape,{depth:.88,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.035});bevel.translate(0,0,-.44);
const archShape=new THREE.Shape();archShape.moveTo(-1,0);archShape.lineTo(-1,1.15);archShape.quadraticCurveTo(-.75,2.1,0,2.55);archShape.quadraticCurveTo(.75,2.1,1,1.15);archShape.lineTo(1,0);archShape.lineTo(.77,0);archShape.lineTo(.77,1.13);archShape.quadraticCurveTo(.6,1.88,0,2.24);archShape.quadraticCurveTo(-.6,1.88,-.77,1.13);archShape.lineTo(-.77,0);archShape.closePath();
const archGeometry=new THREE.ExtrudeGeometry(archShape,{depth:.22,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:1,steps:1});
const clothShape=new THREE.Shape();clothShape.moveTo(-.4,.7);clothShape.lineTo(.4,.7);clothShape.lineTo(.36,-.54);clothShape.lineTo(.12,-.39);clothShape.lineTo(-.05,-.72);clothShape.lineTo(-.37,-.53);clothShape.closePath();const clothGeometry=new THREE.ShapeGeometry(clothShape);
const hash=(x,y,n=0)=>{const v=Math.sin(x*127.1+y*311.7+n*17.7)*43758.5453;return v-Math.floor(v)};
export function buildEnvironment(world,torches,stair,theme,preset){
 const chunkSize=preset.detail===0?20:preset.detail===1?12:10;const root=new THREE.Group(),batches=new Map(),chunks=new Map(),flames=[],shafts=[];
 const stone=material(theme.stone),floorMat=material(theme.floor,world.config.number===3?'marble':'stone'),trim=material(theme.trim),metal=material(theme.metal,'metal'),iron=material('#554a40','metal'),cloth=material(theme.cloth,'fabric',{side:THREE.DoubleSide}),black=material('#1b2025');
 const glow=material(theme.accent,'stone',{emissive:theme.accent,emissiveIntensity:.6}),fire=new THREE.MeshBasicMaterial({color:world.config.number===4?'#93d5ef':'#ffba65'});fire.userData.floorOwned=true;
 function add(g,mat,x,y,z,sx,sy,sz,rz=0,ry=0,wall=false){const cx=Math.floor(x/chunkSize),cz=Math.floor(z/chunkSize),key=[cx,cz,g.id,mat.id,wall].join(':');if(!batches.has(key))batches.set(key,{g,mat,rows:[],cx,cz,wall});batches.get(key).rows.push([x,y,z,sx,sy,sz,rz,ry]);}
 const block=preset.detail?bevel:shapes.box;
 for(let y=1;y<world.H-1;y++)for(let x=1;x<world.W-1;x++){
  const h=hash(x,y);
  if(world.walk(x,y)){
   add(block,floorMat,x+.5,-.1-h*.018,y+.5,.985,.15,.985,0,(Math.floor(h*4))*Math.PI/2);
   // Dirt, chips and flush inlays stay below ankle height and never change collision.
   if(preset.detail&&h>.86){add(shapes.sphere,world.config.number===2?glow:black,x+.25,.005,y+.35,.16,.012,.09);add(shapes.box,stone,x+.72,.012,y+.66,.12,.035,.08,0,h*6);}
   if(preset.detail&&world.config.number===1&&h>.94){add(shapes.cylinder,trim,x+.5,.035,y+.5,.025,.35,.025,Math.PI/2);add(shapes.cylinder,trim,x+.48,.04,y+.54,.025,.28,.025,1.15);add(shapes.sphere,trim,x+.68,.07,y+.5,.08,.075,.065);}
   if(world.config.number===5&&h>.6)add(shapes.plane,trim,x+.5,.001,y+.5,.12,.12,1,-Math.PI/2);
  }else if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>world.walk(x+dx,y+dy))){
   const broken=h>.92;
   for(let row=0;row<(broken?2:3);row++)for(let col=0;col<2;col++)add(block,stone,x+.25+col*.5+(row%2?.06:0),.16+row*.31,y+.5,.46,.29,.95,0,0,true);
   add(block,trim,x+.5,broken?.65:1.02,y+.5,1.04,.12,1.04,0,0,true);
   if(h>.7&&preset.detail)add(shapes.sphere,black,x+.5,.4,y+.5,.48,.3,.48,0,0,true);
  }
 }
 for(const r of world.rooms){
  const back=r.y-.5;
  for(const side of [-1,1]){const x=side<0?r.x-.5:r.x+r.w+.5;if(world.walk(Math.floor(x),Math.floor(back)))continue;
   for(const [y,s,dy]of [[.14,.68,.28],[.4,.54,.2],[1.45,.36,1.9],[2.44,.5,.16],[2.6,.65,.22]])add(shapes.cylinder,y===1.45?stone:trim,x,y,back,s,dy,s,0,0,true);
   if(preset.detail)for(let n=0;n<6;n++){const a=n*Math.PI/3;add(shapes.cylinder,trim,x+Math.cos(a)*.29,1.45,back+Math.sin(a)*.29,.055,1.8,.055,0,0,true);}
  }
  const x=[r.cx+.5,r.x+2.3,r.x+r.w-2.3].find(x=>[-1,0,1].every(dx=>!world.walk(Math.floor(x+dx),Math.floor(back))))??r.cx+.5;if(!world.walk(Math.floor(x),Math.floor(back))){
   add(archGeometry,trim,x,1.05,back+.3,1,1,1,0,0,true);
   // Recessed lancet, metal tracery and stained glass on the non-walkable back wall.
   add(shapes.box,black,x,1.95,back+.4,1.4,2,.08,0,0,true);
   for(const side of [-1,0,1]){add(shapes.box,world.config.number===3?glow:cloth,x+side*.32,1.95,back+.46,.25,1.5,.035,0,0,true);add(shapes.cylinder,metal,x+side*.32,1.95,back+.49,.025,1.6,.025,0,0,true);}
   add(shapes.box,metal,x,2,back+.5,1.2,.045,.04,0,0,true);
   if(preset.detail){const banner=add(clothGeometry,cloth,x+2,1.9,back+.46,1,1.1,1,0,0,true);add(shapes.box,metal,x+2,2.75,back+.46,1,.045,.06,0,0,true);}
   // High-quality broken vault ribs only on the far wall; never roof over the player.
   if(preset.detail===2)for(const side of [-1,1])add(archGeometry,stone,x+side*2.2,2.1,back-.2,.9,.6,1,side*.35,0,true);
  }
  // Tomb niches/statues project into blocked wall cells, not the playable chamber.
  for(const side of [-1,1]){const z=r.y+2.5,xx=side<0?r.x-.42:r.x+r.w+.42;if(world.walk(Math.floor(xx),Math.floor(z)))continue;
   if(world.config.number<=2){add(block,stone,xx,.63,z,.78,1.25,1.65,0,0,true);add(block,trim,xx,1.34,z,.9,.15,1.8,0,0,true);add(shapes.sphere,trim,xx,1.46,z,.18,.08,.45,0,0,true);
    if(world.config.number===2)for(let n=0;n<3;n++)add(shapes.cone,glow,xx,1.2+n*.05,z+n*.27,.09,.4,.09,side*.4,0,true);
   }else{add(block,trim,xx,.25,z,.8,.5,.8,0,0,true);add(shapes.cone,stone,xx,.9,z,.28,1,.25,0,0,true);add(shapes.sphere,stone,xx,1.55,z,.17,.22,.17,0,0,true);for(const arm of [-1,1])add(shapes.cylinder,stone,xx+arm*.2,1.12,z,.08,.6,.08,arm*.5,0,true);}
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
 for(const t of torches){const tgroup=new THREE.Group();tgroup.position.set(t.x,0,t.y);root.add(tgroup);mesh(tgroup,shapes.cylinder,iron,0,.43,0,.07,.85,.07);mesh(tgroup,shapes.cone,metal,0,.83,0,.18,.17,.18);const flame=mesh(tgroup,shapes.sphere,fire,0,1,0,.105,.26,.105);flames.push({mesh:flame,phase:t.phase,root:tgroup});}
 const dummy=new THREE.Object3D();for(const {g,mat,rows,cx,cz,wall}of batches.values()){const key=cx+':'+cz;if(!chunks.has(key)){const group=new THREE.Group();group.userData.center={x:cx*chunkSize+chunkSize/2,y:cz*chunkSize+chunkSize/2};root.add(group);chunks.set(key,group);}const m=new THREE.InstancedMesh(g,mat,rows.length);for(let i=0;i<rows.length;i++){const [x,y,z,sx,sy,sz,rz,ry]=rows[i];dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(g===shapes.plane||g===shapes.disk?-Math.PI/2:0,ry,g===shapes.plane||g===shapes.disk?0:rz);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);if(mat===stone||mat===floorMat){const shade=.85+hash(x,z)*.3;m.setColorAt(i,new THREE.Color(shade,shade,shade));}}m.computeBoundingSphere();m.userData.wall=wall;chunks.get(key).add(m);}
 if(preset.detail===2){for(const r of world.rooms){const mat=new THREE.MeshBasicMaterial({color:theme.accent,transparent:true,opacity:.035,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});mat.userData.floorOwned=true;const shaft=mesh(root,shapes.cone,mat,r.cx+.5,1.9,r.y+1.5,1.2,3.5,1.2);shaft.rotation.z=.35;shafts.push(shaft);}}
 return {root,chunks,flames,shafts,portalRing,theme};
}
export function updateEnvironment(env,player,time){for(const group of env.chunks.values()){const c=group.userData.center;group.visible=Math.abs(c.x-player.x)<22&&Math.abs(c.y-player.y)<26;}
 for(const f of env.flames){f.root.visible=Math.hypot(f.root.position.x-player.x,f.root.position.z-player.y)<16;f.mesh.scale.y=.26*(1+Math.sin(time*13+f.phase)*.16);}
 for(const s of env.shafts)s.visible=Math.hypot(s.position.x-player.x,s.position.z-player.y)<18;
}
export function disposeEnvironment(env){if(!env)return;env.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.material?.userData.floorOwned)o.material.dispose();});env.root.removeFromParent();}
