// Runs index.html's game script in a Node VM with a chosen floor seed (ARPG Phase 2 PR1). `read(file)` supplies source,
// so the same harness can load the working tree or any committed revision (for the golden fixture). Test-only.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const readWorkingTree=file=>fs.readFileSync(path.join(root,file),'utf8');
function loadModule(source){const m={exports:{}};new Function('module','exports','require',source)(m,m.exports,require);return m.exports;}
function loadGame(read=readWorkingTree){
  const elements=new Map();
  const context2d=new Proxy({},{get:()=>()=>{}});
  const element=()=>({style:{},classList:{add(){},remove(){},toggle(){}},dataset:{},addEventListener(){},getContext:()=>context2d,querySelectorAll:()=>[],textContent:'',innerHTML:'',width:130,height:130});
  const story={paused:false,objects:[],connect(a){this.adapter=a;},setup(){},update(){},emit(){},canLeave:()=>true};
  const sandbox={document:{hidden:false,addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}},localStorage:{getItem(){return null;},setItem(){}},innerWidth:393,innerHeight:852,devicePixelRatio:1,addEventListener(){},requestAnimationFrame(){},
    VesperStory:story,VesperFloors:loadModule(read('floors.js')),VesperEnemies:loadModule(read('enemy-system.js')),VesperAbilities:loadModule(read('abilities.js')),VesperBosses:loadModule(read('boss-system.js')),VesperEquipment:loadModule(read('equipment.js')),VesperInventoryUI:{create(adapter){this.adapter=adapter;return {isOpen:false};}},__seed:1};
  sandbox.window=sandbox;
  const literal='seed=(Math.random()*4294967296)>>>0';
  let script=read('index.html').match(/<script>\s*'use strict';([\s\S]*?)<\/script>/)[1];
  if(!script.includes(literal))throw new Error('Seed literal moved: update the harness and the browser test hooks');
  script=script.replace(literal,'seed=(window.__seed>>>0)').replace(/\}\)\(\);\s*$/,
    "window.generation={startGame,newFloor,spawnEnemy,setFloor(n){floor=n;},get floor(){return floor;},get world(){return world;},get enemies(){return enemies;},get chests(){return chests;},get traps(){return traps;},get torches(){return torches;},get seed(){return seed;},get areaManifest(){return typeof areaManifest==='undefined'?null:areaManifest;}};})();");
  vm.createContext(sandbox);vm.runInContext(script,sandbox);
  const g=sandbox.generation;
  // Build floor `number` from `seed` exactly as the game does on descending.
  g.build=(number,seed)=>{sandbox.__seed=seed;g.setFloor(number);g.newFloor();return g;};
  sandbox.__seed=1;g.startGame();
  return g;
}
const fnv=text=>{let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0');};
// The graphics capture's world digest (tests/visual-capture.cjs), so drift here is drift there.
const worldDigest=world=>Array.from(world.g).reduce((a,b)=>((a*31+b)>>>0),0);
// Everything population decides, plus the generator state left afterwards: equal signatures mean identical layout,
// identical entities and positions, and an identical number and order of random draws.
function signature(g){
  return fnv(JSON.stringify({W:g.world.W,H:g.world.H,cells:worldDigest(g.world),rooms:g.world.rooms.map(r=>[r.x,r.y,r.w,r.h]),exit:[g.world.exit.x,g.world.exit.y],
    enemies:g.enemies.map(e=>[e.type,e.x,e.y,e.hp,!!e.finalGuard,!!e.elite]),chests:g.chests.map(c=>[c.x,c.y]),traps:g.traps.map(t=>[t.x,t.y]),torches:g.torches.map(t=>[t.x,t.y]),rngState:g.seed}));
}
module.exports={loadGame,signature,worldDigest,readWorkingTree};
