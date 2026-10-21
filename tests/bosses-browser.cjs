const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
for(const viewport of [{width:320,height:568},{width:844,height:390}]){const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/index.html',route=>{let html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');html=html.replace("const stick=$('stick')","window.bossQA={bosses,abilities,combat,draw,tick,startGame,attemptAttack,killEnemy,damageEnemy,nextFloor,get player(){return player},get enemies(){return enemies},get state(){return state},get floor(){return floor},get world(){return world},setFloor(n){floor=n;newFloor()},ready(){attackTimer=0;dashTime=0;invul=0},enter(){player.x=world.exit.x+2;player.y=world.exit.y+2;cam.x=player.x;cam.y=player.y},exit(){player.x=stair.x;player.y=stair.y;portalNear=true}};const stick=$('stick')");route.fulfill({body:html,contentType:'text/html'});});
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:3000')+'/index.html');await page.waitForFunction(()=>window.bossQA&&window.castleView);await page.evaluate(()=>{bossQA.startGame();bossQA.player.xpNeeded=1e9;});const reports=[];
 for(const floor of [1,3,5]){
 await page.evaluate(f=>{bossQA.setFloor(f);bossQA.enter();for(const e of bossQA.enemies)if(e.type!=='boss')bossQA.killEnemy(e);bossQA.tick(.02);},floor);
 if(floor===5){
  if(!await page.evaluate(()=>!bossQA.bosses.active&&bossQA.bosses.candles.length===4))throw Error('Ritual missing');
  for(let i=0;i<4;i++){await page.evaluate(i=>{const c=bossQA.bosses.candles[i];bossQA.player.x=c.x;bossQA.player.y=c.y;bossQA.tick(.001);bossQA.draw();},i);await page.locator('#boss-interact').tap();}
  if(!await page.evaluate(()=>bossQA.state==='cinematic'))throw Error('Fourth flame did not begin cinematic');
  const before=await page.evaluate(()=>JSON.stringify(bossQA.abilities.cooldowns));await page.evaluate(()=>bossQA.tick(.3));if(before!==await page.evaluate(()=>JSON.stringify(bossQA.abilities.cooldowns)))throw Error('Cinematic advanced abilities');
  await page.locator('#boss-skip').tap();if(!await page.evaluate(()=>bossQA.bosses.active&&bossQA.state==='playing'))throw Error('Skip did not activate King');
 }
 const report=await page.evaluate(f=>{
  const q=bossQA,b=q.bosses.boss;if(b.maxHp!==({1:2500,3:2500,5:4000})[f])throw Error('Boss health configuration mismatch');q.player.hp=q.player.maxHp=10000;
  const names=f===1?['acid','cross']:f===3?['wall','half','melee']:['whirlwind','axe','extinguish'];
  for(const name of names){q.bosses.begin(name);q.draw();const h=q.bosses.action?.h;if(h){const mesh=castleView.dynamic.get('hazard:'+h.id);if(!mesh)throw Error('Missing 3D hazard '+name);if(['wall','cross','polygon'].includes(h.shape)&&mesh.userData.fills.length!==VesperEnemies.hazardPolygons(h).length)throw Error('Polygon visual mismatch');}q.tick(.04);castleView.enabled=false;q.draw();castleView.enabled=true;q.draw();}
  b.hp=b.maxHp*.49;q.tick(.02);if(!b.enraged)throw Error('Threshold not applied');
  if(f===5){for(const c of q.bosses.candles){q.player.x=c.x;q.player.y=c.y;q.bosses.interact();}}
  b.hp=b.maxHp;q.player.x=b.x;q.player.y=b.y+.65;let hits=0;const hp=b.hp;
  while(!b.dead&&hits<200){q.ready();q.attemptAttack();hits++;}if(!b.dead)throw Error('Starter weapon could not defeat '+b.bossName);
  if(q.combat.hazards.some(h=>h.bossOwned&&!h.spent))throw Error('Boss hazards survived defeat');
  return {floor:f,boss:b.bossName,starterMeleeHits:hits,damage:hp-b.hp,enraged:true};
 },floor);reports.push(report);
 if(floor===5){if(!await page.evaluate(()=>bossQA.bosses.sequence?.kind==='victory'))throw Error('Victory sequence missing');await page.locator('#boss-skip').tap();await page.evaluate(()=>{bossQA.exit();bossQA.nextFloor();});if(!await page.evaluate(()=>bossQA.state==='complete'))throw Error('King did not unlock ending');}
 }
 await page.evaluate(()=>{bossQA.startGame();bossQA.player.xpNeeded=1e9;bossQA.setFloor(5);bossQA.enter();for(const e of bossQA.enemies)if(e.type!=='boss')bossQA.killEnemy(e);bossQA.tick(.01);const c=bossQA.bosses.candles[0];bossQA.player.x=c.x;bossQA.player.y=c.y;bossQA.tick(.01);bossQA.draw();});
 const boxes=await page.evaluate(()=>{const ids=['boss-interact','stick','attack','dash','potion','ability-execution','ability-aegis','ability-stunning','pickup-loot','inventory-button','story-interact','descend'];return ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height,visible:!e.hidden&&getComputedStyle(e).display!=='none'&&r.width>0}}).filter(e=>e.visible)});
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1)throw Error('Controls overlap '+a.id+'/'+b.id);}
 await page.locator('#viewmode').tap();await page.evaluate(()=>bossQA.draw());if(!await page.evaluate(()=>!castleView.enabled))throw Error('Canvas unavailable');await page.locator('#viewmode').tap();
 if(process.env.SCREENSHOT_PATH)await page.screenshot({path:process.env.SCREENSHOT_PATH.replace('.png','-'+viewport.width+'.png')});
 if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({viewport,reports,candles:true,cinematics:true,controls:true,renderers:true,errors}));await context.close();
}await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
