const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('./character-state.js');
const G=require('./campaign-state.js');
const E=require('./equipment.js');
const S=require('./save-store.js');
const V=require('./game-session.js');
const {loadGame}=require('./tests/generation-harness.cjs');
const ID='0f1e2d3c-aaaa-4bbb-8ccc-123456789abc';
const game=loadGame(),manifest=(floor,seed)=>game.build(floor,seed).areaManifest;
const fresh=()=>{const s=C.create();s.characterId=ID;s.revision=1;s.createdAt='2026-11-01T00:00:00.000Z';return s;};
const ok=r=>{assert.ok(r.ok,JSON.stringify(r).slice(0,400));return r.state;};
const roundTrip=s=>{const env=C.envelope(C.dehydrate(s),{characterId:ID,revision:2,createdAt:'2026-11-01T00:00:00.000Z',savedAt:'2026-11-01T00:00:00.000Z',sessionId:'t',leaseEpoch:1});const h=C.hydrate(env);assert.ok(h.ok,JSON.stringify(h.errors));return h.state;};
async function stored(state=fresh()){
 const adapter=S.memoryAdapter(),time={now:Date.parse('2026-11-01T00:00:00Z')},clock=()=>time.now,store=S.createStore({adapter,sessionId:'tab-a',clock,leaseMs:10000});
 const {epoch}=await store.acquireLease(ID);assert.ok((await store.create(ID,C.dehydrate(state),epoch)).ok);
 return {adapter,store,epoch,time,clock,envelope:(await store.load(ID)).envelope,reload:async()=>C.hydrate((await store.load(ID)).envelope).state};
}

test('Snapshot: runtime health, shield and timers are clamped to saved bounds and never refill or revive',()=>{
 const s=fresh(),max=s.stats.maxHp;
 assert.equal(V.applySnapshot(s,null).applied,false);
 assert.equal(V.applySnapshot(s,{hp:max,shield:s.character.resources.equipmentShield,cooldowns:{execution:0,aegis:0,stunning:0},attackRemaining:0,dodgeRemaining:0,firePassiveRemaining:0,shieldDelay:0}).applied,false,'identical values write nothing');
 const r=ok(V.applySnapshot(s,{hp:61.5,shield:9999,cooldowns:{execution:99,aegis:-4,stunning:3},attackRemaining:5,dodgeRemaining:1,firePassiveRemaining:-1,shieldDelay:1e9}));
 assert.equal(r.character.resources.hp,61.5);assert.equal(r.character.resources.equipmentShield,E.stats(s.stats,s.run).shield,'shield is capped by the equipped capacity');
 assert.deepEqual(r.character.timers.abilityCooldowns,{execution:8,aegis:0,stunning:3});assert.equal(r.character.timers.attackRemaining,2);assert.equal(r.character.timers.firePassiveRemaining,0);
 assert.equal(ok(V.applySnapshot(s,{hp:max*5})).character.resources.hp,max,'never above derived maximum');
 assert.equal(V.applySnapshot(s,{hp:0}).applied,false,'zero health is recorded by the death command, not a snapshot');
 assert.equal(V.applySnapshot(s,{hp:NaN,cooldowns:{aegis:'x'}}).applied,false);
 const dead=ok(require('./command-coordinator.js').recordDeath(s,'death-1'));
 assert.equal(V.applySnapshot(dead,{hp:50}).applied,false,'a snapshot never revives a pending death');
 assert.equal(s.character.resources.hp,max,'input untouched');
});

test('Respawn: once per respawn ID, full health at the checkpoint, every possession and cooldown kept',()=>{
 const K=require('./command-coordinator.js');let s=fresh();
 s=ok(V.applySnapshot(s,{hp:20,cooldowns:{aegis:12}}));s=ok(K.drinkPotion(s));
 assert.equal(V.respawn(s,{respawnId:'r-1'}).code,'alive','a living character cannot respawn');
 const dead=ok(K.recordDeath(s,'death-1')),risen=ok(V.respawn(dead,{respawnId:'respawn-death-1'}));
 assert.equal(risen.character.resources.hp,risen.stats.maxHp);assert.deepEqual(risen.world.lifecycle,{mode:'alive',deathId:null,lastRespawnId:'respawn-death-1'});
 for(const k of ['lifetimeXp','ash','level','deaths'])assert.equal(risen.character[k],dead.character[k]);
 assert.equal(risen.run.potions,dead.run.potions,'no potion refill');assert.equal(risen.character.timers.abilityCooldowns.aegis,12,'cooldowns survive death');
 assert.equal(risen.campaign.activeCheckpointId,'forgotten-crypt:entrance');
 assert.equal(V.respawn(risen,{respawnId:'respawn-death-1'}).applied,false,'repeating the same respawn is a no-op');
 assert.equal(V.respawn(risen,{respawnId:'respawn-death-2'}).code,'alive');assert.equal(V.respawn(dead,{}).code,'invalid');
 roundTrip(risen);
});

