const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('./character-state.js');
const G=require('./campaign-state.js');
const E=require('./equipment.js');
const F=require('./floors.js');
const S=require('./save-store.js');
const {loadGame}=require('./tests/generation-harness.cjs');
const ID='0f1e2d3c-aaaa-4bbb-8ccc-123456789abc';
// Real Phase 2 PR1 manifests from the game's own generation.
const game=loadGame(),manifest=(floor,seed)=>game.build(floor,seed).areaManifest;
const fresh=()=>{const s=C.create();s.characterId=ID;return s;};
const ok=r=>{assert.ok(r.ok,JSON.stringify({code:r.code,message:r.message,errors:r.errors?.slice(0,3)}));return r.state;};
const snapshot=s=>C.canonical(C.dehydrate(s));
const unlockAll=s=>{let next=s;for(const loc of F.locations.slice(0,-1))next=ok(G.completeArea(next,{locationId:loc}));return next;};
const inArea=(floor=1,seed=42)=>{const m=manifest(floor,seed),r=G.enterArea(fresh(),m);return {m,id:r.instanceId,s:ok(r)};};

test('An area instance is recorded once from a PR1 manifest; a differently generated area is refused',()=>{
 const m=manifest(1,42),s0=fresh(),before=snapshot(s0),r=G.enterArea(s0,m);
 const s=ok(r);assert.equal(r.instanceId,'forgotten-crypt:s0000002a');assert.equal(snapshot(s0),before,'input untouched');
 assert.deepEqual(s.world.instances[r.instanceId],{locationId:'forgotten-crypt',mode:'campaign',seed:42,generatorVersion:F.GENERATOR_VERSION,layoutHash:m.layoutHash,epoch:0,killed:[],opened:[],groundDrops:[]});
 const again=G.enterArea(s,m);assert.equal(again.applied,false);assert.equal(again.state,s);
 assert.equal(G.enterArea(s,{...m,layoutHash:'00000000'}).code,'area-mismatch');
 assert.equal(G.enterArea(s,{...m,generatorVersion:F.GENERATOR_VERSION+1}).code,'area-mismatch');
 // A replay epoch of the same floor and seed is a separate instance with its own key.
 assert.equal(G.enterArea(s,m,{mode:'replay',epoch:1}).instanceId,'forgotten-crypt:s0000002a:replay:e1');
 // A location that is not unlocked cannot hold an instance.
 assert.equal(G.enterArea(s,manifest(2,42)).code,'invalid');
 let many=unlockAll(fresh());for(let seed=1;seed<=C.limits.instances;seed++)many=ok(G.enterArea(many,manifest(1,seed)));
 assert.equal(G.enterArea(many,manifest(1,99)).code,'instance-limit');
});

test('A kill grants XP, skill points and drops exactly once, including after save, restore and replay',()=>{
 const {m,id,s}=inArea(),spawn=m.spawns[0].id,axe=E.item('graveaxe');
 const r=G.recordKill(s,{instanceId:id,spawnId:spawn,xp:48+76+5,drops:[{kind:'ash',amount:3,x:1,y:1},{kind:'potion',amount:1,x:1,y:1},{kind:'item',item:axe,x:1,y:1}]});
 const after=ok(r);assert.equal(r.levelsGained,2);
 assert.deepEqual([after.character.level,after.character.xpIntoLevel,after.character.unspentSkillPoints,after.character.lifetimeXp],[3,5,2,129]);
 assert.deepEqual(after.world.instances[id].groundDrops.map(d=>d.dropId),[spawn+':d0',spawn+':d1',spawn+':d2']);
 assert.equal(after.stats.maxHp,115+2*5);
 // Repeating the kill, directly or after a save/restore round trip, grants nothing.
 const again=G.recordKill(after,{instanceId:id,spawnId:spawn,xp:500,drops:[{kind:'ash',amount:99,x:0,y:0}]});
 assert.equal(again.applied,false);assert.equal(again.state,after);
 const restored=C.hydrate(C.envelope(C.dehydrate(after),{characterId:ID,revision:1,createdAt:'2026-10-31T00:00:00.000Z',savedAt:'2026-10-31T00:00:00.000Z',sessionId:'t',leaseEpoch:1}));
 assert.ok(restored.ok,JSON.stringify(restored.errors));
 const replay=G.recordKill(restored.state,{instanceId:id,spawnId:spawn,xp:500});assert.equal(replay.applied,false);
 assert.equal(replay.state.character.lifetimeXp,129);
});

