const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('./character-state.js');
const K=require('./command-coordinator.js');
const A=require('./abilities.js');
const S=require('./save-store.js');
const {loadGame}=require('./tests/generation-harness.cjs');
const ID='0f1e2d3c-aaaa-4bbb-8ccc-123456789abc';
const fixture=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'tests/fixtures/save-v1-full.json'),'utf8')).payload;
// A stored character (the full fixture: 96.5/140 HP, 2 potions, execution 3.5 s and stunning 11.25 s on cooldown).
async function setup(payload=fixture(),onStatus=null){
 const adapter=S.memoryAdapter(),time={now:Date.parse('2026-11-01T00:00:00Z')},clock=()=>time.now;
 const store=S.createStore({adapter,sessionId:'tab-a',clock,leaseMs:10000}),{epoch}=await store.acquireLease(ID);
 assert.ok((await store.create(ID,payload,epoch)).ok);
 const statuses=[],envelope=(await store.load(ID)).envelope;
 const k=K.createCoordinator({store,characterId:ID,epoch,envelope,onStatus:s=>{statuses.push(s.status);if(onStatus)onStatus(s);}});
 const reload=async()=>C.hydrate((await store.load(ID)).envelope).state;
 return {adapter,store,epoch,time,clock,k,statuses,reload};
}
const stored=async(store)=>(await store.load(ID)).envelope;

test('Potion: the decrement and the heal commit together, and a reload never refunds it',async()=>{
 const {k,reload,statuses}=await setup(),before=k.state;
 const r=await k.drinkPotion();assert.ok(r.ok,JSON.stringify(r));
 const max=before.stats.maxHp;assert.equal(max,140);assert.equal(r.healed,Math.min(max-96.5,Math.round(max*.42)));assert.equal(k.state.run.potions,1);assert.equal(k.state.character.resources.hp,140);
 assert.equal(before.run.potions,2,'the previous state object is untouched');assert.deepEqual(statuses,['saving','saved']);
 const s=await reload();assert.equal(s.run.potions,1);assert.equal(s.character.resources.hp,140);
 assert.equal((await k.drinkPotion()).code,'unavailable','full health: no potion is spent');assert.equal(k.state.run.potions,1);
});

test('Aborted writes at every commit boundary acknowledge nothing and pause until a retry succeeds',async()=>{
 for(const [command,run,check] of [['potion',k=>k.drinkPotion(),s=>s.run.potions],['ability',k=>k.reserveAbility('aegis'),s=>s.character.timers.abilityCooldowns.aegis],['death',k=>k.recordDeath('death-9'),s=>s.character.deaths]]){
  for(let n=0;n<3;n++){
   const {adapter,store,k,reload,statuses}=await setup(),beforeValue=check(k.state),beforeRevision=(await stored(store)).revision;
   adapter.failAfter(n);const r=await run(k);adapter.clearFailure();
   assert.equal(r.ok,false,command+' after '+n+' writes');assert.equal(r.status,'failed');assert.equal(k.status,'failed');
   assert.equal(check(k.state),beforeValue,command+': nothing acknowledged in memory');
   assert.equal((await stored(store)).revision,beforeRevision);assert.equal(check(await reload()),beforeValue,command+': nothing stored');
   // Paused: every command is refused until the failed one is retried successfully.
   for(const other of [k.drinkPotion(),k.reserveAbility('execution'),k.recordDeath('death-x'),k.ledger('completeArea',{locationId:'forgotten-crypt'})])assert.equal((await other).code,'save-failed');
   const retried=await k.retry();assert.ok(retried.ok,JSON.stringify(retried));assert.equal(k.status,'saved');
   assert.notEqual(check(k.state),beforeValue);assert.equal(check(await reload()),check(k.state),command+': applied exactly once after retry');
   assert.deepEqual(statuses.slice(0,2),['saving','failed']);assert.equal((await k.retry()).code,'nothing-to-retry');
  }
 }
});

