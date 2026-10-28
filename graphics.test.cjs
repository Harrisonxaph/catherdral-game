const {test}=require('node:test'),assert=require('node:assert/strict'),G=require('./graphics.js');
test('Stored graphics preferences are validated and mobile defaults conservatively',()=>{assert.equal(G.choose(null,true),'low');assert.equal(G.choose('invalid',true),'low');assert.equal(G.choose(null,false),'medium');assert.equal(G.choose('high',true),'high');const old=G.current;assert.equal(G.set('invalid'),false);assert.equal(G.current,old);});
test('Quality budgets increase monotonically and each floor has its own theme',()=>{const {low,medium,high}=G.presets;for(const key of ['pixelRatio','lights','particles','detail'])assert.ok(low[key]<medium[key]&&medium[key]<high[key]);assert.equal(new Set(G.themes.map(t=>t.name)).size,5);assert.equal(new Set(G.themes.map(t=>t.fog)).size,5);assert.equal(low.bump,false);assert.equal(high.bump,true);});
test('Baked torch light is bounded, falls off with distance and is deterministic',()=>{
 const {lighting}=G,torches=[{x:10,y:10},{x:11,y:10}],sample=G.lightField(torches,'#ffb46a');
 assert.deepEqual(G.lightField([], '#ffb46a')(3,0,3),[lighting.base,lighting.base,lighting.base]);
 const near=sample(10.5,0,10),mid=sample(12.5,0,10),far=sample(30,0,30);
 assert.ok(near[0]>mid[0]&&mid[0]>far[0]);assert.deepEqual(far,[lighting.base,lighting.base,lighting.base]);
 for(const v of near)assert.ok(v>=lighting.base&&v<=lighting.max);
 assert.ok(near[0]>near[2]); // warm torch colour tints red above blue
 assert.deepEqual(sample(10.5,0,10),G.lightField(torches,'#ffb46a')(10.5,0,10));
 assert.deepEqual(G.lightField([], '#ffb46a',.5)(3,0,3),[.5,.5,.5]);assert.deepEqual(G.lightField([], '#ffb46a',undefined)(3,0,3),[lighting.base,lighting.base,lighting.base]);
 // Many overlapping torches stay capped; bucketing finds torches across cell borders.
 const crowd=G.lightField(Array.from({length:40},(_,i)=>({x:5+i*.01,y:5})),'#ffffff')(5,0,5);assert.ok(crowd.every(v=>v===lighting.max));
 const edge=G.lightField([{x:lighting.radius-.01,y:0}],'#ffffff')(lighting.radius+.01,0,0);assert.ok(edge[0]>lighting.base);
});
test('Ambient occlusion darkens wall-adjacent floor cells within its cap',()=>{
 const open=()=>true,room=(x,y)=>x>0&&y>0&&x<9&&y<9;
 assert.equal(G.occlusion(open,5,5),1);assert.equal(G.occlusion(room,5,5),1);
 assert.ok(G.occlusion(room,1,5)<1);assert.ok(G.occlusion(room,1,1)<G.occlusion(room,1,5));
 assert.equal(G.occlusion(()=>false,5,5),G.lighting.cap);
});
test('Every floor theme defines distinct torch light, exposure, fog density and grade',()=>{
 const hex=/^#[0-9a-f]{6}$/i;
 for(const t of G.themes){assert.match(t.torch,hex);assert.match(t.grade,hex);assert.ok(t.exposure>=1&&t.exposure<=1.5);assert.ok(t.fogDensity>0&&t.fogDensity<.05);}
 assert.equal(new Set(G.themes.map(t=>t.torch)).size,5);
 for(const t of G.themes){assert.match(t.motes.color,hex);assert.ok(Math.abs(t.motes.speed)>0&&Math.abs(t.motes.speed)<.5);assert.ok(t.motes.size>0&&t.motes.size<4);}
 assert.ok(G.themes[4].motes.speed<0,'Throne of Ash ash falls');assert.equal(new Set(G.themes.map(t=>t.motes.color)).size,5);assert.equal(new Set(G.themes.map(t=>t.grade)).size,5);
});