test('Chests open once; IDs from another area, the wrong kind or an unknown area change nothing',()=>{
 const {m,id,s}=inArea(),chest=m.chests[0].id,before=snapshot(s);
 const opened=ok(G.openChest(s,{instanceId:id,chestId:chest,drops:[{kind:'ash',amount:12,x:2,y:2}]}));
 assert.deepEqual(opened.world.instances[id].opened,[chest]);
 assert.equal(G.openChest(opened,{instanceId:id,chestId:chest,drops:[{kind:'ash',amount:12,x:2,y:2}]}).applied,false);
 const other=manifest(1,43);
 for(const [r,why] of [[G.recordKill(s,{instanceId:id,spawnId:other.spawns[0].id,xp:10}),'spawn from another seed'],
  [G.recordKill(s,{instanceId:id,spawnId:manifest(2,42).spawns[0].id,xp:10}),'spawn from another floor'],
  [G.recordKill(s,{instanceId:id,spawnId:chest,xp:10}),'chest ID as a kill'],
  [G.openChest(s,{instanceId:id,chestId:m.spawns[0].id}),'spawn ID as a chest'],
  [G.recordKill(s,{instanceId:id,spawnId:id+':spawn:'+F.MAX_ENTITIES,xp:10}),'index out of range'],
  [G.recordKill(s,{instanceId:id,spawnId:m.spawns[0].id,xp:-1}),'negative XP']]){
  assert.equal(r.ok,false,why);assert.equal(r.code,'invalid',why);
 }
 assert.equal(G.recordKill(s,{instanceId:'plague-halls:s0000002a',spawnId:'x',xp:1}).code,'unknown-area');
 assert.equal(G.recordKill(s,{instanceId:'__proto__',spawnId:'x',xp:1}).code,'unknown-area');
 assert.equal(snapshot(s),before,'every rejected operation left the state untouched');
});

test('Pick-ups move the same item once; a full bag or potion belt keeps the drop on the ground',()=>{
 const {m,id,s}=inArea(),axe=E.item('graveaxe');
 const dropped=ok(G.recordKill(s,{instanceId:id,spawnId:m.spawns[0].id,drops:[{kind:'item',item:axe,x:1,y:1},{kind:'ash',amount:4,x:1,y:1},{kind:'potion',amount:1,x:1,y:1}]}));
 const d=dropped.world.instances[id].groundDrops.map(x=>x.dropId);
 const got=ok(G.pickUp(dropped,{instanceId:id,dropId:d[0]}));assert.equal(got.run.bag.filter(Boolean)[0],axe);
 assert.equal(G.pickUp(got,{instanceId:id,dropId:d[0]}).applied,false,'a second pick-up grants no copy');
 assert.equal(ok(G.pickUp(got,{instanceId:id,dropId:d[1]})).character.ash,4);
 assert.equal(ok(G.pickUp(got,{instanceId:id,dropId:d[2]})).run.potions,3);
 // Full bag: lossless refusal.
 let full=dropped;full={...full,run:{...full.run,bag:Array.from({length:6},()=>E.item('rustbound'))}};
 const before=snapshot(full),r=G.pickUp(full,{instanceId:id,dropId:d[0]});
 assert.equal(r.code,'bag-full');assert.equal(snapshot(full),before);assert.ok(full.world.instances[id].groundDrops.some(x=>x.dropId===d[0]));
 const belt={...dropped,run:{...dropped.run,potions:3}};assert.equal(G.pickUp(belt,{instanceId:id,dropId:d[2]}).code,'potions-full');
});

test('Once-only rewards are granted once, held losslessly through a full bag, and never re-earned by replay',()=>{
 const {id,s}=inArea(),key=G.campaignRewardKey('forgotten-crypt'),relic=E.item('bloodforged');
 assert.equal(key,'campaign:forgotten-crypt:boss:item');
 // Escrow path with a full bag: the claim waits, the reward is neither lost nor rerolled.
 const fullBag=b=>({...b,run:{...b.run,bag:Array.from({length:6},()=>E.item('rustbound'))}});
 const held=ok(G.grantReward(fullBag(s),{rewardKey:key,item:relic}));
 assert.deepEqual(held.campaign.rewardLedger,{[key]:'escrow'});
 assert.equal(G.grantReward(held,{rewardKey:key,item:E.item('twinmoon')}).applied,false,'a second grant while held gives nothing');
 assert.equal(G.claimEscrow(held,{rewardKey:key}).code,'bag-full');
 const freed={...held,run:{...held.run,bag:[null,...held.run.bag.slice(1)]}},claimed=ok(G.claimEscrow(freed,{rewardKey:key}));
 assert.equal(claimed.run.bag[0],relic);assert.deepEqual(claimed.campaign.rewardLedger,{[key]:'claimed'});assert.equal(claimed.campaign.rewardEscrow.length,0);
 assert.equal(G.claimEscrow(claimed,{rewardKey:key}).applied,false);
 // After claiming, even a replay instance of the same floor cannot earn the campaign reward again.
 const replay=G.enterArea(claimed,manifest(1,42),{mode:'replay',epoch:1}),inReplay=ok(replay);
 assert.equal(G.grantReward(inReplay,{rewardKey:key,item:E.item('twinmoon'),instanceId:replay.instanceId}).applied,false);
 // Ground path: the reward lies in the area until picked up, which claims it in the same change.
 const onGround=ok(G.grantReward(s,{rewardKey:key,item:relic,instanceId:id,x:3,y:3})),drop=onGround.world.instances[id].groundDrops[0];
 assert.equal(drop.rewardKey,key);assert.ok(drop.dropId.startsWith(id+':reward:'));
 const taken=ok(G.pickUp(onGround,{instanceId:id,dropId:drop.dropId}));assert.deepEqual(taken.campaign.rewardLedger,{[key]:'claimed'});
 // An item already owned elsewhere cannot be granted as a second copy.
 const owned=G.grantReward(s,{rewardKey:'campaign:forgotten-crypt:quest:item',item:s.run.main});assert.equal(owned.code,'invalid');
});