test('Ability cooldowns are reserved before the wind-up, never reset by repeats or reloads, and Aegis is not saved',async()=>{
 const {k,reload,store}=await setup();
 assert.deepEqual(Object.fromEntries(Object.entries(A.definitions).map(([id,d])=>[id,d.cooldown])),{execution:8,aegis:20,stunning:18},'the three abilities are unchanged');
 assert.equal((await k.reserveAbility('execution')).code,'cooldown','execution is still recharging (3.5 s)');
 const r=await k.reserveAbility('aegis');assert.ok(r.ok);assert.equal(r.cooldown,20);
 const revision=(await stored(store)).revision;
 for(let i=0;i<5;i++)assert.equal((await k.reserveAbility('aegis')).code,'cooldown','a repeated tap cannot reuse it');
 assert.equal((await stored(store)).revision,revision,'refused commands write nothing');
 const s=await reload();assert.equal(s.character.timers.abilityCooldowns.aegis,20);assert.equal(s.character.timers.abilityCooldowns.stunning,11.25);
 assert.equal(JSON.stringify((await stored(store)).payload).includes('barrier'),false);
 assert.equal((await k.reserveAbility('meteor')).code,'invalid');assert.equal((await k.reserveAbility('__proto__')).code,'invalid');
});

test('A death is recorded once per death ID, keeps all progress, and blocks potions and abilities while pending',async()=>{
 const {k,reload,store}=await setup(),before=k.state;
 const r=await k.recordDeath('death-1');assert.ok(r.ok);
 const s=await reload();assert.equal(s.character.resources.hp,0);assert.equal(s.character.deaths,before.character.deaths+1);
 assert.deepEqual(s.world.lifecycle,{mode:'dead-pending-respawn',deathId:'death-1',lastRespawnId:before.world.lifecycle.lastRespawnId});
 for(const key of ['lifetimeXp','ash','level','unspentSkillPoints'])assert.equal(s.character[key],before.character[key],key+' kept');
 assert.equal(C.canonical(C.dehydrate(s).items),C.canonical(C.dehydrate(before).items),'items kept');
 const revision=(await stored(store)).revision,again=await k.recordDeath('death-1');
 assert.equal(again.ok,true);assert.equal(again.applied,false);assert.equal((await stored(store)).revision,revision,'replayed death ID writes nothing');
 assert.equal((await k.recordDeath('death-2')).code,'already-dead');assert.equal(k.state.character.deaths,before.character.deaths+1);
 assert.equal((await k.drinkPotion()).code,'dead');assert.equal((await k.reserveAbility('aegis')).code,'dead');
 // A reloaded session replaying the same death ID still grants nothing.
 const k2=K.createCoordinator({store,characterId:ID,epoch:(await store.acquireLease(ID)).epoch,envelope:await stored(store)});
 assert.equal((await k2.recordDeath('death-1')).applied,false);
});

test('A stale tab or revision stops this session from saving; nothing is acknowledged',async()=>{
 const {store,k,time,reload,clock,adapter}=await setup();
 time.now+=10001;const other=S.createStore({adapter,sessionId:'tab-b',clock}),lease=await other.acquireLease(ID);assert.ok(lease.ok);
 const r=await k.drinkPotion();assert.equal(r.code,'fenced');assert.equal(k.status,'stale');assert.equal(k.state.run.potions,2);
 assert.equal((await reload()).run.potions,2);assert.equal((await k.retry()).code,'nothing-to-retry');
 assert.equal((await k.reserveAbility('aegis')).code,'stale');
 // A revision written elsewhere is a conflict: also stale, nothing acknowledged.
 const b=await setup(),k2=K.createCoordinator({store:b.store,characterId:ID,epoch:b.epoch,envelope:await stored(b.store)});
 assert.ok((await b.k.drinkPotion()).ok);
 const c=await k2.drinkPotion();assert.equal(c.code,'conflict');assert.equal(k2.status,'stale');assert.equal(k2.state.run.potions,2);
 assert.equal((await stored(b.store)).payload.character.resources.potions,1,'only the first command was stored');
 void store;
});

test('Double taps while a save is pending are refused, so one tap spends one potion',async()=>{
 const {k,reload}=await setup();
 const [a,b]=await Promise.all([k.drinkPotion(),k.drinkPotion()]);
 assert.deepEqual([a.ok,b.code],[true,'busy']);assert.equal((await reload()).run.potions,1);
});

