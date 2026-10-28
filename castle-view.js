import * as THREE from './vendor/three.module.min.js';
import {material,shapes,mesh,settingsMaterials,contactMaterial,resourceInfo,rimUniforms,cutUniforms} from './art-materials.js';
import {buildEnvironment,updateEnvironment,disposeEnvironment,poolTexture} from './environment-art.js';
import {createCharacter,animateCharacter,disposeCharacter} from './character-art.js';
import {createBoss,animateBoss,disposeBoss,createRoyalAxe,setBossQuality,createRitualCandle,animateRitualCandle,createAcidProjectile} from './boss-art.js';
import {createBossEffects,animateHazardEffects,animateCollapse,disposeBossEffects,createAcidStreams} from './boss-effects.js';

const stone = new THREE.MeshStandardMaterial({ color: '#64717e', roughness: .95 });
const trim = new THREE.MeshStandardMaterial({ color: '#98a1a6', roughness: .85 });
const dark = new THREE.MeshStandardMaterial({ color: '#242936', roughness: .9 });
const crimson = new THREE.MeshStandardMaterial({ color: '#782f44', side: THREE.DoubleSide });
const gold = new THREE.MeshStandardMaterial({ color: '#d6a757', metalness: .5, roughness: .4 });
const steel = new THREE.MeshStandardMaterial({ color: '#ccd9de', metalness: .65, roughness: .3 });
const box = new THREE.BoxGeometry(1, 1, 1);
const sphere = new THREE.IcosahedronGeometry(1, 1);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
const cone = new THREE.ConeGeometry(1, 1, 8);
const plane = new THREE.PlaneGeometry(1,1);
const disk = new THREE.CircleGeometry(1,32);
const ring = new THREE.RingGeometry(.96,1,32);
const healthMaterial=new THREE.MeshBasicMaterial({color:'#d35a70',depthTest:false,depthWrite:false});
const shieldMaterial=new THREE.MeshBasicMaterial({color:'#61b7ff',depthTest:false,depthWrite:false});
const barMaterial=new THREE.MeshBasicMaterial({color:'#100d18',depthTest:false,depthWrite:false});
const aegisMaterial=new THREE.MeshBasicMaterial({color:'#429dff',transparent:true,opacity:.16,depthWrite:false});
const aegisHitMaterial=new THREE.MeshBasicMaterial({color:'#b9e5ff',transparent:true,opacity:.4,depthWrite:false});
const hitMaterial=new THREE.MeshBasicMaterial({color:'#ffe3c2',transparent:true,opacity:.4,wireframe:true});
const hazardMaterials=new Map();
function hazardMaterial(color,warning){const key=color+warning;if(!hazardMaterials.has(key))hazardMaterials.set(key,new THREE.MeshBasicMaterial({color,transparent:true,opacity:warning?.18:.5,depthWrite:false,side:THREE.DoubleSide}));return hazardMaterials.get(key);}

// Combat effects (graphics v2, W4). Pools are allocated at the High budget and drawn up to the active preset's budget.
const impactMaterial=new THREE.MeshBasicMaterial({map:poolTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
const scorchMaterial=new THREE.MeshBasicMaterial({map:poolTexture,color:'#000000',transparent:true,opacity:.5,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3});
const puffMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.55,depthWrite:false});
const ribbonMaterial=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
const puffGeometry=new THREE.IcosahedronGeometry(1,0),tipWorld=new THREE.Vector3(),baseWorld=new THREE.Vector3();
// Loot rarity light (W5): open beam whose vertex colours fade to black at the top (additive), plus ring and glint glows.
const beamGeometry=(()=>{const g=new THREE.CylinderGeometry(.15,.24,1,10,1,true);g.translate(0,.5,0);const p=g.attributes.position,c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const k=Math.pow(1-p.getY(i),1.6);c.set([k,k,k],i*3);}g.setAttribute('color',new THREE.BufferAttribute(c,3));return g;})();
const beamMaterial=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
const lootRingMaterial=new THREE.MeshBasicMaterial({map:poolTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-3});
const lootStyle=Object.freeze({common:{beam:.8,ring:.75,glow:.35},rare:{beam:1.35,ring:.95,glow:.55},legendary:{beam:2.2,ring:1.25,glow:.8}});
function progressMaterial(color){const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});return m;}
const heroPosition=new THREE.Vector3(),rimWhite=new THREE.Color('#ffffff');const trailMaterials=new Map();
function trailMaterial(color){if(!trailMaterials.has(color))trailMaterials.set(color,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));return trailMaterials.get(color);}
const materials = new Map();
function colorMaterial(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .4 }));
  return materials.get(color);
}
function part(group, geometry, material, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); group.add(mesh);
  return mesh;
}

