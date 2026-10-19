const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function game(){
  const elements=new Map(),events=[],handlers={};
  const context2d=new Proxy({}, {get:()=>()=>{}});
  const element=()=>({style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},getContext:()=>context2d,querySelectorAll:()=>[],textContent:'',innerHTML:'',width:130,height:130});
  const story={paused:false,objects:[],connect(a){this.adapter=a},setup(){},update(){},emit(name,detail){events.push({name,detail})},canLeave:()=>true};
  const sandbox={document:{hidden:false,addEventListener(name,fn){handlers[name]=fn},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)}},localStorage:{getItem(){return null},setItem(){}},innerWidth:393,innerHeight:852,devicePixelRatio:1,addEventListener(name,fn){handlers[name]=fn},requestAnimationFrame(){},VesperStory:story,VesperFloors:require('./floors.js'),VesperEnemies:require('./enemy-system.js'),VesperEquipment:require('./equipment.js'),VesperInventoryUI:{create(adapter){this.adapter=adapter;return {isOpen:false}}}};sandbox.window=sandbox;
  const script=fs.readFileSync('index.html','utf8').match(/<script>\s*'use strict';([\s\S]*?)<\/script>/)[1];
  vm.createContext(sandbox);vm.runInContext(script.replace(/\}\)\(\);\s*$/,`window.testGame={equipmentStats,reconcileEquipment,checkEncounter,collectEquipment,dropEquipment,openInventory(){window.VesperInventoryUI.adapter.pause()},closeInventory(){window.VesperInventoryUI.adapter.resume()},get gear(){return runEquipment},get loot(){return loots},get fireCooldown(){return fireCooldown},get encounter(){return encounter},setRandom(fn){rand=fn},hurt,spawnEnemy,combat,damageEnemy,fireBolt,get bullets(){return bullets},startGame,tick,attemptAttack,dash,drink,killEnemy,die,nextFloor,get player(){return player},get enemies(){return enemies},get state(){return state},get floor(){return floor},get portalReady(){return portalReady},get attackTimer(){return attackTimer},get dashTime(){return dashTime},get world(){return world},get finalEncounter(){return finalEncounter},get needed(){return needed},hurt,free,moveEntity,setKey(k,v){key[k]=v},atExit(){player.x=stair.x;player.y=stair.y;portalNear=true}};})();`),sandbox);
  return {g:sandbox.testGame,story,events,handlers,document:sandbox.document};
}
test('Movement, combat, dash, potions and safe reading pause',()=>{
  const {g,story}=game();g.startGame();const x=g.player.x;g.setKey('d',true);g.tick(.04);assert.ok(g.player.x>x);g.setKey('d',false);
  story.paused=true;const before=JSON.stringify(g.player);g.setKey('d',true);g.tick(.04);g.attemptAttack();g.dash();assert.equal(JSON.stringify(g.player),before);assert.equal(g.attackTimer,0);assert.equal(g.dashTime,0);
  story.adapter.clearInput();story.paused=false;g.tick(.04);assert.equal(JSON.stringify(g.player),before);
  g.attemptAttack();assert.ok(g.attackTimer>0);g.dash();assert.ok(g.dashTime>0);g.player.hp=50;const count=g.player.potions;g.drink();assert.ok(g.player.hp>50);assert.equal(g.player.potions,count-1);
});
test('Guardian, seal, chapter exit and death use real gameplay hooks',()=>{
  const {g,story,events}=game();g.startGame();assert.ok(g.enemies.some(e=>e.type==='boss'));g.player.xpNeeded=1e9;
  for(const enemy of g.enemies)g.killEnemy(enemy);
  assert.equal(events.filter(e=>e.name==='boss-defeated').length,1);assert.equal(events.filter(e=>e.name==='seal-open').length,1);assert.equal(g.portalReady,true);
  g.atExit();story.canLeave=()=>false;g.nextFloor();assert.equal(g.floor,1);story.canLeave=()=>true;g.nextFloor();assert.equal(g.floor,2);assert.equal(events.filter(e=>e.name==='floor-left').length,1);
  g.die();g.die();assert.equal(events.filter(e=>e.name==='player-died').length,1);g.startGame();assert.equal(g.floor,1);assert.equal(g.state,'playing');
});
test('Chapter props fit procedurally generated chambers',()=>{
  const {g}=game();for(let i=0;i<25;i++){g.startGame();const w=g.world,r=w.start;for(const [x,y] of [[r.cx+1.5,r.cy+.5],[r.cx-.5,r.cy+.5],[r.cx+.5,r.cy-1.5],[w.exit.cx+.5,w.exit.cy+1.5]])assert.equal(w.walk(Math.floor(x),Math.floor(y)),true);}
});

