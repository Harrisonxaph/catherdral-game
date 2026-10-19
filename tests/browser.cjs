const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
for(const viewport of [{width:393,height:852},{width:412,height:915}]){
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/index.html',route=>{let html=fs.readFileSync(path.join(root,'index.html'),'utf8');html=html.replace("const stick=$('stick')", "window.qa={bosses,spawnEnemy,combat,damageEnemy,draw,startGame,tick,attemptAttack,nextFloor,killEnemy,get player(){return player},get enemies(){return enemies},get floor(){return floor},get state(){return state},get attackTimer(){return attackTimer},get dashTime(){return dashTime},get world(){return world},exit(){player.x=stair.x;player.y=stair.y;portalNear=true},resetAttack(){attackTimer=0},setKey(k,v){key[k]=v}};const stick=$('stick')");route.fulfill({contentType:'text/html',body:html});});
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:3000')+'/index.html');await page.waitForFunction(()=>window.castleView&&window.qa);
 await page.evaluate(()=>qa.startGame());await page.waitForTimeout(300);
 const stick=await page.locator('#stick').boundingBox();
 const before=await page.evaluate(()=>qa.player.x);
 const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:stick.x+stick.width*.8,y:stick.y+stick.height*.5}]});
 await page.waitForTimeout(200);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const moved=await page.evaluate(x=>qa.player.x>x,before);if(!moved)throw Error('Touch movement failed');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 if(!await page.evaluate(()=>qa.state==='playing'))throw Error('Visible blur paused gameplay');
 const initialScale=await page.evaluate(()=>visualViewport.scale);
 for(let tap=0;tap<2;tap++)await page.touchscreen.tap(viewport.width/2,viewport.height*.48);
 await page.waitForTimeout(150);
 if(!await page.evaluate(scale=>visualViewport.scale===scale,initialScale))throw Error('Double tap zoomed gameplay');
 for(let tap=0;tap<2;tap++)await page.locator('#attack').tap();
 if(!await page.evaluate(()=>qa.state==='playing'))throw Error('Combat tap paused gameplay');
 await page.locator('#pausebtn').tap();
 if(!await page.evaluate(()=>qa.state==='paused'))throw Error('Explicit pause broken');
 await page.locator('#resume').tap();
 if(!await page.evaluate(()=>qa.state==='playing'))throw Error('Resume broken');
 await page.locator('#dash').tap();if(!await page.evaluate(()=>qa.dashTime>0))throw Error('Dash failed');
 await page.evaluate(()=>{qa.player.hp=40});await page.locator('#potion').tap();if(!await page.evaluate(()=>qa.player.hp>40))throw Error('Healing failed');
 const enemyReport=await page.evaluate(()=>{
   qa.player.hp=qa.player.maxHp=100000;qa.player.xpNeeded=1e9;
   const r=qa.world.start,types=Object.keys(VesperEnemies.definitions),actors=[];
   for(let i=0;i<types.length;i++){const e=qa.spawnEnemy(r.x+2+(i%4)*1.5,r.y+2+Math.floor(i/4)*2,types[i]);e.state='chasing';e.cooldown=0;e.abilityCooldown=0;actors.push(e);}
   let simulationMs=0;
   for(let frame=0;frame<150;frame++){const before=performance.now();qa.tick(.04);simulationMs+=performance.now()-before;if(frame%30===0)qa.draw();}qa.draw();
   for(const e of actors){if(!castleView.dynamic.has(e))throw Error('Enemy not rendered: '+e.type);const mesh=castleView.dynamic.get(e);if(!mesh.userData.health||mesh.userData.health.renderOrder<=20)throw Error('Missing or occluded health bar: '+e.type);}
   const guardian=actors.find(e=>e.type==='guardian'),before=guardian.hp;
   qa.damageEnemy(guardian,10);if(guardian.hp!==before||guardian.shield>=guardian.maxShield)throw Error('Shield integration failed');qa.draw();
   if(!castleView.dynamic.get(guardian).userData.shield)throw Error('No 3D shield bar');
   const hazard=qa.combat.addHazard({x:qa.player.x,y:qa.player.y,radius:1.4,warning:1,duration:2,damage:5,kind:'poison',color:'#80ba45'});qa.draw();
   const marker=castleView.dynamic.get('hazard:'+hazard.id);if(!marker||marker.scale.x!==hazard.radius||marker.scale.z!==hazard.radius)throw Error('Hazard visual radius mismatch');
   return {types:actors.map(e=>e.type),simulationMsPerTick:Math.round(simulationMs/150*100)/100,drawCalls:castleView.renderer.info.render.calls,hazards:qa.combat.hazards.length,minions:qa.enemies.filter(e=>e.minion&&!e.dead).length};
 });
 console.log(JSON.stringify({viewport,enemyReport}));
 if(process.env.SCREENSHOT_PATH)await page.screenshot({path:process.env.SCREENSHOT_PATH.replace('.png','-'+viewport.width+'.png')});
 await page.evaluate(()=>qa.startGame());
 const result=await page.evaluate(()=>{
 const floors=[];qa.player.xpNeeded=1e9;
 for(let i=1;i<=5;i++){
  for(const e of [...qa.enemies].sort((a,b)=>(a.type==='boss')-(b.type==='boss'))){if(e.dead)continue;if(e.type==='boss'){qa.player.x=e.x;qa.player.y=e.y+.65;qa.tick(.001);if(i===5){for(const c of qa.bosses.candles){qa.player.x=c.x;qa.player.y=c.y;qa.bosses.interact();}qa.bosses.skip();}}qa.player.x=e.x;qa.player.y=e.y+.65;for(let hits=0;!e.dead&&hits<100;hits++){qa.resetAttack();qa.attemptAttack();}if(!e.dead)throw Error('Melee could not defeat '+e.type);if(e.type==='boss')qa.bosses.skip();}
  qa.exit();if(i===1){const crown=VesperStory.objects.find(o=>o.kind==='crown');qa.player.x=crown.x;qa.player.y=crown.y;qa.tick(.001);document.getElementById('story-interact').click();document.getElementById('story-close').click();qa.exit();}
  const frame=performance.now();castleView.render({world:qa.world,player:qa.player,torches:[],stair:{x:qa.world.exit.cx+.5,y:qa.world.exit.cy+.5},cam:{x:qa.player.x,y:qa.player.y},time:1,enemies:qa.enemies,chests:[],traps:[],loots:[],bullets:[],particles:[],flashes:[],texts:[],portalReady:true,attackTimer:0,invul:0,damageOverlay:0});
  floors.push({floor:qa.floor,rooms:qa.world.rooms.length,enemies:qa.enemies.length,buildMs:Math.round(performance.now()-frame),drawCalls:castleView.renderer.info.render.calls});qa.nextFloor();if(VesperStory.paused)document.getElementById('story-close').click();
 }
 return {floors,state:qa.state,webgl:castleView.enabled};
 });
 if(result.state!=='complete'||!result.webgl||errors.length)throw Error(JSON.stringify({result,errors}));
 console.log(JSON.stringify({viewport,moved,...result,errors}));await context.close();
}
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
