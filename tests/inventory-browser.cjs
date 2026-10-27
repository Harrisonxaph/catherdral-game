const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 for(const viewport of [{width:320,height:568},{width:393,height:852},{width:412,height:915}]){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/index.html',route=>{let html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');html=html.replace("const stick=$('stick')", "window.inventoryQA={startGame,tick,attemptAttack,die,dropEquipment,collectEquipment,equipmentStats,reconcileEquipment,get run(){return runEquipment},get player(){return player},get state(){return state},get attackTimer(){return attackTimer},get shieldDelay(){return shieldDelay},get loot(){return loots},get clock(){return time}};const stick=$('stick')");return route.fulfill({body:html,contentType:'text/html'});});
  await page.goto((process.env.BASE_URL||'http://127.0.0.1:3000')+'/index.html');await page.waitForFunction(()=>window.inventoryQA&&window.castleView).catch(e=>{throw Error(JSON.stringify(errors)+e.message)});await page.evaluate(()=>inventoryQA.startGame());
  await page.evaluate(()=>{
   const q=inventoryQA,E=VesperEquipment;q.player.xpNeeded=1e9;
   for(const key of ['duskdagger','ashbringer','bulwark','kingsmercy'])E.collect(q.run,key==='duskdagger'?E.generate(key,()=>.4):E.item(key));
   q.attemptAttack();
  });
  await page.locator('#inventory-button').tap();
  if(!await page.locator('#inventory-dialog').evaluate(el=>el.open))throw Error('Inventory did not open');
  const panel=page.locator('#inventory-dialog');
  if(await panel.evaluate(el=>el.scrollHeight>el.clientHeight+20)){
   const box=await panel.boundingBox(),cdp=await context.newCDPSession(page),x=box.x+box.width*.6,y=box.y+Math.min(box.height-35,380);
   await panel.evaluate(el=>el.scrollTop=0);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   for(let step=1;step<=5;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*24}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   if(!await panel.evaluate(el=>el.scrollTop>0))throw Error('Touch scrolling inventory failed');
  }
  const snapshot=await page.evaluate(()=>({clock:inventoryQA.clock,attack:inventoryQA.attackTimer,shield:inventoryQA.player.shield}));
  await page.evaluate(()=>{inventoryQA.tick(8);inventoryQA.attemptAttack()});
  if(!await page.evaluate(s=>inventoryQA.clock===s.clock&&inventoryQA.attackTimer===s.attack&&inventoryQA.player.shield===s.shield,snapshot))throw Error('Inventory pause exploit');
  await page.locator('[data-index="0"]').tap();
  const rolledInfo=await page.locator('#inventory-info').innerText();
  if(!rolledInfo.includes('Quickened: +4% attack speed')||!rolledInfo.includes('Δ attacks/sec 0.44')||!rolledInfo.includes('Δ crit'))throw Error('Rolled modifier or stat deltas missing: '+rolledInfo);
  await page.locator('[data-action="equip"][data-target-slot="off"]').tap();
  if(!await page.evaluate(()=>inventoryQA.equipmentStats().configuration==='Dual wield'&&inventoryQA.player.shield===0))throw Error('Dual wield failed');
  await page.locator('[data-index="1"]').tap();await page.locator('[data-action="equip"][data-target-slot="main"]').tap();
  if(!await page.evaluate(()=>inventoryQA.run.main.key==='ashbringer'&&inventoryQA.run.off===null))throw Error('Two-hand equipment failed');
  if(!await page.locator('#equipped-slots').innerText().then(t=>t.includes('Occupied by main-hand weapon')))throw Error('Two-hand slot indicator missing');
  const selected=await page.evaluate(()=>inventoryQA.run.bag.findIndex(i=>i?.key==='bulwark'));
  await page.locator(`[data-index="${selected}"]`).tap();if(await page.locator('[data-action="equip"]').isEnabled())throw Error('Invalid two-hand plus shield allowed');
  // On a small phone, scrolling must reach the information and actions without overflow.
  await page.locator('#inventory-info').scrollIntoViewIfNeeded();
  if(!await page.locator('#inventory-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1))throw Error('Inventory horizontal overflow');
  const unwanted=await page.evaluate(()=>inventoryQA.run.bag.findIndex(i=>i?.key==='rustbound'));
  await page.locator(`[data-index="${unwanted}"]`).tap();await page.locator('[data-action="drop"]').tap();
  if(!await page.evaluate(i=>!!inventoryQA.run.bag[i],unwanted))throw Error('Drop was not confirmed');
  await page.locator('[data-action="confirm-drop"]').tap();
  if(!await page.evaluate(i=>inventoryQA.run.bag[i]===null&&inventoryQA.loot.filter(l=>l.kind==='equipment').length===1,unwanted))throw Error('Drop failed or duplicated');
  if(process.env.SCREENSHOT_PATH)await page.screenshot({path:process.env.SCREENSHOT_PATH.replace('.png','-'+viewport.width+'.png')});
  await page.locator('#inventory-close').tap();
  if(!await page.evaluate(()=>inventoryQA.state==='playing'))throw Error('Close failed to resume');
  await page.evaluate(()=>{inventoryQA.tick(1);const l=inventoryQA.loot.find(l=>l.kind==='equipment');inventoryQA.player.x=l.x;inventoryQA.player.y=l.y;inventoryQA.tick(.04)});
  await page.locator('#pickup-loot').tap();
  if(!await page.evaluate(()=>inventoryQA.loot.filter(l=>l.kind==='equipment'&&!l.gone).length===0))throw Error('Touch collection failed');
  // The 2D fallback continues to render loot and equipment effects.
  await page.locator('#viewmode').tap();if(!await page.evaluate(()=>!castleView.enabled))throw Error('2D fallback toggle failed');
  await page.locator('#viewmode').tap();if(!await page.evaluate(()=>castleView.enabled))throw Error('3D restore failed');
  await page.locator('#inventory-button').tap();await page.locator('#inventory-close').tap();
  await page.locator('#dash').tap();await page.locator('#attack').tap();
  if(!await page.evaluate(()=>inventoryQA.state==='playing'&&!document.getElementById('controls').inert))throw Error('Controls remain disabled');
  if(!await page.evaluate(()=>{const i=[inventoryQA.run.main,inventoryQA.run.off,...inventoryQA.run.bag].find(i=>i?.key==='duskdagger');return i?.modifiers?.[0]?.value===.04}))throw Error('Rolled instance changed during inventory operations');
  if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({viewport,inventory:true,loadouts:true,dropAndCollect:true,pauseSafe:true,renderers:true,errors}));await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
