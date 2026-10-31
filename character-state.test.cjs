const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('./equipment.js');
const C=require('./character-state.js');
const fixture=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'tests/fixtures',name),'utf8'));
const meta={characterId:'0f1e2d3c-aaaa-4bbb-8ccc-123456789abc',revision:3,createdAt:'2026-10-28T12:00:00.000Z',savedAt:'2026-10-28T12:30:00.000Z',sessionId:'session-a',leaseEpoch:2};
const wrap=payload=>C.envelope(payload,meta);
const copy=v=>JSON.parse(JSON.stringify(v));
// Mutate a deep copy of a valid envelope; the original fixture is never touched.
const variant=(env,change)=>{const next=copy(env);change(next.payload,next);return next;};
const rejects=(env,pattern)=>{const r=C.validate(env);assert.equal(r.ok,false,'expected rejection: '+pattern);assert.ok(r.errors.some(e=>pattern.test(e.path+' '+e.message)),JSON.stringify(r.errors));return r;};

test('A new character is the current starter hero at the Crypt entrance and validates',()=>{
 const s=C.create(),env=wrap(C.dehydrate(s)),c=env.payload.character;
 assert.deepEqual(C.validate(env),{ok:true,code:null,errors:[]});
 assert.equal(s.run.main.key,'rustbound');assert.equal(s.run.off.key,'cryptshield');assert.equal(s.run.potions,2);
 assert.deepEqual({level:c.level,xp:c.lifetimeXp,hp:c.resources.hp,shield:c.resources.equipmentShield,ash:c.ash},{level:1,xp:0,hp:115,shield:12,ash:0});
 assert.deepEqual(s.stats,{maxHp:115,damage:30,speed:3.9,range:1.7,arc:1.06,attackRate:.36,dashCd:2.2,crit:0});
 assert.deepEqual(c.abilityUnlocks,['execution','aegis','stunning']);assert.equal(env.payload.campaign.activeCheckpointId,'forgotten-crypt:entrance');
});

test('Permanent XP keeps the existing threshold recurrence and carries overflow across levels',()=>{
 let need=48;for(let level=1;level<C.progression.levelCap;level++){assert.equal(C.thresholds[level],need);need=Math.round(need*1.24+16);}
 assert.deepEqual(C.levelFor(47),{level:1,xpIntoLevel:47,xpNeeded:48});
 assert.deepEqual(C.levelFor(48+76+5),{level:3,xpIntoLevel:5,xpNeeded:110});
 const cap=C.thresholds.slice(1).reduce((n,t)=>n+t,0);
 assert.deepEqual(C.levelFor(cap+999),{level:30,xpIntoLevel:999,xpNeeded:0});
 assert.equal(C.pointsEarned(30),29);
});

test('The committed full fixture round-trips all twelve items, rolled mods, stash, ground and escrow unchanged',()=>{
 const env=fixture('save-v1-full.json');assert.deepEqual(C.validate(env).errors,[]);
 assert.deepEqual([...new Set(env.payload.items.map(i=>i.key))].sort(),Object.keys(E.definitions).sort());
 const h=C.hydrate(env);assert.ok(h.ok);
 const again=C.dehydrate(h.state);assert.equal(C.canonical(again),C.canonical(env.payload));
 // Hydrated instances keep their saved IDs and mods and stay frozen for the existing E.* API.
 for(const record of env.payload.items){const live=[h.state.run.main,h.state.run.off,...h.state.run.bag,...h.state.stash,...h.state.campaign.rewardEscrow.map(e=>e.item),...Object.values(h.state.world.instances).flatMap(i=>i.groundDrops.map(d=>d.item))].find(i=>i?.id===record.id);
  assert.ok(live,'item '+record.id+' hydrated');assert.equal(live.key,record.key);assert.deepEqual(copy(live.mods),record.mods);assert.ok(Object.isFrozen(live)&&Object.isFrozen(live.mods));}
 assert.ok(E.valid(h.state.run));
 // Stats come from the same equipment rules as play; equal to freshly built identical instances.
 const fresh={main:E.item(h.state.run.main.key,h.state.run.main.mods),off:h.state.run.off&&E.item(h.state.run.off.key,h.state.run.off.mods),bag:Array(6).fill(null)};
 const base={damage:h.state.stats.damage,attackRate:h.state.stats.attackRate,crit:h.state.stats.crit};
 assert.deepEqual(E.stats(base,h.state.run),E.stats(base,fresh));
 // Derived intrinsic stats are recomputed from rules, never accumulated by repeated loads.
 assert.deepEqual(C.hydrate(wrap(again)).state.stats,h.state.stats);
 assert.equal(h.state.stats.maxHp,115+3*5+2*5);assert.equal(h.state.stats.damage,30+3+1);
});

