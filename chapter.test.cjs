const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function game(){
  const elements=new Map(),events=[];
  const context2d=new Proxy({}, {get:()=>()=>{}});
  const element=()=>({style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},getContext:()=>context2d,querySelectorAll:()=>[],textContent:'',innerHTML:'',width:130,height:130});
  const story={paused:false,objects:[],connect(a){this.adapter=a},setup(){},update(){},emit(name,detail){events.push({name,detail})},canLeave:()=>true};
  const sandbox={document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)}},localStorage:{getItem(){return null},setItem(){}},innerWidth:393,innerHeight:852,devicePixelRatio:1,addEventListener(){},requestAnimationFrame(){},VesperStory:story,VesperFloors:require('./floors.js')};sandbox.window=sandbox;
  const script=fs.readFileSync('index.html','utf8').match(/<script>\s*'use strict';([\s\S]*?)<\/script>/)[1];
  vm.createContext(sandbox);vm.runInContext(script.replace(/\}\)\(\);\s*$/,`window.testGame={startGame,tick,attemptAttack,dash,drink,killEnemy,die,nextFloor,get player(){return player},get enemies(){return enemies},get state(){return state},get floor(){return floor},get portalReady(){return portalReady},get attackTimer(){return attackTimer},get dashTime(){return dashTime},get world(){return world},get finalEncounter(){return finalEncounter},get needed(){return needed},hurt,free,moveEntity,setKey(k,v){key[k]=v},atExit(){player.x=stair.x;player.y=stair.y;portalNear=true}};})();`),sandbox);
  return {g:sandbox.testGame,story,events};
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
