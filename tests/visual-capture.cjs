/* Deterministic before/after scenes. Injected hooks never ship in production HTML.
 * Default (legacy Stage 4.5 gallery): docs/visual-comparison, baseline 3b9b40e for castle-view/inventory-ui only.
 * CAPTURE_SET=v2: docs/graphics-v2, "before" served entirely from CAPTURE_BASELINE (default 387a900),
 * phone captures at Low/Medium/High and desktop at Medium/High. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const phase=process.env.CAPTURE_PHASE||'after',v2=process.env.CAPTURE_SET==='v2',root=path.resolve(__dirname,'..');
const baseline=process.env.CAPTURE_BASELINE||(v2?'387a900':'3b9b40e'),dir=path.join(root,v2?'docs/graphics-v2/captures':'docs/visual-comparison');
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg'};
const viewports=v2?[{width:960,height:720,qualities:['medium','high']},{width:393,height:852,qualities:['low','medium','high']}]:[{width:960,height:720,qualities:['medium']},{width:393,height:852,qualities:['medium']}];
const show=file=>execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:1<<26});
const hook="window.visualQA={draw,load(n){startGame();floor=n;newFloor();player.xpNeeded=1e9;const r=world.rooms[1];enemies=[];player.x=r.cx+.5;player.y=r.y+3.8;player.facing=-Math.PI/2;cam.x=player.x;cam.y=player.y;time=2;for(const [i,type]of Object.keys(enemySystem.definitions).entries()){const a=i*Math.PI/4;const e=spawnEnemy(player.x+Math.cos(a)*2.7,player.y+Math.sin(a)*2.7,type);e.aim=a+Math.PI;e.state='chasing';}messageTimeout=0;$('toast').classList.remove('visible');updateHUD();draw();},get world(){return world},get player(){return player}};const stick=$('stick')";
function measure(){const v=castleView,samples=[];for(let n=0;n<32;n++){const t=performance.now();visualQA.draw();v.renderer.getContext().finish();if(n>=8)samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);
 return {quality:v.quality,pixelRatio:v.renderer.getPixelRatio(),p50Ms:+samples[12].toFixed(2),p95Ms:+samples[22].toFixed(2),drawCalls:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,geometries:v.renderer.info.memory.geometries,textures:v.renderer.info.memory.textures,lights:v.torchLights.filter(l=>l.visible).length,worldDigest:Array.from(visualQA.world.g).reduce((a,b)=>((a*31+b)>>>0),0)};}
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const report={phase,set:v2?'v2':'legacy',baseline:phase==='before'?baseline:null,renderer:'Chromium software WebGL; timings are not physical-device FPS',scenes:[]};
 for(const viewport of viewports){
  const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1,serviceWorkers:'block'});
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;localStorage.setItem('vesperGraphics','medium')});
  if(phase==='before'){
   if(v2)await page.route(url=>!url.pathname.endsWith('/index.html')&&!!types[path.extname(url.pathname)],r=>{const file=new URL(r.request().url()).pathname.replace(/^\//,'');try{r.fulfill({body:show(file),contentType:types[path.extname(file)]});}catch{r.continue();}});
   else for(const file of ['castle-view.js','inventory-ui.js'])await page.route('**/'+file,r=>r.fulfill({body:show(file).toString('utf8'),contentType:'text/javascript'}));
  }
  await page.route('**/index.html',r=>{let h=phase==='before'?show('index.html').toString('utf8'):fs.readFileSync(path.join(root,'index.html'),'utf8');
   h=h.replace("seed=(Math.random()*4294967296)>>>0","seed=1602022801").replace("const stick=$('stick')",hook);r.fulfill({body:h,contentType:'text/html'});});
  const cdp=await page.context().newCDPSession(page);
  await page.goto((process.env.BASE_URL||'http://127.0.0.1:3011')+'/index.html');await page.waitForFunction(()=>window.visualQA&&window.castleView);
  for(const quality of viewport.qualities){
   await page.evaluate(q=>VesperGraphics.set(q),quality);
   for(let floor=1;floor<=5;floor++){
    await page.evaluate(f=>visualQA.load(f),floor);const metrics=await page.evaluate(measure);
    const shot=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:84,fromSurface:true}),name=v2?`${phase}-${quality}-${floor}-${viewport.width}.jpg`:`${phase}-${floor}-${viewport.width}.jpg`;
    fs.writeFileSync(path.join(dir,name),Buffer.from(shot.data,'base64'));
    const scene={floor,viewport:{width:viewport.width,height:viewport.height},...metrics};report.scenes.push(scene);console.log(JSON.stringify({phase,...scene}));
   }
  }
  // Legacy report keeps its Chapel quality sweep for comparison with the Stage 4.5 record.
  if(!v2&&phase==='after'&&viewport.width===393){report.qualitySamples=[];for(const quality of ['low','medium','high']){await page.evaluate(q=>{VesperGraphics.set(q);visualQA.load(3);},quality);const sample=await page.evaluate(measure);report.qualitySamples.push(sample);console.log(JSON.stringify(sample));}}
  await page.close();
 }
 await browser.close();fs.writeFileSync(path.join(dir,phase+'-metrics.json'),JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exit(1)});