test('Inventory sync only rearranges saved items: nothing created, copied, lost or refilled',()=>{
 const s=fresh(),sword=E.item('rustbound');s.run.bag[0]=sword;const base=ok(G.transition(s,()=>{}));
 const swapped={main:base.run.bag[0],off:base.run.off,bag:[base.run.main,...base.run.bag.slice(1)],potions:base.run.potions};
 const r=ok(V.syncRun(base,swapped));assert.equal(r.run.main.id,sword.id);assert.equal(r.run.bag[0].id,base.run.main.id);roundTrip(r);
 assert.equal(V.syncRun(r,swapped).applied,false,'the same arrangement writes nothing');
 assert.equal(V.syncRun(base,{...swapped,bag:[E.item('rustbound'),...swapped.bag.slice(1)]}).code,'mismatch','a new item cannot appear');
 assert.equal(V.syncRun(base,{...swapped,bag:[null,...swapped.bag.slice(1)]}).code,'mismatch','an item cannot vanish');
 assert.equal(V.syncRun(base,{...swapped,bag:[swapped.main,...swapped.bag.slice(1)]}).code,'mismatch','an item cannot be held twice');
 assert.equal(V.syncRun(base,{...swapped,potions:3}).code,'mismatch','potions change only through potion commands');
 const forged={...base.run.main,mods:[{stat:'damage',value:999}]};
 assert.equal(ok(V.syncRun(base,{...base.run,main:forged,bag:base.run.bag.slice()})).run.main,base.run.main,'the saved item object is kept, never the runtime copy');
 // Unequipping the shield clamps the stored equipment shield to the new (zero) capacity.
 const shieldless={main:base.run.main,off:null,bag:[base.run.bag[0],base.run.off,...base.run.bag.slice(2)],potions:base.run.potions};
 const r2=ok(V.syncRun(base,shieldless));assert.equal(r2.character.resources.equipmentShield,0);roundTrip(r2);
});

test('Arrival records the area and checkpoint; the transition recovery is granted once per location',()=>{
 let s=fresh();const m1=manifest(1,101),m2=manifest(2,202);
 s=ok(V.arrive(s,{manifest:m1}));assert.equal(s.world.currentInstanceId,m1.instanceId);assert.equal(s.campaign.activeCheckpointId,'forgotten-crypt:entrance');assert.equal(s.run.potions,2,'no recovery on the first floor');
 assert.equal(V.arrive(s,{manifest:m1}).applied,false,'arriving again changes nothing');
 assert.equal(V.arrive(s,{manifest:m2}).code,'locked');
 s=ok(G.completeArea(s,{locationId:'forgotten-crypt'}));s=ok(V.applySnapshot(s,{hp:40}));
 const r=V.arrive(s,{manifest:m2});s=ok(r);const max=s.stats.maxHp;
 assert.deepEqual(r.recovered,{hp:Math.round(max*.2),potions:1});assert.equal(s.character.resources.hp,40+Math.round(max*.2));assert.equal(s.run.potions,3);
 assert.equal(s.campaign.activeCheckpointId,'plague-halls:entrance');assert.ok(s.campaign.storyFlags.includes('recovery:plague-halls'));
 // Going back and forth never grants it again.
 const back=ok(V.arrive(s,{manifest:m1})),again=V.arrive(back,{manifest:m2});ok(again);assert.equal(again.recovered,null);assert.equal(again.state.run.potions,3);
 const dead=ok(require('./command-coordinator.js').recordDeath(s,'d'));assert.equal(V.arrive(dead,{manifest:m1}).code,'dead');
 roundTrip(again.state);
});

test('Dropped items move to the ground under their own item ID and back; foreign or forged drop IDs are invalid',()=>{
 let s=fresh();const m=manifest(1,303);s=ok(V.arrive(s,{manifest:m}));
 const relic=E.item('rustbound');s.run.bag[2]=relic;s=ok(G.transition(s,()=>{}));
 const dropped=ok(G.dropItem(s,{instanceId:m.instanceId,itemId:relic.id,x:3.5,y:4.5}));
 assert.equal(dropped.run.bag[2],null);const d=dropped.world.instances[m.instanceId].groundDrops[0];
 assert.deepEqual([d.dropId,d.item,d.rewardKey],[m.instanceId+':item:'+relic.id,relic,null]);
 const back=roundTrip(dropped);assert.equal(back.world.instances[m.instanceId].groundDrops[0].item.id,relic.id);
 assert.equal(G.dropItem(dropped,{instanceId:m.instanceId,itemId:relic.id,x:0,y:0}).code,'missing','an item can only be dropped once');
 const picked=ok(G.pickUp(dropped,{instanceId:m.instanceId,dropId:d.dropId}));assert.equal(picked.run.bag.filter(i=>i&&i.id===relic.id).length,1);
 // The schema refuses an item drop ID that names a different item.
 const payload=C.dehydrate(dropped);payload.world.instances[m.instanceId].groundDrops[0].dropId=m.instanceId+':item:'+(relic.id+1);
 const check=C.validate(C.envelope(payload,{characterId:ID,revision:2,createdAt:'2026-11-01T00:00:00.000Z',savedAt:'2026-11-01T00:00:00.000Z',sessionId:'t',leaseEpoch:1}));
 assert.equal(check.ok,false);assert.ok(check.errors.some(e=>/dropId/.test(e.path)));
});