test('Hydration reserves the ID allocator above every durable ID before any new item exists',()=>{
 const env=variant(fixture('save-v1-full.json'),p=>{p.character.nextItemId=900000;});
 assert.ok(C.hydrate(env).ok);assert.ok(E.nextId()>=900000);assert.ok(E.item('rustbound').id>=900000);
 // Restoring never moves the allocator backwards or replaces a saved ID.
 const before=E.nextId(),r=E.restore({id:5,key:'duskdagger',mods:[]});assert.equal(r.id,5);assert.equal(E.nextId(),before);
 assert.throws(()=>E.reserve(0),RangeError);assert.throws(()=>E.restore({id:1.5,key:'rustbound',mods:[]}),RangeError);
 assert.throws(()=>E.restore({id:999999999,key:'twinmoon',mods:[{stat:'crit',value:.02}]}),RangeError);assert.equal(E.nextId(),before);
 // A dehydrated save records the live allocator so a later load cannot hand out an ID already used by a dropped item.
 const s=C.hydrate(fixture('save-v1-full.json')).state;E.item('graveaxe');assert.equal(C.dehydrate(s).character.nextItemId,E.nextId());
});

test('Duplicate, dangling and orphaned ownership is rejected across hands, bag, stash, ground and escrow',()=>{
 const env=fixture('save-v1-full.json'),ground=p=>Object.values(p.world.instances)[0].groundDrops.find(d=>d.kind==='item');
 rejects(variant(env,p=>{p.items.push({...p.items[0]});}),/duplicate item ID/);
 rejects(variant(env,p=>{p.character.stash[p.character.stash.indexOf(null)]=p.character.backpack.find(Boolean);}),/also owned/);
 rejects(variant(env,p=>{ground(p).itemId=p.campaign.rewardEscrow[0].itemId;}),/also owned/);
 rejects(variant(env,p=>{p.character.stash[p.character.stash.indexOf(null)]=p.character.equipment.main;}),/also owned/);
 rejects(variant(env,p=>{const id=p.character.backpack.find(Boolean);p.character.backpack[p.character.backpack.indexOf(id)]=null;}),/has no owner/);
 rejects(variant(env,p=>{p.character.backpack[p.character.backpack.indexOf(null)]=777777;}),/missing item/);
 rejects(variant(env,p=>{p.character.nextItemId=Math.max(...p.items.map(i=>i.id));}),/exceed every allocated/);
 // dehydrate refuses to write a state that would own one item twice.
 const s=C.hydrate(env).state;s.stash[s.stash.indexOf(null)]=s.run.main;assert.throws(()=>C.dehydrate(s),/owned twice/);
});

