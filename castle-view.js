import * as THREE from './vendor/three.module.min.js';

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
const hitMaterial=new THREE.MeshBasicMaterial({color:'#ffe3c2',transparent:true,opacity:.4,wireframe:true});
const hazardMaterials=new Map();
function hazardMaterial(color,warning){const key=color+warning;if(!hazardMaterials.has(key))hazardMaterials.set(key,new THREE.MeshBasicMaterial({color,transparent:true,opacity:warning?.18:.5,depthWrite:false,side:THREE.DoubleSide}));return hazardMaterials.get(key);}

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
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor('#101722');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.id = 'castle-scene';
    this.renderer.domElement.setAttribute('aria-label', '3D castle dungeon');
    this.renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none';
    document.getElementById('game').after(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2('#101722', .035);
    this.scene.add(new THREE.HemisphereLight('#d7e6ff', '#3c3446', 2));
    const moon = new THREE.DirectionalLight('#c0d7ff', 2.3); moon.position.set(-6, 15, -8); this.scene.add(moon);
    this.heroLight = new THREE.PointLight('#ffc486', 13, 9, 2); this.scene.add(this.heroLight);
    this.camera = new THREE.OrthographicCamera();
    this.camera.near = .1; this.camera.far = 100;
    this.dynamic = new Map(); this.world = null; this.enabled = true;
    this.renderer.domElement.addEventListener('webglcontextlost', e => {
      e.preventDefault(); this.enabled = false; this.renderer.domElement.hidden = true;
      document.getElementById('viewmode').textContent = '2D';
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => { this.enabled = true; });
  }
  build(world, torches, stair) {
    if (this.structure) {
      this.scene.remove(this.structure);
      this.structure.traverse(o => { if (o.isInstancedMesh) o.dispose(); if(o.geometry?.type==='TorusGeometry')o.geometry.dispose(); });
    }
    for (const mesh of this.dynamic.values()) {this.scene.remove(mesh);if(mesh.geometry?.type==='TorusGeometry')mesh.geometry.dispose();if(mesh.isSprite){mesh.material.map.dispose();mesh.material.dispose();}}
    this.dynamic.clear();
    this.world = world; this.structure = new THREE.Group(); this.scene.add(this.structure);
    const batches = new Map();
    const add = (material, x,y,z,sx,sy,sz) => {
      if (!batches.has(material)) batches.set(material, []);
      batches.get(material).push([x,y,z,sx,sy,sz]);
    };
    const floorMaterials = ['#3f4857','#46505e','#505967','#394451'].map(colorMaterial);
    for (let y=1;y<world.H-1;y++) for(let x=1;x<world.W-1;x++) {
      if (world.walk(x,y)) {
        add(floorMaterials[(x*7+y*13)%4],x+.5,-.12,y+.5,.97,.22,.97);
      } else if ([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>world.walk(x+dx,y+dy))) {
        add(dark,x+.5,.55,y+.5,1,1.1,1);
        for(let row=0;row<3;row++) for(let col=0;col<2;col++)
          add(stone,x+.25+col*.5,row*.34+.16,y+.5,.475,.31,.98);
        add(trim,x+.5,1.09,y+.5,1.06,.14,1.06);
        add(stone,x+.25,1.35,y+.25,.44,.4,.44);
        add(stone,x+.75,1.35,y+.75,.44,.4,.44);
      }
    }
    for (const room of world.rooms) {
      for (const [x,z] of [[room.x-.5,room.y-.5],[room.x+room.w+.5,room.y-.5]]) {
        if (world.walk(Math.floor(x),Math.floor(z))) continue;
        part(this.structure,cylinder,stone,x,1.3,z,.72,2.6,.72);
        part(this.structure,cylinder,trim,x,2.55,z,.84,.2,.84);
        for(let i=0;i<8;i++) {const a=i*Math.PI/4;add(stone,x+Math.cos(a)*.66,2.85,z+Math.sin(a)*.66,.32,.48,.32);}
        part(this.structure,box,dark,x,1.8,z+.72,.15,.65,.035);
        part(this.structure,box,crimson,x,1.1,z+.74,.42,.65,.04);
        part(this.structure,box,gold,x,1.16,z+.77,.05,.45,.02);
      }
      // A raised nave, pillars, and pointed arches stay outside the walkable tiles.
      const z=room.y-.46;
      const x=room.cx+.5;
      if (!world.walk(Math.floor(x), Math.floor(z))) {
        add(dark,x,1.1,z+.52,1.45,2.1,.03);
        for(const side of [-1,1]) {
          add(trim,x+side*.85,1.05,z, .22,2.1,.65);
          const beam=part(this.structure,box,trim,x+side*.42,2.25,z,.18,1.2,.65);
          beam.rotation.z=side*.78;
        }
        add(crimson,x,1.2,z+.55,.58,1.3,.035);
        add(gold,x,1.36,z+.58,.055,.8,.02);
        add(gold,x,1.5,z+.58,.3,.055,.02);
      }
    }
    for(const [material, rows] of batches) {
      const mesh=new THREE.InstancedMesh(box,material,rows.length), dummy=new THREE.Object3D();
      rows.forEach((r,i)=>{dummy.position.set(...r.slice(0,3));dummy.scale.set(...r.slice(3));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
      mesh.instanceMatrix.needsUpdate=true; mesh.computeBoundingSphere(); this.structure.add(mesh);
    }
    this.flames=[];
    for(const t of torches) {
      part(this.structure,cylinder,dark,t.x,.45,t.y,.09,.9,.09);
      part(this.structure,cylinder,gold,t.x,.93,t.y,.22,.12,.22);
      const flame=part(this.structure,cone,colorMaterial('#ffad53'),t.x,1.16,t.y,.16,.42,.16);
      this.flames.push({mesh:flame,phase:t.phase});
      const glow=part(this.structure,cylinder,colorMaterial('#87512d'),t.x,.012,t.y,.5,.015,.5);
      glow.material.emissiveIntensity=.6;
    }
    this.portal=new THREE.Group();this.portal.position.set(stair.x,.08,stair.y);this.structure.add(this.portal);
    this.portalRing=part(this.portal,new THREE.TorusGeometry(.65,.07,6,32),gold,0,.1,0,1,1,1);this.portalRing.rotation.x=-Math.PI/2;
    for(let i=0;i<5;i++)part(this.portal,box,trim,0,.04+i*.045,.42-i*.21,1,.09,.2);
  }
  damageLabel(text) {
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
    const context=canvas.getContext('2d');context.font='bold 34px system-ui';context.textAlign='center';context.lineWidth=5;context.strokeStyle='#101722';context.strokeText(text.txt,128,44);context.fillStyle=text.color;context.fillText(text.txt,128,44);
    const texture=new THREE.CanvasTexture(canvas);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true}));sprite.scale.set(2,.5,1);sprite.renderOrder=10;return sprite;
  }
  actor(hero,type) {
    const group=new THREE.Group();
    const definition=window.VesperEnemies?.definitions[type];
    const mat=hero?steel:definition?colorMaterial(definition.color):crimson;
    part(group,cone,hero?crimson:mat,0,.45,0,.29,.78,.25);
    part(group,box,mat,0,.73,0,.44,.4,.26);
    part(group,sphere,hero?steel:mat,0,1.08,0,.21,.25,.21);
    part(group,box,dark,0,1.1,-.2,.27,.055,.035);
    for(const side of [-1,1])part(group,box,dark,side*.13,.16,0,.13,.32,.17);
    part(group,box,hero?gold:dark,-.31,.63,-.05,.14,.46,.32);
    const sword=part(group,box,steel,.34,.85,-.25,.055,.7,.08);sword.rotation.x=-.5;group.userData.sword=sword;
    part(group,box,gold,.34,.53,-.08,.24,.05,.1);
    if(type==='boss'||type==='brute')group.scale.setScalar(type==='boss'?1.8:1.35);
    if(!hero&&type!=='boss'){
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
    return group;
  }
  object(key,make,active) {
    active.add(key);
    if(!this.dynamic.has(key)) {const mesh=make();this.dynamic.set(key,mesh);this.scene.add(mesh);}
    return this.dynamic.get(key);
  }
  render(data) {
    const {world,player,torches,stair,cam,time,enemies,hazards=[],chests,traps,loots,bullets,particles,flashes,texts,portalReady,attackTimer,invul,damageOverlay}=data;
    this.renderer.domElement.hidden=!this.enabled;
    if(!this.enabled)return false;
    if(this.world!==world)this.build(world,torches,stair);
    const w=innerWidth,h=innerHeight;
    if(w!==this.width||h!==this.height){this.width=w;this.height=h;this.renderer.setSize(w,h,false);const span=w<650?10.8:19;this.camera.left=-span/2;this.camera.right=span/2;this.camera.top=span*h/w/2;this.camera.bottom=-span*h/w/2;this.camera.updateProjectionMatrix();}
    this.camera.position.set(cam.x,17,cam.y+12);this.camera.lookAt(cam.x,0,cam.y-.6);
    this.heroLight.position.set(player.x,2.5,player.y);
    this.renderer.domElement.style.filter=damageOverlay>.1?'sepia(.25) saturate(1.4)':'none';
    for(const f of this.flames)f.mesh.scale.y=.42*(1+Math.sin(time*12+f.phase)*.17);
    this.portalRing.material=portalReady?colorMaterial('#efc878'):dark;
    const active=new Set();
    const hero=this.object(player,()=>this.actor(true),active);hero.position.set(player.x,0,player.y);hero.rotation.y=-player.facing-Math.PI/2+(attackTimer>0?Math.sin(attackTimer*20)*.6:0);hero.visible=invul<=0||Math.floor(time*16)%2===0;
    for(const e of enemies){
      if(e.dead||Math.hypot(e.x-player.x,e.y-player.y)>13)continue;
      const m=this.object(e,()=>this.actor(false,e.type),active);
      const prep=e.state==='preparing',attack=e.state==='attacking';
      m.position.set(e.x,e.type==='wraith'?.13+Math.sin(time*3)*.1:attack?.12:0,e.y);
      m.rotation.y=-e.aim-Math.PI/2;m.rotation.z=e.state==='stunned'?Math.sin(time*40)*.09:0;
      if(m.userData.sword)m.userData.sword.rotation.x=prep?-1.6:attack?.8:-.5;
      if(m.userData.flash)m.userData.flash.visible=e.hit>0;
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
      if(e.elite&&!m.userData.elite){part(m,cone,gold,0,1.5,0,.16,.22,.16);m.userData.elite=true;}
    }
    for(const h of hazards){
      if(Math.hypot(h.x-player.x,h.y-player.y)>15)continue;
      const warning=h.age<h.warning;
      const m=this.object('hazard:'+h.id,()=>{
        const group=new THREE.Group(),rect=h.shape==='rect';
        const fill=part(group,rect?plane:disk,hazardMaterial(h.color,true),0,.025,0,1,1,1);fill.rotation.x=-Math.PI/2;
        if(rect){for(const [x,z,sx,sz] of [[-.5,0,.025,1],[.5,0,.025,1],[0,-.5,1,.025],[0,.5,1,.025]])part(group,box,colorMaterial(h.color),x,.035,z,sx,.01,sz);}else{const edge=part(group,ring,colorMaterial(h.color),0,.035,0,1,1,1);edge.rotation.x=-Math.PI/2;}
        group.userData.fill=fill;return group;
      },active);
      m.position.set(h.x,0,h.y);m.scale.set(h.shape==='rect'?h.width:h.radius,1,h.shape==='rect'?h.height:h.radius);
      m.userData.fill.material=hazardMaterial(h.color,warning);
      // The ring is always the full damage radius; the flashing fill signals timing.
      m.userData.fill.visible=!warning||Math.sin(time*12)>-.3;
    }
    for(const o of window.VesperStory?.objects||[]){if(Math.hypot(o.x-player.x,o.y-player.y)>12)continue;const m=this.object(o,()=>{if(o.kind==='knight')return this.actor(true);const g=new THREE.Group();if(o.kind==='crown'){part(g,cone,gold,0,.5,0,.22,.42,.22);}else{part(g,box,trim,0,.24,0,.55,.48,.4);part(g,box,o.kind==='book'?crimson:gold,0,.51,0,.45,.08,.32);}return g;},active);m.position.set(o.x,0,o.y);if(o.kind==='knight')m.rotation.y=Math.atan2(player.x-o.x,player.y-o.y);}
    for(const c of chests){if(Math.hypot(c.x-player.x,c.y-player.y)>13)continue;const m=this.object(c,()=>{const g=new THREE.Group();part(g,box,gold,0,.3,0,.65,.5,.45);part(g,box,dark,0,.32,-.24,.16,.25,.03);return g;},active);m.position.set(c.x,0,c.y);m.scale.y=c.opened?.4:1;}
    for(const t of traps){if(Math.hypot(t.x-player.x,t.y-player.y)>13)continue;const m=this.object(t,()=>{const g=new THREE.Group();part(g,box,dark,0,.025,0,.65,.05,.65);for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)part(g,cone,steel,x*.2,.15,z*.2,.07,.3,.07);return g;},active);m.position.set(t.x,0,t.y);m.scale.y=Math.sin(time*2.4+t.phase)>.12?1:.15;}
    for(const [items,size,y,color] of [[loots,.12,.3,'#ecc575'],[bullets,.15,.65,'#ed748c'],[particles,.055,.45,null]])for(const a of items){if(Math.hypot(a.x-player.x,a.y-player.y)>13)continue;const m=this.object(a,()=>new THREE.Mesh(sphere,colorMaterial(a.color||color)),active);m.position.set(a.x,y+Math.sin(time*4)*.05,a.y);m.scale.setScalar(size);m.rotation.y=time;}
    for(const f of flashes){const m=this.object(f,()=>{const mesh=new THREE.Mesh(new THREE.TorusGeometry(f.range*.8,.045,4,24,player.arc*2),colorMaterial('#ffe0a5'));mesh.rotation.x=Math.PI/2;return mesh;},active);m.position.set(f.x,.5,f.y);m.rotation.z=f.a-player.arc;m.scale.setScalar(1-f.t/f.duration*.3);}
    for(const text of texts){const m=this.object(text,()=>this.damageLabel(text),active);m.position.set(text.x,1.7,text.y);m.material.opacity=1-text.t/.75;}
    for(const [key,mesh] of this.dynamic)if(!active.has(key)){this.scene.remove(mesh);if(mesh.geometry?.type==='TorusGeometry')mesh.geometry.dispose();if(mesh.isSprite){mesh.material.map.dispose();mesh.material.dispose();}this.dynamic.delete(key);}
    this.renderer.render(this.scene,this.camera);return true;
  }
}
try { window.castleView = new CastleView(); }
catch { document.getElementById('viewmode').textContent='2D'; }