test('Restore plan rebuilds killed, opened and dropped state; a differently generated area is refused',()=>{
 let s=fresh();const m=manifest(1,404);s=ok(V.arrive(s,{manifest:m}));
 s=ok(G.recordKill(s,{instanceId:m.instanceId,spawnId:m.spawns[0].id,xp:10,drops:[{kind:'ash',amount:2,x:1,y:1}]}));
 if(m.chests.length)s=ok(G.openChest(s,{instanceId:m.instanceId,chestId:m.chests[0].id}));
 const plan=V.restorePlan(s,m);assert.ok(plan.ok);assert.ok(plan.known);assert.ok(plan.killed.has(m.spawns[0].id));assert.equal(plan.drops.length,1);
 if(m.chests.length)assert.ok(plan.opened.has(m.chests[0].id));
 assert.equal(V.restorePlan(s,{...m,layoutHash:'00000000'}).code,'area-mismatch');
 assert.equal(V.restorePlan(s,manifest(1,405)).known,false);
 assert.deepEqual(V.currentArea(s),{locationId:'forgotten-crypt',floor:1,seed:404,instanceId:m.instanceId});
 assert.equal(V.currentArea(fresh()).seed,null);
});

test('Session: events apply in order, taps are refused while saving, and a failed save halts until retry',async()=>{
 const m=manifest(1,505),env=await stored();let runtime={hp:C.create().stats.maxHp};
 const session=V.createSession({store:env.store,characterId:ID,epoch:env.epoch,envelope:env.envelope,snapshot:()=>({hp:runtime.hp})});
 assert.ok((await session.enqueue('arrive',s=>V.arrive(s,{manifest:m}))).ok);
 // The potion decision uses current runtime health folded in by the snapshot, not the stale committed value.
 runtime.hp=30;const K=require('./command-coordinator.js');
 const [a,b]=await Promise.all([session.enqueue('potion',s=>K.drinkPotion(s),{tap:true}),session.enqueue('potion',s=>K.drinkPotion(s),{tap:true})]);
 assert.ok(a.ok);assert.equal(b.code,'busy');assert.equal(a.healed,Math.round(session.state.stats.maxHp*.42));assert.equal((await env.reload()).run.potions,1);
 // Three kills queued while the store fails on the second: the second halts the queue, the third waits behind it.
 const kill=n=>session.enqueue('kill',s=>G.recordKill(s,{instanceId:m.instanceId,spawnId:m.spawns[n].id,xp:5}));
 const first=await kill(0);assert.ok(first.ok);
 env.adapter.failAfter(0);const second=kill(1),third=kill(2);
 await new Promise(r=>setTimeout(r,20));env.adapter.clearFailure();
 assert.equal(session.halted,true);assert.equal(session.status,'failed');assert.equal(session.pending,2);
 assert.deepEqual((await env.reload()).world.instances[m.instanceId].killed,[m.spawns[0].id],'nothing after the failure was stored');
 assert.ok(session.hasUnsaved);
 const retried=await session.retry();assert.ok(retried.ok,JSON.stringify(retried));
 assert.ok((await second).ok);assert.ok((await third).ok);
 const s=await env.reload();assert.deepEqual(s.world.instances[m.instanceId].killed,[0,1,2].map(n=>m.spawns[n].id),'applied once each, in order');
 assert.equal(s.character.lifetimeXp,15);assert.equal(session.halted,false);assert.equal((await session.retry()).code,'nothing-to-retry');
 // Stale: another tab took over. Everything queued resolves as refused; nothing more is stored.
 env.time.now+=10001;assert.ok((await S.createStore({adapter:env.adapter,sessionId:'tab-b',clock:env.clock}).acquireLease(ID)).ok);
 const stale=await kill(3);assert.equal(stale.code,'fenced');assert.equal(session.status,'stale');
 assert.equal((await kill(4)).code,'stale');assert.equal((await env.reload()).world.instances[m.instanceId].killed.length,3);
});
