import * as THREE from './vendor/three.module.min.js';
import {material,shapes,mesh,settingsMaterials,contactMaterial,resourceInfo} from './art-materials.js';
import {buildEnvironment,updateEnvironment,disposeEnvironment} from './environment-art.js';
import {createCharacter,animateCharacter,disposeCharacter} from './character-art.js';

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

const heroPosition=new THREE.Vector3();const trailMaterials=new Map();const fadingMaterials=new Map();
function trailMaterial(color){if(!trailMaterials.has(color))trailMaterials.set(color,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));return trailMaterials.get(color);}
function fadedMaterial(original){if(!fadingMaterials.has(original)){const m=original.clone();m.transparent=true;m.opacity=.24;m.depthWrite=false;fadingMaterials.set(original,m);}return fadingMaterials.get(original);}
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
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2('#101722', .035);
    this.ambient=new THREE.HemisphereLight('#a7bed8','#282330',1.35);this.scene.add(this.ambient);
    const moon = this.moon = new THREE.DirectionalLight('#c0d7ff', 3.2); moon.position.set(-6, 15, 8); this.scene.add(moon);
    this.heroLight = new THREE.PointLight('#ffc486', 9, 9, 2); this.scene.add(this.heroLight);
    this.camera = new THREE.OrthographicCamera();
    this.camera.near = .1; this.camera.far = 100;
    this.atmosphereGeometry=new THREE.BufferGeometry();this.atmosphereGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(42*3),3));this.atmosphereMaterial=new THREE.PointsMaterial({color:'#beced4',size:1.8,transparent:true,opacity:.3,depthWrite:false});this.atmosphere=new THREE.Points(this.atmosphereGeometry,this.atmosphereMaterial);this.atmosphere.frustumCulled=false;this.scene.add(this.atmosphere);this.effectDummy=new THREE.Object3D();this.effectColor=new THREE.Color();this.effectMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending});this.particleBatch=new THREE.InstancedMesh(sphere,this.effectMaterial,120);this.projectileBatch=new THREE.InstancedMesh(sphere,this.effectMaterial,48);for(const batch of [this.particleBatch,this.projectileBatch]){batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.frustumCulled=false;batch.count=0;this.scene.add(batch);}this.actorPool=new Map();this.torchLights=Array.from({length:3},()=>{const light=new THREE.PointLight('#ffb46c',0,6,2);this.scene.add(light);return light;});this.dynamic = new Map(); this.world = null; this.enabled = true;
    window.addEventListener('vesper-graphics-change',()=>this.setQuality(window.VesperGraphics.current));
    this.renderer.domElement.addEventListener('webglcontextlost', e => {
      e.preventDefault(); this.enabled = false; this.renderer.domElement.hidden = true;
      document.getElementById('viewmode').textContent = '2D';
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => { this.enabled = true; });
  }
  setQuality(value){
    this.quality=value;this.preset=window.VesperGraphics.presets[value];this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.preset.pixelRatio));this.width=0;this.world=null;settingsMaterials(this.preset.bump);for(const [base,m]of fadingMaterials){m.bumpMap=this.preset.bump?base.map:null;m.needsUpdate=true;}
  }
  release(mesh,pool=true){
    this.scene.remove(mesh);
    if(mesh.userData.rig&&pool){const key=mesh.userData.hero?'hero':mesh.userData.type;const list=this.actorPool.get(key)||[];if(list.length<2){list.push(mesh);this.actorPool.set(key,list);return;}}
    disposeCharacter(mesh);mesh.traverse(o=>{if(o.userData.ownedMaterial)o.material.dispose();});if(mesh.geometry?.type==='TorusGeometry')mesh.geometry.dispose();if(mesh.isSprite){mesh.material.map.dispose();mesh.material.dispose();}
  }
  build(world,torches,stair){
    disposeEnvironment(this.environment);
    for(const object of this.dynamic.values())this.release(object,false);this.dynamic.clear();for(const pool of this.actorPool.values())for(const m of pool)disposeCharacter(m);this.actorPool.clear();
    this.world=world;this.theme=window.VesperGraphics.themes[world.config.number-1];this.environment=buildEnvironment(world,torches,stair,this.theme,this.preset);this.structure=this.environment.root;this.scene.add(this.structure);this.flames=this.environment.flames;this.portalRing=this.environment.portalRing;
    this.renderer.setClearColor(this.theme.fog);this.scene.fog=new THREE.FogExp2(this.theme.fog,.018);this.ambient.color.set(this.theme.ambient);this.moon.color.set(this.theme.ambient);settingsMaterials(this.preset.bump);
  }
  damageLabel(text) {
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
    const context=canvas.getContext('2d');context.font='bold 34px system-ui';context.textAlign='center';context.lineWidth=5;context.strokeStyle='#101722';context.strokeText(text.txt,128,44);context.fillStyle=text.color;context.fillText(text.txt,128,44);
    const texture=new THREE.CanvasTexture(canvas);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true}));sprite.scale.set(2,.5,1);sprite.renderOrder=10;return sprite;
  }
  actor(hero,type,bossId){
    if(type==='boss')return this.bossActor(hero,type,bossId);
    const key=hero?'hero':type,list=this.actorPool.get(key),cached=list?.pop();if(cached){cached.userData.previous=null;cached.rotation.set(0,0,0);cached.scale.copy(cached.userData.baseScale);return cached;}
    return createCharacter(hero,type,{healthMaterial,shieldMaterial,barMaterial,hitMaterial});
  }
  bossActor(hero,type,bossId) {
    const group=new THREE.Group();
    const definition=window.VesperEnemies?.definitions[type];
    const mat=hero?steel:definition?colorMaterial(definition.color):crimson;
    part(group,cone,hero?crimson:mat,0,.45,0,.29,.78,.25);
    part(group,box,mat,0,.73,0,.44,.4,.26);
    part(group,sphere,hero?steel:mat,0,1.08,0,.21,.25,.21);
    part(group,box,dark,0,1.1,-.2,.27,.055,.035);
    for(const side of [-1,1])part(group,box,dark,side*.13,.16,0,.13,.32,.17);
    group.userData.offhand=part(group,box,hero?gold:dark,-.31,.63,-.05,.14,.46,.32);
    const sword=part(group,box,steel,.34,.85,-.25,.055,.7,.08);sword.rotation.x=-.5;group.userData.sword=sword;
    group.userData.hilt=part(group,box,gold,.34,.53,-.08,.24,.05,.1);
    if(hero){group.userData.offSword=part(group,box,steel,-.34,.85,-.25,.055,.7,.08);group.userData.offSword.rotation.x=-.5;group.userData.offSword.visible=false;group.userData.axe=part(sword,box,steel,0,.32,0,7,.3,1.5);group.userData.axe.visible=false;}
    if(type==='boss'||type==='brute')group.scale.setScalar(type==='boss'?1.8:1.35);
    if(!hero){
      if(type==='guardian'){
        part(group,box,colorMaterial('#497fb6'),-.38,.66,-.2,.4,.65,.14);
        part(group,box,steel,0,.8,0,.58,.43,.34);
      }
      if(type==='ghoul'||type==='plague'){
        group.scale.set(1.1,.7,1.15);part(group,sphere,mat,0,.62,-.28,.3,.28,.3);
        for(const side of [-1,1])part(group,cone,steel,side*.36,.34,-.37,.06,.34,.06);
        if(type==='plague')for(const side of [-1,1])part(group,sphere,colorMaterial('#b2d74f'),side*.24,.68,.18,.15,.2,.14);
        sword.visible=false;
      }
      if(type==='brute')for(const side of [-1,1]){const horn=part(group,cone,gold,side*.3,1.32,0,.12,.5,.12);horn.rotation.z=-side*.6;}
      if(type==='summoner'){
        part(group,cylinder,dark,.38,.85,0,.06,1.5,.06);part(group,sphere,colorMaterial('#d7a1fa'),.38,1.65,0,.17,.17,.17);
        for(const side of [-1,1])part(group,cone,gold,side*.2,1.4,0,.08,.45,.08);sword.visible=false;
      }
      if(type==='cultist'){part(group,cone,mat,0,1.29,0,.27,.5,.27);part(group,sphere,colorMaterial('#b583ed'),.34,.7,-.3,.16,.16,.16);sword.visible=false;}
      if(type==='wraith'){part(group,cone,mat,0,.22,0,.35,.8,.35);sword.material=colorMaterial('#c6f4ff');group.scale.set(.8,1.15,.8);}
      const flash=part(group,sphere,hitMaterial,0,.7,0,.48,.75,.4);flash.visible=false;group.userData.flash=flash;
      const bars=new THREE.Group();group.add(bars);bars.position.y=type==='summoner'?1.95:1.65;group.userData.bars=bars;
      part(bars,plane,barMaterial,0,0,0,.9,.09,1);
      group.userData.health=part(bars,plane,healthMaterial,0,0,.01,.86,.055,1);
      if(type==='guardian'){part(bars,plane,barMaterial,0,.13,0,.9,.09,1);group.userData.shield=part(bars,plane,shieldMaterial,0,.13,.01,.86,.055,1);}
      bars.traverse(o=>{if(o.isMesh)o.renderOrder=20;});group.userData.health.renderOrder=21;if(group.userData.shield)group.userData.shield.renderOrder=21;
    }
    if(type==='boss'){
      const u=group.userData;u.offhand.visible=false;
      if(bossId==='snakeling'){
        u.sword.visible=false;u.hilt.visible=false;for(const i of [0,1,4,5])group.children[i].visible=false;group.children[2].material=colorMaterial('#708d49');part(group,cylinder,colorMaterial('#708d49'),0,.55,0,.2,.7,.2);part(group,sphere,colorMaterial('#708d49'),0,.14,.16,.55,.13,.4);
        for(const side of [-1,1]){const coil=part(group,ring,colorMaterial('#7b9b50'),side*.18,.12,.12,.48,.48,.48);coil.rotation.x=-Math.PI/2;part(group,cone,colorMaterial('#e1ed9f'),side*.12,.94,-.35,.05,.25,.05);}
        part(group,sphere,colorMaterial('#708d49'),0,.85,-.23,.3,.19,.35);group.scale.set(1.8,1.35,1.8);
      }else{
        part(u.sword,box,bossId==='flameghoul'?colorMaterial('#ff9450'):steel,0,.26,0,7,.3,1.3);
        for(const side of [-1,1]){const horn=part(group,cone,bossId==='flameghoul'?colorMaterial('#ff9c46'):gold,side*.24,1.38,0,.09,.4,.09);horn.rotation.z=-side*.5;}
        if(bossId==='flameghoul')for(const side of [-1,1])part(group,cone,colorMaterial('#ff7f36'),side*.29,1.04,.05,.12,.45,.12);
        if(bossId==='king'){part(group,cylinder,gold,0,1.29,0,.24,.12,.24);for(let i=-1;i<=1;i++)part(group,cone,gold,i*.16,1.43,0,.065,.26,.065);}
      }
    }
    if(!hero){const indicator=new THREE.Group();indicator.position.y=1.8;group.add(indicator);const halo=part(indicator,ring,gold,0,0,0,.23,.23,.23);halo.rotation.x=-Math.PI/2;for(const side of [-1,1])part(indicator,cone,gold,side*.22,.1,0,.06,.16,.06);indicator.visible=false;group.userData.stunIndicator=indicator;}
    return group;
  }
  object(key,make,active) {
    active.add(key);
    if(!this.dynamic.has(key)) {const mesh=make();this.dynamic.set(key,mesh);this.scene.add(mesh);}
    return this.dynamic.get(key);
  }
  render(data) {
    const {world,player,torches,stair,cam,time,equipment,abilityState,bossState,enemies,hazards=[],chests,traps,loots,bullets,particles,flashes,texts,portalReady,attackTimer,invul,damageOverlay}=data;
    this.renderer.domElement.hidden=!this.enabled;
    if(!this.enabled)return false;
    if(this.world!==world)this.build(world,torches,stair);
    const w=innerWidth,h=innerHeight;
    if(w!==this.width||h!==this.height){this.width=w;this.height=h;this.renderer.setSize(w,h,false);const span=w<650?10.8:19;this.camera.left=-span/2;this.camera.right=span/2;this.camera.top=span*h/w/2;this.camera.bottom=-span*h/w/2;this.camera.updateProjectionMatrix();}
    if(bossState?.sequence){const e=bossState.boss,t=bossState.sequence.elapsed;this.camera.position.set(e.x+Math.sin(t*.5)*3,13,e.y+10);this.camera.lookAt(e.x,.7,e.y);}else{this.camera.position.set(cam.x,17,cam.y+12);this.camera.lookAt(cam.x,0,cam.y-.6);}
    if(data.screenShake>0){this.camera.position.x+=Math.sin(time*91)*Math.min(.08,data.screenShake*.15);this.camera.position.z+=Math.cos(time*83)*Math.min(.05,data.screenShake*.1);}
    this.heroLight.position.set(player.x,2.5,player.y);
    this.renderer.domElement.style.filter=damageOverlay>.1?'sepia(.25) saturate(1.4)':'none';
    updateEnvironment(this.environment,player,time);
    for(const group of this.environment.chunks.values())if(group.visible)for(const o of group.children)if(o.userData.wall){o.userData.originalMaterial??=o.material;const c=group.userData.center;o.material=c.y>cam.y+3&&Math.abs(c.x-cam.x)<9?fadedMaterial(o.userData.originalMaterial):o.userData.originalMaterial;}
    const positions=this.atmosphereGeometry.attributes.position,count=this.quality==='low'?0:this.quality==='high'?42:24;for(let i=0;i<count;i++)positions.setXYZ(i,player.x+Math.sin(i*127.1)*8+Math.sin(time*.2+i)*.2,.25+((i*.13+time*.1)%1.8),player.y+Math.cos(i*79.3)*8);positions.needsUpdate=true;this.atmosphereGeometry.setDrawRange(0,count);this.atmosphereMaterial.color.set(this.theme.accent);
    const nearest=this.flames.filter(f=>f.root.visible).sort((a,b)=>a.root.position.distanceToSquared(heroPosition.set(player.x,0,player.y))-b.root.position.distanceToSquared(heroPosition));for(let i=0;i<this.torchLights.length;i++){const light=this.torchLights[i],f=nearest[i];light.visible=i<this.preset.lights&&!!f;if(light.visible){light.position.set(f.root.position.x,1.25,f.root.position.z);light.intensity=7+Math.sin(time*13+f.phase)*1.2;}}
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
    animateCharacter(hero,player,time,{attacking:attackTimer>0&&!abilityState?.cast,preparing:!!abilityState?.cast,dodging:!!data.dodging,heavy:hero.userData.heavy,blocking:invul>0&&window.VesperEquipment?.definition(equipment?.off)?.kind==='shield',reacting:invul>0,twoHanded:window.VesperEquipment?.definition(equipment?.main)?.hands===2,dual:window.VesperEquipment?.definition(equipment?.off)?.kind==='weapon'});
    if(abilityState?.cast){hero.rotation.y=-abilityState.cast.facing-Math.PI/2;hero.userData.sword.rotation.x=-.8;}else hero.userData.sword.rotation.x=attackTimer>0?-2.1:-.5;hero.userData.offSword.rotation.x=attackTimer>0?-2.1:-.5;
    if(abilityState?.barrier.capacity>0&&abilityState.barrier.remaining>0){
      const barrier=abilityState.barrier,m=this.object(barrier,()=>{
        const group=new THREE.Group();group.userData.shell=part(group,shapes.sphere,aegisMaterial,0,.75,0,.78,1.05,.78);const halo=part(group,ring,colorMaterial('#69baff'),0,.04,0,.85,.85,.85);halo.rotation.x=-Math.PI/2;for(let i=0;i<4;i++){const a=i*Math.PI/2;const sigil=part(group,ring,trailMaterial('#69baff'),Math.cos(a)*.77,.75,Math.sin(a)*.77,.1,.1,.1);sigil.rotation.y=-a;}return group;
      },active);
      m.position.set(player.x,0,player.y);m.userData.shell.material=barrier.hit>0?aegisHitMaterial:aegisMaterial;
    }
    for(const e of enemies){
      const victory=e===bossState?.boss&&bossState?.sequence?.kind==='victory',dying=e.dead&&time-(e.deadAt||0)<.4;if(e.dead&&!dying&&!victory||Math.hypot(e.x-player.x,e.y-player.y)>13&&!bossState?.sequence)continue;
      const contact=this.object('contact:'+enemies.indexOf(e),()=>{const m=new THREE.Mesh(shapes.plane,contactMaterial);m.rotation.x=-Math.PI/2;return m;},active);contact.position.set(e.x,.012,e.y);contact.scale.set(e.type==='brute'?1.3:.8,e.type==='brute'?1.05:.65,1);
      const m=this.object(e,()=>this.actor(false,e.type,e.bossId),active);
      const prep=e.state==='preparing',attack=e.state==='attacking';
      animateCharacter(m,e,time,{preparing:prep,attacking:attack,deadProgress:dying?Math.min(1,(time-e.deadAt)/.4):0});
      m.position.set(e.x,dying?-.3*Math.min(1,(time-e.deadAt)/.4):e.type==='wraith'?.13+Math.sin(time*3)*.1:attack?.12:0,e.y);
      if(victory)m.scale.y=Math.max(.03,1.8*(1-bossState.sequence.elapsed/bossState.sequence.duration));
      m.rotation.y=e.bossId==='king'&&e.action==='whirlwind'&&attack?time*8:-e.aim-Math.PI/2;m.rotation.z=dying?-Math.PI*.45*Math.min(1,(time-e.deadAt)/.4):e.state==='stunned'?Math.sin(time*40)*.09:0;
      if(m.userData.sword)m.userData.sword.rotation.x=prep?-.8:attack?-2.1:-.5;
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
        if(h.axe){const axe=new THREE.Group();part(axe,box,steel,0,.28,0,.1,.08,1.5);part(axe,box,gold,0,.28,-.5,.75,.12,.45);group.add(axe);group.userData.axe=axe;}
        if(h.shape==='wall'){const flames=new THREE.Group();for(let x=-h.width/2+.25;x<h.width/2;x+=.65){if(Math.abs(x-h.gapX)<h.gap/2+.1)continue;part(flames,cone,colorMaterial('#ff9c42'),x,.3,0,.17,.6,.14);}group.add(flames);group.userData.flames=flames;}
        group.userData.fill=group.userData.fills[0];return group;
      },active);
      m.position.set(h.x,0,h.y);m.rotation.y=-(h.angle||0);m.scale.set(complex?1:h.shape==='rect'?h.width:h.radius,1,complex?1:h.shape==='rect'?h.height:h.radius);
      for(const fill of m.userData.fills){fill.material=hazardMaterial(h.color,warning);fill.visible=!warning||Math.sin(time*12)>-.3;}
      if(m.userData.flames){m.userData.flames.visible=!warning;m.userData.flames.scale.y=1+Math.sin(time*15)*.12;}
      if(m.userData.axe){m.userData.axe.visible=!warning;m.userData.axe.rotation.y=time*5;}
      if(h.tossFlight&&warning){const flight=this.object('toss:'+h.id,()=>{const g=new THREE.Group();part(g,box,steel,0,0,0,.08,.06,.8);part(g,box,gold,0,0,-.28,.45,.1,.2);return g;},active),t=Math.min(1,h.age/h.warning);flight.position.set(h.tossFlight.x+(h.x-h.tossFlight.x)*t,.8+Math.sin(t*Math.PI)*2.3,h.tossFlight.y+(h.y-h.tossFlight.y)*t);flight.rotation.y=time*8;}
      if(h.acidFlight&&warning){const flight=this.object('acid:'+h.id,()=>new THREE.Mesh(sphere,colorMaterial('#b8e76d')),active),t=Math.min(1,h.age/h.warning);flight.position.set(h.acidFlight.x+(h.x-h.acidFlight.x)*t,.5+Math.sin(t*Math.PI)*2.3,h.acidFlight.y+(h.y-h.acidFlight.y)*t);flight.scale.setScalar(.18);}
    }
    for(const c of bossState?.candles||[]){const m=this.object(c,()=>{const g=new THREE.Group();part(g,cylinder,gold,0,.14,0,.28,.25,.28);part(g,cylinder,trim,0,.48,0,.1,.55,.1);g.userData.flame=part(g,cone,colorMaterial('#ffd07b'),0,.86,0,.12,.3,.12);return g;},active);m.position.set(c.x,0,c.y);m.userData.flame.visible=c.lit;}
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
          const E=window.VesperEquipment,spec=E.definition(l.item),mat=colorMaterial(l.color);
          part(group,cylinder,mat,0,.015,0,.4,.025,.4);
          if(spec.kind==='shield'){const shield=part(group,cylinder,steel,0,.2,0,.23,.08,.23);shield.rotation.x=.6;}
          else{const blade=part(group,box,steel,0,.22,0,.07,.65,.07);blade.rotation.z=-.65;part(group,box,gold,-.15,.07,0,.25,.05,.1);}
          if(spec.rarity==='legendary')for(const side of [-1,1])part(group,cone,mat,side*.32,.25,0,.05,.12,.05);
        }
        return group;
      },active);
      m.position.set(l.x,l.kind==='ash'?.3+Math.sin(time*3+l.phase)*.05:0,l.y);
      if(l.kind==='ash'){m.scale.setScalar(.12);m.rotation.y=time;}else if(l.kind==='equipment')m.rotation.y=Math.sin(time+l.phase)*.15;
    }
    for(const [items,batch,limit,y]of [[particles,this.particleBatch,this.preset.particles,.45],[bullets,this.projectileBatch,48,.65]]){let count=0;for(let i=items.length-1;i>=0&&count<limit;i--){const a=items[i];if(Math.hypot(a.x-player.x,a.y-player.y)>13)continue;const size=batch===this.particleBatch?(a.size||.055)*Math.max(.2,a.life/(a.max||.65)):(a.r||.14);this.effectDummy.position.set(a.x,y,a.y);this.effectDummy.scale.setScalar(size);this.effectDummy.updateMatrix();batch.setMatrixAt(count,this.effectDummy.matrix);batch.setColorAt(count,this.effectColor.set(a.color||'#d8b4fa'));count++;}batch.count=count;batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;}

    for(const f of flashes){const m=this.object(f,()=>{const g=new THREE.Group(),color=f.color||'#ffe0a5';for(let i=0;i<(this.quality==='high'?2:1);i++){const geometry=new THREE.TorusGeometry(f.range*(f.fullCircle?1:.8)-i*.06,i?.018:.045,4,32,f.fullCircle?Math.PI*2:(f.arc??player.arc)*2),mesh=new THREE.Mesh(geometry,trailMaterial(color));mesh.userData.ownedGeometry=true;g.add(mesh);}g.rotation.x=Math.PI/2;return g;},active);m.position.set(f.x,.5,f.y);m.rotation.z=f.a-(f.arc??player.arc);m.scale.setScalar(1-f.t/f.duration*.3);}

    for(const text of texts){const m=this.object(text,()=>this.damageLabel(text),active);m.position.set(text.x,1.7,text.y);m.material.opacity=1-text.t/.75;}
    for(const [key,mesh] of this.dynamic)if(!active.has(key)){this.release(mesh);this.dynamic.delete(key);}
    this.renderer.render(this.scene,this.camera);this.metrics={quality:this.quality,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,...resourceInfo()};return true;
  }
}
try { window.castleView = new CastleView(); }
catch { document.getElementById('viewmode').textContent='2D'; }
