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
// Actor rim light (graphics v2, W3): a fresnel edge added to emissive light, so silhouettes separate from the floor on
// every preset without extra lights or draw calls. One shared uniform set lets the renderer tint it per floor.
export const rimUniforms={rimColor:{value:new THREE.Color('#9fc0dc')},rimStrength:{value:.42}};
export function actorMaterial(color,kind='stone',extra={}){
 const m=material(color,kind,{...extra,userData:{rim:true}});
 if(!m.userData.rimReady){m.userData.rimReady=true;m.customProgramCacheKey=()=>'vesper-rim';m.onBeforeCompile=shader=>{
  shader.uniforms.rimColor=rimUniforms.rimColor;shader.uniforms.rimStrength=rimUniforms.rimStrength;
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n{vec3 rimView=isOrthographic?vec3(0.,0.,1.):normalize(vViewPosition);float rimF=pow(1.-saturate(dot(normalize(normal),rimView)),2.5);totalEmissiveRadiance+=rimColor*rimF*rimStrength;}');
 };}
 return m;
}
// Wall cutaway (graphics v2, W6): wall fragments above ankle height that are nearer the camera than a tracked actor,
// within cutRadius of it on screen, are discarded with an ordered dither. Walls stay opaque and keep a faint outline.
// cutFront keeps main's behaviour of ghosting walls in front of the view (x: camera x, y: start z, z: half width, w: strength).
export const cutUniforms={cutCentres:{value:Array.from({length:4},()=>new THREE.Vector4(0,0,0,0))},cutRadius:{value:1.7},cutFront:{value:new THREE.Vector4(0,1e9,9,0)}};
export function envMaterial(color,kind='stone',extra={}){
 const m=material(color,kind,{...extra,userData:{cut:true}});
 if(!m.userData.cutReady){m.userData.cutReady=true;m.customProgramCacheKey=()=>'vesper-cut';m.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,cutUniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCutWorld;').replace('#include <project_vertex>','#include <project_vertex>\n{vec4 cutP=vec4(transformed,1.);\n#ifdef USE_INSTANCING\ncutP=instanceMatrix*cutP;\n#endif\nvCutWorld=(modelMatrix*cutP).xyz;}');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCutWorld;\nuniform vec4 cutCentres[4];\nuniform float cutRadius;\nuniform vec4 cutFront;\nfloat cutBayer(vec2 p){ivec2 q=ivec2(mod(p,4.));float m[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);return (m[q.x+q.y*4]+.5)/16.;}').replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vCutWorld.y>.22){vec3 cutV=(viewMatrix*vec4(vCutWorld,1.)).xyz;float cut=0.;for(int i=0;i<4;i++){vec4 c=cutCentres[i];if(c.w<=0.)continue;vec3 h=(viewMatrix*vec4(c.xyz,1.)).xyz;if(cutV.z>h.z+.35)cut=max(cut,c.w*.88*(1.-smoothstep(cutRadius*.55,cutRadius,length(cutV.xy-h.xy))));}cut=max(cut,cutFront.w*smoothstep(cutFront.y,cutFront.y+1.,vCutWorld.z)*(1.-smoothstep(cutFront.z-1.,cutFront.z,abs(vCutWorld.x-cutFront.x))));if(cut>cutBayer(gl_FragCoord.xy))discard;}');
 };}
 return m;
}
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
