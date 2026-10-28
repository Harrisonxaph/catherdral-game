/* Compares CAPTURE_SET=v2 after-metrics against the main baseline (docs/graphics-v2/SPEC.md section 6).
 * Draw calls, triangles, textures, lights and world digests are deterministic and enforced.
 * Software-WebGL timings are noisy and only reported. Usage: node tests/graphics-budget.cjs [captureDir] */
const fs=require('fs'),path=require('path');
const dir=path.resolve(process.argv[2]||path.join(__dirname,'../docs/graphics-v2/captures'));
const budgets=Object.freeze({
 low:{drawCalls:1.1,triangles:1.2,lights:0,textures:8},
 medium:{drawCalls:1.2,triangles:1.3,lights:2,textures:10},
 high:{drawCalls:1.2,triangles:1.3,lights:3,textures:10},
 timingAdvisory:1.5
});
const allowed=(value,factor)=>Math.floor(value*factor+1e-9);
// Every baseline scene must be measured exactly once; partial or duplicated captures never count as a pass.
function check(before,after){
 const key=s=>[s.quality,s.floor,s.viewport?.width].join('/'),failures=[],rows=[],base=new Map(),seen=new Set();
 const beforeScenes=Array.isArray(before?.scenes)?before.scenes:[],afterScenes=Array.isArray(after?.scenes)?after.scenes:[];
 if(!beforeScenes.length)failures.push('No baseline scenes recorded.');
 if(!afterScenes.length)failures.push('No after scenes recorded.');
 for(const s of beforeScenes){if(base.has(key(s)))failures.push(key(s)+': duplicate baseline scene');base.set(key(s),s);}
 for(const s of afterScenes){if(seen.has(key(s))){failures.push(key(s)+': duplicate after scene');continue;}seen.add(key(s));}
 for(const k of base.keys())if(!seen.has(k))failures.push(k+': missing after scene');
 for(const s of afterScenes){
  const b=base.get(key(s)),limit=budgets[s.quality];
  if(!b){failures.push(key(s)+': no baseline scene');continue;}
  if(!limit){failures.push(key(s)+': unknown quality');continue;}
  if(s.worldDigest!==b.worldDigest)failures.push(key(s)+': world layout changed');
  if(s.drawCalls>allowed(b.drawCalls,limit.drawCalls))failures.push(`${key(s)}: draw calls ${s.drawCalls} > ${allowed(b.drawCalls,limit.drawCalls)}`);
  if(s.triangles>allowed(b.triangles,limit.triangles))failures.push(`${key(s)}: triangles ${s.triangles} > ${allowed(b.triangles,limit.triangles)}`);
  if(s.lights>limit.lights)failures.push(`${key(s)}: ${s.lights} real-time torch lights > ${limit.lights}`);
  if(s.textures>limit.textures)failures.push(`${key(s)}: ${s.textures} textures > ${limit.textures}`);
  const slow=s.p50Ms>b.p50Ms*budgets.timingAdvisory;
  if(rows.some(r=>r.scene===key(s)))continue;
  rows.push({scene:key(s),drawCalls:b.drawCalls+'→'+s.drawCalls,triangles:b.triangles+'→'+s.triangles,p50Ms:b.p50Ms+'→'+s.p50Ms+(slow?' (advisory: over 1.5×)':'')});
 }
 return {failures,rows};
}
if(require.main===module){
 const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
 const {failures,rows}=check(read('before-metrics.json'),read('after-metrics.json'));
 console.table(rows);
 if(failures.length){console.error(failures.join('\n'));process.exit(1);}
 console.log(`Graphics budgets passed for all ${rows.length} baseline scenes.`);
}
module.exports={budgets,check};