test('Invalid gear and loadouts reject the whole candidate instead of rerolling or deleting items',()=>{
 const env=fixture('save-v1-full.json'),find=(p,key)=>p.items.find(i=>i.key===key);
 rejects(variant(env,p=>{find(p,'rustbound').mods=[{stat:'damage',value:40}];}),/invalid modifiers/);
 rejects(variant(env,p=>{find(p,'twinmoon').mods=[{stat:'crit',value:.02}];}),/invalid modifiers/);
 rejects(variant(env,p=>{find(p,'bulwark').mods=[{stat:'damage',value:2}];}),/invalid modifiers/);
 rejects(variant(env,p=>{find(p,'graveaxe').mods=[{stat:'damage',value:2,extra:1}];}),/invalid modifiers/);
 rejects(variant(env,p=>{find(p,'graveaxe').key='excalibur';}),/unknown item/);
 rejects(variant(env,p=>{find(p,'graveaxe').upgradeRank=1;}),/upgrades are not available/);
 // Two-handed main with an occupied off hand, and a shield in the main hand.
 rejects(variant(env,p=>{const two=find(p,'ashbringer').id,bag=p.character.backpack;bag[bag.indexOf(two)]=p.character.equipment.main;p.character.equipment.main=two;}),/invalid loadout/);
 rejects(variant(env,p=>{const off=p.character.equipment.off,shield=find(p,'oathguard').id,bag=p.character.backpack;bag[bag.indexOf(shield)]=p.character.equipment.main;p.character.equipment.main=shield;void off;}),/invalid loadout/);
 rejects(variant(env,p=>{p.character.backpack.pop();}),/exactly 6/);
 rejects(variant(env,p=>{p.character.stash.push(null);}),/exactly 24/);
 const before=E.nextId();assert.equal(C.hydrate(variant(env,p=>{find(p,'rustbound').mods=[{stat:'damage',value:40}];p.character.nextItemId=5e6;})).ok,false);assert.equal(E.nextId(),before,'a rejected candidate never reserves IDs');
});

test('Malformed numbers, unknown fields and oversized records are refused',()=>{
 const env=fixture('save-v1-full.json');
 for(const [change,pattern] of [
  [p=>{p.character.lifetimeXp=NaN;},/lifetimeXp/],[p=>{p.character.lifetimeXp=-1;},/lifetimeXp/],[p=>{p.character.lifetimeXp+=1.5;},/lifetimeXp/],
  [p=>{p.character.level++;},/level.*does not match/],[p=>{p.character.xpIntoLevel++;},/xpIntoLevel/],
  [p=>{p.character.unspentSkillPoints++;},/spent plus unspent/],[p=>{p.character.passiveRanks.vigor=6;},/rank out of range/],
  [p=>{p.character.passiveRanks.berserk=1;},/unknown passive/],[p=>{p.character.abilityUpgradeRanks.execution=1;},/not approved/],
  [p=>{p.character.ash=1.5;},/ash/],[p=>{p.character.ash=Infinity;},/ash/],[p=>{p.character.resources.hp=9999;},/derived maximum health/],
  [p=>{p.character.resources.equipmentShield=50;},/shield capacity/],[p=>{p.character.resources.potions=4;},/potions/],
  [p=>{p.character.timers.abilityCooldowns.aegis=21;},/aegis/],[p=>{p.character.timers.dodgeRemaining=-0.1;},/dodgeRemaining/],
  [p=>{p.character.abilityUnlocks=['execution','aegis'];},/abilityUnlocks/],[p=>{p.character.cheat=true;},/unknown field cheat/],
  [p=>{p.items[0].mods.push({stat:'damage',value:1},{stat:'crit',value:.02},{stat:'speed',value:.04});},/invalid modifiers/],
  [p=>{p.campaign.storyFlags=['ok','ok'];},/duplicate values/],[p=>{p.campaign.journalEntries.push({id:'x',title:'t',text:'y'.repeat(5000)});},/text/],
  [p=>{Object.values(p.world.instances)[0].groundDrops[0].x=1e9;},/position/],
 ])rejects(variant(env,change),pattern);
 rejects(variant(env,p=>{for(let i=0;i<4097;i++)p.items.push({id:1e6+i,key:'rustbound',mods:[],upgradeRank:0});}),/too many entries/);
 // JSON with a __proto__ key arrives as an own property and is refused rather than merged.
 rejects(JSON.parse(JSON.stringify(env).replace('"character":{','"character":{"__proto__":{"ash":1},')),/unknown field __proto__/);
});

