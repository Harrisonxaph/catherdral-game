import * as THREE from './vendor/three.module.min.js';
import {material,shapes,mesh,mergeStatic} from './art-materials.js';

// Original procedural art. Pivot rigs and deforming surfaces, not imported glTF assets.
const iron=material('#3b3a3c','metal'),edge=material('#96928a','metal'),gold=material('#a68b52','metal'),bone=material('#d1c3a1'),black=material('#15151b','metal'),flesh=material('#6a6252');
const glow=c=>material(c,'metal',{emissive:c,emissiveIntensity:1.1});
const ember=glow('#ff6722'),acid=glow('#9adb4b'),eye=glow('#d9fc85');
const chest=new THREE.LatheGeometry([new THREE.Vector2(.25,0),new THREE.Vector2(.34,.16),new THREE.Vector2(.46,.47),new THREE.Vector2(.39,.65)],14);
const skull=new THREE.SphereGeometry(1,14,10),rib=new THREE.TorusGeometry(.3,.035,5,16,Math.PI*1.5);
const jawShape=new THREE.Shape();jawShape.moveTo(-.24,.04);jawShape.lineTo(-.17,-.16);jawShape.lineTo(.17,-.16);jawShape.lineTo(.24,.04);jawShape.lineTo(.12,-.035);jawShape.lineTo(-.12,-.035);jawShape.closePath();
const jawGeometry=new THREE.ExtrudeGeometry(jawShape,{depth:.1,bevelEnabled:true,bevelSegments:1,bevelSize:.025,bevelThickness:.02,steps:1});
const plateShape=new THREE.Shape();plateShape.moveTo(-.48,.38);plateShape.quadraticCurveTo(0,.65,.48,.38);plateShape.lineTo(.32,-.24);plateShape.lineTo(0,-.42);plateShape.lineTo(-.32,-.24);plateShape.closePath();
const plateGeometry=new THREE.ExtrudeGeometry(plateShape,{depth:.12,bevelEnabled:true,bevelSegments:1,bevelSize:.025,bevelThickness:.025,steps:1});
const axeShape=new THREE.Shape();axeShape.moveTo(.03,.26);axeShape.bezierCurveTo(.27,.4,.48,.67,.62,.68);axeShape.quadraticCurveTo(.47,.08,.65,-.45);axeShape.quadraticCurveTo(.25,-.25,.03,-.17);axeShape.closePath();
const axeBlade=new THREE.ExtrudeGeometry(axeShape,{depth:.095,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,steps:1});
const crownShape=new THREE.Shape();crownShape.moveTo(-.4,0);for(let i=0;i<7;i++){crownShape.lineTo(-.4+i*.133,.16+(i%2?.14:.02));}crownShape.lineTo(.4,0);crownShape.closePath();const crownGeometry=new THREE.ExtrudeGeometry(crownShape,{depth:.06,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:1,steps:1});
const cloakGeometry=new THREE.PlaneGeometry(.95,1.6,8,10);{const a=cloakGeometry.attributes.position;for(let i=0;i<a.count;i++){a.setZ(i,Math.cos(a.getX(i)*24)*.045+Math.max(0,-a.getY(i))*.25);if(a.getY(i)<-.7)a.setY(i,a.getY(i)+Math.sin(i*5.1)*.14);}cloakGeometry.computeVertexNormals();}
const cloth=material('#26202b','fabric',{side:THREE.DoubleSide});
function pivot(parent,x,y,z){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
function keep(m){m.userData.keep=true;return m;}
function curved(parent,points,r,mat){const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),12,r,6,false),m=mesh(parent,geometry,mat,0,0,0);m.userData.ownedGeometry=true;return m;}
function consolidate(root){root.traverse(o=>{if(!o.isGroup)return;const owned=o.children.filter(m=>m.userData.ownedGeometry);mergeStatic(o);for(const m of owned)if(m.parent!==o)m.geometry.dispose();});}

