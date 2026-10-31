/* Critical gameplay commands committed atomically to the save repository (ARPG Phase 2 PR3, docs/arpg/SPEC.md section 5).
 * Each command computes its new state with a pure transition, commits it in one compare-and-swap save, and only then
 * publishes it: an aborted or refused write acknowledges nothing. A failed critical save pauses further commands with an
 * honest status instead of continuing unsaved. No DOM or renderer: not loaded by the game yet (wiring is Phase 2 PR5). */
(() => {
 'use strict';
 const node=typeof module!=='undefined';
 const C=node?require('./character-state.js'):window.VesperCharacter,G=node?require('./campaign-state.js'):window.VesperCampaign,
  E=node?require('./equipment.js'):window.VesperEquipment,A=node?require('./abilities.js'):window.VesperAbilities;
 const fail=(code,message)=>({ok:false,code,message});
 const alive=s=>s.world.lifecycle.mode==='alive';

 // ---- pure transitions (state in, new state out; the input is never mutated)
 // Potion: the belt decrement and the heal are one change, using the existing equipment rule (42% of maximum health).
 function drinkPotion(state){
  if(!alive(state))return fail('dead','cannot drink while dead');
  return G.transition(state,next=>{
   const healed=E.usePotion(next.run,next.character.resources.hp,next.stats.maxHp);
   if(!healed)return fail('unavailable',next.run.potions>0?'already at full health':'no potions left');
   next.character.resources.hp+=healed;
   return {healed};
  });
 }
 // Ability: reserve the full cooldown before the existing wind-up starts. A ready ability has a zero cooldown; reserving
 // never shortens one, and the temporary Aegis barrier is never part of saved state.
 function reserveAbility(state,id){
  if(typeof id!=='string'||!Object.hasOwn(A.definitions,id))return fail('invalid','unknown ability');
  if(!alive(state))return fail('dead','cannot use abilities while dead');
  if(state.character.timers.abilityCooldowns[id]>0)return fail('cooldown','ability is still recharging');
  return G.transition(state,next=>{next.character.timers.abilityCooldowns[id]=A.definitions[id].cooldown;return {cooldown:A.definitions[id].cooldown};});
 }
 // Death: recorded once per death ID with zero health; XP, items, ash and allocations are kept (no death penalty).
 // Recording the same death again is a no-op; a different death while one is pending is refused.
 function recordDeath(state,deathId){
  const l=state.world.lifecycle;
  if(l.mode==='dead-pending-respawn')return l.deathId===deathId?{ok:true,applied:false,state}:fail('already-dead','a different death is already pending');
  return G.transition(state,next=>{
   next.character.resources.hp=0;next.character.deaths+=1;
   next.world.lifecycle={mode:'dead-pending-respawn',deathId,lastRespawnId:l.lastRespawnId};
  });
 }
 // Campaign ledger commands from campaign-state.js, committed through the same path.
 const ledger=Object.freeze(['enterArea','recordKill','openChest','pickUp','grantReward','claimEscrow','completeArea']);

 // ---- coordinator: one committed state per character, one command at a time
 // Status: 'saved' | 'saving' | 'failed' (a retryable save failure; commands are paused until retry succeeds) |
 // 'stale' (another tab or revision took over; nothing more can be saved from this session until it reloads).
 const STALE=new Set(['fenced','conflict','exists','unsupported','corrupt']);
 function createCoordinator({store,characterId,epoch,envelope,onStatus=()=>{}}){
  const loaded=C.hydrate(envelope);if(!loaded.ok)throw new RangeError('cannot coordinate an invalid save: '+loaded.code);
  let state=loaded.state,revision=envelope.revision,status='saved',pending=false,failed=null;
  // Observers are notified after the outcome is settled; a throwing observer never changes a save result, never turns
  // a completed commit into a retryable failure and never leaves a command pending.
  const setStatus=(next,detail)=>{status=next;try{onStatus({status,...detail});}catch(_){/* observer errors are ignored */}};
  async function execute(name,args,transitionFn){
   if(pending)return fail('busy','another command is still saving');
   if(status==='stale')return fail('stale','this session can no longer save; reload');
   if(status==='failed')return fail('save-failed','saving failed; retry before continuing');
   const r=transitionFn(state);
   if(!r.ok||!r.applied)return r; // refused or a no-op: nothing to save, nothing changes
   pending=true;let saved;
   try{
    setStatus('saving',{command:name});
    saved=await store.commit(characterId,C.dehydrate(r.state),{expectedRevision:revision,epoch});
   }catch(e){saved={ok:false,code:'storage',message:e?.message};}
   finally{pending=false;}
   if(!saved.ok){
    failed={name,args};
    setStatus(STALE.has(saved.code)?'stale':'failed',{command:name,code:saved.code,message:saved.message});
    return {ok:false,code:saved.code,message:saved.message,status};
   }
   state=r.state;revision=saved.revision;failed=null;setStatus('saved',{command:name,revision});
   const {state:_,...extra}=r;return {...extra,state};
  }
  const commands={
   drinkPotion:()=>execute('drinkPotion',[],s=>drinkPotion(s)),
   reserveAbility:id=>execute('reserveAbility',[id],s=>reserveAbility(s,id)),
   recordDeath:deathId=>execute('recordDeath',[deathId],s=>recordDeath(s,deathId)),
   ledger:(name,args)=>ledger.includes(name)?execute(name,[args],s=>G[name](s,args)):Promise.resolve(fail('invalid','unknown ledger command'))
  };
  // Retry re-runs the failed command against the last committed state; a stale session cannot retry.
  async function retry(){
   if(status!=='failed'||!failed)return fail('nothing-to-retry','no failed save to retry');
   const {name,args}=failed;status='saved';
   return ledger.includes(name)?commands.ledger(name,args[0]):commands[name](...args);
  }
  return Object.freeze({...commands,retry,get state(){return state;},get revision(){return revision;},get status(){return status;},get pending(){return pending;}});
 }
 const api=Object.freeze({drinkPotion,reserveAbility,recordDeath,ledger,createCoordinator});
 if(node)module.exports=api;else window.VesperCommands=api;
})();