test('Campaign, lifecycle and reward-ledger invariants are mutually consistent',()=>{
 const env=fixture('save-v1-full.json');
 rejects(variant(env,p=>{p.campaign.unlockedLocations=['forgotten-crypt','crimson-chapel'];}),/campaign prefix/);
 rejects(variant(env,p=>{delete p.campaign.bossCompletions['forgotten-crypt'];}),/unlocked before forgotten-crypt was completed/);
 rejects(variant(env,p=>{p.campaign.campaignComplete=true;}),/Throne of Ash/);
 rejects(variant(env,p=>{p.campaign.activeCheckpointId='throne-of-ash:entrance';}),/unlocked location/);
 rejects(variant(env,p=>{p.campaign.bossCompletions['throne-of-ash']=true;}),/not unlocked/);
 rejects(variant(env,p=>{p.campaign.eliteCompletions['crimson-chapel']=true;}),/not an encounter location/);
 rejects(variant(env,p=>{p.campaign.rewardLedger[p.campaign.rewardEscrow[0].rewardKey]='claimed';}),/escrow/);
 rejects(variant(env,p=>{p.world.lifecycle={mode:'dead-pending-respawn',deathId:'death-1',lastRespawnId:null};}),/zero health/);
 rejects(variant(env,p=>{p.world.lifecycle.deathId='death-1';}),/null while alive/);
 rejects(variant(env,p=>{p.world.currentInstanceId='missing';}),/current location/);
 rejects(variant(env,p=>{p.world.pendingTransition={to:'plague-halls'};}),/not supported by schema v1/);
 // A death recorded with zero health and a death ID is a valid respawn-pending save, not a fresh character.
 assert.ok(C.validate(variant(env,p=>{p.character.resources.hp=0;p.world.lifecycle={mode:'dead-pending-respawn',deathId:'death-1',lastRespawnId:null};})).ok);
});

test('Future or different versions are read-only unsupported, never invalid data to replace',()=>{
 const env=fixture('save-v1-full.json');
 assert.equal(C.validate({...env,schemaVersion:2}).code,'unsupported');assert.equal(C.validate({...env,contentVersion:'campaign-2'}).code,'unsupported');
 assert.equal(C.validate({...env,progressionVersion:2}).code,'unsupported');assert.equal(C.validate({...env,schemaVersion:0}).code,'invalid');
 assert.equal(C.hydrate({...env,schemaVersion:2}).code,'unsupported');assert.equal(C.migrate({...env,schemaVersion:2}).code,'unsupported');
});

test('Migrations are pure, validated before and after, and idempotent (synthetic v1 to v2)',()=>{
 const env=fixture('save-v1-full.json'),original=JSON.stringify(env);
 const v2=e=>e.schemaVersion===2&&e.payload.character.title==='Penitent'?C.validate({...e,schemaVersion:1,payload:{...e.payload,character:(({title,...rest})=>rest)(e.payload.character)}}):{ok:false,errors:[{path:'v2',message:'bad'}]};
 const plan={target:2,steps:{1:e=>{e.schemaVersion=2;e.payload.character.title='Penitent';return e;}},validators:{1:C.validate,2:v2}};
 const r=C.migrate(env,plan);assert.ok(r.ok,JSON.stringify(r.errors));assert.equal(r.migrated,true);assert.equal(r.from,1);assert.equal(r.envelope.payload.character.title,'Penitent');
 assert.equal(JSON.stringify(env),original,'input untouched');
 const again=C.migrate(r.envelope,plan);assert.ok(again.ok);assert.equal(again.migrated,false);assert.deepEqual(again.envelope,r.envelope);
 // An invalid source, a broken step and a step that yields an invalid result all fail without a partial result.
 assert.equal(C.migrate(variant(env,p=>{p.character.ash=-1;}),plan).ok,false);
 assert.equal(C.migrate(env,{...plan,steps:{1:e=>e}}).ok,false);
 assert.equal(C.migrate(env,{...plan,steps:{1:e=>{e.schemaVersion=2;return e;}}}).ok,false);
 assert.equal(C.migrate(env,{...plan,steps:{}}).ok,false);
 // With the real (empty) registry, a current save is returned unchanged.
 const current=C.migrate(env);assert.ok(current.ok);assert.equal(current.migrated,false);assert.deepEqual(current.envelope,env);
});

