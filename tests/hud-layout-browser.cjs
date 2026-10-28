/* HUD and control rectangles must not move or shrink when visual styling changes (graphics v2, W5).
 * RECORD=1 writes tests/hud-layout-baseline.json from the current tree; otherwise compares against it. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const baselinePath=path.join(__dirname,'hud-layout-baseline.json'),record=process.env.RECORD==='1';
const ids=['hud','map','inventory-button','viewmode','sound','pausebtn','stick','attack','dash','potion','ability-execution','ability-aegis','ability-stunning','pickup-loot'];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']}),result={};
 for(const viewport of [{width:320,height:568},{width:393,height:852},{width:844,height:390},{width:960,height:720}]){
  const mobile=viewport.width<650||viewport.height<500,context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{requestAnimationFrame=()=>0;});
  await page.route('**/index.html',r=>{let h=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');h=h.replace("const stick=$('stick')","window.hudQA={startGame,draw,dropEquipment,tick,get player(){return player}};const stick=$('stick')");r.fulfill({body:h,contentType:'text/html'});});
  await page.goto((process.env.BASE_URL||'http://127.0.0.1:3011')+'/index.html');await page.waitForFunction(()=>window.hudQA&&window.castleView);
  const rects=await page.evaluate(ids=>{hudQA.startGame();const p=hudQA.player;hudQA.dropEquipment(VesperEquipment.item('graveaxe',[{stat:'crit',value:.03}]),p.x,p.y);hudQA.tick(.5);hudQA.draw();
   const out={};for(const id of ids){const el=document.getElementById(id);if(!el||el.hidden||getComputedStyle(el).display==='none')continue;const r=el.getBoundingClientRect();out[id]=[r.x,r.y,r.width,r.height].map(v=>Math.round(v*2)/2);}
   document.getElementById('inventory-button').click();for(const el of document.querySelectorAll('#inventory-dialog .inventory-slot, #inventory-close')){const r=el.getBoundingClientRect();out[(el.dataset.index!==undefined?'slot'+el.dataset.index:el.dataset.slot||el.id)]=[r.x,r.y,r.width,r.height].map(v=>Math.round(v*2)/2);}
   return out;},ids);
  if(errors.length)throw Error(JSON.stringify(errors));
  const small=Object.entries(rects).filter(([id,[,,w,h]])=>id!=='hud'&&id!=='map'&&id!=='stick'&&(w<44||h<44));if(small.length)throw Error('Touch target under 44px: '+JSON.stringify(small));
  result[viewport.width+'x'+viewport.height]=rects;await context.close();
 }
 await browser.close();
 if(record){fs.writeFileSync(baselinePath,JSON.stringify(result,null,1)+'\n');console.log('Recorded HUD layout baseline for',Object.keys(result).join(', '));return;}
 const base=JSON.parse(fs.readFileSync(baselinePath,'utf8')),moved=[];
 for(const [vp,rects] of Object.entries(base))for(const [id,r] of Object.entries(rects)){const now=result[vp]?.[id];if(!now)moved.push(vp+' '+id+' missing');else if(now.some((v,i)=>Math.abs(v-r[i])>.5))moved.push(`${vp} ${id} ${JSON.stringify(r)} -> ${JSON.stringify(now)}`);}
 if(moved.length)throw Error('HUD/control layout changed:\n'+moved.join('\n'));
 console.log(JSON.stringify({hudLayoutUnchanged:true,viewports:Object.keys(result),elements:Object.values(result).reduce((n,r)=>n+Object.keys(r).length,0)}));
})().catch(e=>{console.error(e);process.exit(1)});
