const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
for(const viewport of [{width:393,height:852},{width:412,height:915}]){
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/index.html',route=>{let html=fs.readFileSync(path.join(root,'index.html'),'utf8');html=html.replace("const stick=$('stick')", "window.qa={startGame,tick,attemptAttack,nextFloor,killEnemy,get player(){return player},get enemies(){return enemies},get floor(){return floor},get state(){return state},get attackTimer(){return attackTimer},get dashTime(){return dashTime},get world(){return world},exit(){player.x=stair.x;player.y=stair.y;portalNear=true},resetAttack(){attackTimer=0},setKey(k,v){key[k]=v}};const stick=$('stick')");route.fulfill({contentType:'text/html',body:html});});
 await page.goto('http://127.0.0.1:3000/index.html');await page.waitForFunction(()=>window.castleView&&window.qa);
 await page.evaluate(()=>qa.startGame());await page.waitForTimeout(300);
 const stick=await page.locator('#stick').boundingBox();
 const before=await page.evaluate(()=>qa.player.x);
 const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:stick.x+stick.width*.8,y:stick.y+stick.height*.5}]});
 await page.waitForTimeout(200);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const moved=await page.evaluate(x=>qa.player.x>x,before);if(!moved)throw Error('Touch movement failed');
 await page.locator('#dash').tap();if(!await page.evaluate(()=>qa.dashTime>0))throw Error('Dash failed');
 await page.evaluate(()=>{qa.player.hp=40});await page.locator('#potion').tap();if(!await page.evaluate(()=>qa.player.hp>40))throw Error('Healing failed');
 const result=await page.evaluate(()=>{
 const floors=[];qa.player.xpNeeded=1e9;
 for(let i=1;i<=5;i++){
  for(const e of qa.enemies){if(e.dead)continue;qa.player.x=e.x;qa.player.y=e.y+.65;for(let hits=0;!e.dead&&hits<100;hits++){qa.resetAttack();qa.attemptAttack();}if(!e.dead)throw Error('Melee could not defeat '+e.type);}
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