test('Canonical form is independent of key order',()=>{
 assert.equal(C.canonical({b:1,a:[{d:2,c:3}]}),C.canonical({a:[{c:3,d:2}],b:1}));
 assert.equal(C.canonical({a:null,b:'x'}),'{"a":null,"b":"x"}');
});

test('Review: a once-only reward is held exactly once across escrow and ground drops',()=>{
 const env=fixture('save-v1-full.json'),key=env.payload.campaign.rewardEscrow[0].rewardKey;
 rejects(variant(env,p=>{Object.values(p.world.instances)[0].groundDrops.find(d=>d.kind==='item').rewardKey=key;}),/also held/);
 rejects(variant(env,p=>{Object.values(p.world.instances)[0].groundDrops.find(d=>d.kind==='ash').rewardKey=key;}),/also held/);
 rejects(variant(env,p=>{p.campaign.rewardLedger['campaign:plague-halls:chest:1:item']='escrow';}),/must be held in escrow or on the ground/);
 // Moving the reward from escrow to the ground keeps exactly one holder and stays valid.
 assert.ok(C.validate(variant(env,p=>{const e=p.campaign.rewardEscrow.pop(),drops=Object.values(p.world.instances)[0].groundDrops;drops.push({dropId:Object.keys(p.world.instances)[0]+':reward:0000abcd',kind:'item',itemId:e.itemId,amount:1,x:0,y:0,rewardKey:e.rewardKey});})).ok);
});

test('Review: inherited property names are never item keys or record keys',()=>{
 const env=fixture('save-v1-full.json');
 for(const key of ['toString','constructor','__proto__','hasOwnProperty'])rejects(variant(env,p=>{p.items.find(i=>i.key==='kingsmercy').key=key;}),/unknown item/);
 rejects(variant(env,p=>{p.items[0].key=7;}),/unknown item/);
 // An own __proto__ instance key (as JSON.parse creates it) would vanish on re-serialisation, orphaning its items.
 rejects(JSON.parse(JSON.stringify(env).replace('"forgotten-crypt:s0000002a":','"__proto__":').replace('"currentInstanceId":"forgotten-crypt:s0000002a"','"currentInstanceId":null')),/invalid key/);
 rejects(variant(env,p=>{p.character.passiveRanks={toString:1,vigor:1,edge:1};}),/invalid key/);
 rejects(variant(env,p=>{p.campaign.questStates.constructor='complete';}),/invalid key/);
});

test('Review: allocator states near the safe-integer limit are refused before any reservation',()=>{
 const env=fixture('save-v1-full.json'),before=E.nextId();
 for(const next of [Number.MAX_SAFE_INTEGER,C.limits.itemId+1])assert.equal(C.hydrate(variant(env,p=>{p.character.nextItemId=next;})).ok,false);
 assert.equal(E.nextId(),before,'a refused save never moves the allocator');
 rejects(variant(env,p=>{p.items[0].id=C.limits.itemId;p.character.nextItemId=C.limits.itemId;}),/item ID range/);
});

test('Review: hostile JSON in any field is rejected through the result, never by throwing',()=>{
 const env=fixture('save-v1-full.json'),hostile=[{toString:null},{valueOf:null,toString:null},[{toString:null}],[],{},null,true,-1,'x'];
 const paths=[];(function walk(v,p){if(p.length)paths.push(p);if(v&&typeof v==='object')for(const k of Object.keys(v))walk(v[k],p.concat(k));})(env,[]);
 assert.ok(paths.length>200);
 for(const p of paths)for(const h of hostile){
  const candidate=copy(env);let o=candidate;for(const k of p.slice(0,-1))o=o[k];o[p.at(-1)]=h;
  for(const fn of ['validate','hydrate','migrate']){let r;assert.doesNotThrow(()=>{r=C[fn](candidate);},fn+' threw for '+p.join('.')+' = '+JSON.stringify(h));assert.equal(typeof r.ok,'boolean');}
 }
});

