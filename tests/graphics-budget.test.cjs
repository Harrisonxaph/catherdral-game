const {test}=require('node:test'),assert=require('node:assert/strict'),{budgets,check}=require('./graphics-budget.cjs');
const scene=(quality,extra={})=>({quality,floor:1,viewport:{width:393},drawCalls:200,triangles:50000,textures:5,lights:0,p50Ms:2,worldDigest:7,...extra});
test('Graphics budgets pass equal scenes and reject growth, extra lights, textures and layout changes',()=>{
 const before={scenes:[scene('low'),scene('high',{lights:3})]};
 assert.deepEqual(check(before,before).failures,[]);
 assert.deepEqual(check(before,{scenes:[scene('low',{drawCalls:220})]}).failures,[]);
 const bad=check(before,{scenes:[scene('low',{drawCalls:221,triangles:60001,lights:1,textures:9,worldDigest:8})]}).failures.join('\n');
 for(const text of ['draw calls 221 > 220','triangles 60001 > 60000','1 real-time torch lights > 0','9 textures > 8','world layout changed'])assert.ok(bad.includes(text),text);
 assert.match(check(before,{scenes:[scene('medium')]}).failures[0],/no baseline scene/);
 assert.match(check(before,{scenes:[]}).failures[0],/No after scenes/);
 assert.equal(budgets.low.lights,0);
});
test('Readability floor rejects black or flattened play areas but allows darker ones',()=>{
 const before={scenes:[scene('low',{meanLuma:50,lumaSpread:40})]};
 assert.deepEqual(check(before,{scenes:[scene('low',{meanLuma:30,lumaSpread:36})]}).failures,[]);
 const bad=check(before,{scenes:[scene('low',{meanLuma:29.9,lumaSpread:35.9})]}).failures.join('\n');
 assert.match(bad,/luminance 29.9 < 30.0/);assert.match(bad,/spread 35.9 < 36.0/);
 assert.match(check(before,{scenes:[scene('low')]}).failures.join(),/luminance undefined/);
});
test('Slow software-WebGL timings are advisory only',()=>{
 const result=check({scenes:[scene('low')]},{scenes:[scene('low',{p50Ms:9})]});
 assert.deepEqual(result.failures,[]);assert.match(result.rows[0].p50Ms,/advisory/);
});
