/* HUD and control rectangles must not move or shrink when visual styling changes (graphics v2, W5).
 * The baseline commit (HUD_BASELINE, default 387a900) and the current tree are rendered in the same browser, with the
 * same fonts and viewport, and compared rectangle by rectangle; a stored snapshot would depend on the machine's fonts.
 * Every interactive control on the current tree must also stay at least 44px in both dimensions. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'),baseline=process.env.HUD_BASELINE||'387a900';
const ids=['hud','map','inventory-button','viewmode','sound','pausebtn','stick','attack','dash','potion','ability-execution','ability-aegis','ability-stunning','pickup-loot'];
const types={'.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const show=file=>execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:1<<26});
const hook="window.hudQA={startGame,draw,dropEquipment,tick,get player(){return player}};const stick=$('stick')";
async function measure(browser,viewport,fromBaseline){
 const mobile=viewport.width<650||viewport.height<500,context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{requestAnimationFrame=()=>0;});
 if(fromBaseline)await page.route(url=>!url.pathname.endsWith('/index.html')&&!!types[path.extname(url.pathname)],r=>{const file=new URL(r.request().url()).pathname.replace(/^\//,'');try{r.fulfill({body:show(file),contentType:types[path.extname(file)]});}catch{r.continue();}});
 await page.route('**/index.html',r=>{const h=(fromBaseline?show('index.html').toString('utf8'):fs.readFileSync(path.join(root,'index.html'),'utf8')).replace("const stick=$('stick')",hook);r.fulfill({body:h,contentType:'text/html'});});
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:3011')+'/index.html');await page.waitForFunction(()=>window.hudQA&&window.castleView);
 const rects=await page.evaluate(ids=>{hudQA.startGame();const p=hudQA.player;hudQA.dropEquipment(VesperEquipment.item('graveaxe'),p.x,p.y);hudQA.tick(.5);hudQA.draw();
  const box=el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(v=>Math.round(v*2)/2);},out={};
  for(const id of ids){const el=document.getElementById(id);if(el&&!el.hidden&&getComputedStyle(el).display!=='none')out[id]=box(el);}
  document.getElementById('inventory-button').click();for(const el of document.querySelectorAll('#inventory-dialog .inventory-slot, #inventory-close'))out[el.dataset.index!==undefined?'slot'+el.dataset.index:el.dataset.slot||el.id]=box(el);
  return out;},ids);
 await context.close();if(errors.length)throw Error((fromBaseline?'baseline ':'current ')+JSON.stringify(errors));return rects;
}
(async()=>{
 execFileSync('git',['cat-file','-e',baseline+'^{commit}'],{cwd:root});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']}),problems=[];let compared=0;
 for(const viewport of [{width:320,height:568},{width:393,height:852},{width:844,height:390},{width:960,height:720}]){
  const vp=viewport.width+'x'+viewport.height,before=await measure(browser,viewport,true),after=await measure(browser,viewport,false);
  if(Object.keys(before).length<20)problems.push(`${vp}: baseline measured only ${Object.keys(before).length} elements`);
  for(const [id,r] of Object.entries(before)){const now=after[id];compared++;if(!now)problems.push(`${vp} ${id} missing`);else if(now.some((v,i)=>Math.abs(v-r[i])>.5))problems.push(`${vp} ${id} ${JSON.stringify(r)} -> ${JSON.stringify(now)}`);}
  for(const [id,[,,w,h]] of Object.entries(after))if(!['hud','map','stick'].includes(id)&&(w<44||h<44))problems.push(`${vp} ${id} touch target ${w}x${h} under 44px`);
 }
 await browser.close();
 if(problems.length)throw Error('HUD/control layout differs from '+baseline+':\n'+problems.join('\n'));
 console.log(JSON.stringify({hudLayoutMatchesBaseline:baseline,viewports:4,elementsCompared:compared,touchTargets:'>=44px'}));
})().catch(e=>{console.error(e);process.exit(1)});