test('All five floors: reachable spawns, increasing difficulty, final guards gate exits, finite ending',()=>{
 const {g,events}=game();g.startGame();g.player.xpNeeded=1e9;
 let previous={area:0,count:0,hp:0,damage:0};
 for(let floor=1;floor<=5;floor++){
  const w=g.world, config=w.config;
  assert.equal(g.floor,floor);assert.equal(config.final,[1,3,5].includes(floor)?'boss':'elite');
  const seen=new Set(),queue=[w.ix(w.start.cx,w.start.cy)];seen.add(queue[0]);
  for(let n=0;n<queue.length;n++){const cell=queue[n],x=cell%w.W,y=Math.floor(cell/w.W);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(w.walk(x+dx,y+dy)){const next=w.ix(x+dx,y+dy);if(!seen.has(next)){seen.add(next);queue.push(next);}}}
  for(const e of [...g.enemies,{x:w.exit.cx+.5,y:w.exit.cy+.5}]){assert.ok(seen.has(w.ix(Math.floor(e.x),Math.floor(e.y))));assert.ok(g.free(e.x,e.y,e.r));}
  const normal=g.enemies.find(e=>e.type==='bone'&&!e.finalGuard);
  assert.ok(seen.size>previous.area);assert.ok(g.enemies.length>previous.count);if(normal){assert.ok(normal.maxHp>previous.hp);assert.ok(normal.dmg>previous.damage);}
  previous={area:seen.size,count:g.enemies.length,hp:normal?.maxHp||previous.hp,damage:normal?.dmg||previous.damage};
  g.atExit();g.nextFloor();assert.equal(g.floor,floor);
  for(const e of g.enemies.filter(e=>!e.finalGuard))g.killEnemy(e);
  assert.equal(g.portalReady,false);g.atExit();g.nextFloor();assert.equal(g.floor,floor);
  const guards=g.finalEncounter;for(const e of guards.slice(0,-1))g.killEnemy(e);assert.equal(g.portalReady,false);
  g.killEnemy(guards.at(-1));assert.equal(g.portalReady,true);
  g.atExit();g.nextFloor();assert.equal(g.floor,Math.min(5,floor+1));
 }
 assert.equal(g.state,'complete');assert.equal(events.filter(e=>e.name==='run-complete').length,1);g.nextFloor();assert.equal(g.floor,5);
 g.startGame();assert.equal(g.state,'playing');assert.equal(g.floor,1);
});
test('Procedural floors stay connected across 100 seeds per floor',()=>{
 const floors=require('./floors.js');
 for(const config of floors.floors)for(let seed=1;seed<=100;seed++){
  let value=seed;const w=floors.generate(config,()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;});
  const seen=new Set([w.ix(w.start.cx,w.start.cy)]),queue=[...seen];
  for(let n=0;n<queue.length;n++){const c=queue[n],x=c%w.W,y=Math.floor(c/w.W);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(w.walk(x+dx,y+dy)){const next=w.ix(x+dx,y+dy);if(!seen.has(next)){seen.add(next);queue.push(next);}}}
  assert.equal(seen.size,w.g.reduce((n,t)=>n+(t===0),0));
 }
});