export function createRoyalAxe(){
 const g=new THREE.Group();mesh(g,shapes.cylinder,black,0,-.3,0,.055,1.95,.055);for(const y of [-1.2,-.7,-.4,-.1,.15])mesh(g,shapes.cylinder,gold,0,y,0,.073,.065,.073);
 for(const side of [-1,1]){const blade=mesh(g,axeBlade,edge,0,.48,-.045);blade.scale.x=side;mesh(g,shapes.sphere,gold,side*.18,.49,.07,.09,.1,.04);}
 mesh(g,shapes.sphere,gold,0,.51,0,.12,.15,.1);mesh(g,shapes.sphere,glow('#9e5871'),0,.51,-.1,.055,.07,.02);consolidate(g);return g;
}
function scaleMaterial(){
 const c=document.createElement('canvas');c.width=c.height=256;const p=c.getContext('2d');p.fillStyle='#172a1a';p.fillRect(0,0,256,256);
 for(let row=-1;row<17;row++)for(let col=-1;col<17;col++){const x=col*16+(row%2)*8,y=row*16,gr=p.createLinearGradient(x,y,x,y+20);gr.addColorStop(0,'#819559');gr.addColorStop(.45,'#3a5432');gr.addColorStop(1,'#12251a');p.fillStyle=gr;p.beginPath();p.moveTo(x-8,y);p.quadraticCurveTo(x-7,y+11,x,y+18);p.quadraticCurveTo(x+8,y+10,x+8,y);p.closePath();p.fill();p.strokeStyle='#b4b87a55';p.lineWidth=.8;p.stroke();}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,4);t.colorSpace=THREE.SRGBColorSpace;
 const m=new THREE.MeshStandardMaterial({map:t,bumpMap:t,bumpScale:.025,roughness:.65,metalness:.12});return {mat:m,texture:t};
}
// Continuous tapered head surface, shaped along the snout rather than stacked spheres.
const serpentHead=(()=>{const pos=[],uv=[],index=[],profiles=[[-.68,.025,.025],[-.58,.16,.07],[-.35,.26,.12],[-.1,.34,.19],[.12,.28,.15],[.25,.025,.025]],sides=16;
 for(let i=0;i<profiles.length;i++)for(let j=0;j<=sides;j++){const [z,w,h]=profiles[i],a=j/sides*Math.PI*2;pos.push(Math.cos(a)*w,.07+Math.sin(a)*h,z);uv.push(j/sides,i/(profiles.length-1));if(i<profiles.length-1&&j<sides){const k=i*(sides+1)+j,n=k+sides+1;index.push(k,k+1,n,n,k+1,n+1);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;})();
let scales;function snakeSurface(){return scales??=scaleMaterial()}
function makeSerpent(root){
 const u=root.userData,skin=snakeSurface().mat;
 const body=pivot(root,0,0,0),rings=40,sides=12,positions=new Float32Array((rings+1)*(sides+1)*3),uv=new Float32Array((rings+1)*(sides+1)*2),indices=[];
 for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){const k=i*(sides+1)+j;uv[k*2]=j/sides;uv[k*2+1]=i/rings;if(i<rings&&j<sides){const n=k+sides+1;indices.push(k,k+1,n,n,k+1,n+1);}}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices);const tube=mesh(body,geometry,skin,0,0,0);tube.frustumCulled=false;tube.userData.ownedGeometry=true;
 const head=pivot(root,0,1.42,-.24),jaw=pivot(head,0,-.08,-.04);
 mesh(head,serpentHead,skin,0,0,0);mesh(head,skull,black,0,-.065,-.3,.28,.045,.3);
 mesh(jaw,skull,material('#b5b585'),0,-.025,-.25,.26,.055,.32);
 for(const side of [-1,1]){const lid=mesh(head,skull,skin,side*.23,.2,-.25,.14,.045,.11);lid.rotation.z=-side*.23;mesh(head,skull,eye,side*.23,.155,-.32,.065,.045,.04);mesh(head,shapes.box,black,side*.23,.155,-.356,.012,.045,.01);
 curved(head,[[side*.16,-.015,-.43],[side*.18,-.2,-.51],[side*.12,-.33,-.49]],.04,bone);mesh(head,shapes.sphere,acid,side*.16,-.18,-.48,.027,.07,.027);
 for(let i=0;i<3;i++){const crest=mesh(head,plateGeometry,skin,side*(.23-i*.035),.17+i*.035,.04+i*.055,.13,.16,.18);crest.rotation.y=side*.7;}}

 const tongue=mesh(jaw,shapes.box,material('#5e3442'),0,-.04,-.59,.035,.015,.2);u.bossRig={kind:'serpent',body,head,jaw,tongue,tube,rings,sides};
 consolidate(head);consolidate(jaw);
}
function makeHumanoid(root,id){
 const king=id==='king',u=root.userData,body=pivot(root,0,1.08,0),head=pivot(body,0,1.12,0),arms=[],legs=[];
 const armour=king?iron:material('#292729','metal'),trim=king?gold:material('#6e5b47','metal');
 mesh(body,chest,king?black:flesh,0,-.05,.02,1,1,.65);mesh(body,shapes.cylinder,bone,0,.5,.04,.055,.9,.055);
 for(let i=0;i<5;i++){const r=mesh(body,rib,bone,0,.15+i*.115,-.15,1-i*.045,.8,.8);r.rotation.z=.25;}
 // Open breastplate and layered gorget expose anatomy instead of a block torso.
 for(const side of [-1,1]){const plate=mesh(body,plateGeometry,armour,side*.28,.37,-.22,.55,.82,.6);plate.rotation.y=side*.38;const gilt=mesh(body,plateGeometry,trim,side*.28,.39,-.24,.46,.64,.3);gilt.rotation.y=side*.38;}
 for(let i=0;i<3;i++)mesh(body,shapes.cylinder,armour,0,.65+i*.055,0,.24+i*.025,.065,.18+i*.015);
 mesh(head,skull,bone,0,.02,0,.24,.3,.22);mesh(head,skull,bone,0,-.07,-.12,.21,.16,.16);
 for(const side of [-1,1]){mesh(head,skull,black,side*.105,.035,-.187,.09,.085,.055);mesh(head,skull,glow(king?'#b88aea':'#ff9f3f'),side*.106,.025,-.235,.038,.026,.018);mesh(head,skull,bone,side*.17,-.04,-.15,.085,.065,.07);}
 const jaw=pivot(head,0,-.16,-.14);mesh(jaw,jawGeometry,bone,0,0,0,.8,.8,.7);for(let i=-2;i<=2;i++)mesh(head,shapes.box,bone,i*.055,-.11,-.24,.035,.065,.04);mesh(head,shapes.cone,black,0,-.05,-.25,.035,.07,.03);
 if(king){mesh(head,shapes.cylinder,black,0,.255,0,.275,.13,.25);for(const side of [-1,1]){mesh(head,crownGeometry,black,0,.28,side*.23,.66,1,.8);mesh(head,shapes.sphere,gold,side*.14,.34,-.25,.025,.035,.015);}mesh(head,shapes.sphere,glow('#8c526d'),0,.4,-.25,.045,.055,.02);}
 else{mesh(head,plateGeometry,armour,.14,.11,.05,.5,.5,1);for(const side of [-1,1])curved(head,[[side*.19,.18,.04],[side*.35,.35,.06],[side*.34,.55,.12]],.07,armour);}
 for(const side of [-1,1]){
  const shoulder=pivot(body,side*.5,.63,0),elbow=pivot(shoulder,0,-.43,0),hand=pivot(elbow,0,-.4,-.025);arms.push({shoulder,elbow,hand,side});
  mesh(shoulder,shapes.cylinder,king?bone:flesh,0,-.19,0,.11,.4,.11);mesh(elbow,shapes.cylinder,bone,0,-.18,0,.075,.36,.075);
  mesh(shoulder,plateGeometry,armour,0,.035,-.1,.55,.58,.65);mesh(shoulder,plateGeometry,trim,0,.05,-.13,.42,.4,.4);mesh(elbow,plateGeometry,armour,0,-.18,-.075,.26,.5,.65);mesh(hand,skull,bone,0,0,0,.095,.11,.075);
  for(let n=-1;n<=1;n++){const claw=mesh(hand,shapes.cone,king?bone:black,n*.047,-.14,-.02,.023,.19,.023);claw.rotation.x=-.3;}
  const hip=pivot(root,side*.24,1.05,.02),knee=pivot(hip,0,-.48,0);legs.push({hip,knee,side});mesh(hip,shapes.cylinder,bone,0,-.23,0,.085,.46,.085);mesh(knee,shapes.cylinder,bone,0,-.22,0,.07,.44,.07);mesh(hip,plateGeometry,armour,0,-.18,-.075,.33,.6,.65);mesh(knee,plateGeometry,armour,0,-.2,-.08,.3,.64,.65);mesh(knee,skull,armour,0,-.43,-.1,.13,.09,.23);
  for(let i=0;i<3;i++){const tasset=mesh(body,plateGeometry,armour,side*(.15+i*.09),-.15-i*.03,0,.22,.55,.7);tasset.rotation.y=side*.25;}
 }
 const cloak=mesh(body,cloakGeometry,cloth,0,.1,.27,1.1,1.25,1);cloak.rotation.x=.12;keep(cloak);
 const weapon=pivot(root,0,0,0);if(king){const axe=createRoyalAxe();weapon.add(axe);}else{curved(body,[[0,.1,-.28],[.08,.3,-.3],[0,.58,-.25]],.024,ember);for(const side of [-1,1])for(let i=0;i<3;i++)mesh(body,shapes.sphere,ember,side*(.15+i*.08),.22+i*.08,-.24,.045,.08,.025);}
 u.bossRig={kind:king?'monarch':'burning',body,head,jaw,arms,legs,cloak,weapon};
 // Merge static detail per bone, retaining the animated cloak and weapon hierarchy.
 consolidate(root);
}

