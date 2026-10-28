import * as THREE from './vendor/three.module.min.js';
import {material,actorMaterial,shapes,mesh,mergeStatic} from './art-materials.js';
const robe=new THREE.LatheGeometry([new THREE.Vector2(.29,0),new THREE.Vector2(.28,.12),new THREE.Vector2(.17,.53),new THREE.Vector2(.23,.67)],10);
const torso=new THREE.LatheGeometry([new THREE.Vector2(.16,0),new THREE.Vector2(.2,.17),new THREE.Vector2(.28,.38),new THREE.Vector2(.23,.48)],10);
const hood=new THREE.SphereGeometry(1,10,8,0,Math.PI*2,0,Math.PI*.76);
const rib=new THREE.TorusGeometry(.17,.025,4,12,Math.PI*1.65);
const capeGeometry=new THREE.PlaneGeometry(.52,.8,4,5);{const p=capeGeometry.attributes.position;for(let i=0;i<p.count;i++){const y=p.getY(i);p.setZ(i,Math.sin(p.getX(i)*16)*.035+Math.max(0,-y)*.2);if(y<-.3)p.setY(i,y+Math.sin(p.getX(i)*30)*.06);}capeGeometry.computeVertexNormals();}
const bladeShape=new THREE.Shape();bladeShape.moveTo(-.45,-.5);bladeShape.lineTo(.45,-.5);bladeShape.lineTo(.36,.3);bladeShape.lineTo(0,.58);bladeShape.lineTo(-.36,.3);bladeShape.closePath();const bladeGeometry=new THREE.ExtrudeGeometry(bladeShape,{depth:.7,bevelEnabled:true,bevelSize:.07,bevelThickness:.15,bevelSegments:1,steps:1});bladeGeometry.translate(0,0,-.35);
const spectral=material('#87bccc','fabric',{transparent:true,opacity:.6,depthWrite:false,emissive:'#3b7891',emissiveIntensity:.45,side:THREE.DoubleSide});
const glow=color=>material(color,'metal',{emissive:color,emissiveIntensity:.7});
function bone(parent,x,y,z){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
export function createCharacter(hero,type,helpers){
 const group=new THREE.Group(),skeleton=type==='bone'||type==='guardian',ghoul=type==='ghoul'||type==='plague',robeType=['cultist','summoner','wraith'].includes(type),wraith=type==='wraith',brute=type==='brute',boss=type==='boss';
 const flesh=hero?actorMaterial('#a69786'):skeleton?actorMaterial('#c5baa0'):wraith?spectral:actorMaterial(ghoul?(type==='plague'?'#899465':'#8a8573'):brute?'#8e5347':'#695169');
 const iron=actorMaterial(hero?'#8b939a':'#6e655a','metal'),steel=actorMaterial('#b8c2c6','metal'),gold=actorMaterial('#b6a075','metal'),black=actorMaterial('#11131b'),cloth=actorMaterial(hero?'#715064':type==='cultist'?'#65566e':'#54435f','fabric',{side:THREE.DoubleSide});
 const body=bone(group,0,.67,0),head=bone(body,0,.58,-.015),arms=[],legs=[];
 if(skeleton){mesh(body,shapes.cylinder,flesh,0,.17,.02,.035,.56,.035);for(let i=0;i<4;i++){const r=mesh(body,rib,flesh,0,.12+i*.09,-.02,1-i*.07,.6,1);r.rotation.z=Math.PI*.18;}mesh(body,shapes.sphere,flesh,0,-.12,.01,.19,.1,.12);}
 else {mesh(body,torso,wraith?spectral:hero||brute?iron:cloth,0,-.12,0,1,1,.64);if(hero||brute){mesh(body,shapes.sphere,iron,0,.14,0,.26,.24,.17);mesh(body,shapes.cylinder,gold,0,-.08,0,.2,.055,.15);}if(ghoul){body.rotation.x=-.45;mesh(body,shapes.sphere,flesh,0,.2,.05,.29,.24,.24);}}
 if(robeType){mesh(group,robe,wraith?spectral:cloth,0,.07,0,1,1.2,1);for(let i=-1;i<=1;i++)mesh(group,shapes.cylinder,wraith?spectral:gold,i*.13,.43,-.22,.014,.62,.014);}
 mesh(head,shapes.sphere,hero?iron:flesh,0,.03,0,.155,.2,.15);
 if(hero){mesh(head,shapes.box,black,0,.06,-.145,.23,.045,.025);mesh(head,shapes.box,steel,0,-.02,-.16,.04,.2,.035);mesh(head,shapes.cone,steel,0,.27,0,.055,.2,.055);}
 else{for(const side of [-1,1])mesh(head,shapes.sphere,skeleton?black:glow(wraith?'#b4ecf7':ghoul?'#c2b877':'#ce775c'),side*.065,.06,-.13,.048,.046,.03);mesh(head,shapes.sphere,flesh,0,-.12,-.035,.12,.08,.12);if(skeleton||ghoul)for(let i=-1;i<=1;i++)mesh(head,shapes.cone,skeleton?flesh:steel,i*.05,-.1,-.15,.018,.09,.025);}
 if(robeType){mesh(head,hood,wraith?spectral:cloth,0,.08,.03,.22,.26,.22);mesh(head,shapes.cone,wraith?spectral:cloth,0,.33,.06,.17,.3,.14);}
 if(brute||type==='summoner'||boss)for(const side of [-1,1]){const h=mesh(head,shapes.cone,gold,side*.18,.25,.015,.085,.48,.085);h.rotation.z=-side*.65;}
 for(const side of [-1,1]){
  const arm=bone(body,side*.29,.26,0),elbow=bone(arm,0,-.3,0);arms.push({upper:arm,lower:elbow,side});
  for(const [p,y,length]of [[arm,-.14,.28],[elbow,-.13,.27]])mesh(p,shapes.cylinder,skeleton?flesh:ghoul?flesh:iron,0,y,0,skeleton?.045:ghoul?.075:.075,length,skeleton?.045:.075);
  mesh(elbow,shapes.sphere,hero?iron:flesh,0,-.27,0,.075,.09,.065);
  if(hero||type==='guardian'||brute)mesh(arm,shapes.sphere,iron,0,.015,0,.16,.12,.15);
  if(ghoul||brute)for(let n=-1;n<=1;n++){const claw=mesh(elbow,shapes.cone,steel,n*.045,-.36,-.035,.018,.18,.018);claw.rotation.x=-2.4;}
  const hip=bone(group,side*.115,.68,0),knee=bone(hip,0,-.32,0);legs.push({upper:hip,lower:knee,side});
  if(!wraith){mesh(hip,shapes.cylinder,skeleton?flesh:cloth,0,-.15,0,skeleton?.05:.085,.3,skeleton?.05:.09);mesh(knee,shapes.cylinder,skeleton?flesh:iron,0,-.14,0,skeleton?.045:.075,.28,skeleton?.045:.075);mesh(knee,shapes.sphere,skeleton?flesh:iron,0,-.28,-.06,.08,.07,.14);}
 }
 const right=arms[1].lower,left=arms[0].lower;
 const sword=mesh(right,bladeGeometry,steel,0,.05,-.1,.07,.68,.07);sword.rotation.x=-.5;sword.userData.keep=true;
 const hilt=mesh(right,shapes.box,gold,0,-.3,-.07,.26,.045,.07);hilt.userData.keep=true;
 mesh(right,shapes.cylinder,black,0,-.23,-.07,.035,.18,.035);
 const shield=mesh(left,shapes.sphere,hero?iron:actorMaterial('#566d81','metal'),0,-.03,-.11,.24,.34,.065);shield.userData.keep=true;mesh(shield,shapes.ring,gold,0,0,1.01,1,1,1);mesh(shield,shapes.sphere,steel,0,0,1.05,.3,.28,.3);
 const offSword=mesh(left,bladeGeometry,steel,0,.04,-.1,.055,.62,.065);offSword.userData.keep=true;offSword.rotation.x=-.5;offSword.visible=false;
 const axe=mesh(sword,shapes.sphere,steel,0,.3,0,6,.26,1.8);axe.userData.keep=true;axe.visible=false;
 if(!hero){shield.visible=type==='guardian';sword.visible=['bone','guardian','boss','wraith'].includes(type);hilt.visible=sword.visible;axe.visible=brute;
  if(brute){sword.visible=true;sword.scale.set(.11,.9,.12);axe.visible=true;}
  if(type==='summoner'||type==='cultist'){mesh(right,shapes.cylinder,iron,0,.12,-.05,.035,1.35,.035);mesh(right,shapes.sphere,glow('#b79ae2'),0,.8,-.05,.13,.13,.13);}
  if(type==='plague')for(const side of [-1,1])mesh(body,shapes.sphere,glow('#a4bf59'),side*.21,.26,.11,.11,.12,.11);
  if(wraith)sword.material=glow('#a2d8ed');
 }
 // Armour and class silhouettes (each piece shares a material already on its bone, so merging adds no draw calls).
 if(hero){for(const a of arms){mesh(a.upper,shapes.sphere,iron,0,-.06,0,.14,.08,.13);mesh(a.lower,shapes.cylinder,iron,0,-.2,0,.09,.07,.09);}
  for(const s of [-1,1])mesh(body,shapes.cone,iron,s*.09,-.22,-.02,.11,.2,.09);mesh(body,shapes.cylinder,iron,0,-.2,0,.21,.06,.15);mesh(head,shapes.cylinder,iron,0,-.06,0,.17,.035,.16);}
 if(type==='brute')for(const a of arms)for(let n=0;n<2;n++){const sp=mesh(a.upper,shapes.cone,iron,a.side*(.05+n*.06),.11,0,.035,.14,.035);sp.rotation.z=-a.side*.6;}
 if(ghoul)for(let n=0;n<3;n++)mesh(body,shapes.cone,flesh,0,.32-n*.1,.2,.035,.12,.035);
 if(skeleton)mesh(head,shapes.box,black,.05,.12,-.12,.012,.09,.01);
 if(type==='plague')for(const [x,y]of [[-.12,.05],[.15,-.05]])mesh(body,shapes.sphere,flesh,x,y,-.17,.06,.06,.05);
 if(robeType&&!wraith)mesh(head,shapes.cone,cloth,0,.2,.12,.12,.2,.1);
 if(wraith)for(const s of [-1,0,1])mesh(group,shapes.cone,spectral,s*.12,.06,.05,.06,.3,.06);
 const cape=mesh(body,capeGeometry,wraith?spectral:cloth,0,.05,.18,1,1,1);cape.rotation.x=.15;cape.visible=hero||robeType||boss;cape.userData.keep=true;
 // Consolidate the static surfaces of each articulated bone, retaining weapon handles.
 for(const p of [head,body,...arms.flatMap(a=>[a.upper,a.lower]),...legs.flatMap(a=>[a.upper,a.lower]),group])mergeStatic(p);
 const u=group.userData;Object.assign(u,{sword,hilt,offhand:shield,offSword,axe,rig:{body,head,arms,legs,cape,baseRotation:body.rotation.x},hero,type});
 if(!hero){const flash=mesh(group,shapes.sphere,helpers.hitMaterial,0,.9,0,.38,.65,.27);flash.visible=false;u.flash=flash;
 const bars=new THREE.Group();bars.position.y=1.72;group.add(bars);u.bars=bars;mesh(bars,shapes.plane,helpers.barMaterial,0,0,0,.9,.09,1);u.health=mesh(bars,shapes.plane,helpers.healthMaterial,0,0,.01,.86,.055,1);if(type==='guardian'){mesh(bars,shapes.plane,helpers.barMaterial,0,.13,0,.9,.09,1);u.shield=mesh(bars,shapes.plane,helpers.shieldMaterial,0,.13,.01,.86,.055,1);}bars.traverse(o=>{if(o.isMesh)o.renderOrder=20});u.health.renderOrder=21;if(u.shield)u.shield.renderOrder=21;
 const indicator=new THREE.Group();indicator.position.y=1.9;group.add(indicator);const halo=mesh(indicator,shapes.ring,gold,0,0,0,.25,.25,.25);halo.rotation.x=-Math.PI/2;for(const side of [-1,1])mesh(indicator,shapes.cone,glow('#eed383'),side*.23,.1,0,.055,.15,.055);indicator.visible=false;u.stunIndicator=indicator;}
 group.scale.setScalar(brute?1.35:boss?1.75:ghoul?1.05:1);if(ghoul){group.scale.y=.82;arms.forEach(a=>a.upper.rotation.z=-a.side*.2);}if(wraith)group.scale.y=1.08;
 group.userData.baseScale=group.scale.clone();return group;
}
export function animateCharacter(group,entity,time,{attacking=false,preparing=false,dodging=false,heavy=false,twoHanded=false,dual=false,blocking=false,reacting=false,deadProgress=0,swing=null,windup=null}={}){
 // Presentation only. swing/windup/deadProgress are 0..1 progress values derived from existing simulation timers.
 const V=window.VesperVFX,u=group.userData,r=u.rig;if(!r)return;const previous=u.previous||{x:entity.x,y:entity.y},moving=Math.hypot(previous.x-entity.x,previous.y-entity.y)>.0001;u.previous={x:entity.x,y:entity.y};const phase=u.hero?(entity.walk||0):time*(u.type==='ghoul'?13:8)+entity.phase;
 const stunned=entity.state==='stunned',idle=!moving&&!attacking&&!preparing&&!dodging,hit=Math.min(1,(entity.hit||0)/.19);
 // Lean into turns from the change in facing, smoothed so it reads as weight shifting rather than jitter.
 const yaw=group.rotation.y,turn=u.prevYaw===undefined?0:Math.atan2(Math.sin(yaw-u.prevYaw),Math.cos(yaw-u.prevYaw));u.prevYaw=yaw;u.lean=(u.lean||0)*.85+THREE.MathUtils.clamp(turn*2.5,-.18,.18)*.15;
 const coil=preparing?(windup!==null?V.windupPose(windup).lean:-.12):0;
 r.body.position.y=.67+(moving?Math.abs(Math.sin(phase))*.035:Math.sin(time*2.2+(entity.phase||0))*.012);
 r.body.rotation.x=r.baseRotation+(dodging?-.65:coil)+(hit>0?.22*hit:reacting?.12:0);
 r.body.rotation.z=stunned?Math.sin(time*7)*.13:u.lean+(reacting||hit>0?Math.sin(time*55)*.03:0);
 r.head.rotation.x=stunned?.35:idle?Math.sin(time*1.3+(entity.phase||0))*.03:0;
 const sp=attacking&&swing!==null?V.swingPose(swing):null,wp=preparing&&windup!==null?V.windupPose(windup):null;
 for(const a of r.arms){a.upper.rotation.x=moving?Math.sin(phase+a.side*Math.PI*.5)*.4:0;a.lower.rotation.x=-.14;a.upper.rotation.z=-a.side*(.08+(idle?Math.sin(time*2.2)*.02:0));
  if(preparing&&(a.side>0||twoHanded)){a.upper.rotation.x=wp?wp.raise:-2.1;a.lower.rotation.x=-.7;}
  else if(attacking&&(a.side>0||dual||twoHanded)){if(sp){a.upper.rotation.x=heavy?sp.raise*1.1+.1:sp.raise;a.upper.rotation.z=a.side*sp.sweep;a.lower.rotation.x=-.2-.3*sp.follow;}else{a.upper.rotation.x=heavy?.9:.5;a.upper.rotation.z=a.side*(heavy?.65:.9);a.lower.rotation.x=-.2;}}
  if(twoHanded&&a.side<0)a.upper.rotation.z=-.75;if(blocking&&a.side<0&&!twoHanded){a.upper.rotation.x=.9;a.lower.rotation.x=.9;}
 }
 for(const l of r.legs){l.upper.rotation.x=moving&&!dodging?Math.sin(phase+l.side*Math.PI*.5)*.55:0;l.lower.rotation.x=moving?Math.max(0,-Math.sin(phase+l.side*Math.PI*.5))*.6:0;}
 // Cape secondary motion: trails while moving, lifts on dodges and strikes, drifts at rest.
 if(r.cape.visible)r.cape.rotation.x=.15+(dodging?.8:moving?.38+Math.sin(phase*2)*.07:Math.sin(time*1.7+(entity.phase||0))*.04)+(attacking?.15:0);
 // Death: knees buckle, then the body topples (VesperVFX.deathPose).
 if(deadProgress){const d=V.deathPose(deadProgress);for(const l of r.legs){l.upper.rotation.x=-.9*d.knee;l.lower.rotation.x=1.5*d.knee;}r.body.rotation.x=r.baseRotation+.25*d.knee;group.rotation.z=-Math.PI*.45*d.tilt;group.position.y=-d.drop;}
}
export function disposeCharacter(group){group.traverse(o=>{if(o.userData.ownedGeometry)o.geometry.dispose();});}