test('Ledger commands commit through the same path; replayed IDs after reload write nothing',async()=>{
 const m=loadGame().build(1,42).areaManifest,payload=fixture();
 payload.world.instances={};payload.world.currentInstanceId=null;payload.campaign.rewardEscrow=[];payload.campaign.rewardLedger={};
 payload.character.backpack=payload.character.backpack.map(()=>null);payload.items=payload.items.filter(i=>[payload.character.equipment.main,payload.character.equipment.off,...payload.character.stash].includes(i.id));
 const {k,store,reload}=await setup(payload);
 assert.ok((await k.ledger('enterArea',m)).ok);const spawn=m.spawns[0].id;
 assert.ok((await k.ledger('recordKill',{instanceId:m.instanceId,spawnId:spawn,xp:30})).ok);
 const revision=(await stored(store)).revision;
 const replay=K.createCoordinator({store,characterId:ID,epoch:(await store.acquireLease(ID)).epoch,envelope:await stored(store)});
 const r=await replay.ledger('recordKill',{instanceId:m.instanceId,spawnId:spawn,xp:30});
 assert.equal(r.applied,false);assert.equal((await stored(store)).revision,revision);
 assert.equal((await reload()).character.lifetimeXp,payload.character.lifetimeXp+30);
 assert.equal((await k.ledger('startGame',{})).code,'invalid','only the listed ledger commands exist');
});

test('A throwing status observer never changes a save outcome, causes a second spend or leaves a command pending',async()=>{
 const low=()=>{const p=fixture();p.character.resources.hp=1;return p;};
 const thrower=on=>s=>{if(s.status===on)throw new Error('observer failed on '+on);};
 // Observer throws while saving or after a completed commit: the commit stands, exactly once.
 for(const on of ['saving','saved']){
  const {k,reload,statuses,store}=await setup(low(),thrower(on));
  const r=await k.drinkPotion();assert.ok(r.ok,on+': '+JSON.stringify(r));
  assert.equal(k.status,'saved');assert.equal(k.pending,false);assert.deepEqual(statuses,['saving','saved']);
  assert.equal(k.state.run.potions,1);assert.equal((await reload()).run.potions,1,on+': committed once');
  const revision=(await stored(store)).revision;
  assert.equal((await k.retry()).code,'nothing-to-retry',on+': a completed commit is never retried');
  assert.equal((await stored(store)).revision,revision);assert.equal((await reload()).run.potions,1,on+': no second potion spent');
  // Not stuck busy: the next deliberate command runs and spends exactly one more potion.
  assert.ok((await k.drinkPotion()).ok);assert.equal((await reload()).run.potions,0);assert.equal(k.pending,false);
 }
 // Observer throws on a failed save: still failed, nothing acknowledged, and one retry applies it once.
 {
  const {k,adapter,reload}=await setup(low(),thrower('failed'));
  adapter.failAfter(0);const r=await k.drinkPotion();adapter.clearFailure();
  assert.equal(r.ok,false);assert.equal(r.status,'failed');assert.equal(k.status,'failed');assert.equal(k.pending,false);
  assert.equal(k.state.run.potions,2);assert.equal((await reload()).run.potions,2);
  assert.ok((await k.retry()).ok);assert.equal((await reload()).run.potions,1);assert.equal((await k.retry()).code,'nothing-to-retry');
  assert.equal((await reload()).run.potions,1);
 }
 // Observer throws on a stale session: still stale, nothing acknowledged or stored, nothing pending.
 {
  const {k,adapter,time,clock,reload}=await setup(low(),thrower('stale'));
  time.now+=10001;assert.ok((await S.createStore({adapter,sessionId:'tab-b',clock}).acquireLease(ID)).ok);
  const r=await k.drinkPotion();assert.equal(r.code,'fenced');assert.equal(k.status,'stale');assert.equal(k.pending,false);
  assert.equal(k.state.run.potions,2);assert.equal((await reload()).run.potions,2);
  assert.equal((await k.drinkPotion()).code,'stale');assert.equal((await k.retry()).code,'nothing-to-retry');
 }
});
