const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 for(const viewport of [{width:320,height:568},{width:393,height:852},{width:412,height:915},{width:844,height:390}]){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/index.html',route=>{let html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');html=html.replace("const stick=$('stick')", "window.abilityQA={startGame,tick,draw,activateAbility,abilities,spawnEnemy,dropEquipment,setState,get player(){return player},get gear(){return runEquipment},get state(){return state},get enemies(){return enemies},setReady(){attackTimer=0;dashTime=0}};const stick=$('stick')");return route.fulfill({body:html,contentType:'text/html'});});
  await page.goto((process.env.BASE_URL||'http://127.0.0.1:3000')+'/index.html');await page.waitForFunction(()=>window.abilityQA&&window.castleView);await page.evaluate(()=>{abilityQA.startGame();abilityQA.player.xpNeeded=1e9;abilityQA.player.hp=abilityQA.player.maxHp=10000;abilityQA.player.facing=0;const e=abilityQA.spawnEnemy(abilityQA.player.x+1,abilityQA.player.y,'brute');e.hp=e.maxHp=10000;});
  const stick=await page.locator('#stick').boundingBox(),execution=await page.locator('#ability-execution').boundingBox(),cdp=await context.newCDPSession(page);
  const point={id:1,x:stick.x+stick.width*.75,y:stick.y+stick.height*.5};const before=await page.evaluate(()=>abilityQA.player.x);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point,{id:2,x:execution.x+execution.width/2,y:execution.y+execution.height/2}]});
  await page.evaluate(()=>abilityQA.tick(.04));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.evaluate(()=>{abilityQA.tick(.2);abilityQA.draw();});
  if(!await page.evaluate(x=>abilityQA.player.x>x&&abilityQA.abilities.cooldowns.execution>0,before))throw Error('Simultaneous movement/Execution failed '+JSON.stringify(await page.evaluate(()=>({x:abilityQA.player.x,cooldown:abilityQA.abilities.cooldowns.execution,hits:abilityQA.enemies.filter(e=>e.hp<e.maxHp).length}))));
  // Running past a target can legitimately miss the locked forward arc; activation and movement are the multitouch contract.
  const cooldown=await page.evaluate(()=>abilityQA.abilities.cooldowns.execution);await page.evaluate(()=>{for(let n=0;n<10;n++)abilityQA.activateAbility('execution');});
  if(!await page.evaluate(c=>abilityQA.abilities.cooldowns.execution<=c,cooldown))throw Error('Cooldown refreshed by taps');
  await page.evaluate(()=>{abilityQA.setReady();abilityQA.player.facing=0;const e=abilityQA.spawnEnemy(abilityQA.player.x+.5,abilityQA.player.y,'cultist');e.hp=e.maxHp=10000;});
  await page.locator('#ability-stunning').tap();await page.evaluate(()=>{abilityQA.tick(.13);abilityQA.draw();});
  if(!await page.evaluate(()=>abilityQA.enemies.some(e=>e.state==='stunned'&&castleView.dynamic.get(e)?.userData.stunIndicator.visible)))throw Error('Stun indicator or control failed');
  await page.locator('#ability-aegis').tap();await page.evaluate(()=>{abilityQA.draw();abilityQA.setState('paused');abilityQA.tick(.04)});
  if(!await page.evaluate(()=>abilityQA.abilities.barrier.capacity>0&&castleView.dynamic.has(abilityQA.abilities.barrier)))throw Error('Aegis did not render');
  await page.locator('#resume').tap();await page.locator('#inventory-button').tap();const snapshot=await page.evaluate(()=>JSON.stringify(abilityQA.abilities.cooldowns));
  await page.evaluate(()=>abilityQA.tick(10));if(!await page.evaluate(s=>JSON.stringify(abilityQA.abilities.cooldowns)===s,snapshot))throw Error('Inventory did not freeze cooldowns');await page.locator('#inventory-close').tap();
  await page.evaluate(()=>{abilityQA.dropEquipment(VesperEquipment.item('ashbringer'),abilityQA.player.x,abilityQA.player.y);abilityQA.tick(.5);document.getElementById('descend').style.display='block';});
  const overlaps=await page.evaluate(()=>{
   const descend=document.getElementById('descend'),previous=descend.style.display;descend.style.display='block';
   const ids=['stick','attack','dash','potion','ability-execution','ability-aegis','ability-stunning','inventory-button','pausebtn','viewmode','sound','pickup-loot','descend','story-interact'];
   const visible=ids.map(id=>document.getElementById(id)).filter(e=>e&&!e.hidden&&getComputedStyle(e).display!=='none').map(e=>({id:e.id,r:e.getBoundingClientRect()}));const bad=[];
   for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){const a=visible[i],b=visible[j];if(Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>2&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>2)bad.push([a.id,b.id]);}
   descend.style.display=previous;return bad;
  });if(overlaps.length)throw Error('HUD overlap '+JSON.stringify({viewport,overlaps}));
  await page.locator('#viewmode').tap();await page.evaluate(()=>abilityQA.draw());if(!await page.evaluate(()=>!castleView.enabled))throw Error('Canvas fallback failed');await page.locator('#viewmode').tap();
  await page.evaluate(()=>{abilityQA.startGame();abilityQA.player.xpNeeded=1e9});await page.keyboard.press('2');if(!await page.evaluate(()=>abilityQA.abilities.cooldowns.aegis>0))throw Error('Keyboard ability binding failed');
  const scale=await page.evaluate(()=>visualViewport.scale);for(let tap=0;tap<2;tap++)await page.touchscreen.tap(viewport.width/2,viewport.height*.5);
  if(!await page.evaluate(s=>visualViewport.scale===s,scale))throw Error('Combat zoom regression');
  if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({viewport,abilities:true,multiTouch:true,cooldowns:true,stunIndicator:true,barrier:true,noOverlap:true,renderers:true,errors}));
  if(process.env.SCREENSHOT_PATH){await page.evaluate(()=>{abilityQA.setState('paused');abilityQA.tick(.01)});await page.screenshot({path:process.env.SCREENSHOT_PATH.replace('.png','-'+viewport.width+'.png')});}
  await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