test('First clears unlock locations in order once; repeats report firstClear false; the Throne completes the campaign',()=>{
 let s=fresh();
 assert.equal(G.completeArea(s,{locationId:'plague-halls'}).code,'locked');
 const first=G.completeArea(s,{locationId:'forgotten-crypt'});s=ok(first);
 assert.deepEqual([first.firstClear,first.unlocked],[true,'plague-halls']);assert.deepEqual(s.campaign.bossCompletions,{'forgotten-crypt':true});
 const repeat=G.completeArea(s,{locationId:'forgotten-crypt'});assert.deepEqual([repeat.applied,repeat.firstClear],[false,false]);assert.equal(repeat.state,s);
 s=ok(G.completeArea(s,{locationId:'plague-halls'}));assert.deepEqual(s.campaign.eliteCompletions,{'plague-halls':true});
 for(const loc of ['crimson-chapel','hollow-sanctum'])s=ok(G.completeArea(s,{locationId:loc}));
 assert.equal(s.campaign.campaignComplete,false);
 const last=G.completeArea(s,{locationId:'throne-of-ash'});s=ok(last);assert.equal(last.unlocked,null);
 assert.equal(s.campaign.campaignComplete,true);assert.deepEqual(s.campaign.unlockedLocations,F.locations.slice());
});

test('Corrupted or contradictory state is refused without partial mutation',()=>{
 const {m,id,s}=inArea();
 // Duplicate ownership smuggled in by a caller: the backpack also holds the equipped weapon.
 const corrupt={...s,run:{...s.run,bag:[s.run.main,...s.run.bag.slice(1)]}},before=snapshot(s);
 const r=G.recordKill(corrupt,{instanceId:id,spawnId:m.spawns[0].id,xp:10});assert.equal(r.ok,false);
 assert.equal(corrupt.world.instances[id].killed.length,0,'the input instance was not mutated');assert.equal(snapshot(s),before);
 // Malformed drops are refused before anything is recorded.
 for(const drops of [[{kind:'gold',amount:1,x:0,y:0}],[{kind:'ash',amount:-3,x:0,y:0}],[{kind:'ash',amount:1,x:NaN,y:0}],'x',Array(65).fill({kind:'ash',amount:1,x:0,y:0})])
  assert.equal(G.recordKill(s,{instanceId:id,spawnId:m.spawns[0].id,drops}).ok,false,JSON.stringify(drops).slice(0,40));
 assert.equal(snapshot(s),before);
});

test('Interrupted commits never half-apply: a failed save leaves the stored kill unrecorded and replay grants once',async()=>{
 const adapter=S.memoryAdapter(),store=S.createStore({adapter,sessionId:'tab-a'}),{epoch}=await store.acquireLease(ID);
 const {m,id,s}=inArea();assert.ok((await store.create(ID,C.dehydrate(s),epoch)).ok);
 const killed=ok(G.recordKill(s,{instanceId:id,spawnId:m.spawns[0].id,xp:60,drops:[{kind:'item',item:E.item('graveaxe'),x:1,y:1}]}));
 // A first commit writes the backup, the record and metadata: interrupt after each of them.
 for(let n=0;n<3;n++){
  adapter.failAfter(n);const r=await store.commit(ID,C.dehydrate(killed),{expectedRevision:1,epoch});adapter.clearFailure();
  assert.equal(r.ok,false,'commit interrupted after '+n+' writes');
  const loaded=await store.load(ID),state=C.hydrate(loaded.envelope).state;
  assert.equal(loaded.envelope.revision,1);assert.deepEqual(state.world.instances[id].killed,[]);assert.equal(state.character.lifetimeXp,0);
 }
 // The retried command applies exactly once and survives a reload; replaying it then grants nothing more.
 assert.ok((await store.commit(ID,C.dehydrate(killed),{expectedRevision:1,epoch})).ok);
 const reloaded=C.hydrate((await store.load(ID)).envelope).state;
 assert.deepEqual(reloaded.world.instances[id].killed,[m.spawns[0].id]);assert.equal(reloaded.character.lifetimeXp,60);
 const replay=G.recordKill(reloaded,{instanceId:id,spawnId:m.spawns[0].id,xp:60});assert.equal(replay.applied,false);
});
