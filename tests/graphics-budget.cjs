/* Compares CAPTURE_SET=v2 after-metrics against the main baseline (docs/graphics-v2/SPEC.md section 6).
 * Draw calls, triangles, textures, lights and world digests are deterministic and enforced.
 * Software-WebGL timings are noisy and only reported. Usage: node tests/graphics-budget.cjs [captureDir] */
const fs=require('fs'),path=require('path');
const dir=path.resolve(process.argv[2]||path.join(__dirname,'../docs/graphics-v2/captures'));
const budgets=Object.freeze({
 low:{drawCalls:1.1,triangles:1.2,lights:0,textures:8},
 medium:{drawCalls:1.2,triangles:1.3,lights:2,textures:10},
 high:{drawCalls:1.2,triangles:1.3,lights:3,textures:10},
 timingAdvisory:1.5,
 // Readability floor (decision D3): darker is allowed, black or flattened is not.
 minLuma:.6,minSpread:.9
});
const allowed=(value,factor)=>Math.floor(value*factor+1e-9);
function check(before,after){
 const key=s=>[s.quality,s.floor,s.viewport.width].join('/'),base=new Map(before.scenes.map(s=>[key(s),s])),failures=[],rows=[];
 if(!after.scenes.length)failures.push('No after scenes recorded.');
 for(const s of after.scenes){
  const b=base.get(key(s)),limit=budgets[s.quality];
  if(!b){failures.push(key(s)+': no baseline scene');continue;}
  if(!limit){failures.push(key(s)+': unknown quality');continue;}
  if(s.worldDigest!==b.worldDigest)failures.push(key(s)+': world layout changed');
  if(s.drawCalls>allowed(b.drawCalls,limit.drawCalls))failures.push(`${key(s)}: draw calls ${s.drawCalls} > ${allowed(b.drawCalls,limit.drawCalls)}`);
  if(s.triangles>allowed(b.triangles,limit.triangles))failures.push(`${key(s)}: triangles ${s.triangles} > ${allowed(b.triangles,limit.triangles)}`);
  if(s.lights>limit.lights)failures.push(`${key(s)}: ${s.lights} real-time torch lights > ${limit.lights}`);
  if(s.textures>limit.textures)failures.push(`${key(s)}: ${s.textures} textures > ${limit.textures}`);
  if(b.meanLuma!==undefined){
   if(!(s.meanLuma>=b.meanLuma*budgets.minLuma))failures.push(`${key(s)}: play-area luminance ${s.meanLuma} < ${(b.meanLuma*budgets.minLuma).toFixed(1)}`);
   if(!(s.lumaSpread>=b.lumaSpread*budgets.minSpread))failures.push(`${key(s)}: luminance spread ${s.lumaSpread} < ${(b.lumaSpread*budgets.minSpread).toFixed(1)}`);
  }
  const slow=s.p50Ms>b.p50Ms*budgets.timingAdvisory;
  rows.push({scene:key(s),drawCalls:b.drawCalls+'→'+s.drawCalls,triangles:b.triangles+'→'+s.triangles,luma:b.meanLuma+'→'+s.meanLuma,spread:b.lumaSpread+'→'+s.lumaSpread,p50Ms:b.p50Ms+'→'+s.p50Ms+(slow?' (advisory: over 1.5×)':'')});
 }
 return {failures,rows};
}
if(require.main===module){
 const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
 const {failures,rows}=check(read('before-metrics.json'),read('after-metrics.json'));
 console.table(rows);
 if(failures.length){console.error(failures.join('\n'));process.exit(1);}
 console.log(`Graphics budgets passed for ${rows.length} scenes.`);
}
module.exports={budgets,check};
