/* Pure campaign world state and once-only reward ledger (ARPG Phase 2 PR2, docs/arpg/SPEC.md section 6). It operates on
 * hydrated character state (character-state.js) using Phase 2 PR1 identities. No DOM, storage, renderer or combat:
 * loaded by the game through game-session.js (Phase 2 PR5). Every operation copies the state, applies the change, validates the whole result against
 * the save schema and returns a new state; the input is never mutated, so a rejected operation changes nothing.
 * Repeating an operation (replay, reload, double tap) is a no-op: `applied:false`, same state, nothing granted. */
(() => {
 'use strict';
 const node=typeof module!=='undefined';
 const C=node?require('./character-state.js'):window.VesperCharacter,E=node?require('./equipment.js'):window.VesperEquipment,F=node?require('./floors.js'):window.VesperFloors;
 const clone=v=>v===null||v===undefined?v:JSON.parse(JSON.stringify(v));
 const fail=(code,message,extra)=>({ok:false,code,message,...extra});
 const unchanged=state=>({ok:true,applied:false,state});
 const safeInt=(v,lo,hi)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi;
 const hash=text=>{let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0');};
 // Copy-on-write: plain records are cloned, frozen item instances are shared (they are immutable).
 function copy(s){
  const instances={};for(const [id,i] of Object.entries(s.world.instances))instances[id]={...i,killed:i.killed.slice(),opened:i.opened.slice(),groundDrops:i.groundDrops.map(d=>({...d}))};
  return {...s,character:clone(s.character),run:{...s.run,bag:s.run.bag.slice()},stash:s.stash.slice(),
   campaign:{...clone({...s.campaign,rewardEscrow:[]}),rewardEscrow:s.campaign.rewardEscrow.map(e=>({...e}))},
   world:{...clone({...s.world,instances:{}}),instances},legacy:clone(s.legacy)};
 }
 // The whole candidate must satisfy the save schema (ownership, ledger, identities, bounds) before it is returned.
 function finish(next,extra){
  next.stats=C.derivedStats(next.character);
  let payload;try{payload=C.dehydrate(next);}catch(e){return fail('invalid',e.message);}
  const check=C.validate(C.envelope(payload,{characterId:next.characterId||'00000000-0000-4000-8000-000000000000',revision:Math.max(1,next.revision||0),createdAt:'2026-01-01T00:00:00.000Z',savedAt:'2026-01-01T00:00:00.000Z',sessionId:'ledger',leaseEpoch:0}));
  return check.ok?{ok:true,applied:true,state:next,...extra}:fail(check.code||'invalid','the resulting state is invalid; nothing was changed',{errors:check.errors});
 }
 // Shared by other pure command modules (command-coordinator.js): copy, mutate, then validate the whole result.
 // `mutate(next)` returns a failure object to reject, or extra result fields (or nothing) to accept.
 function transition(state,mutate){
  const next=copy(state),extra=mutate(next);
  if(extra&&extra.ok===false)return extra;
  return finish(next,extra||undefined);
 }
 const instanceOf=(s,id)=>typeof id==='string'&&Object.hasOwn(s.world.instances,id)?s.world.instances[id]:null;
 const identityOf=inst=>F.instanceId(F.locations.indexOf(inst.locationId)+1,inst.seed);
 // Campaign-unique reward keys use the location and encounter, never the instance or epoch, so repopulating or
 // replaying an area can never earn the same once-only reward again (SPEC section 6).
 function campaignRewardKey(locationId,encounter='boss',kind='item'){
  if(!F.locations.includes(locationId))throw new RangeError('Unknown location');
  if(!/^[a-z]+$/.test(encounter)||!/^[a-z]+$/.test(kind))throw new RangeError('Invalid reward key part');
  return 'campaign:'+locationId+':'+encounter+':'+kind;
 }

 // Record an area instance from a Phase 2 PR1 manifest. Re-entering the same area is a no-op; a manifest whose generator
 // version or layout differs from the saved one is refused, because saved IDs would then name different entities.
 function enterArea(state,manifest,{mode='campaign',epoch=0}={}){
  if(!manifest||!F.locations.includes(manifest.locationId)||!safeInt(manifest.seed,0,0xffffffff))return fail('invalid','not an area manifest');
  if(!['campaign','replay'].includes(mode)||!safeInt(epoch,0,1e6))return fail('invalid','invalid mode or epoch');
  const key=C.instanceKey(manifest.locationId,manifest.seed,mode,epoch),existing=instanceOf(state,key);
  if(existing){
   if(existing.generatorVersion!==manifest.generatorVersion||existing.layoutHash!==manifest.layoutHash)return fail('area-mismatch','the saved area was generated differently; its IDs cannot be reused');
   return {...unchanged(state),instanceId:key};
  }
  if(Object.keys(state.world.instances).length>=C.limits.instances)return fail('instance-limit','too many saved areas');
  const next=copy(state);
  next.world.instances[key]={locationId:manifest.locationId,mode,seed:manifest.seed,generatorVersion:manifest.generatorVersion,layoutHash:manifest.layoutHash,epoch,killed:[],opened:[],groundDrops:[]};
  return finish(next,{instanceId:key});
 }
 // Drops are [{kind:'item',item,x,y} | {kind:'ash',amount,x,y} | {kind:'potion',amount:1,x,y}], resolved by the caller
 // with the existing loot tables. Their IDs are "<instance key>:<spawn|chest>:<n>:d<k>": scoped to the full saved
 // instance key (mode and epoch included), so the same initial enemy killed in a campaign instance and in replay
 // epochs leaves distinct drops that can all lie on the ground at once.
 function placeDrops(inst,instanceId,sourceId,drops){
  const source=sourceId.slice(identityOf(inst).length+1);
  if(!Array.isArray(drops)||drops.length>64)throw new RangeError('invalid drops');
  drops.forEach((d,n)=>{
   if(!d||!['item','ash','potion'].includes(d.kind))throw new RangeError('invalid drop kind');
   inst.groundDrops.push({dropId:instanceId+':'+source+':d'+n,kind:d.kind,item:d.kind==='item'?d.item:null,amount:d.kind==='item'?1:d.amount,x:d.x,y:d.y,rewardKey:null});
  });
 }
 function grantXp(c,xp){
  const before=c.level;c.lifetimeXp+=xp;const lv=C.levelFor(c.lifetimeXp);
  c.level=lv.level;c.xpIntoLevel=lv.xpIntoLevel;c.unspentSkillPoints+=C.pointsEarned(lv.level)-C.pointsEarned(before);
  return lv.level-before;
 }
 // An initial enemy dies: its killed marker, XP (including any level-ups and skill points) and drops form one change.
 // Summoned minions have no spawn ID and are never recorded.
 function recordKill(state,{instanceId,spawnId,xp=0,drops=[]}={}){
  const inst=instanceOf(state,instanceId);if(!inst)return fail('unknown-area','no such area instance');
  if(typeof spawnId!=='string')return fail('invalid','a spawn ID is required');
  if(inst.killed.includes(spawnId))return unchanged(state);
  if(!safeInt(xp,0,1e6))return fail('invalid','XP out of range');
  const next=copy(state),target=next.world.instances[instanceId];target.killed.push(spawnId);
  const levels=grantXp(next.character,xp);
  try{placeDrops(target,instanceId,spawnId,drops);}catch(e){return fail('invalid',e.message);}
  return finish(next,{levelsGained:levels});
 }
 function openChest(state,{instanceId,chestId,drops=[]}={}){
  const inst=instanceOf(state,instanceId);if(!inst)return fail('unknown-area','no such area instance');
  if(typeof chestId!=='string')return fail('invalid','a chest ID is required');
  if(inst.opened.includes(chestId))return unchanged(state);
  const next=copy(state),target=next.world.instances[instanceId];target.opened.push(chestId);
  try{placeDrops(target,instanceId,chestId,drops);}catch(e){return fail('invalid',e.message);}
  return finish(next);
 }
 // Pick up one ground drop. The item moves to the backpack (never copied); a full bag or full potion belt leaves the
 // drop where it is. A reward held on the ground becomes claimed in the ledger in the same change.
 function pickUp(state,{instanceId,dropId}={}){
  const inst=instanceOf(state,instanceId);if(!inst)return fail('unknown-area','no such area instance');
  const index=inst.groundDrops.findIndex(d=>d.dropId===dropId);if(index<0)return unchanged(state);
  const next=copy(state),target=next.world.instances[instanceId],drop=target.groundDrops[index];
  if(drop.kind==='item'){const slot=next.run.bag.indexOf(null);if(slot<0)return fail('bag-full','backpack full; the item stays on the ground');next.run.bag[slot]=drop.item;}
  else if(drop.kind==='ash')next.character.ash+=drop.amount;
  else{if(next.run.potions+drop.amount>E.balance.potions)return fail('potions-full','potion belt full; the potion stays on the ground');next.run.potions+=drop.amount;}
  target.groundDrops.splice(index,1);
  if(drop.rewardKey!==null)next.campaign.rewardLedger[drop.rewardKey]='claimed';
  return finish(next,{picked:drop.kind});
 }
 // The player drops a backpack item in an area: the same item moves to the ground (never copied), with the drop ID
 // "<instance key>:item:<item ID>". Picking it up again moves it back through pickUp.
 function dropItem(state,{instanceId,itemId,x,y}={}){
  const inst=instanceOf(state,instanceId);if(!inst)return fail('unknown-area','no such area instance');
  const index=state.run.bag.findIndex(i=>i&&i.id===itemId);if(index<0)return fail('missing','that item is not in the backpack');
  const next=copy(state),item=next.run.bag[index];next.run.bag[index]=null;
  next.world.instances[instanceId].groundDrops.push({dropId:instanceId+':item:'+item.id,kind:'item',item,amount:1,x,y,rewardKey:null});
  return finish(next);
 }
 // A once-only reward (for example a campaign boss item, generated once by the caller). If its key was ever granted it is
 // never granted again, whether it is still held or already claimed. It is held as a ground drop in an area, or in
 // reward escrow when no area is given, and is claimed by moving that same item later.
 function grantReward(state,{rewardKey,item,instanceId=null,x=0,y=0}={}){
  if(typeof rewardKey!=='string')return fail('invalid','a reward key is required');
  if(Object.hasOwn(state.campaign.rewardLedger,rewardKey))return unchanged(state);
  if(!item)return fail('invalid','a reward item is required');
  const next=copy(state);next.campaign.rewardLedger[rewardKey]='escrow';
  if(instanceId===null)next.campaign.rewardEscrow.push({rewardKey,item});
  else{
   const target=instanceOf(next,instanceId);if(!target)return fail('unknown-area','no such area instance');
   target.groundDrops.push({dropId:instanceId+':reward:'+hash(rewardKey),kind:'item',item,amount:1,x,y,rewardKey});
  }
  return finish(next);
 }
 function claimEscrow(state,{rewardKey}={}){
  const index=state.campaign.rewardEscrow.findIndex(e=>e.rewardKey===rewardKey);if(index<0)return unchanged(state);
  const next=copy(state),slot=next.run.bag.indexOf(null);if(slot<0)return fail('bag-full','backpack full; the reward stays in escrow');
  next.run.bag[slot]=next.campaign.rewardEscrow[index].item;next.campaign.rewardEscrow.splice(index,1);next.campaign.rewardLedger[rewardKey]='claimed';
  return finish(next);
 }
 // First clear of a location's final encounter (boss or elites, from the floor configuration). Records completion,
 // unlocks the next location in campaign order and marks the campaign complete after the Throne of Ash. Clearing again
 // is a no-op with firstClear:false, so first-clear-only effects (such as transition recovery) cannot repeat.
 function completeArea(state,{locationId}={}){
  const number=F.locations.indexOf(locationId)+1;if(!number)return fail('invalid','unknown location');
  if(!state.campaign.unlockedLocations.includes(locationId))return fail('locked','location is not unlocked');
  const kind=F.get(number).final,field=kind==='boss'?'bossCompletions':'eliteCompletions';
  if(state.campaign[field][locationId]===true)return {...unchanged(state),firstClear:false};
  const next=copy(state);next.campaign[field][locationId]=true;
  const nextLocation=F.locations[number]||null;
  if(nextLocation&&!next.campaign.unlockedLocations.includes(nextLocation))next.campaign.unlockedLocations.push(nextLocation);
  if(locationId==='throne-of-ash')next.campaign.campaignComplete=true;
  return finish(next,{firstClear:true,unlocked:nextLocation});
 }
 const api=Object.freeze({transition,campaignRewardKey,enterArea,recordKill,openChest,pickUp,dropItem,grantReward,claimEscrow,completeArea});
 if(node)module.exports=api;else window.VesperCampaign=api;
})();
