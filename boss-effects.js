import * as THREE from './vendor/three.module.min.js';
import {shapes,material,mesh} from './art-materials.js';
import {flameMaterial} from './boss-art.js';
const mist=new THREE.MeshBasicMaterial({color:'#96d74b',transparent:true,opacity:.6,depthWrite:false});
const sparks=new THREE.MeshBasicMaterial({color:'#e4c597',transparent:true,opacity:.65,depthWrite:false});
const dust=material('#84776a');
const acidFlow=(()=>{const c=document.createElement('canvas');c.width=128;c.height=32;const p=c.getContext('2d');for(let i=0;i<5;i++){p.strokeStyle=i%2?'#d3ff6dbb':'#72a74766';p.lineWidth=i%2?1.2:3;p.beginPath();for(let x=0;x<129;x++){const y=3+i*6+Math.sin(x*.12+i)*2;x?p.lineTo(x,y):p.moveTo(x,y);}p.stroke();}const map=new THREE.CanvasTexture(c);map.wrapS=THREE.RepeatWrapping;return new THREE.MeshBasicMaterial({map,transparent:true,opacity:.75,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});})();
export function createAcidStreams(h){const g=new THREE.Group();for(const turn of [0,Math.PI/2]){const strip=mesh(g,shapes.plane,acidFlow,0,.055,0,h.radius*2,h.width*.8,1);strip.rotation.set(-Math.PI/2,0,turn);}return g;}
const dummy=new THREE.Object3D();
function batch(root,geometry,mat,count){const m=new THREE.InstancedMesh(geometry,mat,count);m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;m.count=0;root.add(m);return m;}
function put(b,index,x,y,z,sx,sy,sz,rotation=0){dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,rotation,0);dummy.updateMatrix();b.setMatrixAt(index,dummy.matrix);}
export function createBossEffects(){const root=new THREE.Group();root.userData.fire=batch(root,shapes.plane,flameMaterial,144);root.userData.acid=batch(root,shapes.sphere,mist,144);root.userData.wind=batch(root,shapes.sphere,sparks,144);root.userData.debris=batch(root,shapes.box,dust,36);return root;}
export function animateHazardEffects(root,hazards,dynamic,time,quality){
 acidFlow.map.offset.x=-time*.65;
 const budget=window.VesperBossPresentation.budgets[quality].hazardMotes,u=root.userData,counts={fire:0,acid:0,wind:0};
 for(const h of hazards){if(!h.bossOwned||h.spent||h.age<h.warning||h.age>=h.warning+h.duration)continue;const visual=dynamic.get('hazard:'+h.id);if(!visual)continue;
  visual.userData.samples??=window.VesperBossPresentation.sampleHazard(h,window.VesperEnemies.containsHazard,h.shape==='wall'?48:36);
  const kind=h.kind==='poison'?'acid':h.kind==='fire'?'fire':'wind',points=visual.userData.samples,cos=Math.cos(h.angle||0),sin=Math.sin(h.angle||0);
  for(const p of points){if(Object.values(counts).reduce((a,b)=>a+b,0)>=budget)break;const i=counts[kind]++,x=h.x+p.x*cos-p.y*sin,z=h.y+p.x*sin+p.y*cos,phase=(time*1.4+p.phase)%1;
   if(kind==='fire')put(u.fire,i,x,.12+phase*.12,z,.13,.25+Math.sin(time*14+p.phase)*.09,1,p.phase);
   else if(kind==='acid')put(u.acid,i,x,.06+Math.sin(time*3+p.phase)**2*.12,z,.045+phase*.025,.04+phase*.03,.045+phase*.025);
   else put(u.wind,i,x,.18+Math.sin(time*6+p.phase)*.06,z,.035,.025,.035);}
 }
 for(const key of ['fire','acid','wind']){u[key].count=counts[key];u[key].instanceMatrix.needsUpdate=true;}
 root.userData.moteCount=counts.fire+counts.acid+counts.wind;
}
export function animateCollapse(root,state,time,quality){
 const b=root.userData.debris,s=state?.sequence,isVictory=s?.kind==='victory',t=isVictory?s.elapsed:0,amount=isVictory?window.VesperBossPresentation.pose(state.boss,time,{sequence:s}).rubble:0,count=amount>0?window.VesperBossPresentation.budgets[quality].debris:0;
 for(let i=0;i<count;i++){const angle=i*2.39996,radius=2.8+(i%5)*.35,cycle=((t-1.7)*(.65+(i%3)*.11)+i*.173)%1,size=.065+(i%4)*.028;put(b,i,state.boss.x+Math.cos(angle)*radius,Math.max(.04,4.5-cycle*5),state.boss.y+Math.sin(angle)*radius,size,size*1.4,size,angle+t);}
 b.count=count;b.instanceMatrix.needsUpdate=true;root.userData.collapse=amount;return amount;
}
export function disposeBossEffects(root){root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});root.removeFromParent();}
