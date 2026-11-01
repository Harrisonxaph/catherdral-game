/* Persistent play session (ARPG Phase 2 PR5, docs/arpg/SPEC.md sections 5-7): pure transitions that map the existing
 * runtime onto the saved character, and a session that commits them one at a time through the command coordinator.
 * No DOM or renderer: index.html owns presentation and calls these through small adapters. */
(() => {
 'use strict';
 const node=typeof module!=='undefined';
 const C=node?require('./character-state.js'):window.VesperCharacter,G=node?require('./campaign-state.js'):window.VesperCampaign,
  K=node?require('./command-coordinator.js'):window.VesperCommands,E=node?require('./equipment.js'):window.VesperEquipment,
  A=node?require('./abilities.js'):window.VesperAbilities,F=node?require('./floors.js'):window.VesperFloors;
 const fail=(code,message)=>({ok:false,code,message});
 const unchanged=state=>({ok:true,applied:false,state});
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 const num=v=>typeof v==='number'&&Number.isFinite(v);
 const gearShield=(state,run=state.run)=>E.stats({damage:state.stats.damage,attackRate:state.stats.attackRate,crit:state.stats.crit},run).shield;

 // ---- pure transitions
 // Noncritical runtime snapshot (health, equipment shield, simulation timers), clamped to the saved bounds. Health is
 // never written while a death is pending or when the runtime is at zero (the death command records that), and the
 // snapshot never refills anything: it only reports what the simulation already holds.
 function applySnapshot(state,snap){
  if(!snap)return unchanged(state);
  const c=state.character,t=c.timers,alive=state.world.lifecycle.mode==='alive';
  const hp=alive&&num(snap.hp)&&snap.hp>0?Math.min(state.stats.maxHp,snap.hp):c.resources.hp;
  const shield=num(snap.shield)?clamp(snap.shield,0,gearShield(state)):c.resources.equipmentShield;
  const timer=(v,max,old)=>num(v)?clamp(v,0,max):old;
  const cooldowns={};for(const [id,d] of Object.entries(A.definitions))cooldowns[id]=timer(snap.cooldowns?.[id],d.cooldown,t.abilityCooldowns[id]);
  const timers={abilityCooldowns:cooldowns,attackRemaining:timer(snap.attackRemaining,2,t.attackRemaining),dodgeRemaining:timer(snap.dodgeRemaining,C.progression.core['penitent-v1'].dashCd,t.dodgeRemaining),
   firePassiveRemaining:timer(snap.firePassiveRemaining,E.balance.fireCooldown,t.firePassiveRemaining),shieldDelay:timer(snap.shieldDelay,E.balance.shieldDelay,t.shieldDelay)};
  if(hp===c.resources.hp&&shield===c.resources.equipmentShield&&C.canonical(timers)===C.canonical(t))return unchanged(state);
  return G.transition(state,next=>{next.character.resources.hp=hp;next.character.resources.equipmentShield=shield;next.character.timers=timers;});
 }
 // Respawn after a recorded death, once per respawn ID: full health at the active checkpoint, everything else kept
 // (potions, items, ash, XP, cooldowns, equipment shield). Repeating it is a no-op; it never revives a living character.
 function respawn(state,{respawnId}={}){
  const l=state.world.lifecycle;
  if(typeof respawnId!=='string')return fail('invalid','a respawn ID is required');
  if(l.mode==='alive')return l.lastRespawnId===respawnId?unchanged(state):fail('alive','there is no death to respawn from');
  return G.transition(state,next=>{next.character.resources.hp=next.stats.maxHp;next.world.lifecycle={mode:'alive',deathId:null,lastRespawnId:respawnId};});
 }
 // Inventory rearrangement from the existing inventory screen (equip, unequip, swap). It may only reorder the items the
 // save already owns: the same item IDs, the same potions, no item created, copied or lost. Items always come from the
 // saved state, never from the runtime objects. The equipment shield is clamped to the new loadout's capacity.
 function syncRun(state,run){
  if(!run||!Array.isArray(run.bag)||run.bag.length!==state.run.bag.length)return fail('invalid','not a loadout');
  const owned=r=>[r.main,r.off,...r.bag].filter(Boolean).map(i=>i.id);
  const before=owned(state.run),after=owned(run);
  if(before.slice().sort((a,b)=>a-b).join()!==after.slice().sort((a,b)=>a-b).join()||new Set(after).size!==after.length)return fail('mismatch','the loadout does not hold the saved items');
  if(run.potions!==state.run.potions)return fail('mismatch','potions change only through potion commands');
  const byId=new Map([state.run.main,state.run.off,...state.run.bag].filter(Boolean).map(i=>[i.id,i])),pick=i=>i?byId.get(i.id):null;
  const draft={main:pick(run.main),off:pick(run.off),bag:run.bag.map(pick),potions:state.run.potions};
  if(draft.main===state.run.main&&draft.off===state.run.off&&draft.bag.every((i,n)=>i===state.run.bag[n]))return unchanged(state);
  if(!E.valid(draft))return fail('invalid','invalid loadout');
  return G.transition(state,next=>{next.run.main=draft.main;next.run.off=draft.off;next.run.bag=draft.bag;next.character.resources.equipmentShield=Math.min(next.character.resources.equipmentShield,gearShield(next,draft));});
 }
 // Arrival on a floor (a new character's first floor, or travel after a first clear): records the area instance from its
 // PR1 manifest, makes it the current area and its entrance the active checkpoint, all in one change. The existing
 // forward-transition recovery (+20% maximum health, +1 potion) is granted once per location for the whole campaign,
 // marked by the "recovery:<location>" story flag; repeat travel or reload never grants it again.
 function arrive(state,{manifest}={}){
  if(state.world.lifecycle.mode!=='alive')return fail('dead','cannot travel while dead');
  if(!manifest||!state.campaign.unlockedLocations.includes(manifest.locationId))return fail('locked','that location is not unlocked');
  const entered=G.enterArea(state,manifest);if(!entered.ok)return entered;
  const s=entered.state,loc=manifest.locationId,key=entered.instanceId,flag='recovery:'+loc;
  const recover=loc!==F.locations[0]&&!s.campaign.storyFlags.includes(flag);
  if(!recover&&s.world.currentInstanceId===key&&s.world.currentLocationId===loc&&s.campaign.activeCheckpointId===loc+':entrance')return {...entered,instanceId:key,recovered:null};
  return G.transition(s,next=>{
   next.world.currentLocationId=loc;next.world.currentInstanceId=key;next.campaign.activeCheckpointId=loc+':entrance';
   if(!recover)return {instanceId:key,recovered:null};
   const r=next.character.resources,max=next.stats.maxHp,hp=Math.min(max,r.hp+Math.round(max*.2)),potions=Math.min(E.balance.potions,next.run.potions+1);
   const recovered={hp:hp-r.hp,potions:potions-next.run.potions};r.hp=hp;next.run.potions=potions;next.campaign.storyFlags.push(flag);
   return {instanceId:key,recovered};
  });
 }
 // What a saved area looks like when it is rebuilt from its manifest: killed spawns, opened chests and ground drops.
 // A saved instance generated differently (another generator or layout) is refused rather than reinterpreted.
 function restorePlan(state,manifest){
  const key=C.instanceKey(manifest.locationId,manifest.seed,'campaign',0),inst=state.world.instances[key]||null;
  if(inst&&(inst.generatorVersion!==manifest.generatorVersion||inst.layoutHash!==manifest.layoutHash))return fail('area-mismatch','the saved area was generated differently');
  return {ok:true,instanceId:key,known:!!inst,killed:new Set(inst?.killed||[]),opened:new Set(inst?.opened||[]),drops:inst?inst.groundDrops.slice():[]};
 }
 // The saved floor seed of the current area, or null when the character has not arrived anywhere yet.
 function currentArea(state){
  const inst=state.world.currentInstanceId&&state.world.instances[state.world.currentInstanceId];
  return inst?{locationId:inst.locationId,floor:F.locations.indexOf(inst.locationId)+1,seed:inst.seed,instanceId:state.world.currentInstanceId}:{locationId:state.world.currentLocationId,floor:F.locations.indexOf(state.world.currentLocationId)+1,seed:null,instanceId:null};
 }

 // ---- session: one committed character, commands applied strictly in order
 // Runtime events (kills, pick-ups, chests, travel) are queued, never refused as busy: the enemy is already dead. Taps
 // (potion, ability) are refused while the same tap is still saving, so a double tap spends once. Every command first
 // folds in the latest runtime snapshot, so it is decided against current health and cooldowns, not stale ones.
 // A failed save halts the queue with that command at its head; nothing after it is applied until retry succeeds.
 // Each command's `publish(result)` runs synchronously as soon as it settles, before the next command samples the
 // runtime snapshot, so a committed effect (a reserved cooldown, a heal) is always in the runtime before anything later
 // can read it; a promise callback would run too late and let an older runtime value overwrite the committed one.
 function createSession({store,characterId,epoch,envelope,snapshot=()=>null,onStatus=()=>{}}){
  const k=K.createCoordinator({store,characterId,epoch,envelope,onStatus});
  // `orphaned`: commands a stale session can never save; kept (with the queue) so the emergency export still holds them.
  const queue=[],taps=new Set(),orphaned=[];let running=false,halted=false;
  const compose=fn=>state=>{
   const snap=applySnapshot(state,snapshot());if(!snap.ok)return snap;
   const r=fn(snap.state);if(!r||r.ok===false)return r||fail('invalid','no transition result');
   return !r.applied&&snap.applied?{...r,applied:true,state:snap.state}:r;
  };
  const blocked=r=>!r.ok&&(r.status==='failed'||r.status==='stale'||r.code==='save-failed'||r.code==='stale');
  const publish=(job,r)=>{if(job.publish)try{job.publish(r);}catch(_){/* a presentation error never stops the queue */}};
  function settle(job,r){queue.shift();if(job.tap)taps.delete(job.name);publish(job,r);job.resolve(r);}
  function orphan(r){const jobs=queue.splice(0);orphaned.push(...jobs);for(const j of jobs){if(j.tap)taps.delete(j.name);publish(j,r);j.resolve(r);}}
  async function pump(){
   if(running||halted)return;running=true;
   try{
    while(queue.length&&!halted){
     const job=queue[0],r=await k.run(job.name,compose(job.fn));
     if(blocked(r)){halted=true;if(k.status==='stale')orphan(r);break;}
     settle(job,r);
    }
   }finally{running=false;}
  }
  function enqueue(name,fn,{tap=false,publish=null}={}){
   if(k.status==='stale')return Promise.resolve(fail('stale','this session can no longer save; reload'));
   if(tap&&taps.has(name))return Promise.resolve(fail('busy','that command is still saving'));
   if(tap)taps.add(name);
   return new Promise(resolve=>{queue.push({name,fn,tap,publish,resolve});pump();});
  }
  // Retry the halted head command once; on success the rest of the queue continues in order.
  async function retry(){
   if(!halted||running)return fail('nothing-to-retry','no failed save to retry');
   running=true;let r;try{r=await k.retry();}finally{running=false;}
   if(blocked(r)){if(k.status==='stale')orphan(r);return r;}
   if(queue.length)settle(queue[0],r);halted=false;pump();return r;
  }
  // Emergency export of everything not yet saved: the committed state with every pending command (the failed head,
  // the commands queued behind it, or those a stale session could not save) applied in order, as pure transitions.
  // Nothing is written, acknowledged or removed from the queue. A command that no longer applies is skipped, exactly
  // as a retry would skip it. An explicit state (caller-held) is exported as given.
  function exportUnsaved(state){
   if(state)return k.exportUnsaved(state);
   const jobs=[...orphaned,...queue];if(!jobs.length)return k.exportUnsaved();
   let s=k.state,applied=0;
   for(const job of jobs){const r=compose(job.fn)(s);if(r&&r.ok&&r.applied){s=r.state;applied++;}}
   return (s===k.state?k.exportUnsaved():k.exportUnsaved(s)).then(r=>r.ok?{...r,pendingCommands:jobs.length,appliedCommands:applied}:r);
  }
  return Object.freeze({characterId,enqueue,retry,exportUnsaved,
   get state(){return k.state;},get revision(){return k.revision;},get status(){return k.status;},get label(){return k.label;},
   get hasUnsaved(){return k.hasUnsaved||queue.length>0||orphaned.length>0;},get pending(){return queue.length;},get halted(){return halted;}});
 }
 const api=Object.freeze({applySnapshot,respawn,syncRun,arrive,restorePlan,currentArea,createSession});
 if(node)module.exports=api;else window.VesperSession=api;
})();
