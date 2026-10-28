/* Persistent character save schema (proposed v1, docs/arpg/SPEC.md section 4): pure validation, item hydration,
 * derived stats and migrations. No DOM, storage or renderer. ARPG Phase 1A: not loaded by the game yet. */
(() => {
 'use strict';
 const node=typeof module!=='undefined';
 const E=node?require('./equipment.js'):window.VesperEquipment,A=node?require('./abilities.js'):window.VesperAbilities;
 const SCHEMA_VERSION=1,CONTENT_VERSION='campaign-1',PROGRESSION_VERSION=1;
 const deepFreeze=o=>{Object.values(o).forEach(v=>v&&typeof v==='object'&&deepFreeze(v));return Object.freeze(o);};
 // Bounds refuse oversized candidates before hydration; exceeding them never discards data.
 const limits=deepFreeze({items:4096,stash:24,instances:6,groundDrops:1024,escrow:256,flags:512,quests:256,journal:512,ledger:4096,idLength:96,itemId:1e12,textLength:4000,ash:1e9,xp:1e12,deaths:1e9,cooldownSlack:1e-9});
 const locations=Object.freeze(['forgotten-crypt','plague-halls','crimson-chapel','hollow-sanctum','throne-of-ash']);
 const bossLocations=Object.freeze(['forgotten-crypt','crimson-chapel','throne-of-ash']),eliteLocations=Object.freeze(['plague-halls','hollow-sanctum']);
 const abilityIds=Object.freeze(Object.keys(A.definitions));
 // Proposed defaults awaiting owner balance approval (SPEC section 8). The core profile equals startGame()'s current hero.
 const progression=deepFreeze({
  version:PROGRESSION_VERSION,levelCap:30,firstThreshold:48,growth:1.24,step:16,hpPerLevel:5,damagePerLevel:1,pointsPerLevel:1,maxSpeed:5.2,
  core:{'penitent-v1':{maxHp:115,damage:30,speed:3.9,range:1.7,arc:1.06,attackRate:.36,dashCd:2.2,crit:0}},
  passives:{vigor:{name:'Vigor',max:5,maxHp:5},edge:{name:'Tempered Edge',max:5,damage:1},focus:{name:'Watcher’s Focus',max:5,crit:.01},stride:{name:'Pilgrim’s Stride',max:5,speed:.02}},
  abilityUpgrades:{} // Ability upgrades need separate approval; no rank is valid in progression v1.
 });
 const thresholds=(()=>{const out=[0,progression.firstThreshold];for(let l=2;l<progression.levelCap;l++)out.push(Math.round(out[l-1]*progression.growth+progression.step));return Object.freeze(out);})();
 // thresholds[l] is the XP needed to advance from level l; the cap retains overflow as lifetime XP.
 function levelFor(lifetimeXp){let level=1,rest=lifetimeXp;while(level<progression.levelCap&&rest>=thresholds[level]){rest-=thresholds[level];level++;}return {level,xpIntoLevel:rest,xpNeeded:level<progression.levelCap?thresholds[level]:0};}
 const pointsEarned=level=>(level-1)*progression.pointsPerLevel;
 const pointsSpent=c=>Object.values(c.passiveRanks).reduce((n,r)=>n+r,0)+Object.values(c.abilityUpgradeRanks).reduce((n,r)=>n+r,0);
 // Intrinsic stats are always recomputed from rules; equipment totals are applied later by E.stats and never stored here.
 function derivedStats(c){
  const core=progression.core[c.coreProfile],levels=c.level-1,r=k=>c.passiveRanks[k]||0,p=progression.passives;
  return Object.freeze({maxHp:core.maxHp+levels*progression.hpPerLevel+r('vigor')*p.vigor.maxHp,damage:core.damage+levels*progression.damagePerLevel+r('edge')*p.edge.damage,speed:Math.min(progression.maxSpeed,core.speed*(1+r('stride')*p.stride.speed)),range:core.range,arc:core.arc,attackRate:core.attackRate,dashCd:core.dashCd,crit:Math.min(.7,core.crit+r('focus')*p.focus.crit)});
 }

 // ---- validation helpers: every record is allowlisted; nothing from a candidate is spread into live state.
 const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
 const safeInt=(v,lo=0,hi=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi;
 const finite=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
 const idText=v=>typeof v==='string'&&v.length>0&&v.length<=limits.idLength&&/^[A-Za-z0-9:._-]+$/.test(v);
 const text=v=>typeof v==='string'&&v.length<=limits.textLength;
 const isoTime=v=>typeof v==='string'&&v.length<=40&&!Number.isNaN(Date.parse(v));
 function checker(){
  const errors=[];
  const fail=(path,message)=>{if(errors.length<64)errors.push({path,message});return false;};
  const shape=(v,path,keys)=>{if(!plain(v))return fail(path,'must be an object');const extra=Object.keys(v).filter(k=>!keys.includes(k)),missing=keys.filter(k=>!(k in v));if(extra.length)fail(path,'unknown field '+extra[0]);if(missing.length)fail(path,'missing field '+missing[0]);return !extra.length&&!missing.length;};
  const map=(v,path,max,each)=>{if(!plain(v))return fail(path,'must be an object');const keys=Object.keys(v);if(keys.length>max)return fail(path,'too many entries');keys.forEach(k=>idText(k)&&!(k in Object.prototype)?each(k,v[k],path+'.'+k):fail(path,'invalid key'));return true;};
  const list=(v,path,max,each,exact)=>{if(!Array.isArray(v))return fail(path,'must be an array');if(exact!==undefined?v.length!==exact:v.length>max)return fail(path,exact!==undefined?'must have exactly '+exact+' slots':'too many entries');v.forEach((x,i)=>each(x,path+'['+i+']',i));return true;};
  const uniqueStrings=(v,path,max,valid=idText)=>list(v,path,max,(x,p)=>valid(x)||fail(p,'invalid value'))&&(new Set(v).size===v.length||fail(path,'duplicate values'));
  return {errors,fail,shape,map,list,uniqueStrings};
 }

 function validateCharacter(c,k,itemsById,owners){
  if(!k.shape(c,'character',['level','lifetimeXp','xpIntoLevel','unspentSkillPoints','coreProfile','passiveRanks','abilityUpgradeRanks','resources','timers','ash','deaths','equipment','backpack','stash','nextItemId','abilityUnlocks']))return;
  if(!safeInt(c.lifetimeXp,0,limits.xp))k.fail('character.lifetimeXp','must be a bounded non-negative integer');
  else{const d=levelFor(c.lifetimeXp);if(c.level!==d.level)k.fail('character.level','does not match lifetime XP');if(c.xpIntoLevel!==d.xpIntoLevel)k.fail('character.xpIntoLevel','does not match lifetime XP');}
  if(!progression.core[c.coreProfile])k.fail('character.coreProfile','unknown core profile');
  k.map(c.passiveRanks,'character.passiveRanks',8,(id,rank,p)=>progression.passives[id]?safeInt(rank,1,progression.passives[id].max)||k.fail(p,'rank out of range'):k.fail(p,'unknown passive'));
  k.map(c.abilityUpgradeRanks,'character.abilityUpgradeRanks',8,(id,rank,p)=>progression.abilityUpgrades[id]?safeInt(rank,1,progression.abilityUpgrades[id].max)||k.fail(p,'rank out of range'):k.fail(p,'ability upgrades are not approved'));
  if(!safeInt(c.unspentSkillPoints,0,progression.levelCap))k.fail('character.unspentSkillPoints','must be a bounded non-negative integer');
  else if(safeInt(c.level,1,progression.levelCap)&&plain(c.passiveRanks)&&plain(c.abilityUpgradeRanks)&&Object.values(c.passiveRanks).every(Number.isSafeInteger)&&Object.values(c.abilityUpgradeRanks).every(Number.isSafeInteger)&&pointsSpent(c)+c.unspentSkillPoints!==pointsEarned(c.level))k.fail('character.unspentSkillPoints','spent plus unspent points must equal points earned');
  if(!safeInt(c.ash,0,limits.ash))k.fail('character.ash','must be a bounded non-negative integer');
  if(!safeInt(c.deaths,0,limits.deaths))k.fail('character.deaths','must be a bounded non-negative integer');
  if(!Array.isArray(c.abilityUnlocks)||c.abilityUnlocks.length!==abilityIds.length||!abilityIds.every(id=>c.abilityUnlocks.includes(id)))k.fail('character.abilityUnlocks','all three existing abilities stay unlocked');
  if(k.shape(c.timers,'character.timers',['abilityCooldowns','attackRemaining','dodgeRemaining','firePassiveRemaining','shieldDelay'])){
   if(k.shape(c.timers.abilityCooldowns,'character.timers.abilityCooldowns',abilityIds))for(const id of abilityIds)finite(c.timers.abilityCooldowns[id],0,A.definitions[id].cooldown+limits.cooldownSlack)||k.fail('character.timers.abilityCooldowns.'+id,'out of range');
   finite(c.timers.attackRemaining,0,2)||k.fail('character.timers.attackRemaining','out of range');
   finite(c.timers.dodgeRemaining,0,progression.core['penitent-v1'].dashCd)||k.fail('character.timers.dodgeRemaining','out of range');
   finite(c.timers.firePassiveRemaining,0,E.balance.fireCooldown)||k.fail('character.timers.firePassiveRemaining','out of range');
   finite(c.timers.shieldDelay,0,E.balance.shieldDelay)||k.fail('character.timers.shieldDelay','out of range');
  }
  if(!safeInt(c.nextItemId,1,limits.itemId))k.fail('character.nextItemId','must be a positive integer within the item ID range');
  const owner=(id,path)=>{if(id===null)return;if(!safeInt(id,1))return k.fail(path,'must be an item ID or null');if(!itemsById.has(id))return k.fail(path,'references a missing item');owners.push({id,path});};
  if(k.shape(c.equipment,'character.equipment',['main','off'])){owner(c.equipment.main,'character.equipment.main');owner(c.equipment.off,'character.equipment.off');}
  k.list(c.backpack,'character.backpack',0,owner,E.balance.capacity);
  k.list(c.stash,'character.stash',0,owner,limits.stash);
 }

 function validateCampaign(m,k,itemsById,owners,rewards){
  if(!k.shape(m,'campaign',['unlockedLocations','activeCheckpointId','campaignComplete','bossCompletions','eliteCompletions','questStates','storyFlags','journalEntries','rewardLedger','rewardEscrow']))return [];
  const unlocked=Array.isArray(m.unlockedLocations)?m.unlockedLocations:[];
  // Locations unlock in campaign order, so the unlocked list is always a prefix of the five floors.
  if(!Array.isArray(m.unlockedLocations)||!unlocked.length||unlocked.length>locations.length||unlocked.some((id,i)=>id!==locations[i]))k.fail('campaign.unlockedLocations','must be the campaign prefix starting with forgotten-crypt');
  if(typeof m.activeCheckpointId!=='string'||!unlocked.some(id=>m.activeCheckpointId===id+':entrance'))k.fail('campaign.activeCheckpointId','must be the entrance of an unlocked location');
  const completion=(v,path,allowed)=>k.map(v,path,allowed.length,(id,done,p)=>!allowed.includes(id)?k.fail(p,'not an encounter location'):!unlocked.includes(id)?k.fail(p,'location is not unlocked'):done===true||k.fail(p,'must be true'));
  completion(m.bossCompletions,'campaign.bossCompletions',bossLocations);completion(m.eliteCompletions,'campaign.eliteCompletions',eliteLocations);
  if(typeof m.campaignComplete!=='boolean')k.fail('campaign.campaignComplete','must be boolean');
  else if(m.campaignComplete!==(plain(m.bossCompletions)&&m.bossCompletions['throne-of-ash']===true))k.fail('campaign.campaignComplete','must match the Throne of Ash completion');
  // A location after the first can only be unlocked once the previous one has been completed.
  unlocked.slice(1).forEach((id,i)=>{const prev=locations[i],done=(plain(m.bossCompletions)&&m.bossCompletions[prev])||(plain(m.eliteCompletions)&&m.eliteCompletions[prev]);if(!done)k.fail('campaign.unlockedLocations',id+' is unlocked before '+prev+' was completed');});
  k.map(m.questStates,'campaign.questStates',limits.quests,(id,state,p)=>['active','complete'].includes(state)||k.fail(p,'must be active or complete'));
  k.uniqueStrings(m.storyFlags,'campaign.storyFlags',limits.flags);
  if(k.list(m.journalEntries,'campaign.journalEntries',limits.journal,(e,p)=>{if(k.shape(e,p,['id','title','text'])){idText(e.id)||k.fail(p+'.id','invalid');text(e.title)||k.fail(p+'.title','invalid');text(e.text)||k.fail(p+'.text','invalid');}})&&new Set(m.journalEntries.map(e=>e?.id)).size!==m.journalEntries.length)k.fail('campaign.journalEntries','duplicate entry IDs');
  k.map(m.rewardLedger,'campaign.rewardLedger',limits.ledger,(id,state,p)=>['escrow','claimed'].includes(state)||k.fail(p,'must be escrow or claimed'));
  k.list(m.rewardEscrow,'campaign.rewardEscrow',limits.escrow,(e,p)=>{if(!k.shape(e,p,['rewardKey','itemId']))return;if(!idText(e.rewardKey))return k.fail(p+'.rewardKey','invalid');rewards.push({key:e.rewardKey,path:p+'.rewardKey'});if(!plain(m.rewardLedger)||m.rewardLedger[e.rewardKey]!=='escrow')k.fail(p+'.rewardKey','ledger must mark escrowed rewards as escrow');if(!safeInt(e.itemId,1)||!itemsById.has(e.itemId))return k.fail(p+'.itemId','references a missing item');owners.push({id:e.itemId,path:p+'.itemId'});});
  return unlocked;
 }

 function validateWorld(w,k,itemsById,owners,rewards,unlocked,hp,rewardLedger){
  if(!k.shape(w,'world',['lifecycle','currentLocationId','currentInstanceId','pendingTransition','checkpoints','locations','instances']))return;
  if(k.shape(w.lifecycle,'world.lifecycle',['mode','deathId','lastRespawnId'])){
   const l=w.lifecycle;
   if(l.mode==='alive'){if(!(hp>0))k.fail('world.lifecycle.mode','a living character needs health above zero');if(l.deathId!==null)k.fail('world.lifecycle.deathId','must be null while alive');}
   else if(l.mode==='dead-pending-respawn'){if(hp!==0)k.fail('world.lifecycle.mode','a pending respawn stores zero health');if(!idText(l.deathId))k.fail('world.lifecycle.deathId','a pending respawn needs a death ID');}
   else k.fail('world.lifecycle.mode','must be alive or dead-pending-respawn');
   if(l.lastRespawnId!==null&&!idText(l.lastRespawnId))k.fail('world.lifecycle.lastRespawnId','invalid');
  }
  if(!unlocked.includes(w.currentLocationId))k.fail('world.currentLocationId','must be an unlocked location');
  // Travel, checkpoint and area-manifest records arrive with Phases 2–3; schema v1 accepts only their empty forms.
  if(w.pendingTransition!==null)k.fail('world.pendingTransition','travel transitions are not supported by schema v1');
  if(!plain(w.checkpoints)||Object.keys(w.checkpoints).length)k.fail('world.checkpoints','must be empty in schema v1');
  if(!plain(w.locations)||Object.keys(w.locations).length)k.fail('world.locations','must be empty in schema v1');
  const dropIds=new Set();
  k.map(w.instances,'world.instances',limits.instances,(id,inst,p)=>{
   if(!k.shape(inst,p,['locationId','mode','groundDrops']))return;
   if(!unlocked.includes(inst.locationId))k.fail(p+'.locationId','must be an unlocked location');
   if(!['campaign','replay'].includes(inst.mode))k.fail(p+'.mode','must be campaign or replay');
   k.list(inst.groundDrops,p+'.groundDrops',limits.groundDrops,(d,dp)=>{
    if(!k.shape(d,dp,['dropId','kind','itemId','amount','x','y','rewardKey']))return;
    if(!idText(d.dropId))k.fail(dp+'.dropId','invalid');else if(dropIds.has(d.dropId))k.fail(dp+'.dropId','duplicate drop ID');else dropIds.add(d.dropId);
    if(!finite(d.x,-1024,1024)||!finite(d.y,-1024,1024))k.fail(dp,'position out of range');
    if(d.rewardKey!==null&&!idText(d.rewardKey))k.fail(dp+'.rewardKey','invalid');else if(d.rewardKey!==null)rewards.push({key:d.rewardKey,path:dp+'.rewardKey'});
    if(d.rewardKey!==null&&(!plain(rewardLedger)||rewardLedger[d.rewardKey]!=='escrow'))k.fail(dp+'.rewardKey','ledger must mark a dropped reward as escrow');
    if(d.kind==='item'){if(d.amount!==1)k.fail(dp+'.amount','item drops have amount 1');if(!safeInt(d.itemId,1)||!itemsById.has(d.itemId))return k.fail(dp+'.itemId','references a missing item');owners.push({id:d.itemId,path:dp+'.itemId'});}
    else if(d.kind==='ash'||d.kind==='potion'){if(d.itemId!==null)k.fail(dp+'.itemId','must be null');if(!safeInt(d.amount,1,d.kind==='ash'?limits.ash:E.balance.potions))k.fail(dp+'.amount','out of range');}
    else k.fail(dp+'.kind','must be item, ash or potion');
   });
  });
  if(w.currentInstanceId!==null&&!(plain(w.instances)&&w.instances[w.currentInstanceId]?.locationId===w.currentLocationId))k.fail('world.currentInstanceId','must name an instance of the current location');
 }

 // Returns {ok, code, errors}. code is 'unsupported' for a future or unknown version: such saves are read-only, never overwritten.
 function validate(envelope){
  const k=checker();
  if(!plain(envelope))return {ok:false,code:'invalid',errors:[{path:'',message:'save must be an object'}]};
  if(envelope.schemaVersion!==SCHEMA_VERSION||envelope.contentVersion!==CONTENT_VERSION||envelope.progressionVersion!==PROGRESSION_VERSION){
   const future=safeInt(envelope.schemaVersion,SCHEMA_VERSION+1)||safeInt(envelope.progressionVersion,PROGRESSION_VERSION+1)||typeof envelope.contentVersion==='string'&&envelope.contentVersion!==CONTENT_VERSION;
   return {ok:false,code:future?'unsupported':'invalid',errors:[{path:'schemaVersion',message:future?'saved by a newer or different game version':'unknown save version'}]};
  }
  if(!k.shape(envelope,'',['schemaVersion','contentVersion','progressionVersion','characterId','revision','createdAt','savedAt','writer','integrity','payload']))return {ok:false,code:'invalid',errors:k.errors};
  if(!/^[A-Za-z0-9-]{8,64}$/.test(String(envelope.characterId)))k.fail('characterId','invalid');
  if(!safeInt(envelope.revision,1))k.fail('revision','must be a positive safe integer');
  if(!isoTime(envelope.createdAt))k.fail('createdAt','must be a timestamp');if(!isoTime(envelope.savedAt))k.fail('savedAt','must be a timestamp');
  if(k.shape(envelope.writer,'writer',['sessionId','leaseEpoch'])){idText(envelope.writer.sessionId)||k.fail('writer.sessionId','invalid');safeInt(envelope.writer.leaseEpoch)||k.fail('writer.leaseEpoch','invalid');}
  if(envelope.integrity!==null&&k.shape(envelope.integrity,'integrity',['algorithm','digest'])){envelope.integrity.algorithm==='SHA-256'||k.fail('integrity.algorithm','unsupported');/^[0-9a-f]{64}$/.test(String(envelope.integrity.digest))||k.fail('integrity.digest','invalid');}
  validatePayload(envelope.payload,k);
  return {ok:!k.errors.length,code:k.errors.length?'invalid':null,errors:k.errors};
 }
 function validatePayload(p,k){
  if(!k.shape(p,'payload',['character','items','campaign','world','legacy']))return;
  const itemsById=new Map(),owners=[],rewards=[];
  k.list(p.items,'items',limits.items,(it,path)=>{
   if(!k.shape(it,path,['id','key','mods','upgradeRank']))return;
   if(!safeInt(it.id,1,limits.itemId-1))return k.fail(path+'.id','must be a positive integer within the item ID range');
   if(itemsById.has(it.id))return k.fail(path+'.id','duplicate item ID '+it.id);
   // Invalid gear rejects the whole candidate: never reroll, clamp or silently delete it.
   if(typeof it.key!=='string'||!Object.hasOwn(E.definitions,it.key))k.fail(path+'.key','unknown item');else if(!Array.isArray(it.mods)||!it.mods.every(m=>plain(m)&&Object.keys(m).length===2&&'stat'in m&&'value'in m)||!E.validModifiers(it.key,it.mods))k.fail(path+'.mods','invalid modifiers');
   if(it.upgradeRank!==0)k.fail(path+'.upgradeRank','upgrades are not available in progression v1');
   itemsById.set(it.id,it);
  });
  if(plain(p.character))validateCharacter(p.character,k,itemsById,owners);else k.fail('character','must be an object');
  const unlocked=plain(p.campaign)?validateCampaign(p.campaign,k,itemsById,owners,rewards):(k.fail('campaign','must be an object'),[]);
  const c=plain(p.character)?p.character:{},hp=plain(c.resources)?c.resources.hp:undefined;
  validateWorld(p.world,k,itemsById,owners,rewards,unlocked,hp,plain(p.campaign)?p.campaign.rewardLedger:null);
  // Ownership graph: every item has exactly one owner reference across hands, bag, stash, ground and escrow.
  const seen=new Map();for(const o of owners){if(seen.has(o.id))k.fail(o.path,'item '+o.id+' is also owned at '+seen.get(o.id));else seen.set(o.id,o.path);}
  for(const id of itemsById.keys())if(!seen.has(id))k.fail('items','item '+id+' has no owner');
  // A once-only reward held in escrow exists exactly once, either in reward escrow or as one ground drop.
  const held=new Map();for(const r of rewards){if(held.has(r.key))k.fail(r.path,'reward '+r.key+' is also held at '+held.get(r.key));else held.set(r.key,r.path);}
  if(plain(p.campaign)&&plain(p.campaign.rewardLedger))for(const [key,state] of Object.entries(p.campaign.rewardLedger))if(state==='escrow'&&!held.has(key))k.fail('campaign.rewardLedger.'+key,'an escrowed reward must be held in escrow or on the ground');
  const maxId=Math.max(0,...itemsById.keys());if(safeInt(c.nextItemId,1)&&c.nextItemId<=maxId)k.fail('character.nextItemId','must exceed every allocated item ID');
  if(!k.errors.length){
   const run=hydrateRun(c,itemsById,()=>null);
   if(!E.valid(run))k.fail('character.equipment','invalid loadout');
   if(k.shape(c.resources,'character.resources',['hp','equipmentShield','potions'])){
    const derived=derivedStats(c),gear=E.stats({damage:derived.damage,attackRate:derived.attackRate,crit:derived.crit},run);
    finite(c.resources.hp,0,derived.maxHp)||k.fail('character.resources.hp','out of range for derived maximum health');
    finite(c.resources.equipmentShield,0,gear.shield)||k.fail('character.resources.equipmentShield','exceeds the equipped shield capacity');
    safeInt(c.resources.potions,0,E.balance.potions)||k.fail('character.resources.potions','out of range');
   }
  }
  if(p.legacy!==null&&k.shape(p.legacy,'legacy',['migrationId','bestKills','narrativeMemories','sourceFingerprint'])){idText(p.legacy.migrationId)||k.fail('legacy.migrationId','invalid');safeInt(p.legacy.bestKills,0,limits.deaths)||k.fail('legacy.bestKills','invalid');k.list(p.legacy.narrativeMemories,'legacy.narrativeMemories',limits.journal,(m,mp)=>text(m)||k.fail(mp,'invalid'));/^[0-9a-f]{0,64}$/.test(String(p.legacy.sourceFingerprint))||k.fail('legacy.sourceFingerprint','invalid');}
 }
 // Plain records → frozen E.* instances. `make` is E.restore for real hydration, or a stub for validation.
 function hydrateRun(c,itemsById,make){const get=id=>id===null?null:make(itemsById.get(id))||{id,key:itemsById.get(id).key,mods:itemsById.get(id).mods};return {main:get(c.equipment.main),off:get(c.equipment.off),bag:c.backpack.map(get),potions:c.resources?.potions};}

 const clone=v=>JSON.parse(JSON.stringify(v));
 // Validated envelope → live state. Nothing is touched unless the whole candidate is valid; the ID allocator is reserved
 // at the durable high-water mark before any instance is rebuilt, and no instance is ever given a replacement ID.
 function hydrate(envelope){
  const result=validate(envelope);if(!result.ok)return {ok:false,code:result.code,errors:result.errors};
  const p=envelope.payload,itemsById=new Map(p.items.map(i=>[i.id,i])),built=new Map();
  E.reserve(p.character.nextItemId);
  const make=record=>{if(!built.has(record.id))built.set(record.id,E.restore(record));return built.get(record.id);},get=id=>id===null?null:make(itemsById.get(id));
  const c=clone(p.character),campaign=clone(p.campaign),world=clone(p.world);
  const run=hydrateRun(c,itemsById,make);
  campaign.rewardEscrow=campaign.rewardEscrow.map(e=>({rewardKey:e.rewardKey,item:get(e.itemId)}));
  for(const inst of Object.values(world.instances))inst.groundDrops=inst.groundDrops.map(d=>({dropId:d.dropId,kind:d.kind,item:d.kind==='item'?get(d.itemId):null,amount:d.amount,x:d.x,y:d.y,rewardKey:d.rewardKey}));
  const character={level:c.level,lifetimeXp:c.lifetimeXp,xpIntoLevel:c.xpIntoLevel,unspentSkillPoints:c.unspentSkillPoints,coreProfile:c.coreProfile,passiveRanks:c.passiveRanks,abilityUpgradeRanks:c.abilityUpgradeRanks,resources:{hp:c.resources.hp,equipmentShield:c.resources.equipmentShield},timers:c.timers,ash:c.ash,deaths:c.deaths,abilityUnlocks:c.abilityUnlocks};
  return {ok:true,state:{characterId:envelope.characterId,revision:envelope.revision,createdAt:envelope.createdAt,character,run,stash:c.stash.map(get),campaign,world,legacy:clone(p.legacy),stats:derivedStats(c)}};
 }
 // Live state → canonical payload. The items table is rebuilt from current owners, so an item can never be written twice.
 function dehydrate(state){
  const items=new Map(),ref=(i,path)=>{if(!i)return null;const seen=items.get(i.id);if(seen&&seen.item!==i)throw new RangeError('Two different items share ID '+i.id);if(seen)throw new RangeError('Item '+i.id+' is owned twice ('+seen.path+', '+path+')');items.set(i.id,{item:i,path});return i.id;};
  const c=state.character,run=state.run;
  const character={level:c.level,lifetimeXp:c.lifetimeXp,xpIntoLevel:c.xpIntoLevel,unspentSkillPoints:c.unspentSkillPoints,coreProfile:c.coreProfile,passiveRanks:clone(c.passiveRanks),abilityUpgradeRanks:clone(c.abilityUpgradeRanks),resources:{hp:c.resources.hp,equipmentShield:c.resources.equipmentShield,potions:run.potions},timers:clone(c.timers),ash:c.ash,deaths:c.deaths,equipment:{main:ref(run.main,'main'),off:ref(run.off,'off')},backpack:run.bag.map((i,n)=>ref(i,'backpack '+n)),stash:state.stash.map((i,n)=>ref(i,'stash '+n)),nextItemId:0,abilityUnlocks:c.abilityUnlocks.slice()};
  const campaign={...clone({...state.campaign,rewardEscrow:[]}),rewardEscrow:state.campaign.rewardEscrow.map(e=>({rewardKey:e.rewardKey,itemId:ref(e.item,'escrow '+e.rewardKey)}))};
  const instances={};for(const [id,inst] of Object.entries(state.world.instances))instances[id]={locationId:inst.locationId,mode:inst.mode,groundDrops:inst.groundDrops.map(d=>({dropId:d.dropId,kind:d.kind,itemId:d.kind==='item'?ref(d.item,'drop '+d.dropId):null,amount:d.amount,x:d.x,y:d.y,rewardKey:d.rewardKey}))};
  const world={...clone({...state.world,instances:{}}),instances};
  const ordered=[...items.values()].map(({item:i})=>({id:i.id,key:i.key,mods:i.mods.map(m=>({stat:m.stat,value:m.value})),upgradeRank:0})).sort((a,b)=>a.id-b.id);
  character.nextItemId=Math.max(E.nextId(),...ordered.map(i=>i.id+1),1);
  return {character,items:ordered,campaign,world,legacy:state.legacy===null?null:clone(state.legacy)};
 }
 function envelope(payload,meta){return {schemaVersion:SCHEMA_VERSION,contentVersion:CONTENT_VERSION,progressionVersion:PROGRESSION_VERSION,characterId:meta.characterId,revision:meta.revision,createdAt:meta.createdAt,savedAt:meta.savedAt,writer:{sessionId:meta.sessionId,leaseEpoch:meta.leaseEpoch},integrity:null,payload};}
 // A new character: the same starter hero, gear and potions as startGame(), at the Crypt entrance checkpoint.
 function create(){
  const run=E.createRun(),core=progression.core['penitent-v1'],shield=E.definition(run.off)?.shield||0;
  return {characterId:null,revision:0,createdAt:null,character:{level:1,lifetimeXp:0,xpIntoLevel:0,unspentSkillPoints:0,coreProfile:'penitent-v1',passiveRanks:{},abilityUpgradeRanks:{},resources:{hp:core.maxHp,equipmentShield:shield},timers:{abilityCooldowns:{execution:0,aegis:0,stunning:0},attackRemaining:0,dodgeRemaining:0,firePassiveRemaining:0,shieldDelay:0},ash:0,deaths:0,abilityUnlocks:abilityIds.slice()},run,stash:Array(limits.stash).fill(null),
   campaign:{unlockedLocations:['forgotten-crypt'],activeCheckpointId:'forgotten-crypt:entrance',campaignComplete:false,bossCompletions:{},eliteCompletions:{},questStates:{},storyFlags:[],journalEntries:[],rewardLedger:{},rewardEscrow:[]},
   world:{lifecycle:{mode:'alive',deathId:null,lastRespawnId:null},currentLocationId:'forgotten-crypt',currentInstanceId:null,pendingTransition:null,checkpoints:{},locations:{},instances:{}},legacy:null,stats:derivedStats({level:1,coreProfile:'penitent-v1',passiveRanks:{}})};
 }
 // Sorted-key JSON: the byte form the save store digests, so key order never changes an integrity check.
 function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}

 // Pure N→N+1 migrations, each validated before and after; the input is never mutated. Schema 1 has no predecessor:
 // until Phase 2 enables persistence no save exists, so schema 1 is amended in place rather than migrated.
 const migrations=Object.freeze({});
 function migrate(input,plan={}){
  const target=plan.target??SCHEMA_VERSION,steps=plan.steps??migrations,validators=plan.validators??{[SCHEMA_VERSION]:validate};
  if(!plain(input)||!safeInt(input.schemaVersion,1))return {ok:false,code:'invalid',errors:[{path:'schemaVersion',message:'unknown save version'}]};
  if(input.schemaVersion>target)return {ok:false,code:'unsupported',errors:[{path:'schemaVersion',message:'saved by a newer game version'}]};
  let current=clone(input);const from=current.schemaVersion;
  while(current.schemaVersion<target){
   const v=current.schemaVersion,before=validators[v]?.(current);
   if(!before?.ok)return {ok:false,code:'invalid',errors:before?.errors||[{path:'schemaVersion',message:'no validator for version '+v}]};
   if(!steps[v])return {ok:false,code:'invalid',errors:[{path:'schemaVersion',message:'no migration from version '+v}]};
   const next=steps[v](clone(current));
   if(!plain(next)||next.schemaVersion!==v+1)return {ok:false,code:'invalid',errors:[{path:'schemaVersion',message:'migration from '+v+' did not produce version '+(v+1)}]};
   current=next;
  }
  const after=(validators[target]||validate)(current);
  return after.ok?{ok:true,envelope:current,migrated:from<target,from}:{ok:false,code:after.code||'invalid',errors:after.errors};
 }

 const api=Object.freeze({SCHEMA_VERSION,CONTENT_VERSION,PROGRESSION_VERSION,limits,locations,progression,thresholds,levelFor,pointsEarned,derivedStats,validate,hydrate,dehydrate,envelope,create,canonical,migrations,migrate});
 if(node)module.exports=api;else window.VesperCharacter=api;
})();