test('Visible blur clears input without pausing; backgrounding pauses; game gestures do not zoom',()=>{
 const {g,story,handlers,document}=game();g.startGame();g.setKey('d',true);
 handlers.blur();assert.equal(g.state,'playing');const x=g.player.x;g.tick(.04);assert.equal(g.player.x,x);
 document.hidden=true;handlers.visibilitychange();assert.equal(g.state,'paused');
 document.hidden=false;handlers.visibilitychange();assert.equal(g.state,'paused');
 g.startGame();let prevented=0;const event={cancelable:true,target:{closest:()=>true},preventDefault(){prevented++}};
 handlers.touchend(event);handlers.gesturestart(event);handlers.gesturechange(event);handlers.dblclick(event);assert.equal(prevented,4);
 handlers.touchend({...event,target:{closest:()=>false}});assert.equal(prevented,4);
 story.paused=true;handlers.gesturestart(event);handlers.touchend(event);assert.equal(prevented,4);
});

test('Projectile cap, expiry, summon rewards and floor-reset cleanup use game hooks',()=>{
 const {g}=game();g.startGame();g.player.xpNeeded=1e9;
 for(let i=0;i<100;i++)g.fireBolt(g.player.x+2,g.player.y,0,10);
 assert.equal(g.bullets.length,48);for(let i=0;i<100;i++)g.tick(.04);assert.equal(g.bullets.length,0);
 const m=g.spawnEnemy(g.player.x+1,g.player.y,'ghoul');m.minion=true;m.xp=0;
 const xp=g.player.xp;g.killEnemy(m);assert.equal(g.player.xp,xp);
 g.combat.addHazard({x:g.player.x,y:g.player.y,duration:100});g.combat.status('poison',10,2);
 for(const e of g.enemies)g.killEnemy(e);g.atExit();g.nextFloor();assert.equal(g.floor,2);assert.equal(g.combat.hazards.length,0);assert.equal(g.combat.statuses.length,0);
});