function fireTexture(){const c=document.createElement('canvas');c.width=32;c.height=64;const p=c.getContext('2d'),gr=p.createLinearGradient(0,62,0,0);gr.addColorStop(0,'#fff4b9');gr.addColorStop(.28,'#ffc049');gr.addColorStop(.7,'#f65c16cc');gr.addColorStop(1,'#e8330010');p.fillStyle=gr;p.beginPath();p.moveTo(16,63);p.bezierCurveTo(-1,55,1,37,11,23);p.quadraticCurveTo(20,12,14,1);p.bezierCurveTo(34,20,22,31,25,40);p.bezierCurveTo(35,50,28,59,16,63);p.fill();const t=new THREE.CanvasTexture(c);return t;}

const flameMaterial=new THREE.MeshBasicMaterial({map:fireTexture(),transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
const dummy=new THREE.Object3D();
export function createBoss(id,helpers){
 const root=new THREE.Group(),u=root.userData;Object.assign(u,{bossId:id,type:'boss',presentation:'procedural-articulated',previous:null});if(id==='snakeling')makeSerpent(root);else makeHumanoid(root,id);
 const def=window.VesperBossPresentation.definitions[id];
 const bars=pivot(root,0,def.barHeight,0);u.bars=bars;mesh(bars,shapes.plane,helpers.barMaterial,0,0,0,.9,.1,1);u.health=mesh(bars,shapes.plane,helpers.healthMaterial,0,0,.01,.86,.065,1);bars.traverse(o=>{if(o.isMesh)o.renderOrder=21});
 const flash=mesh(root,shapes.sphere,helpers.hitMaterial,0,id==='snakeling'?1.2:1.45,0,.65,1,.6);flash.visible=false;u.flash=flash;
 const indicator=pivot(root,0,def.barHeight+.2,0);const halo=mesh(indicator,shapes.ring,gold,0,0,0,.33,.33,.33);halo.rotation.x=-Math.PI/2;indicator.visible=false;u.stunIndicator=indicator;
 if(id==='flameghoul'){u.fire=new THREE.InstancedMesh(shapes.plane,flameMaterial,18);u.fire.instanceMatrix.setUsage(THREE.DynamicDrawUsage);u.fire.frustumCulled=false;root.add(u.fire);}
 root.scale.setScalar(id==='snakeling'?1.15:1.08);root.userData.baseScale=root.scale.clone();setBossQuality(helpers.quality||'low');return root;
}
function deformSnake(r,p){
 const a=r.tube.geometry.attributes.position,n=r.rings,s=r.sides;
 for(let i=0;i<=n;i++){const t=i/n,wave=Math.sin(t*11-p.clock*(p.moving?5:1.4))*.19*t*(1-p.collapse),angle=t*Math.PI*2.2;
  const x=Math.sin(angle)*(.85+t*.3)+wave,y=(1.3*Math.exp(-t*5)+.18)*(1-.86*p.collapse),z=-.02+t*1.4+Math.sin(angle*.6)*.3;
  const radius=(.245*(1-t)**.6+.012)*(1+.04*Math.sin(t*15-p.clock*2));
  for(let j=0;j<=s;j++){const th=j/s*Math.PI*2,k=i*(s+1)+j;a.setXYZ(k,x+Math.cos(th)*radius,y+Math.sin(th)*radius,z);}}
 a.needsUpdate=true;r.tube.geometry.computeVertexNormals();
 r.head.position.set(0,1.42*(1-.86*p.collapse)+Math.sin(p.clock*2)*.025,-.24+(p.attacking?-.22*p.strike:0));r.head.rotation.x=p.preparing?-.2*p.windup:p.collapse*.7;r.head.rotation.z=Math.sin(p.clock*1.3)*.035+p.hit*.09;r.jaw.rotation.x=p.preparing?.15+p.windup*.35:p.attacking?.55:.06;r.tongue.scale.z=1+Math.sin(p.clock*7)*.15;
}
const down=new THREE.Vector3(0,-1,0),target=new THREE.Vector3(),direction=new THREE.Vector3(),bend=new THREE.Vector3(),upper=new THREE.Vector3(),lower=new THREE.Vector3(),inverseBody=new THREE.Matrix4(),inverseShoulder=new THREE.Quaternion(),upperUnit=new THREE.Vector3();
function gripRoyalAxe(r){
 r.body.updateMatrix();r.weapon.updateMatrix();inverseBody.copy(r.body.matrix).invert();
 for(const a of r.arms){target.set(0,a.side<0?.15:-.15,0).applyMatrix4(r.weapon.matrix).applyMatrix4(inverseBody).sub(a.shoulder.position);const distance=Math.min(.825,target.length()),along=(.43*.43-.4*.4+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,.43*.43-along*along));direction.copy(target).normalize();bend.set(a.side,0,.25).addScaledVector(direction,-bend.dot(direction)).normalize();upper.copy(direction).multiplyScalar(along).addScaledVector(bend,height);a.shoulder.quaternion.setFromUnitVectors(down,upperUnit.copy(upper).normalize());lower.copy(direction).multiplyScalar(distance).sub(upper).normalize().applyQuaternion(inverseShoulder.copy(a.shoulder.quaternion).invert());a.elbow.quaternion.setFromUnitVectors(down,lower);}
}
export function animateBoss(root,e,time,action,sequence,quality){
 const u=root.userData,previous=u.previous,moving=!!previous&&Math.hypot(e.x-previous.x,e.y-previous.y)>.00001;u.previous={x:e.x,y:e.y};
 const p=window.VesperBossPresentation.pose(e,time,{action,sequence,moving});u.pose=p;const r=u.bossRig;
 if(r.kind==='serpent')deformSnake(r,p);else{
  const king=r.kind==='monarch',step=p.moving?Math.sin(p.clock*(king?6:8)):0,fold=p.kneel||p.collapse;
  r.body.position.y=1.08-fold*.62+Math.abs(step)*.035;r.body.rotation.x=(king?0:-.22)+(p.preparing?.16*p.windup:0)+(p.attacking?-.28*p.strike:0)-fold*.27;r.body.rotation.z=p.hit*Math.sin(p.clock*45)*.09;
  r.head.rotation.x=-fold*.35+(p.preparing?-.1:0);r.jaw.rotation.x=king?.02:p.attacking?.3:.1+Math.sin(p.clock*3)*.04;r.cloak.rotation.x=.12+Math.sin(p.clock*3)*.04+fold*.2;
  for(const l of r.legs){l.hip.position.y=1.05-fold*.62;l.hip.rotation.x=step*l.side*.3+fold*.75;l.knee.rotation.x=Math.max(0,-step*l.side)*.4-fold*2.32;}
  for(const a of r.arms){a.shoulder.rotation.x=p.preparing?-1.5*p.windup:p.attacking?-.9+1.9*p.strike:king?-.55:step*a.side*.45;a.shoulder.rotation.z=-a.side*(king?.25:.35);a.elbow.rotation.x=king?-.9:-.15;if(fold){a.shoulder.rotation.x=-.6+fold*.5;a.elbow.rotation.x=-.8+fold*.7;}}
  if(!king&&['wall','half'].includes(e.action)&&!e.dead)for(const a of r.arms){a.shoulder.rotation.z=-a.side*(p.preparing?.8:1);a.shoulder.rotation.x=p.preparing?-.5:-.9;a.elbow.rotation.x=-.4;}
  if(king){const w=r.weapon;w.visible=e.dead||e.action!=='axe'||!['preparing','attacking'].includes(e.state);w.position.set(p.drop*.65,1.4-p.drop*1.26,-.4+p.drop*.35);w.rotation.set(-.45+p.drop*(Math.PI/2+.45),0,-.4+p.drop*.9);if(!e.dead){w.position.set(0,1.4,-.4);w.rotation.x=p.preparing?-1.1: p.attacking?-.7+1.7*p.strike:-.45;gripRoyalAxe(r);}}
  if(u.fire){const limit=window.VesperBossPresentation.budgets[quality].flames;u.fire.count=e.dead?Math.round(limit*(1-p.collapse)):limit;for(let i=0;i<u.fire.count;i++){const side=i%2?1:-1,flicker=.75+Math.sin(p.clock*14+i*2.3)*.22;dummy.position.set(side*(.3+(i%3)*.15),1.5+(i%5)*.2-fold*.4,-.25+Math.sin(i*5)*.12);dummy.rotation.set(0,(i%3)*Math.PI/3,Math.sin(p.clock*4+i)*.1);dummy.scale.set(.24*flicker,(.55+(i%3)*.12)*flicker*(e.enraged?1.2:1),1);dummy.updateMatrix();u.fire.setMatrixAt(i,dummy.matrix);}u.fire.instanceMatrix.needsUpdate=true;}
  if(!king&&e.dead){r.body.rotation.x-=p.collapse*.75;r.body.position.y-=p.collapse*.25;}
 }
 root.rotation.z=p.stunned?Math.sin(p.clock*35)*.035:0;return p;
}
export function disposeBoss(root){root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedGeometry)o.geometry.dispose();});}
export function setBossQuality(quality){if(scales){scales.mat.bumpMap=quality==='low'?null:scales.texture;scales.mat.needsUpdate=true;}}
export {flameMaterial};

