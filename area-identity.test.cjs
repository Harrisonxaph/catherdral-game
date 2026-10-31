const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('./floors.js');
const C=require('./character-state.js');
const {loadGame,signature,worldDigest}=require('./tests/generation-harness.cjs');
const golden=require('./tests/fixtures/p2-pr1-generation-golden.json');
const SEEDS=golden.seeds;
// The save schema's ID rule (character-state.js idText): stable IDs must be storable as ledger and instance keys later.
const storable=id=>typeof id==='string'&&id.length>0&&id.length<=C.limits.idLength&&/^[A-Za-z0-9:._-]+$/.test(id)&&!(id in Object.prototype);

test('Identity helpers are pure, bounded and aligned with the save schema locations',()=>{
 assert.deepEqual([...F.locations],[...C.locations]);
 assert.equal(F.instanceId(1,0),'forgotten-crypt:s00000000');assert.equal(F.instanceId(5,0xffffffff),'throne-of-ash:sffffffff');
 assert.equal(F.entityId('crimson-chapel:s0000002a','chest',7),'crimson-chapel:s0000002a:chest:7');
 for(const bad of [[0,1],[6,1],[1,-1],[1,2**32],[1,1.5],[1,'7']])assert.throws(()=>F.instanceId(...bad),RangeError);
 for(const bad of [['nowhere:s00000000','spawn',0],['forgotten-crypt','spawn',0],['forgotten-crypt:s00000000','boss',0],['forgotten-crypt:s00000000','spawn',-1],['forgotten-crypt:s00000000','spawn',F.MAX_ENTITIES],['forgotten-crypt:s00000000','spawn',1.5]])assert.throws(()=>F.entityId(...bad),RangeError);
 const longest=F.entityId(F.instanceId(4,0xffffffff),'spawn',F.MAX_ENTITIES-1);assert.ok(storable(longest),longest);
 const w=F.generate(F.get(2),()=>.25);assert.equal(F.layoutHash(w),F.layoutHash(F.generate(F.get(2),()=>.25)));
 assert.notEqual(F.layoutHash(w),F.layoutHash(F.generate(F.get(2),()=>.75)));
});

test('Generation is unchanged from main for all five floors x 100 seeds: layout, entities, positions and RNG draw order',()=>{
 const g=loadGame();
 for(let floor=1;floor<=5;floor++){
  const expected=golden.floors[floor];assert.equal(expected.signatures.length,SEEDS);
  for(let seed=1;seed<=SEEDS;seed++)assert.equal(signature(g.build(floor,seed)),expected.signatures[seed-1],'floor '+floor+' seed '+seed+' differs from '+golden.baseline);
  // The graphics captures' pinned seed: same world digest, so the 25-scene budget digests cannot drift.
  g.build(floor,golden.graphicsSeed);
  assert.equal(signature(g),expected.graphicsSeed.signature);assert.equal(worldDigest(g.world),expected.graphicsSeed.worldDigest);
  assert.equal(g.enemies.length,expected.graphicsSeed.enemies);assert.equal(g.chests.length,expected.graphicsSeed.chests);
 }
});

test('Every initial spawn and chest gets a stable, unique, storable ID scoped by area instance',()=>{
 const g=loadGame(),seen=new Set();
 for(let floor=1;floor<=5;floor++)for(let seed=1;seed<=SEEDS;seed++){
  g.build(floor,seed);const m=g.areaManifest,instance=F.instanceId(floor,seed);
  assert.equal(m.locationId,F.locations[floor-1]);assert.equal(m.instanceId,instance);assert.equal(m.seed,seed);
  assert.equal(m.generatorVersion,F.GENERATOR_VERSION);assert.equal(m.layoutHash,F.layoutHash(g.world));
  assert.equal(m.spawns.length,g.enemies.length);assert.equal(m.chests.length,g.chests.length);
  g.enemies.forEach((e,i)=>{assert.equal(e.spawnId,F.entityId(instance,'spawn',i));assert.deepEqual({...m.spawns[i]},{id:e.spawnId,type:e.type,x:e.x,y:e.y});});
  g.chests.forEach((c,i)=>{assert.equal(c.chestId,F.entityId(instance,'chest',i));assert.deepEqual({...m.chests[i]},{id:c.chestId,x:c.x,y:c.y});});
  for(const id of [...m.spawns,...m.chests].map(r=>r.id)){assert.ok(storable(id),id);assert.ok(id.startsWith(instance+':'));assert.ok(!seen.has(id),'collision '+id);seen.add(id);}
  assert.ok(Object.isFrozen(m)&&Object.isFrozen(m.spawns)&&Object.isFrozen(m.spawns[0]));
 }
 assert.ok(seen.size>20000,'covered '+seen.size+' identities');
});

test('Regenerating the same floor and seed in a fresh game reproduces identical IDs and positions',()=>{
 const first=loadGame(),second=loadGame();
 for(let floor=1;floor<=5;floor++)for(const seed of [1,7,42,99,0xffffffff,golden.graphicsSeed]){
  const a=JSON.stringify(first.build(floor,seed).areaManifest);
  assert.equal(JSON.stringify(second.build(floor,seed).areaManifest),a,'floor '+floor+' seed '+seed);
  // Building other floors in between must not change it either.
  second.build(floor===5?1:floor+1,seed+1);assert.equal(JSON.stringify(second.build(floor,seed).areaManifest),a);
 }
});

test('Summoned minions and later spawns get no spawn ID and leave the manifest untouched',()=>{
 const g=loadGame().build(3,5),before=JSON.stringify(g.areaManifest),count=g.enemies.length;
 const minion=g.spawnEnemy(g.world.start.cx+.5,g.world.start.cy+.5,'ghoul');
 assert.equal(minion.spawnId,undefined);assert.equal(g.enemies.length,count+1);assert.equal(JSON.stringify(g.areaManifest),before);
});