test('Equipment remains across floors, resets on retry, and inventory cannot refresh combat timers or shield',()=>{
 const E=require('./equipment.js'),{g}=game();g.startGame();g.player.xpNeeded=1e9;
 E.collect(g.gear,E.item('ashbringer'));assert.equal(E.equip(g.gear,0,'main').ok,true);g.reconcileEquipment();
 const carried=JSON.stringify(g.gear);g.attemptAttack();const attack=g.attackTimer;
 g.openInventory();g.tick(10);g.attemptAttack();g.drink();assert.equal(g.attackTimer,attack);assert.equal(JSON.stringify(g.gear),carried);g.closeInventory();
 for(const enemy of g.enemies)g.killEnemy(enemy);g.atExit();g.nextFloor();assert.equal(g.floor,2);assert.equal(g.gear.main.key,'ashbringer');assert.equal(g.gear.bag.length,6);
 g.die();g.startGame();assert.equal(g.gear.main.key,'rustbound');assert.equal(g.gear.bag.filter(Boolean).length,0);assert.equal(g.player.potions,2);
});
test('Boss encounter rewards are generic and once-only, independent of kill order',()=>{
 const {g}=game();g.startGame();g.player.xpNeeded=1e9;g.setRandom(()=>.5);
 const ordinary=g.enemies.filter(e=>!e.finalGuard);for(const e of ordinary)g.killEnemy(e);
 assert.equal(g.loot.filter(l=>l.kind==='equipment').length,0);
 const boss=g.finalEncounter.find(e=>e.type==='boss');g.killEnemy(boss);assert.equal(g.loot.filter(l=>l.kind==='equipment').length,0);
 for(const e of g.finalEncounter)g.killEnemy(e);const count=g.loot.filter(l=>l.kind==='equipment').length;assert.equal(count,1);
 g.checkEncounter();g.killEnemy(boss);assert.equal(g.loot.filter(l=>l.kind==='equipment').length,count);
});
test('Full backpack and repeated pickups cannot delete or duplicate a ground item',()=>{
 const E=require('./equipment.js'),{g}=game();g.startGame();for(let i=0;i<6;i++)E.collect(g.gear,E.item('rustbound'));
 const item=E.item('bloodforged');g.dropEquipment(item,g.player.x,g.player.y);g.tick(.5);g.collectEquipment();assert.equal(g.loot.find(l=>l.item===item).gone,undefined);
 E.drop(g.gear,0);g.collectEquipment();g.collectEquipment();assert.equal(g.gear.bag.filter(i=>i?.id===item.id).length,1);assert.equal(g.loot.find(l=>l.item===item).gone,true);
});
test('Three-potion capacity, defence, shield depletion and simulation-only recovery',()=>{
 const E=require('./equipment.js'),a=game().g,b=game().g;a.startGame();b.startGame();
 E.unequip(b.gear,'off');b.reconcileEquipment();a.hurt(20);b.hurt(20);assert.ok(a.player.hp>b.player.hp);assert.equal(a.player.shield,0);
 a.openInventory();a.tick(10);assert.equal(a.player.shield,0);a.closeInventory();
 a.player.potions=100;assert.equal(a.player.potions,3);a.player.hp=50;a.drink();assert.equal(a.player.potions,2);assert.ok(a.player.hp<=a.player.maxHp);
 a.player.hp=a.player.maxHp;const count=a.player.potions;a.drink();assert.equal(a.player.potions,count);
});
test('Equipment healing is health-hit-only and once per attack; fire has a persistent cooldown',()=>{
 const E=require('./equipment.js');
 const critical=game().g;critical.startGame();E.collect(critical.gear,E.item('bloodforged'));E.equip(critical.gear,0,'main');critical.reconcileEquipment();critical.player.hp=50;critical.player.crit=.5;critical.setRandom(()=>0);
 const guard=critical.spawnEnemy(critical.player.x+.8,critical.player.y,'guardian');critical.attemptAttack();assert.equal(critical.player.hp,50);assert.equal(guard.shield,0);
 const life=game().g;life.startGame();E.collect(life.gear,E.item('kingsmercy'));E.equip(life.gear,0,'main');life.reconcileEquipment();life.player.hp=50;life.setRandom(()=>.5);
 for(const dy of [-.2,.2]){const e=life.spawnEnemy(life.player.x+.8,life.player.y+dy,'brute');e.hp=e.maxHp=1000;}life.attemptAttack();assert.equal(life.player.hp,51.2);
 const fire=game().g;fire.startGame();E.collect(fire.gear,E.item('ashbringer'));E.equip(fire.gear,0,'main');fire.reconcileEquipment();fire.setRandom(()=>.5);
 const a=fire.spawnEnemy(fire.player.x+1.2,fire.player.y,'brute'),b=fire.spawnEnemy(fire.player.x+2.2,fire.player.y+.1,'brute');a.hp=a.maxHp=b.hp=b.maxHp=1000;
 fire.attemptAttack();assert.ok(b.hp<1000);assert.equal(fire.fireCooldown,3);fire.openInventory();fire.tick(10);fire.closeInventory();assert.equal(fire.fireCooldown,3);
});
test('Potions remain on the ground at capacity and collect exactly once after consumption',()=>{
 const {g}=game();g.startGame();g.player.potions=3;g.player.hp=20;const potion={x:g.player.x,y:g.player.y,kind:'potion',phase:0};g.loot.push(potion);
 g.tick(.04);assert.equal(g.player.potions,3);assert.ok(g.loot.includes(potion));g.drink();assert.equal(g.player.potions,2);g.tick(.04);assert.equal(g.player.potions,3);assert.ok(!g.loot.includes(potion));g.tick(.04);assert.equal(g.player.potions,3);
});
