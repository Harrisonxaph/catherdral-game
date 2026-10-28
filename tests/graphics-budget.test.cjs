const {test}=require('node:test'),assert=require('node:assert/strict'),{budgets,check}=require('./graphics-budget.cjs');
const scene=(quality,extra={})=>({quality,floor:1,viewport:{width:393},drawCalls:200,triangles:50000,textures:5,lights:0,p50Ms:2,worldDigest:7,...extra});
test('Graphics budgets pass equal scenes and reject growth, extra lights, textures and layout changes',()=>{
 const before={scenes:[scene('low'),scene('high',{lights:3})]};
 assert.deepEqual(check(before,before).failures,[]);
 assert.deepEqual(check(before,{scenes:[scene('low',{drawCalls:220}),scene('high',{lights:3})]}).failures,[]);
 const bad=check(before,{scenes:[scene('low',{drawCalls:221,triangles:60001,lights:1,textures:9,worldDigest:8}),scene('high',{lights:3})]}).failures.join('\n');
 for(const text of ['draw calls 221 > 220','triangles 60001 > 60000','1 real-time torch lights > 0','9 textures > 8','world layout changed'])assert.ok(bad.includes(text),text);
 assert.ok(check(before,{scenes:[scene('low'),scene('high',{lights:3}),scene('medium')]}).failures.some(f=>/medium\/1\/393: no baseline scene/.test(f)));
 assert.ok(check(before,{scenes:[]}).failures.some(f=>/No after scenes/.test(f)));
 assert.equal(budgets.low.lights,0);
});
test('Incomplete, duplicated or malformed coverage never passes',()=>{
 const full={scenes:['low','medium','high'].flatMap(q=>[1,2,3,4,5].map(floor=>scene(q,{floor})))};
 assert.deepEqual(check(full,full).failures,[]);
 const one=check(full,{scenes:[full.scenes[0]]}).failures;assert.equal(one.filter(f=>/missing after scene/.test(f)).length,14);
 const dup=check(full,{scenes:[...full.scenes.slice(1),full.scenes[1]]}).failures.join('\n');assert.match(dup,/low\/1\/393: missing after scene/);assert.match(dup,/low\/2\/393: duplicate after scene/);
 assert.match(check({scenes:[...full.scenes,full.scenes[0]]},full).failures.join(),/duplicate baseline scene/);
 assert.ok(check({},full).failures.some(f=>/No baseline scenes/.test(f)));assert.ok(check(full,{}).failures.some(f=>/No after scenes/.test(f)));
 assert.equal(check(full,full).rows.length,15);
});
test('Slow software-WebGL timings are advisory only',()=>{
 const result=check({scenes:[scene('low')]},{scenes:[scene('low',{p50Ms:9})]});
 assert.deepEqual(result.failures,[]);assert.match(result.rows[0].p50Ms,/advisory/);
});
