const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('./abilities.js'),E=require('./equipment.js'),N=require('./enemy-system.js'),F=require('./floors.js');
function harness(){let active=true,ready=true;const effects=[],strikes=[],p={x:5,y:5,maxHp:100,range:1.7,arc:1.06,facing:0},gear={damage:40,crit:0,critMultiplier:1.9};
 const abilities=A.createRuntime({active:()=>active,player:()=>p,stats:()=>gear,meleeReady:()=>ready,lock(){},effect:(...e)=>effects.push(e),strike:(...s)=>strikes.push(s)});return {abilities,p,gear,effects,strikes,active:v=>active=v,ready:v=>ready=v};}
test('Definitions activate once, have fixed cooldowns, pause, expire and restart',()=>{
 const h=harness(),a=h.abilities;assert.equal(A.definitions.execution.cooldown,8);assert.equal(A.definitions.aegis.cooldown,20);assert.equal(A.definitions.stunning.cooldown,18);
 for(const id of Object.keys(A.definitions)){a.reset();assert.equal(a.activate(id),true);assert.equal(a.activate(id),false);h.active(false);a.tick(100);assert.equal(a.cooldowns[id],A.definitions[id].cooldown);h.active(true);a.tick(.2);if(id!=='aegis')assert.equal(h.strikes.at(-1)[0].id,id);a.cancelCast();assert.ok(a.cooldowns[id]>0);}
 a.reset();h.ready(false);assert.equal(a.activate('execution'),false);assert.equal(a.activate('aegis'),true);assert.equal(a.barrier.capacity,35);a.tick(3);assert.equal(a.barrier.capacity,0);assert.ok(h.effects.some(e=>e[0]==='aegis-expire'));a.reset();assert.ok(Object.values(a.cooldowns).every(v=>v===0));
});
test('Execution damage uses one equipment calculation for all loadouts and critical hits',()=>{
 const run=E.createRun(),base={damage:30,attackRate:.36,crit:0};
 for(const type of ['shield','dual','two','unarmed']){
  if(type==='dual'){E.collect(run,E.item('rustbound'));E.equip(run,run.bag.findIndex(Boolean),'off');}
  if(type==='two'){E.collect(run,E.item('ashbringer'));E.equip(run,run.bag.findIndex(i=>i?.key==='ashbringer'),'main');}
  if(type==='unarmed')E.unequip(run,'main');
  const gear=E.stats(base,run);assert.equal(A.calculateDamage(gear,2,false),gear.damage*2);assert.equal(A.calculateDamage(gear,2,true),gear.damage*2*gear.critMultiplier);
 }
});
test('Targets obey arc, range, line of sight, health and nearest-first order',()=>{
 const p={x:5,y:5,facing:0,range:1.7,arc:1},near={x:6,y:5,r:.3},far={x:6.5,y:5,r:.3},behind={x:4,y:5,r:.3},blocked={x:5.5,y:5,r:.3,blocked:true},outside={x:9,y:5,r:.3},dead={x:5.1,y:5,r:.3,dead:true};
 assert.deepEqual(A.targets(p,[far,behind,blocked,near,outside,dead],(a,b)=>!b.blocked),[near,far]);
});
test('Aegis cannot accumulate, breaks visibly, and reactivation creates fresh capacity only after cooldown',()=>{
 const h=harness(),a=h.abilities;a.activate('aegis');assert.deepEqual(a.absorb(20),{blocked:20,remaining:0});assert.equal(a.activate('aegis'),false);assert.equal(a.barrier.capacity,15);assert.deepEqual(a.absorb(30),{blocked:15,remaining:15});assert.ok(h.effects.some(e=>e[0]==='aegis-break'));a.tick(20);h.p.maxHp=200;assert.equal(a.activate('aegis'),true);assert.equal(a.barrier.capacity,70);
});
function enemyHarness(){const enemies=[],player={x:5,y:5},w={W:20,H:20,ix:(x,y)=>y*20+x,walk:(x,y)=>x>0&&x<19&&y>0&&y<19},flow=new Int16Array(400);const r=N.createRuntime({world:()=>w,player:()=>player,enemies:()=>enemies,flow:()=>flow,free:()=>true,move(e,x,y){e.x+=x;e.y+=y},random:()=>.5,spawn(){throw Error('Summon during stun')},damage(){},hurt(){},bolt(){throw Error('Bolt during stun')},effect(){},allowed:()=>true});return {r,enemies,spawn(type){const e=N.create(type,6,5,F.get(1));e.state='preparing';e.stateTime=10;enemies.push(e);return e;}};}
test('All ordinary archetypes can be ability-stunned, stay still, and gain recovery immunity',()=>{
 for(const type of Object.keys(N.definitions)){
  const h=enemyHarness(),e=h.spawn(type);assert.ok(h.r.stun(e,2,{source:'ability'}),type);const duration=type==='guardian'?1:2,x=e.x,y=e.y;
  h.r.tick(duration-.1);assert.equal(e.state,'stunned');assert.equal(e.x,x);assert.equal(e.y,y);assert.equal(h.r.stun(e,2,{source:'ability'}),false);
  h.r.tick(.11);assert.notEqual(e.state,'stunned');assert.equal(h.r.stun(e,2,{source:'ability'}),false);
 }
});
test('Configurable bosses stagger for .75s; protected actions and hazards survive interruption',()=>{
 const h=enemyHarness(),e={type:'boss',x:6,y:5,hp:100,dead:false,state:'chasing'};h.enemies.push(e);assert.ok(h.r.stun(e,2,{source:'ability'}));assert.equal(e.stateTime,.75);h.r.tick(.8);assert.notEqual(e.state,'stunned');
 e.stunLock=0;e.controlResistance={durationCap:.4,postRecoveryImmunity:3};assert.ok(h.r.stun(e,2,{source:'ability'}));assert.equal(e.stateTime,.4);h.r.tick(.5);e.stunLock=0;e.attackInterruptible=false;assert.equal(h.r.stun(e,2,{source:'ability'}),false);
 e.attackInterruptible=true;e.state='chasing';const active=h.r.addHazard({x:10,y:10,owner:e,warning:0,duration:20}),protectedWarning=h.r.addHazard({x:10,y:10,owner:e,warning:10,duration:20,interruptible:false,cancelOnStun:true}),ordinary=h.r.addHazard({owner:e,warning:10,cancelOnStun:true});assert.ok(h.r.stun(e,2,{source:'ability'}));h.r.tick(.1);assert.ok(h.r.hazards.includes(active));assert.ok(h.r.hazards.includes(protectedWarning));assert.ok(!h.r.hazards.includes(ordinary));
});
