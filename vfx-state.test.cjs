const {test}=require('node:test'),assert=require('node:assert/strict'),V=require('./vfx-state.js'),N=require('./enemy-system.js');
test('Effect budgets grow with quality and Low draws no scorch decals',()=>{
 const {low,medium,high}=V.budgets;for(const k of ['trail','impacts','puffs'])assert.ok(low[k]<medium[k]&&medium[k]<high[k]);assert.equal(low.scorch,0);assert.ok(high.scorch>=medium.scorch);
});
test('Telegraph progress grows only truthful shapes and pulses in the final quarter',()=>{
 const at=(shape,age)=>V.telegraph({shape,age,warning:2});
 assert.equal(at('rect',0).scale,.02);assert.equal(at('circle',1).scale,.5);assert.equal(at('cross',1.999).grow,true);assert.ok(at('cross',1.999).scale>.99);
 for(const shape of ['wall','polygon']){assert.equal(at(shape,1).grow,false);assert.equal(at(shape,1).scale,1);assert.ok(at(shape,1.4).opacity>at(shape,.2).opacity);}
 assert.equal(at('rect',1.4).pulse,0);assert.ok([1.6,1.7,1.8,1.9].some(a=>at('rect',a).pulse>.5));
 const done=at('circle',2.5);assert.equal(done.active,true);assert.equal(done.opacity,0);assert.equal(done.progress,1);
 assert.equal(V.telegraph({shape:'circle',age:0,warning:0}).active,true);
});
test('Growing telegraphs stay inside the final hazard at every step (checked with containsHazard)',()=>{
 const hazards=[{shape:'circle',radius:2.4},{shape:'rect',width:3,height:1.2,angle:.7},{shape:'cross',radius:3,width:.9,angle:.3}];
 for(const base of hazards){const h={...base,x:4,y:-2};
  for(const p of [.05,.3,.6,.9,1]){for(const poly of N.hazardPolygons(h))for(const [px,py] of poly){const a=h.angle||0,x=px*p*.999,y=py*p*.999;
   assert.ok(N.containsHazard(h,{x:h.x+x*Math.cos(a)-y*Math.sin(a),y:h.y+x*Math.sin(a)+y*Math.cos(a)}),base.shape+' at '+p);}}}
 // A scaled flame wall would move its safe gap, which is why walls never grow.
 const wall={shape:'wall',x:0,y:0,width:10,height:1,gap:2,gapX:3},gapCentre={x:3,y:0};assert.equal(N.containsHazard(wall,gapCentre),false);assert.equal(N.containsHazard(wall,{x:3*.5,y:0}),true);assert.equal(V.telegraph({...wall,age:1,warning:2}).grow,false);
});
test('Trails keep newest samples first, cap their length and expire old samples',()=>{
 const t=V.createTrail(4),p=i=>({x:i,y:0,z:0});
 for(let i=0;i<6;i++)V.pushTrail(t,p(i),p(i),.01,true);assert.equal(t.points.length,4);assert.equal(t.points[0].tip.x,5);
 V.pushTrail(t,p(9),p(9),.01,false);assert.equal(t.points.length,4);assert.equal(t.points[0].tip.x,5);
 V.pushTrail(t,p(9),p(9),.2,false);assert.equal(t.points.length,0);
 // Paused redraws (dt 0, or a negative/NaN dt) neither add samples nor age the trail.
 const frozen=V.createTrail(8);for(let i=0;i<4;i++)V.pushTrail(frozen,p(i),p(i),.02,true);const snap=JSON.stringify(frozen.points);
 for(let i=0;i<10;i++){V.pushTrail(frozen,p(99),p(99),0,true);V.pushTrail(frozen,p(98),p(98),-.1,true);V.pushTrail(frozen,p(97),p(97),NaN,true);}assert.equal(JSON.stringify(frozen.points),snap);
 assert.equal(V.trailAlpha(0,5),1);assert.equal(V.trailAlpha(4,5),0);assert.ok(V.trailAlpha(1,5)>V.trailAlpha(2,5));assert.equal(V.trailAlpha(0,1),0);
});
test('Effect pools never exceed capacity, reuse the oldest slot and drop expired items',()=>{
 const pool=V.createPool(3);for(let i=0;i<5;i++)V.spawn(pool,{id:i,life:1});assert.equal(pool.items.length,3);assert.deepEqual(pool.items.map(i=>i.id).sort(),[2,3,4]);
 V.advance(pool,.5);assert.equal(pool.items.length,3);V.advance(pool,.6);assert.equal(pool.items.length,0);
 assert.equal(V.spawn(V.createPool(0),{life:1}),null);
});
test('Character pose curves are bounded, monotonic where they should be, and end at rest poses',()=>{
 const s0=V.swingPose(0),s1=V.swingPose(.55),s2=V.swingPose(1);assert.equal(s0.raise,-1.7);assert.ok(Math.abs(s1.raise-.8)<1e-12);assert.equal(s2.raise,s1.raise);assert.ok(s0.sweep>s1.sweep);assert.ok(Math.abs(s2.follow-1)<1e-12);assert.equal(s0.follow,0);
 for(let p=0;p<1;p+=.05){assert.ok(V.swingPose(p+.05).raise>=V.swingPose(p).raise-1e-12);assert.ok(V.windupPose(p+.05).raise<=V.windupPose(p).raise+1e-12);}
 assert.deepEqual(V.swingPose(-1),s0);assert.deepEqual(V.swingPose(5),s2);
 const d0=V.deathPose(0),d1=V.deathPose(1);assert.deepEqual([d0.knee,d0.tilt,d0.drop],[0,0,0]);assert.deepEqual([d1.knee,d1.tilt],[1,1]);assert.ok(Math.abs(d1.drop-.3)<1e-12);
 assert.equal(V.deathPose(.25).tilt,0);assert.ok(V.deathPose(.25).knee>.5);assert.ok(V.deathDuration>.4&&V.deathDuration<1);
});