test('P2 PR2: area instances carry their PR1 identity; foreign, malformed or mis-keyed records are refused',()=>{
 const env=fixture('save-v1-full.json'),key=Object.keys(env.payload.world.instances)[0],inst=p=>p.world.instances[key];
 assert.equal(key,'forgotten-crypt:s0000002a');assert.equal(C.instanceKey('forgotten-crypt',42,'replay',3),'forgotten-crypt:s0000002a:replay:e3');
 rejects(variant(env,p=>{inst(p).killed.push('forgotten-crypt:s0000002b:spawn:1');}),/killed/);
 rejects(variant(env,p=>{inst(p).killed.push('plague-halls:s0000002a:spawn:1');}),/killed/);
 rejects(variant(env,p=>{inst(p).killed.push(key+':chest:1');}),/killed/);
 rejects(variant(env,p=>{inst(p).killed.push(key+':spawn:4096');}),/killed/);
 rejects(variant(env,p=>{inst(p).killed.push(key+':spawn:01');}),/killed/);
 rejects(variant(env,p=>{inst(p).killed.push(inst(p).killed[0]);}),/duplicate values/);
 rejects(variant(env,p=>{inst(p).opened.push(key+':spawn:2');}),/opened/);
 rejects(variant(env,p=>{inst(p).groundDrops[1].dropId='plague-halls:s0000002a:spawn:1:d0';}),/must belong to this area/);
 rejects(variant(env,p=>{inst(p).generatorVersion=2;}),/floor generator/);
 rejects(variant(env,p=>{inst(p).layoutHash='xyz';}),/layoutHash/);
 rejects(variant(env,p=>{inst(p).seed=2**32;}),/seed/);
 rejects(variant(env,p=>{inst(p).seed=43;}),/area identity/);
 rejects(variant(env,p=>{inst(p).epoch=1;}),/area identity/);
 rejects(variant(env,p=>{delete inst(p).killed;}),/missing field killed/);
 // A correctly keyed replay epoch of the same floor is a separate, valid instance.
 assert.ok(C.validate(variant(env,p=>{p.world.instances[C.instanceKey('forgotten-crypt',42,'replay',1)]={...copy(inst(p)),mode:'replay',epoch:1,killed:[],opened:[],groundDrops:[]};})).ok);
});

test('Review: drop IDs must belong to their exact instance key, mode and epoch included',()=>{
 const env=fixture('save-v1-full.json'),key=Object.keys(env.payload.world.instances)[0],replay=C.instanceKey('forgotten-crypt',42,'replay',1);
 const withReplay=p=>{p.world.instances[replay]={...copy(p.world.instances[key]),mode:'replay',epoch:1,killed:[],opened:[],groundDrops:[]};return p.world.instances[replay];};
 // A campaign drop ID inside the replay instance (and the reverse) is refused, as are malformed suffixes.
 rejects(variant(env,p=>{withReplay(p).groundDrops.push({...copy(p.world.instances[key].groundDrops[1]),dropId:key+':spawn:5:d0'});}),/belong to this area instance|duplicate drop ID/);
 rejects(variant(env,p=>{withReplay(p);p.world.instances[key].groundDrops[1].dropId=replay+':spawn:5:d0';}),/belong to this area instance/);
 for(const bad of [':spawn:5',':spawn:05:d0',':spawn:4096:d0',':spawn:5:d64',':boss:d0',':reward:xyz',':reward:0000abcd:d0'])
  rejects(variant(env,p=>{p.world.instances[key].groundDrops[1].dropId=key+bad;}),/belong to this area instance/);
 // The same source suffix under each instance key is valid simultaneously.
 assert.ok(C.validate(variant(env,p=>{withReplay(p).groundDrops.push({...copy(p.world.instances[key].groundDrops[1]),dropId:replay+':spawn:5:d0'});})).ok);
});
