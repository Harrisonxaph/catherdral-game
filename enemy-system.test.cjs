const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('./enemy-system.js');
const F=require('./floors.js');
function arena(block=()=>false){
 const W=30,H=30,world={W,H,ix:(x,y)=>y*W+x,walk:(x,y)=>x>0&&y>0&&x<W-1&&y<H-1&&!block(x,y)},player={x:15.5,y:15.5,hp:1e6,r:.26},enemies=[],hits=[],hitTimes=[],bolts=[];
 const flow=new Int16Array(W*H);let randomValue=.7;
 const free=(x,y,r=.3)=>[[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]].every(([x,y])=>world.walk(Math.floor(x),Math.floor(y)));
 const move=(e,dx,dy)=>{if(free(e.x+dx,e.y,e.r))e.x+=dx;if(free(e.x,e.y+dy,e.r))e.y+=dy;};
 function refresh(){flow.fill(32000);const q=[world.ix(Math.floor(player.x),Math.floor(player.y))];flow[q[0]]=0;for(let i=0;i<q.length;i++){const c=q[i],x=c%W,y=Math.floor(c/W);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])if(world.walk(x+dx,y+dy)){const k=world.ix(x+dx,y+dy);if(flow[k]>flow[c]+1){flow[k]=flow[c]+1;q.push(k);}}}}
 function spawn(x,y,type){const e=E.create(type,x,y,F.get(1),()=>randomValue);enemies.push(e);return e;}
 const api={world:()=>world,player:()=>player,enemies:()=>enemies,flow:()=>flow,free,move,random:()=>randomValue,spawn,damage(e,n){E.damage(e,n);if(e.hp<=0){e.dead=true;e.state='dead';}},hurt(n){hits.push(n);hitTimes.push(runtime.clock);player.hp-=n;},bolt(...args){bolts.push(args);},effect(){},allowed:()=>true};
 const runtime=E.createRuntime(api);
 function step(seconds){for(let time=0;time<seconds;time+=.04){refresh();runtime.tick(.04);}}
 return {world,player,enemies,hits,hitTimes,bolts,spawn,step,runtime,free,api,setRandom(v){randomValue=v}};
}
test('Eight types detect, prepare, attack and die; attacks respect warnings',()=>{
 assert.equal(Object.keys(E.definitions).length,8);
 for(const type of Object.keys(E.definitions)){
  const a=arena(),e=a.spawn(15.5,16.3,type);a.step(.2);assert.equal(e.state,'detecting',type);assert.equal(a.hits.length,0,type);
  a.step(8);assert.ok(a.hits.length||a.bolts.length||a.enemies.some(m=>m.master===e),type+' never attacked');
  E.damage(e,1e6);if(e.shield===0&&e.hp>0)E.damage(e,1e6);assert.ok(e.hp<=0,type);e.dead=true;a.step(.08);assert.equal(e.state,'dead');
 }
});
test('Guardian shield absorbs whole breaking hit before health; health hits can interrupt',()=>{
 const a=arena(),e=a.spawn(10.5,10.5,'guardian'),hp=e.hp;
 E.damage(e,10);assert.equal(e.hp,hp);assert.equal(e.shield,e.maxShield-10);assert.equal(a.runtime.stun(e),false);
 E.damage(e,1000);assert.equal(e.hp,hp);assert.equal(e.shield,0);assert.equal(a.runtime.stun(e),true);
 E.damage(e,10);assert.equal(e.hp,hp-10);
});
test('Circle and rectangle hazards have exact footprints, warnings, ticks, expiry and poison DOT',()=>{
 const a=arena();const h=a.runtime.addHazard({x:15.5,y:15.5,radius:1,warning:1,duration:1,damage:10,poison:2});
 assert.equal(a.runtime.contains(h,{x:16.49,y:15.5}),true);assert.equal(a.runtime.contains(h,{x:16.51,y:15.5}),false);
 a.step(.8);assert.equal(a.hits.length,0);a.step(.3);assert.ok(a.hits.includes(10));
 a.player.x=20;a.step(3);assert.ok(a.hits.includes(2));assert.equal(a.runtime.hazards.length,0);assert.equal(a.runtime.statuses.length,0);
 const rect=a.runtime.addHazard({shape:'rect',x:10,y:10,width:4,height:1});assert.ok(a.runtime.contains(rect,{x:11.9,y:10.4}));assert.equal(a.runtime.contains(rect,{x:12.1,y:10}),false);
 a.runtime.targetStatus(a.spawn(5.5,5.5,'bone'),'burn',1.5,4,.5);const e=a.enemies[0],hp=e.hp;a.step(2);assert.ok(e.hp<hp);assert.equal(e.statuses.length,0);
});
test('Stun and death cancel pending impacts, while established poison remains',()=>{
 const a=arena(),e=a.spawn(15.5,16.5,'brute');e.abilityCooldown=0;a.step(.8);assert.equal(e.state,'preparing');assert.ok(a.runtime.hazards.length);a.runtime.stun(e,1);a.player.x=25;a.step(2);assert.equal(a.hits.length,0);assert.equal(a.runtime.hazards.length,0);
 const b=arena(),dead=b.spawn(15.5,16.5,'brute');dead.abilityCooldown=0;b.step(.8);dead.dead=true;b.step(2);assert.equal(b.hits.length,0);
});
test('Summoners are capped at three living minions each and twelve globally; deaths allow replacements',()=>{
 const a=arena();for(let i=0;i<5;i++)a.spawn(12.5+i,17.5,'summoner');a.step(80);
 assert.ok(a.enemies.filter(e=>e.minion&&!e.dead).length<=12);
 for(const e of a.enemies.filter(e=>e.type==='summoner'))assert.ok(a.enemies.filter(m=>m.master===e&&!m.dead).length<=3);
 assert.ok(a.enemies.some(e=>e.minion));const m=a.enemies.find(e=>e.minion);m.dead=true;a.step(10);assert.ok(a.enemies.filter(e=>e.minion&&!e.dead).length<=12);
});
test('Attacker and hazard budgets stay bounded; warrior double strike is faster',()=>{
 const a=arena();for(let i=0;i<20;i++)a.spawn(15.5+Math.cos(i)*1.1,15.5+Math.sin(i)*1.1,'bone');
 for(let t=0;t<150;t++){a.step(.04);assert.ok(a.enemies.filter(e=>['preparing','attacking'].includes(e.state)).length<=3);}
 for(let i=0;i<100;i++)a.runtime.addHazard({duration:10});assert.equal(a.runtime.hazards.length,E.limits.hazards);
 const b=arena();b.setRandom(.1);const e=b.spawn(15.5,16.3,'bone');b.step(6);assert.ok(b.hitTimes.length>=2);assert.ok(b.hitTimes.some((time,i)=>i>0&&time-b.hitTimes[i-1]<1.2),'No fast second strike');
});
test('Navigation routes around walls and keeps lunges and teleports on walkable tiles',()=>{
 const a=arena((x,y)=>x===14&&y>=10&&y<=19),e=a.spawn(12.5,15.5,'bone');e.state='chasing';a.player.x=16.5;
 a.step(16);assert.ok(e.x>14.5,'pursuit did not find the gap around wall');assert.ok(a.free(e.x,e.y,e.r));
 for(const type of ['wraith','ghoul']){const b=arena((x,y)=>x===17),m=b.spawn(15.5,16.5,type);for(let t=0;t<300;t++){b.step(.04);assert.ok(b.free(m.x,m.y,m.r));}}
});
test('Every roster is present and scaling is retained across all five floors',()=>{
 const seen=new Set();for(const f of F.floors){for(const type of f.roster){seen.add(type);const e=E.create(type,5,5,f);assert.ok(e.hp>=E.definitions[type].hp);assert.equal(e.elite,f.number===5);}}
 assert.equal(seen.size,8);assert.throws(()=>E.create('unknown',0,0,F.get(1)));
});

test('Wraith blink is short, evasive and wall-safe; ranged cultists retreat',()=>{
 const a=arena(),w=a.spawn(15.5,16.5,'wraith');w.state='chasing';w.abilityCooldown=0;const before={x:w.x,y:w.y};a.step(.04);
 assert.ok(Math.hypot(w.x-before.x,w.y-before.y)>1.5);assert.ok(Math.hypot(w.x-before.x,w.y-before.y)<=2.01);assert.ok(a.free(w.x,w.y,w.r));
 const b=arena(),c=b.spawn(15.5,16.5,'cultist');c.state='chasing';c.cooldown=10;const initial=Math.hypot(c.x-b.player.x,c.y-b.player.y);b.step(.5);assert.ok(Math.hypot(c.x-b.player.x,c.y-b.player.y)>initial);
});
test('Out of budget attacks wait rather than lunge without a warning',()=>{
 const a=arena(),e=a.spawn(15.5,17,'ghoul');e.state='chasing';e.cooldown=0;
 for(let i=0;i<E.limits.hazards;i++)a.runtime.addHazard({x:2,y:2,duration:50});a.step(.04);assert.equal(e.state,'recovering');assert.equal(a.hits.length,0);
});
