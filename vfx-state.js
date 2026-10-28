/* Pure presentation maths for effects: budgets, telegraph progress, trail and impact pools. No DOM, renderer or simulation writes. */
(() => {
 'use strict';
 const budgets=Object.freeze({
  low:Object.freeze({trail:8,impacts:6,puffs:6,scorch:0,halos:true}),
  medium:Object.freeze({trail:12,impacts:10,puffs:10,scorch:4,halos:true}),
  high:Object.freeze({trail:16,impacts:16,puffs:14,scorch:6,halos:true})
 });
 const clamp01=v=>Math.max(0,Math.min(1,v));
 // Shapes whose growth about the hazard origin is truthful at every step; walls and free polygons ramp opacity
 // instead, because scaling would move their safe gaps during the warning.
 const growShapes=Object.freeze(['circle','rect','cross']);
 function telegraph(h){
  // Same rule as the renderer's warning test (age < warning), so zero-warning hazards are active at once.
  const age=h.age||0,active=age>=(h.warning||0),progress=active?1:clamp01(age/Math.max(1e-6,h.warning));
  const shape=['polygon','cross','wall','rect'].includes(h.shape)?h.shape:'circle',grow=growShapes.includes(shape);
  // Final quarter pulses three times so the moment of impact is readable without relying on colour alone.
  const late=progress>=.75&&!active?(progress-.75)/.25:0,pulse=late?.5-.5*Math.cos(late*Math.PI*6):0;
  return {progress,active,grow,scale:grow?Math.max(.02,progress):1,opacity:active?0:grow?.32+.22*pulse:.08+.24*progress+.18*pulse,pulse};
 }
 // Fixed-length trail of blade samples: newest first, ages advance with presentation time and old samples expire.
 function createTrail(length){return {length,points:[],life:.16};}
 function pushTrail(trail,tip,base,dt,active){
  for(const p of trail.points)p.age+=dt;
  if(active)trail.points.unshift({tip:{...tip},base:{...base},age:0});
  while(trail.points.length>trail.length||trail.points.length&&trail.points.at(-1).age>trail.life)trail.points.pop();
  return trail.points;
 }
 const trailAlpha=(index,count)=>count<2?0:Math.pow(1-index/(count-1),1.5);
 // Ring pool for impacts and puffs: never allocates past its capacity, reuses the oldest slot.
 function createPool(capacity){return {capacity,items:[],next:0};}
 function spawn(pool,item){if(!pool.capacity)return null;const entry={...item,age:0};if(pool.items.length<pool.capacity)pool.items.push(entry);else{pool.items[pool.next]=entry;pool.next=(pool.next+1)%pool.capacity;}return entry;}
 function advance(pool,dt){for(const i of pool.items)i.age+=dt;pool.items=pool.items.filter(i=>i.age<i.life);pool.next%=Math.max(1,pool.capacity);return pool.items;}
 // Character pose curves (progress 0..1 in, joint angles out). They follow simulation timers and never change them.
 const ease=t=>t*t*(3-2*t),deathDuration=.7;
 // Swing: arm starts raised behind the shoulder, sweeps across by 55% of the strike, then follows through.
 function swingPose(p){p=clamp01(p);const s=ease(Math.min(1,p/.55));return {raise:-1.7+2.5*s,sweep:.95-1.35*s,follow:p>.55?(p-.55)/.45:0};}
 // Wind-up: the weapon arm climbs and the torso coils back as the windup timer runs down.
 function windupPose(p){p=clamp01(p);const s=ease(p);return {raise:-.4-1.7*s,lean:-.12-.12*s};}
 // Death: knees buckle first (0-40%), then the body topples (30-100%) over deathDuration seconds.
 function deathPose(p){p=clamp01(p);const knee=ease(Math.min(1,p/.4)),fall=ease(clamp01((p-.3)/.7));return {knee,drop:.12*knee+.18*fall,tilt:fall};}
 const api=Object.freeze({budgets,telegraph,createTrail,pushTrail,trailAlpha,createPool,spawn,advance,swingPose,windupPose,deathPose,deathDuration});
 if(typeof module!=='undefined')module.exports=api;else window.VesperVFX=api;
})();
