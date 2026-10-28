import * as THREE from './vendor/three.module.min.js';
// Original deterministic 128px surfaces: no downloads, external licences or texture fetches.
const textures=new Map(),materials=new Map();
function surface(kind){if(textures.has(kind))return textures.get(kind);const c=document.createElement('canvas');c.width=c.height=128;const p=c.getContext('2d');let seed=kind.length*739;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 p.fillStyle=kind==='fabric'?'#a7a7a7':'#a0a0a0';p.fillRect(0,0,128,128);
 for(let i=0;i<1500;i++){const v=Math.round(80+rnd()*115);p.fillStyle=`rgba(${v},${v},${v},${.1+rnd()*.4})`;p.fillRect(rnd()*128,rnd()*128,1+rnd()*3,1+rnd()*2);}
 if(kind==='fabric'){p.strokeStyle='#44444428';p.lineWidth=.6;for(let x=0;x<128;x+=3){p.beginPath();p.moveTo(x,0);p.lineTo(x,128);p.stroke();}}
 else if(kind==='flagstone'){
  // Irregular slab joints (dark grout with a lit upper lip) and a few hairline cracks, so one cell never reads as one flat tile.
  const joint=(x1,y1,x2,y2)=>{p.strokeStyle='#2a2a2acc';p.lineWidth=2.2;p.beginPath();p.moveTo(x1,y1);p.lineTo(x2,y2);p.stroke();p.strokeStyle='#d8d8d81f';p.lineWidth=.6;p.beginPath();p.moveTo(x1+1,y1+1.5);p.lineTo(x2+1,y2+1.5);p.stroke();};
  const split=40+rnd()*48;joint(0,split,128,split+(rnd()-.5)*6);const a=30+rnd()*68,b=30+rnd()*68;joint(a,0,a+(rnd()-.5)*5,split);joint(b,split,b+(rnd()-.5)*5,128);
  p.strokeStyle='#1e1e1e66';p.lineWidth=.6;for(let n=0;n<2;n++){let x=rnd()*128,y=rnd()*128;p.beginPath();p.moveTo(x,y);for(let j=0;j<4;j++){x+=(rnd()-.5)*22;y+=(rnd()-.5)*22;p.lineTo(x,y);}p.stroke();}
 }
 else if(kind==='relief'){
  // Carved panel: pointed lancet, rosette and moulding, lit from the top left (light edge) with a dark lower-right edge.
  const carve=draw=>{p.save();p.translate(-1.5,-1.5);p.strokeStyle='#e8e8e8aa';p.lineWidth=2.5;draw();p.restore();p.save();p.translate(1.5,1.5);p.strokeStyle='#1a1a1acc';p.lineWidth=2.5;draw();p.restore();};
  carve(()=>{p.strokeRect(8,8,112,112);});
  carve(()=>{p.beginPath();p.moveTo(34,112);p.lineTo(34,58);p.quadraticCurveTo(36,30,64,18);p.quadraticCurveTo(92,30,94,58);p.lineTo(94,112);p.stroke();});
  carve(()=>{p.beginPath();p.arc(64,62,17,0,Math.PI*2);p.stroke();for(let n=0;n<6;n++){const a=n*Math.PI/3;p.beginPath();p.moveTo(64,62);p.lineTo(64+Math.cos(a)*17,62+Math.sin(a)*17);p.stroke();}});
  carve(()=>{p.beginPath();p.moveTo(64,84);p.lineTo(64,112);p.stroke();});
 }
 else{p.strokeStyle=kind==='marble'?'#e3e3e355':'#30303099';p.lineWidth=kind==='metal'?.4:1.1;for(let n=0;n<(kind==='metal'?20:5);n++){let x=rnd()*128,y=rnd()*128;p.beginPath();p.moveTo(x,y);for(let j=0;j<5;j++){x+=(rnd()-.5)*28;y+=rnd()*17;p.lineTo(x,y);}p.stroke();}}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=2;textures.set(kind,t);return t;
}
export function material(color,kind='stone',extra={}){const key=color+kind+JSON.stringify(extra);if(!materials.has(key)){const map=surface(kind),m=new THREE.MeshStandardMaterial({color,map,roughnessMap:map,roughness:kind==='metal'?.88:.94,metalness:kind==='metal'?.3:0,bumpMap:map,bumpScale:kind==='metal'?.012:.035,...extra});materials.set(key,m);}return materials.get(key);}
export const shapes={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,10,7),bone:new THREE.CapsuleGeometry(.07,.28,2,6),cylinder:new THREE.CylinderGeometry(1,1,1,10),cone:new THREE.ConeGeometry(1,1,8),plane:new THREE.PlaneGeometry(1,1),ring:new THREE.RingGeometry(.93,1,32),disk:new THREE.CircleGeometry(1,32)};
export function mesh(group,geometry,mat,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);group.add(m);return m;}
export function settingsMaterials(bump){for(const m of materials.values()){if(!!m.bumpMap!==bump){m.bumpMap=bump?m.map:null;m.needsUpdate=true;}}}
export function mergeStatic(group){
 // Merge rigid pieces sharing a material inside one bone; preserve articulated children.
 const groups=new Map();group.updateMatrixWorld(true);for(const child of [...group.children]){if(!child.isMesh||child.userData.keep||!child.visible)continue;child.updateMatrix();const key=child.material;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(child);}
 for(const [mat,list]of groups){if(list.length<2)continue;const positions=[],normals=[],uvs=[];for(const m of list){const g=(m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone());g.applyMatrix4(m.matrix);positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);uvs.push(...g.attributes.uv.array);g.dispose();group.remove(m);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));const m=new THREE.Mesh(geometry,mat);m.userData.ownedGeometry=true;group.add(m);}
}
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=32;const sp=shadowCanvas.getContext('2d'),gradient=sp.createRadialGradient(16,16,1,16,16,16);gradient.addColorStop(0,'#000a');gradient.addColorStop(1,'#0000');sp.fillStyle=gradient;sp.fillRect(0,0,32,32);
export const contactMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
export function resourceInfo(){return {surfaceTextures:textures.size,sharedMaterials:materials.size};}