export function createRitualCandle(){
 const g=new THREE.Group();mesh(g,shapes.cylinder,black,0,.12,0,.32,.24,.32);mesh(g,shapes.cylinder,gold,0,.26,0,.25,.06,.25);mesh(g,shapes.cylinder,iron,0,.42,0,.075,.35,.075);mesh(g,shapes.cylinder,gold,0,.59,0,.18,.055,.18);mesh(g,shapes.cylinder,material('#d9c8a0'),0,.73,0,.09,.25,.09);
 for(const side of [-1,1]){const brace=mesh(g,shapes.cone,gold,side*.18,.35,0,.045,.3,.045);brace.rotation.z=-side*.4;}
 consolidate(g);const flame=pivot(g,0,.87,0);for(const a of [0,Math.PI/2]){const f=mesh(flame,shapes.plane,flameMaterial,0,.18,0,.3,.65,1);f.rotation.y=a;}
 const halo=mesh(g,shapes.disk,new THREE.MeshBasicMaterial({color:'#edba6a',transparent:true,opacity:.14,depthWrite:false,blending:THREE.AdditiveBlending}),0,.018,0,.5,.5,1);halo.rotation.x=-Math.PI/2;halo.userData.ownedMaterial=true;g.userData.flame=flame;g.userData.halo=halo;return g;
}
export function animateRitualCandle(g,lit,flare,time){g.userData.flare=flare;const f=g.userData.flame;f.visible=lit||flare>0;f.scale.set(1+flare*1.2,(1+flare*2.7)*(.95+Math.sin(time*12+g.position.x)*.05),1+flare*1.2);g.userData.halo.visible=f.visible;g.userData.halo.scale.setScalar(.5+flare*.8);}
export function createAcidProjectile(){const g=new THREE.Group();mesh(g,shapes.sphere,acid,0,0,0,.18,.23,.18);for(let i=0;i<3;i++)mesh(g,shapes.sphere,acid,0,.02*i,.15+i*.13,.1-i*.02,.1-i*.02,.1-i*.02);return g;}
