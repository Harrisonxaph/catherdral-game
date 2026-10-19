/* Simulation-time player abilities. Equipment and actual melee resolution stay in the game adapter. */
(() => {
 'use strict';
 const definitions=Object.freeze({
  execution:Object.freeze({name:'Execution Strike',key:'1',cooldown:8,windup:.18,multiplier:2,stagger:.45,color:'#ef536c'}),
  aegis:Object.freeze({name:'Aegis of Ash',key:'2',cooldown:20,duration:3,healthFraction:.35,color:'#69baff'}),
  stunning:Object.freeze({name:'Stunning Blow',key:'3',cooldown:18,windup:.12,multiplier:.5,stun:2,bossStagger:.75,color:'#f1cd76'})
 });
 function validTarget(player,enemy,visible,range=player.range,arc=player.arc,facing=player.facing){
  if(enemy.dead||Math.hypot(enemy.x-player.x,enemy.y-player.y)>=range+(enemy.r||0))return false;
  const angle=Math.atan2(enemy.y-player.y,enemy.x-player.x),delta=Math.atan2(Math.sin(angle-facing),Math.cos(angle-facing));
  return Math.abs(delta)<arc&&visible(player,enemy);
 }
 function targets(player,enemies,visible,options={}){return enemies.filter(e=>validTarget(player,e,visible,options.range??player.range,options.arc??player.arc,options.facing??player.facing)).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));}
 const calculateDamage=(gear,multiplier=1,critical=false,variance=1)=>gear.damage*multiplier*(critical?gear.critMultiplier:1)*variance;
 function createRuntime(api){
  const cooldowns={execution:0,aegis:0,stunning:0},barrier={capacity:0,maximum:0,remaining:0,hit:0};let cast=null;
  function available(id){return !!definitions[id]&&api.active()&&cooldowns[id]<=0&&(id==='aegis'||!cast&&api.meleeReady());}
  function activate(id){
   if(!available(id))return false;const d=definitions[id],p=api.player();cooldowns[id]=d.cooldown;
   if(id==='aegis'){barrier.capacity=barrier.maximum=p.maxHp*d.healthFraction;barrier.remaining=d.duration;barrier.hit=0;api.effect('aegis-start',p,d);}
   else{cast={id,remaining:d.windup,facing:p.facing,range:p.range,arc:p.arc,gear:{...api.stats()}};api.lock(d.windup+.15);api.effect('windup',p,d);}
   return true;
  }
  function endBarrier(reason){if(barrier.remaining>0||barrier.capacity>0)api.effect(reason,api.player(),definitions.aegis);barrier.capacity=0;barrier.remaining=0;}
  function absorb(amount){
   const blocked=barrier.remaining>0?Math.min(barrier.capacity,Math.max(0,amount)):0;
   if(blocked){barrier.capacity-=blocked;barrier.hit=.18;api.effect('aegis-hit',api.player(),definitions.aegis);if(barrier.capacity<=0)endBarrier('aegis-break');}
   return {blocked,remaining:Math.max(0,amount-blocked)};
  }
  function tick(dt){
   if(!api.active())return;for(const id of Object.keys(cooldowns))cooldowns[id]=Math.max(0,cooldowns[id]-dt);
   barrier.hit=Math.max(0,barrier.hit-dt);if(barrier.remaining>0){barrier.remaining=Math.max(0,barrier.remaining-dt);if(barrier.remaining===0){api.effect('aegis-expire',api.player(),definitions.aegis);barrier.capacity=0;}}
   if(cast){cast.remaining-=dt;if(cast.remaining<=0){const attack=cast;cast=null;api.strike(attack,definitions[attack.id]);}}
  }
  function cancelCast(){cast=null;} // Floor changes cancel pending hits, retaining cooldowns and remaining barrier.
  function reset(){for(const id of Object.keys(cooldowns))cooldowns[id]=0;barrier.capacity=barrier.maximum=barrier.remaining=barrier.hit=0;cast=null;}
  return {activate,available,tick,absorb,reset,cancelCast,cooldowns,barrier,get cast(){return cast;}};
 }
 const api=Object.freeze({definitions,validTarget,targets,calculateDamage,createRuntime});if(typeof module!=='undefined')module.exports=api;else window.VesperAbilities=api;
})();
