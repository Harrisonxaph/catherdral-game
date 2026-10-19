const {test}=require('node:test'),assert=require('node:assert/strict');
const Bosses=require('./boss-system.js'),Enemies=require('./enemy-system.js');
function arena(floor=1){const size=floor===1?10:floor===3?12:14,room={x:0,y:0,w:size,h:size},p={x:2,y:2,r:.26,hp:115,maxHp:115},boss={type:'boss',x:size/2,y:size/2,hp:require('./floors.js').get(floor).bossHealth,maxHp:require('./floors.js').get(floor).bossHealth,r:.59,phase:0},hits=[],sequences=[],notices=[];let ready=true;
 const combat=Enemies.createRuntime({player:()=>p,enemies:()=>[boss],world:()=>({walk:(x,y)=>x>=0&&y>=0&&x<size&&y<size}),allowed:()=>true,damage(){},flow:()=>[],move(e,x,y){e.x+=x;e.y+=y},hurt(n,x,y,kind){hits.push({n,kind})}});
 const b=Bosses.createRuntime({combat,player:()=>p,ready:()=>ready,clearInput(){},effect(){},notice(...args){notices.push(args)},sequence:s=>sequences.push(s?.kind||'end'),move(e,x,y){e.x+=x;e.y+=y}});b.reset(boss,room,floor);
 const tick=(seconds)=>{for(let n=0;n<Math.ceil(seconds/.02);n++){combat.tick(.02);b.tick(.02)}};
 const awaken=()=>{if(floor===5){for(const c of b.candles){Object.assign(p,{x:c.x,y:c.y});assert.ok(b.interact());}assert.equal(b.sequence.kind,'awakening');b.skip();}else b.tick(.01);};
 return {b,boss,p,room,combat,hits,sequences,notices,tick,awaken,setReady(v){ready=v}};
}
test('Data-defined bosses require guards/arena entry; dormant King cannot take damage',()=>{
 assert.equal(Object.keys(Bosses.definitions).length,3);for(const floor of [1,3,5]){const a=arena(floor);a.setReady(false);a.tick(1);assert.equal(a.b.active,false);assert.equal(a.b.modifyDamage(a.boss,100),0);a.setReady(true);a.awaken();assert.equal(a.b.active,true);assert.equal(a.b.modifyDamage(a.boss,100),100);a.p.x=-1;assert.equal(a.b.modifyDamage(a.boss,100),0);}
});
test('Acid samples the player, warns before impact, persists exactly ten seconds, and limits overlap',()=>{
 const a=arena();a.awaken();a.b.begin('acid');const h=a.b.action.h;assert.equal(h.warning,1.5);assert.equal(h.duration,10);assert.deepEqual([h.x,h.y],[2,2]);a.p.x=3;a.tick(1);assert.equal(a.hits.length,0);a.p.x=2;a.tick(.6);assert.ok(a.hits.some(h=>h.kind==='poison'));a.tick(9.7);assert.ok(a.combat.hazards.includes(h));a.tick(.3);assert.ok(!a.combat.hazards.includes(h));
 const b=arena();b.awaken();let max=0;for(let n=0;n<2000;n++){b.tick(.02);max=Math.max(max,b.combat.hazards.filter(h=>h.acidFlight&&!h.spent).length);assert.ok(!(b.combat.hazards.some(h=>h.shape==='cross'&&!h.spent)&&b.combat.hazards.some(h=>h.acidFlight&&!h.spent)));}assert.ok(max<=2);
});
test('Rotating cross preserves safe outer routes; enraged rotation is faster; windup never rotates',()=>{
 const a=arena();a.awaken();a.b.begin('cross');let h=a.b.action.h,angle=h.angle;a.tick(1);assert.equal(h.angle,angle);a.tick(1);assert.ok(h.angle>angle);assert.equal(a.combat.contains(h,{x:9.5,y:9.5}),false);const normal=h.angularSpeed;
 const b=arena();b.awaken();b.boss.hp=80;b.b.begin('cross');assert.ok(b.b.action.h.angularSpeed>normal);assert.ok(b.b.action.duration>=3);assert.equal(b.combat.stun(b.boss,.75,{source:'ability'}),false);
});
test('Flame wall moves only after warning, has a true gap, and half-arena strike leaves the rear safe',()=>{
 const a=arena(3);a.awaken();a.b.begin('wall');const h=a.b.action.h,initial=h.y;a.tick(1);assert.equal(h.y,initial);a.tick(1);assert.ok(h.y>initial);assert.ok(h.gap>2*a.p.r);assert.equal(a.combat.contains(h,{x:h.x+h.gapX,y:h.y}),false);assert.equal(a.combat.contains(h,{x:h.x-h.width/2+.1,y:h.y}),true);
 a.b.begin('half');const half=a.b.action.h,angle=a.boss.aim;assert.equal(a.combat.contains(half,{x:a.boss.x+Math.cos(angle)*2,y:a.boss.y+Math.sin(angle)*2}),true);assert.equal(a.combat.contains(half,{x:a.boss.x-Math.cos(angle)*2,y:a.boss.y-Math.sin(angle)*2}),false);assert.ok(half.warning>1.5);
});
test('King requires four local candle interactions and one skippable cinematic; ward is exactly 80%',()=>{
 const a=arena(5);a.p.x=a.p.y=7;assert.equal(a.b.interact(),false);for(const [i,c]of a.b.candles.entries()){a.p.x=c.x;a.p.y=c.y;assert.equal(a.b.interact(),true);assert.equal(a.b.active,false);assert.equal(!!a.b.sequence,i===3);}assert.equal(a.b.sequence.kind,'awakening');a.b.skip();assert.equal(a.b.active,true);assert.equal(a.b.skip(),false);assert.equal(a.b.modifyDamage(a.boss,100),100);
 a.b.begin('extinguish');a.tick(1.05);assert.equal(a.b.candles.filter(c=>!c.lit).length,1);assert.equal(a.b.modifyDamage(a.boss,100),20);const c=a.b.candles.find(c=>!c.lit);Object.assign(a.p,{x:c.x,y:c.y});assert.equal(a.b.interact(),true);assert.equal(a.b.modifyDamage(a.boss,100),100);assert.deepEqual(a.sequences,['awakening','end']);
});
test('Persistent axes cap at three, have separated sites, preserve corner candle access, and clear on defeat',()=>{
 const a=arena(5);a.awaken();for(let n=0;n<8;n++){a.b.begin('axe');a.tick(.02);const axes=a.combat.hazards.filter(h=>h.axe&&!h.spent);assert.ok(axes.length<=3);for(const h of axes){assert.equal(h.duration,Infinity);for(const c of a.b.candles)assert.ok(Math.hypot(c.x-h.x,c.y-h.y)>h.radius+a.p.r);}for(let i=0;i<axes.length;i++)for(let j=i+1;j<axes.length;j++)assert.ok(Math.hypot(axes[i].x-axes[j].x,axes[i].y-axes[j].y)>2.8);}
 a.boss.dead=true;a.b.defeat(a.boss);a.tick(.02);assert.equal(a.combat.hazards.length,0);assert.equal(a.b.sequence.kind,'victory');a.b.skip();assert.equal(a.b.active,false);
});
test('Stunning interrupts melee, caps at .75s, grants recovery immunity, and cannot cancel protected mechanics',()=>{
 for(const floor of [1,3,5]){const a=arena(floor);a.awaken();a.b.begin('melee');const h=a.b.action.h;assert.ok(a.combat.stun(a.boss,2,{source:'ability'}));assert.equal(a.boss.stateTime,.75);a.tick(.02);assert.equal(a.b.action,null);assert.ok(h.spent);assert.equal(a.combat.stun(a.boss,2,{source:'ability'}),false);a.tick(.8);assert.notEqual(a.boss.state,'stunned');assert.equal(a.combat.stun(a.boss,2,{source:'ability'}),false);a.tick(2.1);a.b.begin(floor===1?'cross':floor===3?'wall':'whirlwind');assert.equal(a.combat.stun(a.boss,2,{source:'ability'}),false);assert.ok(a.b.action);}
});
test('Enrage accelerates scheduling and King extinguishes more frequently; reset removes ritual and axes',()=>{
 for(const floor of [1,3,5]){const a=arena(floor);a.awaken();a.boss.hp=a.boss.maxHp*.49;a.tick(.02);assert.equal(a.boss.enraged,true);a.b.reset(null,a.room,2);assert.equal(a.b.boss,null);assert.equal(a.b.candles.length,0);assert.equal(a.b.active,false);assert.equal(a.b.sequence,null);}
 const count=enrage=>{const a=arena(5);a.awaken();if(enrage)a.boss.hp=200;let prior=null,total=0;for(let n=0;n<5000;n++){a.tick(.02);if(a.b.action?.name==='extinguish'&&prior!=='extinguish')total++;prior=a.b.action?.name;for(const c of a.b.candles)c.lit=true;}return total;};assert.ok(count(true)>count(false));
});
test('Shared visual polygons match rotated cross, gap, rectangle and polygon collision',()=>{
 const h={x:5,y:5,shape:'cross',radius:3,width:.6,angle:Math.PI/4};assert.ok(Enemies.containsHazard(h,{x:6,y:6}));assert.ok(!Enemies.containsHazard(h,{x:6,y:5}));assert.equal(Enemies.hazardPolygons(h).length,2);
 const a=arena(3);a.awaken();a.b.begin('half');const zone=a.b.action.h;for(const poly of Enemies.hazardPolygons(zone))for(const [x,y]of poly)assert.ok(Enemies.containsHazard(zone,{x:zone.x+x,y:zone.y+y}));
});
