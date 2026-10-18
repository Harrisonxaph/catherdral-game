const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function game(){
  const elements=new Map(),events=[];
  const context2d=new Proxy({}, {get:()=>()=>{}});
  const element=()=>({style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},getContext:()=>context2d,querySelectorAll:()=>[],textContent:'',innerHTML:'',width:130,height:130});
  const story={paused:false,objects:[],connect(a){this.adapter=a},setup(){},update(){},emit(name,detail){events.push({name,detail})},canLeave:()=>true};
  const sandbox={document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)}},localStorage:{getItem(){return null},setItem(){}},innerWidth:393,innerHeight:852,devicePixelRatio:1,addEventListener(){},requestAnimationFrame(){},VesperStory:story};sandbox.window=sandbox;
  const script=fs.readFileSync('index.html','utf8').match(/<script>\s*'use strict';([\s\S]*?)<\/script>/)[1];
  vm.createContext(sandbox);vm.runInContext(script.replace(/\}\)\(\);\s*$/,`window.testGame={startGame,tick,attemptAttack,dash,drink,killEnemy,die,nextFloor,get player(){return player},get enemies(){return enemies},get state(){return state},get floor(){return floor},get portalReady(){return portalReady},get attackTimer(){return attackTimer},get dashTime(){return dashTime},get world(){return world},setKey(k,v){key[k]=v},atExit(){player.x=stair.x;player.y=stair.y;portalNear=true}};})();`),sandbox);
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