class CastleView {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.quality=window.VesperGraphics.current;this.preset=window.VesperGraphics.presets[this.quality];this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.preset.pixelRatio));this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;
    this.renderer.setClearColor('#101722');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.id = 'castle-scene';
    this.renderer.domElement.setAttribute('aria-label', '3D castle dungeon');
    this.renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none';
    document.getElementById('game').after(this.renderer.domElement);
    // CSS-only colour grade (decision D2): vignette tinted per floor, below every HUD layer, hidden with the 3D canvas.
    this.grade=document.createElement('div');this.grade.id='castle-grade';this.grade.setAttribute('aria-hidden','true');this.grade.style.cssText='position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse 75% 70% at 50% 46%,transparent 55%,var(--grade,#050c16) 100%);opacity:.6';this.renderer.domElement.after(this.grade);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2('#101722', .035);
    this.ambient=new THREE.HemisphereLight('#a7bed8','#282330',1.15);this.scene.add(this.ambient);
    const moon = this.moon = new THREE.DirectionalLight('#c0d7ff', 2.4); moon.position.set(-6, 15, 8); this.scene.add(moon);
    this.heroLight = new THREE.PointLight('#ffc486', 11.5, 9, 2); this.scene.add(this.heroLight);
    this.camera = new THREE.OrthographicCamera();
    this.camera.near = .1; this.camera.far = 100;
    this.atmosphereGeometry=new THREE.BufferGeometry();this.atmosphereGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(42*3),3));this.atmosphereMaterial=new THREE.PointsMaterial({color:'#beced4',size:1.8,transparent:true,opacity:.3,depthWrite:false});this.atmosphere=new THREE.Points(this.atmosphereGeometry,this.atmosphereMaterial);this.atmosphere.frustumCulled=false;this.scene.add(this.atmosphere);this.effectDummy=new THREE.Object3D();this.effectColor=new THREE.Color();this.effectMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending});this.particleBatch=new THREE.InstancedMesh(sphere,this.effectMaterial,120);this.projectileBatch=new THREE.InstancedMesh(sphere,this.effectMaterial,48);for(const batch of [this.particleBatch,this.projectileBatch]){batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;batch.count=0;this.scene.add(batch);}this.actorPool=new Map();this.torchLights=Array.from({length:3},()=>{const light=new THREE.PointLight('#ffb46c',0,6,2);this.scene.add(light);return light;});this.dynamic = new Map(); this.world = null; this.enabled = true;
    const V=window.VesperVFX,max=V.budgets.high;this.fxDummy=new THREE.Object3D();this.resetEffects();
    const ribbon=new THREE.BufferGeometry(),index=[];ribbon.setAttribute('position',new THREE.BufferAttribute(new Float32Array(max.trail*6),3).setUsage(THREE.DynamicDrawUsage));ribbon.setAttribute('color',new THREE.BufferAttribute(new Float32Array(max.trail*6),3).setUsage(THREE.DynamicDrawUsage));for(let i=0;i<max.trail-1;i++){const a=i*2;index.push(a,a+1,a+2,a+1,a+3,a+2);}ribbon.setIndex(index);
    this.ribbon=new THREE.Mesh(ribbon,ribbonMaterial);this.ribbon.frustumCulled=false;this.ribbon.renderOrder=6;this.ribbon.visible=false;this.scene.add(this.ribbon);
    this.impactBatch=new THREE.InstancedMesh(shapes.plane,impactMaterial,max.impacts);this.scorchBatch=new THREE.InstancedMesh(shapes.plane,scorchMaterial,max.scorch);this.puffBatch=new THREE.InstancedMesh(puffGeometry,puffMaterial,max.puffs*5);
    for(const b of [this.impactBatch,this.scorchBatch,this.puffBatch]){b.instanceMatrix.setUsage(THREE.DynamicDrawUsage);b.frustumCulled=false;b.count=0;b.visible=false;this.scene.add(b);}this.impactBatch.renderOrder=7;
    this.lootBeams=new THREE.InstancedMesh(beamGeometry,beamMaterial,48);this.lootRings=new THREE.InstancedMesh(shapes.plane,lootRingMaterial,40);this.lootGlints=new THREE.InstancedMesh(shapes.plane,impactMaterial,40);this.lootSeen=new Map();
    for(const b of [this.lootBeams,this.lootRings,this.lootGlints]){b.instanceMatrix.setUsage(THREE.DynamicDrawUsage);b.frustumCulled=false;b.count=0;b.visible=false;this.scene.add(b);}this.lootBeams.renderOrder=5;this.lootGlints.renderOrder=7;
    window.addEventListener('vesper-graphics-change',()=>this.setQuality(window.VesperGraphics.current));
    this.renderer.domElement.addEventListener('webglcontextlost', e => {
      e.preventDefault(); this.enabled = false; this.renderer.domElement.hidden = true; this.grade.hidden = true;
      document.getElementById('viewmode').textContent = '2D';
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => { this.enabled = true; });
  }
  resetEffects(){const V=window.VesperVFX,b=V.budgets[this.quality];this.vfx={trail:V.createTrail(b.trail),impacts:V.createPool(b.impacts),scorch:V.createPool(b.scorch),puffs:V.createPool(b.puffs),pickups:V.createPool(8),hits:new WeakMap(),dead:new WeakSet()};this.lootSeen?.clear();}
  setQuality(value){
    this.quality=value;this.preset=window.VesperGraphics.presets[value];this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.preset.pixelRatio));this.width=0;this.world=null;this.resetEffects();settingsMaterials(this.preset.bump);setBossQuality(this.quality);
  }
  release(mesh,pool=true){
    this.scene.remove(mesh);
    if(mesh.userData.rig&&pool){const key=mesh.userData.hero?'hero':mesh.userData.type;const list=this.actorPool.get(key)||[];if(list.length<2){list.push(mesh);this.actorPool.set(key,list);return;}}
    if(mesh.userData.bossRig){disposeBoss(mesh);return;}
    disposeCharacter(mesh);mesh.traverse(o=>{if(o.userData.ownedMaterial)o.material.dispose();});if(mesh.geometry?.type==='TorusGeometry')mesh.geometry.dispose();if(mesh.isSprite){mesh.material.map.dispose();mesh.material.dispose();}
  }
  build(world,torches,stair){
    disposeEnvironment(this.environment);if(this.bossEffects)disposeBossEffects(this.bossEffects);this.bossEffects=createBossEffects();this.scene.add(this.bossEffects);
    for(const object of this.dynamic.values())this.release(object,false);this.dynamic.clear();for(const pool of this.actorPool.values())for(const m of pool)disposeCharacter(m);this.actorPool.clear();
    this.resetEffects();this.cutEase=new Map();this.world=world;this.theme=window.VesperGraphics.themes[world.config.number-1];this.environment=buildEnvironment(world,torches,stair,this.theme,this.preset);this.structure=this.environment.root;this.scene.add(this.structure);this.flames=this.environment.flames;this.portalRing=this.environment.portalRing;
    this.renderer.setClearColor(this.theme.fog);this.scene.fog=new THREE.FogExp2(this.theme.fog,this.theme.fogDensity);this.renderer.toneMappingExposure=this.theme.exposure;rimUniforms.rimColor.value.set(this.theme.accent).lerp(rimWhite,.45);this.grade.style.setProperty('--grade',this.theme.grade);this.ambient.color.set(this.theme.ambient);this.moon.color.set(this.theme.ambient);settingsMaterials(this.preset.bump);setBossQuality(this.quality);
  }
  updateEffects({player,enemies,abilityState,equipment,flashes=[]},hero){
    // Presentation only: reads simulation state (attack timer, hit flash, death flag) and never writes it.
    const V=window.VesperVFX,fx=this.vfx,dt=this.visualDt,d=this.fxDummy,u=hero.userData,E=window.VesperEquipment,cast=abilityState?.cast;
    // The trail sweeps the strike's real arc and range from the newest melee flash (the swing pose itself is static).
    let f=null;for(const x of flashes)if(!x.fullCircle&&(!f||x.t<f.t))f=x;
    if(f){const arc=f.arc??player.arc,ang=f.a-arc+2*arc*Math.min(1,f.t/(f.duration*.6)),c=Math.cos(ang),sn=Math.sin(ang);tipWorld.set(f.x+c*f.range*.9,.62,f.y+sn*f.range*.9);baseWorld.set(f.x+c*.35,.5,f.y+sn*.35);}
    const points=V.pushTrail(fx.trail,tipWorld,baseWorld,dt,!!f&&u.sword.visible),pos=this.ribbon.geometry.attributes.position,col=this.ribbon.geometry.attributes.color,main=E?.definition(equipment?.main);
    this.effectColor.set(f?.color||(cast?window.VesperAbilities.definitions[cast.id]?.color:null)||(main?E.rarities[main.rarity].color:'#ffe0a5'));
    for(let i=0;i<points.length;i++){const p=points[i],a=V.trailAlpha(i,points.length),c=this.effectColor;pos.setXYZ(i*2,p.tip.x,p.tip.y,p.tip.z);pos.setXYZ(i*2+1,p.base.x,p.base.y,p.base.z);col.setXYZ(i*2,c.r*a,c.g*a,c.b*a);col.setXYZ(i*2+1,c.r*a*.2,c.g*a*.2,c.b*a*.2);}
    pos.needsUpdate=col.needsUpdate=true;this.ribbon.geometry.setDrawRange(0,Math.max(0,points.length-1)*6);this.ribbon.visible=points.length>1;
    for(const e of enemies){
      const last=fx.hits.get(e)||0;if((e.hit||0)>last+.01&&Math.hypot(e.x-player.x,e.y-player.y)<13){const heavy=!!u.heavy;V.spawn(fx.impacts,{x:e.x,y:e.y,life:.16,size:heavy?1.5:.95,heavy});if(heavy)V.spawn(fx.scorch,{x:e.x,y:e.y,life:1.4,size:.9});}fx.hits.set(e,e.hit||0);
      if(e.dead&&!fx.dead.has(e)){fx.dead.add(e);if(e.type!=='boss'&&Math.hypot(e.x-player.x,e.y-player.y)<13)V.spawn(fx.puffs,{x:e.x,y:e.y,life:.7,color:e.type==='wraith'?'#a9cdd6':e.type==='plague'?'#8f9a6c':'#8f8a84'});}
    }
    const draw=(batch,items,place)=>{let n=0;for(const item of items)n=place(item,n,1-item.age/item.life);batch.count=n;batch.visible=n>0;batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;};
    draw(this.impactBatch,V.advance(fx.impacts,dt),(i,n,k)=>{d.position.set(i.x,.75,i.y);d.quaternion.copy(this.camera.quaternion);d.scale.setScalar(i.size*(1.2-.6*k));d.updateMatrix();this.impactBatch.setMatrixAt(n,d.matrix);this.impactBatch.setColorAt(n,this.effectColor.set(i.color||(i.heavy?'#ffb36b':'#fff0d0')).multiplyScalar(k));return n+1;});
    draw(this.scorchBatch,V.advance(fx.scorch,dt),(i,n,k)=>{d.position.set(i.x,.012,i.y);d.rotation.set(-Math.PI/2,0,0);d.scale.setScalar(i.size*(.6+.4*k));d.updateMatrix();this.scorchBatch.setMatrixAt(n,d.matrix);return n+1;});
    draw(this.puffBatch,V.advance(fx.puffs,dt),(i,n,k)=>{for(let m=0;m<5;m++){const a=m*2.4+i.x,r=.15+(1-k)*.45;d.position.set(i.x+Math.cos(a)*r,.2+(1-k)*1.1+m*.05,i.y+Math.sin(a)*r);d.rotation.set(0,a,0);d.scale.setScalar(.03+.09*k);d.updateMatrix();this.puffBatch.setMatrixAt(n,d.matrix);this.puffBatch.setColorAt(n,this.effectColor.set(i.color));n++;}return n;});
  }
  updateLoot(loots,player,time){
    // Rarity light on visible equipment drops, and a short collapse/flash when a drop disappears (collected).
    const E=window.VesperEquipment,V=window.VesperVFX,d=this.fxDummy,fx=this.vfx,c=this.effectColor,now=new Set();let beams=0,rings=0,glints=0;
    for(const l of loots){if(l.kind!=='equipment'||l.gone||Math.hypot(l.x-player.x,l.y-player.y)>13)continue;now.add(l);const rarity=E.definition(l.item).rarity,st=lootStyle[rarity]||lootStyle.common,pulse=rarity==='legendary'?.82+Math.sin(time*2.4+l.x)*.18:1;
      this.lootSeen.set(l,{x:l.x,y:l.y,color:l.color,rarity});
      d.position.set(l.x,0,l.y);d.rotation.set(0,0,0);d.scale.set(1,st.beam*pulse,1);d.updateMatrix();this.lootBeams.setMatrixAt(beams,d.matrix);this.lootBeams.setColorAt(beams++,c.set(l.color).multiplyScalar(st.glow*pulse));
      d.position.set(l.x,.013,l.y);d.rotation.set(-Math.PI/2,0,0);d.scale.setScalar(st.ring);d.updateMatrix();this.lootRings.setMatrixAt(rings,d.matrix);this.lootRings.setColorAt(rings++,c.set(l.color).multiplyScalar(.7));
      if(E.modifiers(l.item).length){const k=.6+.4*Math.sin(time*5+l.y*3);d.position.set(l.x,.62+Math.sin(time*2+l.x)*.04,l.y);d.quaternion.copy(this.camera.quaternion);d.scale.setScalar(.32*k);d.updateMatrix();this.lootGlints.setMatrixAt(glints,d.matrix);this.lootGlints.setColorAt(glints++,c.set(l.color).lerp(rimWhite,.5).multiplyScalar(k));}}
    for(const [l,info] of this.lootSeen)if(!now.has(l)){this.lootSeen.delete(l);if(l.gone){V.spawn(fx.pickups,{...info,life:.45});V.spawn(fx.impacts,{x:info.x,y:info.y,life:.22,size:1.6,color:info.color});}}
    for(const p of V.advance(fx.pickups,this.visualDt)){const k=1-p.age/p.life,st=lootStyle[p.rarity]||lootStyle.common;d.position.set(p.x,p.age*1.4,p.y);d.rotation.set(0,0,0);d.scale.set(.6+k*.4,st.beam*(.4+k*.8),.6+k*.4);d.updateMatrix();this.lootBeams.setMatrixAt(beams,d.matrix);this.lootBeams.setColorAt(beams++,c.set(p.color).multiplyScalar(st.glow*1.6*k));}
    for(const [b,n] of [[this.lootBeams,beams],[this.lootRings,rings],[this.lootGlints,glints]]){b.count=n;b.visible=n>0;b.instanceMatrix.needsUpdate=true;if(b.instanceColor)b.instanceColor.needsUpdate=true;}
  }
  updateCutaway(player,enemies,cam=player){
    // Front band: like main's chunk fade, walls more than 1.2 south of the view target (within 9 sideways) are ghosted.
    // Wall cutaway centres: the hero always, plus up to three nearby living enemies eased in/out over 0.2 s.
    const c=cutUniforms.cutCentres.value,dt=this.visualDt,ease=this.cutEase??=new Map();c[0].set(player.x,.7,player.y,1);cutUniforms.cutFront.value.set(cam.x,cam.y+1.2,9,.72);
    const near=enemies.filter(e=>!e.dead&&Math.hypot(e.x-player.x,e.y-player.y)<8).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)).slice(0,3);
    for(const [e,w] of ease){const k=Math.max(0,w-dt/.2);if(!near.includes(e)&&k<=0)ease.delete(e);else if(!near.includes(e))ease.set(e,k);}
    for(const e of near)ease.set(e,Math.min(1,(ease.get(e)||0)+dt/.2));
    let n=1;for(const [e,w] of ease){if(n>=4)break;c[n++].set(e.x,e.type==='boss'?1.2:.7,e.y,w);}for(;n<4;n++)c[n].w=0;
  }
  damageLabel(text) {
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
    const context=canvas.getContext('2d');context.font='bold 34px system-ui';context.textAlign='center';context.lineWidth=5;context.strokeStyle='#101722';context.strokeText(text.txt,128,44);context.fillStyle=text.color;context.fillText(text.txt,128,44);
    const texture=new THREE.CanvasTexture(canvas);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true}));sprite.scale.set(2,.5,1);sprite.renderOrder=10;return sprite;
  }
  actor(hero,type,bossId){
    if(type==='boss')return createBoss(bossId,{quality:this.quality,healthMaterial,shieldMaterial,barMaterial,hitMaterial});
    const key=hero?'hero':type,list=this.actorPool.get(key),cached=list?.pop();if(cached){cached.userData.previous=null;cached.rotation.set(0,0,0);cached.scale.copy(cached.userData.baseScale);return cached;}
    return createCharacter(hero,type,{healthMaterial,shieldMaterial,barMaterial,hitMaterial});
  }
  object(key,make,active) {
    active.add(key);
    if(!this.dynamic.has(key)) {const mesh=make();this.dynamic.set(key,mesh);this.scene.add(mesh);}
    return this.dynamic.get(key);
  }
  render(data) {
    const {world,player,torches,stair,cam,time,equipment,abilityState,bossState,enemies,hazards=[],chests,traps,loots,bullets,particles,flashes,texts,portalReady,attackTimer,invul,damageOverlay}=data;
    this.renderer.domElement.hidden=!this.enabled;this.grade.hidden=!this.enabled;
    if(!this.enabled)return false;
    if(this.world!==world)this.build(world,torches,stair);
    const w=innerWidth,h=innerHeight;
    if(w!==this.width||h!==this.height){this.width=w;this.height=h;this.renderer.setSize(w,h,false);const span=w<650?10.8:19;this.camera.left=-span/2;this.camera.right=span/2;this.camera.top=span*h/w/2;this.camera.bottom=-span*h/w/2;this.camera.updateProjectionMatrix();}
    if(bossState?.sequence){const e=bossState.boss,t=bossState.sequence.elapsed;this.camera.position.set(e.x+Math.sin(t*.5)*3,13,e.y+10);this.camera.lookAt(e.x,.7,e.y);}else{this.camera.position.set(cam.x,17,cam.y+12);this.camera.lookAt(cam.x,0,cam.y-.6);}
    if(data.screenShake>0){this.camera.position.x+=Math.sin(time*91)*Math.min(.08,data.screenShake*.15);this.camera.position.z+=Math.cos(time*83)*Math.min(.05,data.screenShake*.1);}
    this.heroLight.position.set(player.x,2.5,player.y);
    this.renderer.domElement.style.filter=damageOverlay>.1?'sepia(.25) saturate(1.4)':'none';
    updateEnvironment(this.environment,player,time,this.camera);
    this.updateCutaway(player,enemies,cam);
    const motes=this.theme.motes,positions=this.atmosphereGeometry.attributes.position,count=this.quality==='low'?0:this.quality==='high'?42:24;for(let i=0;i<count;i++)positions.setXYZ(i,player.x+Math.sin(i*127.1)*8+Math.sin(time*.2+i)*.2,.25+(((i*.13+time*motes.speed)%1.8)+1.8)%1.8,player.y+Math.cos(i*79.3)*8);positions.needsUpdate=true;this.atmosphereGeometry.setDrawRange(0,count);this.atmosphereMaterial.color.set(motes.color);this.atmosphereMaterial.size=motes.size;
    const nearest=this.flames.filter(f=>f.root.visible).sort((a,b)=>a.root.position.distanceToSquared(heroPosition.set(player.x,0,player.y))-b.root.position.distanceToSquared(heroPosition));for(let i=0;i<this.torchLights.length;i++){const light=this.torchLights[i],f=nearest[i];light.visible=i<this.preset.lights&&!!f;if(light.visible){light.position.set(f.root.position.x,1.25,f.root.position.z);light.intensity=4.8+Math.sin(time*13+f.phase)*.9;light.color.set(this.theme.torch);}}
    this.heroLight.visible=this.quality!=='low';
    this.visualDt=Math.max(0,Math.min(.05,time-(this.lastVisualTime??time)));this.lastVisualTime=time;
    this.portalRing.material=portalReady?colorMaterial('#efc878'):dark;
    const active=new Set();
    const shadow=this.object('player-contact',()=>{const m=new THREE.Mesh(shapes.plane,contactMaterial);m.rotation.x=-Math.PI/2;return m;},active);shadow.position.set(player.x,.012,player.y);shadow.scale.set(1.1,.8,1);
    const hero=this.object(player,()=>this.actor(true),active);hero.position.set(player.x,0,player.y);const heroTarget=-player.facing-Math.PI/2;if(attackTimer>0)hero.rotation.y=heroTarget;const turn=THREE.MathUtils.euclideanModulo(heroTarget-hero.rotation.y+Math.PI,Math.PI*2)-Math.PI;hero.rotation.y+=turn*Math.min(1,this.visualDt*18);hero.visible=invul<=0||Math.floor(time*16)%2===0;
    if(equipment&&window.VesperEquipment){
      const E=window.VesperEquipment,main=E.definition(equipment.main),off=E.definition(equipment.off),u=hero.userData;
      u.sword.visible=!!main;u.hilt.visible=!!main;u.offhand.visible=off?.kind==='shield';u.offSword.visible=off?.kind==='weapon';
      u.sword.scale.set(main?.hands===2?.085:.055,main?.hands===2?1.05:.7,.08);
      u.sword.material=main?colorMaterial(E.rarities[main.rarity].color):steel;
      u.axe.visible=!!main&&['graveaxe','executioner','ashbringer'].includes(equipment.main.key);
      if(off){u.offhand.material=colorMaterial(E.rarities[off.rarity].color);u.offSword.material=colorMaterial(E.rarities[off.rarity].color);}
    }
    hero.userData.heavy=abilityState?.cast?.id==='execution'||hero.userData.heavy&&attackTimer>0;
    // Hero swing progress comes from the newest melee flash; ability wind-up from the cast's remaining windup time.
    let heroFlash=null;for(const f of flashes)if(!f.fullCircle&&(!heroFlash||f.t<heroFlash.t))heroFlash=f;const castDef=abilityState?.cast&&window.VesperAbilities.definitions[abilityState.cast.id];
    animateCharacter(hero,player,time,{swing:heroFlash?heroFlash.t/heroFlash.duration:null,windup:castDef?.windup?1-abilityState.cast.remaining/castDef.windup:null,attacking:attackTimer>0&&!abilityState?.cast,preparing:!!abilityState?.cast,dodging:!!data.dodging,heavy:hero.userData.heavy,blocking:invul>0&&window.VesperEquipment?.definition(equipment?.off)?.kind==='shield',reacting:invul>0,twoHanded:window.VesperEquipment?.definition(equipment?.main)?.hands===2,dual:window.VesperEquipment?.definition(equipment?.off)?.kind==='weapon'});
    if(abilityState?.cast){hero.rotation.y=-abilityState.cast.facing-Math.PI/2;hero.userData.sword.rotation.x=-.8;}else hero.userData.sword.rotation.x=attackTimer>0?-2.1:-.5;hero.userData.offSword.rotation.x=attackTimer>0?-2.1:-.5;
    if(abilityState?.barrier.capacity>0&&abilityState.barrier.remaining>0){
      const barrier=abilityState.barrier,m=this.object(barrier,()=>{
        const group=new THREE.Group();group.userData.shell=part(group,shapes.sphere,aegisMaterial,0,.75,0,.78,1.05,.78);const halo=part(group,ring,colorMaterial('#69baff'),0,.04,0,.85,.85,.85);halo.rotation.x=-Math.PI/2;for(let i=0;i<4;i++){const a=i*Math.PI/2;const sigil=part(group,ring,trailMaterial('#69baff'),Math.cos(a)*.77,.75,Math.sin(a)*.77,.1,.1,.1);sigil.rotation.y=-a;}return group;
      },active);
      m.position.set(player.x,0,player.y);m.userData.shell.material=barrier.hit>0?aegisHitMaterial:aegisMaterial;
    }
    for(const e of enemies){
      const victory=e===bossState?.boss&&bossState?.sequence?.kind==='victory',deathDuration=e.type==='boss'?window.VesperBossPresentation.definitions[e.bossId]?.deathDuration||.4:window.VesperVFX.deathDuration,dying=e.dead&&time-(e.deadAt||0)<deathDuration;if(e.dead&&!dying&&!victory||Math.hypot(e.x-player.x,e.y-player.y)>13&&!bossState?.sequence)continue;
      const contact=this.object('contact:'+enemies.indexOf(e),()=>{const m=new THREE.Mesh(shapes.plane,contactMaterial);m.rotation.x=-Math.PI/2;return m;},active);contact.position.set(e.x,.012,e.y);contact.scale.set(e.type==='brute'?1.3:.8,e.type==='brute'?1.05:.65,1);
      const m=this.object(e,()=>this.actor(false,e.type,e.bossId),active);
      const prep=e.state==='preparing',attack=e.state==='attacking';
      m.position.set(e.x,0,e.y);m.rotation.y=e.bossId==='king'&&e.action==='whirlwind'&&attack&&!e.dead?time*8:-e.aim-Math.PI/2;
      if(e.type==='boss')animateBoss(m,e,time,e===bossState?.boss?bossState.action:null,e===bossState?.boss?bossState.sequence:null,this.quality);
      else{
        const v=m.userData;if(v.st!==e.state){v.st=e.state;v.stDur=Math.max(.01,e.stateTime||0);}const progress=1-Math.max(0,e.stateTime||0)/v.stDur;
        if(!dying){m.position.y=e.type==='wraith'?.13+Math.sin(time*3)*.1:attack?.12:0;m.rotation.z=0;}
        animateCharacter(m,e,time,{preparing:prep,attacking:attack,windup:prep?progress:null,swing:attack?progress:null,deadProgress:dying?Math.min(1,(time-e.deadAt)/deathDuration):0});
        if(m.userData.sword)m.userData.sword.rotation.x=prep?-.8:attack?-2.1:-.5;
      }
      if(m.userData.flash)m.userData.flash.visible=e.hit>0;if(m.userData.stunIndicator){m.userData.stunIndicator.visible=e.state==='stunned';m.userData.stunIndicator.rotation.y=time*3;}
      if(m.userData.bars){
        m.userData.bars.visible=e.hp<e.maxHp||e.shield<e.maxShield||!['idle','patrol'].includes(e.state);
        m.userData.bars.quaternion.copy(m.quaternion).invert().multiply(this.camera.quaternion);
        const health=Math.max(0,e.hp/e.maxHp);m.userData.health.scale.x=.86*health;m.userData.health.position.x=-.43*(1-health);
        if(m.userData.shield){const shield=Math.max(0,e.shield/e.maxShield);m.userData.shield.scale.x=.86*shield;m.userData.shield.position.x=-.43*(1-shield);}
      }
      if(prep&&e.target&&['bolt','lunge'].includes(e.action)){
        const dx=e.target.x-e.x,dz=e.target.y-e.y;
        const aim=this.object(e.target,()=>new THREE.Mesh(box,hazardMaterial(e.action==='bolt'?'#b583ed':'#e6b676',false)),active);
        aim.position.set((e.x+e.target.x)/2,.045,(e.y+e.target.y)/2);aim.scale.set(Math.hypot(dx,dz),.015,.055);aim.rotation.y=-Math.atan2(dz,dx);
      }
      if(e.minion)m.scale.setScalar(.65);
      if(e.elite&&!m.userData.elite)m.userData.elite=part(m,cone,gold,0,1.85,0,.13,.16,.13);if(m.userData.elite)m.userData.elite.visible=!!e.elite;
    }
    this.updateEffects(data,hero);
    for(const h of hazards){
      if(h.spent||Math.hypot(h.x-player.x,h.y-player.y)>24)continue;
      const warning=h.age<h.warning,complex=['cross','wall','polygon'].includes(h.shape);
      const m=this.object('hazard:'+h.id,()=>{
        const group=new THREE.Group();group.userData.fills=[];
        if(complex){
          for(const poly of window.VesperEnemies.hazardPolygons(h)){
            const shape=new THREE.Shape();poly.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
            const geometry=new THREE.ShapeGeometry(shape);const mesh=part(group,geometry,hazardMaterial(h.color,true),0,.025,0,1,1,1);mesh.rotation.x=Math.PI/2;mesh.userData.ownedGeometry=true;group.userData.fills.push(mesh);
            const positions=poly.concat([poly[0]]).map(([x,y])=>new THREE.Vector3(x,.045,y));const lineGeometry=new THREE.BufferGeometry().setFromPoints(positions);const line=new THREE.Line(lineGeometry,new THREE.LineBasicMaterial({color:h.color,transparent:true,opacity:.95}));line.userData.ownedGeometry=true;line.userData.ownedMaterial=true;group.add(line);
          }
        }else{
          const rect=h.shape==='rect',fill=part(group,rect?plane:disk,hazardMaterial(h.color,true),0,.025,0,1,1,1);fill.rotation.x=-Math.PI/2;group.userData.fills.push(fill);
          if(rect){for(const [x,z,sx,sz] of [[-.5,0,.025,1],[.5,0,.025,1],[0,-.5,1,.025],[0,.5,1,.025]])part(group,box,colorMaterial(h.color),x,.035,z,sx,.01,sz);}else{const edge=part(group,ring,colorMaterial(h.color),0,.035,0,1,1,1);edge.rotation.x=-Math.PI/2;}
        }
        if(h.shape==='cross'){const streams=createAcidStreams(h);group.add(streams);group.userData.streams=streams;}
        if(h.axe){const axe=createRoyalAxe();axe.scale.setScalar(.6);axe.position.y=.4;axe.rotation.z=Math.PI/2;group.add(axe);group.userData.axe=axe;}

        const progress=new THREE.Group(),pmat=progressMaterial(h.color);progress.position.y=.006;for(const fill of group.userData.fills){const p=new THREE.Mesh(fill.geometry,pmat);p.position.copy(fill.position);p.rotation.copy(fill.rotation);p.renderOrder=3;progress.add(p);}progress.children[0].userData.ownedMaterial=true;group.add(progress);group.userData.progress=progress;
        group.userData.fill=group.userData.fills[0];return group;
      },active);
      m.position.set(h.x,0,h.y);m.rotation.y=-(h.angle||0);m.scale.set(complex?1:h.shape==='rect'?h.width:h.radius,1,complex?1:h.shape==='rect'?h.height:h.radius);
      for(const fill of m.userData.fills){fill.material=hazardMaterial(h.color,warning);fill.visible=true;}
      // Warning progress: circles/rects/crosses grow from the hazard origin to exactly the final shape; walls and polygons ramp opacity so safe gaps never move.
      const t=window.VesperVFX.telegraph(h),pg=m.userData.progress;pg.visible=!t.active;if(pg.visible){pg.scale.set(t.scale,1,t.scale);pg.children[0].material.opacity=t.opacity;}
      if(m.userData.streams)m.userData.streams.visible=!warning;
      if(m.userData.flames){m.userData.flames.visible=!warning;m.userData.flames.scale.y=1+Math.sin(time*15)*.12;}
      if(m.userData.axe){m.userData.axe.visible=!warning;m.userData.axe.rotation.y=time*5;}
      if(h.tossFlight&&warning){const flight=this.object('toss:'+h.id,()=>{const g=createRoyalAxe();g.scale.setScalar(.6);g.rotation.z=Math.PI/2;return g;},active),t=Math.min(1,h.age/h.warning);flight.position.set(h.tossFlight.x+(h.x-h.tossFlight.x)*t,.8+Math.sin(t*Math.PI)*2.3,h.tossFlight.y+(h.y-h.tossFlight.y)*t);flight.rotation.y=time*8;}
      if(h.acidFlight&&warning){const flight=this.object('acid:'+h.id,()=>createAcidProjectile(),active),t=Math.min(1,h.age/h.warning);flight.position.set(h.acidFlight.x+(h.x-h.acidFlight.x)*t,1.45*(1-t)+Math.sin(t*Math.PI)*1.5+.08,h.acidFlight.y+(h.y-h.acidFlight.y)*t);flight.rotation.y=-Math.atan2(h.y-h.acidFlight.y,h.x-h.acidFlight.x)-Math.PI/2;}
    }
    for(const c of bossState?.candles||[]){const m=this.object(c,createRitualCandle,active);m.position.set(c.x,0,c.y);const flare=bossState?.sequence?.kind==='victory'?window.VesperBossPresentation.pose(bossState.boss,time,{sequence:bossState.sequence}).candleFlare:0;animateRitualCandle(m,c.lit,flare,time+(bossState?.sequence?.elapsed||0));}

    for(const o of window.VesperStory?.objects||[]){if(Math.hypot(o.x-player.x,o.y-player.y)>12)continue;const m=this.object(o,()=>{if(o.kind==='knight')return this.actor(true);const g=new THREE.Group();if(o.kind==='crown'){part(g,cone,gold,0,.5,0,.22,.42,.22);}else{part(g,box,trim,0,.24,0,.55,.48,.4);part(g,box,o.kind==='book'?crimson:gold,0,.51,0,.45,.08,.32);}return g;},active);m.position.set(o.x,0,o.y);if(o.kind==='knight')m.rotation.y=Math.atan2(player.x-o.x,player.y-o.y);}
    for(const c of chests){if(Math.hypot(c.x-player.x,c.y-player.y)>13)continue;const m=this.object(c,()=>{const g=new THREE.Group();part(g,box,gold,0,.3,0,.65,.5,.45);part(g,box,dark,0,.32,-.24,.16,.25,.03);return g;},active);m.position.set(c.x,0,c.y);m.scale.y=c.opened?.4:1;}
    for(const t of traps){if(Math.hypot(t.x-player.x,t.y-player.y)>13)continue;const m=this.object(t,()=>{const g=new THREE.Group();part(g,box,dark,0,.025,0,.65,.05,.65);for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)part(g,cone,steel,x*.2,.15,z*.2,.07,.3,.07);return g;},active);m.position.set(t.x,0,t.y);m.scale.y=Math.sin(time*2.4+t.phase)>.12?1:.15;}
    for(const l of loots){
      if(l.gone||Math.hypot(l.x-player.x,l.y-player.y)>13)continue;
      const m=this.object(l,()=>{
        if(l.kind==='ash')return new THREE.Mesh(sphere,colorMaterial('#ecc575'));
        const group=new THREE.Group();
        if(l.kind==='potion'){part(group,cylinder,colorMaterial('#db5769'),0,.17,0,.12,.26,.12);part(group,cylinder,gold,0,.34,0,.05,.09,.05);}
        else{
          const E=window.VesperEquipment,spec=E.definition(l.item),mat=colorMaterial(l.color),axe=['graveaxe','executioner','ashbringer'].includes(l.item.key);
          if(spec.kind==='shield'){const shield=part(group,cylinder,steel,0,.2,0,.23,.08,.23);shield.rotation.x=.6;part(group,sphere,gold,0,.24,.06,.06,.06,.04);}
          else if(axe){const haft=part(group,cylinder,dark,0,.2,0,.025,spec.hands===2?.85:.62,.025);haft.rotation.z=-.65;const head=part(group,box,steel,spec.hands===2?.3:.22,spec.hands===2?.42:.34,0,.2,.18,.04);head.rotation.z=-.65;}
          else{const long=spec.hands===2,blade=part(group,box,steel,0,.24,0,.07,long?.85:.62,.06);blade.rotation.z=-.65;part(group,box,gold,long?-.2:-.15,.07,0,long?.32:.25,.05,.1);}
          if(spec.rarity==='legendary')for(const side of [-1,1])part(group,cone,mat,side*.32,.25,0,.05,.12,.05);
        }
        return group;
      },active);
      m.position.set(l.x,l.kind==='ash'?.3+Math.sin(time*3+l.phase)*.05:0,l.y);
      if(l.kind==='ash'){m.scale.setScalar(.12);m.rotation.y=time;}else if(l.kind==='equipment')m.rotation.y=Math.sin(time+l.phase)*.15;
    }
    this.updateLoot(loots,player,time);
    for(const [items,batch,limit,y]of [[particles,this.particleBatch,this.preset.particles,.45],[bullets,this.projectileBatch,48,.65]]){let count=0;for(let i=items.length-1;i>=0&&count<limit;i--){const a=items[i];if(Math.hypot(a.x-player.x,a.y-player.y)>13)continue;const size=batch===this.particleBatch?(a.size||.055)*Math.max(.2,a.life/(a.max||.65)):(a.r||.14);this.effectDummy.position.set(a.x,y,a.y);this.effectDummy.scale.setScalar(size);this.effectDummy.updateMatrix();batch.setMatrixAt(count,this.effectDummy.matrix);batch.setColorAt(count,this.effectColor.set(a.color||'#d8b4fa'));count++;}batch.count=count;batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;}

    for(const f of flashes){const m=this.object(f,()=>{const g=new THREE.Group(),color=f.color||'#ffe0a5';for(let i=0;i<(this.quality==='high'?2:1);i++){const geometry=new THREE.TorusGeometry(f.range*(f.fullCircle?1:.8)-i*.06,i?.018:.045,4,32,f.fullCircle?Math.PI*2:(f.arc??player.arc)*2),mesh=new THREE.Mesh(geometry,trailMaterial(color));mesh.userData.ownedGeometry=true;g.add(mesh);}g.rotation.x=Math.PI/2;return g;},active);m.position.set(f.x,.5,f.y);m.rotation.z=f.a-(f.arc??player.arc);m.scale.setScalar(1-f.t/f.duration*.3);}

    for(const text of texts){const m=this.object(text,()=>this.damageLabel(text),active);m.position.set(text.x,1.7,text.y);m.material.opacity=1-text.t/.75;}
    animateHazardEffects(this.bossEffects,hazards,this.dynamic,time,this.quality);const collapse=animateCollapse(this.bossEffects,bossState,time,this.quality);if(collapse>0){this.camera.position.x+=Math.sin(bossState.sequence.elapsed*35)*.045*collapse;this.camera.position.z+=Math.cos(bossState.sequence.elapsed*31)*.035*collapse;}
    for(const [key,mesh] of this.dynamic)if(!active.has(key)){this.release(mesh);this.dynamic.delete(key);}
    this.renderer.render(this.scene,this.camera);this.metrics={quality:this.quality,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,...resourceInfo()};return true;
  }
}
try { window.castleView = new CastleView(); }
catch { document.getElementById('viewmode').textContent='2D'; }
