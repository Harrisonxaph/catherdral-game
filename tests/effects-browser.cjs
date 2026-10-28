/* Graphics v2 effects: trails, impacts, death puffs, telegraph progress and halos read simulation state only. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 for(const [viewport,quality] of [[{width:393,height:852},'low'],[{width:960,height:720},'high']]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(q=>{requestAnimationFrame=()=>0;localStorage.setItem('vesperGraphics',q);},quality);
  await page.route('**/index.html',r=>{let h=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');h=h.replace("const stick=$('stick')","window.fxQA={startGame,tick,draw,attemptAttack,activateAbility,spawnEnemy,killEnemy,combat,abilities,setAttackTimer(v){attackTimer=v},get player(){return player},get enemies(){return enemies},clearEnemies(){enemies=[]},get torches(){return torches},get time(){return time},get state(){return state},setState(s){state=s}};const stick=$('stick')");r.fulfill({body:h,contentType:'text/html'});});
  await page.goto((process.env.BASE_URL||'http://127.0.0.1:3011')+'/index.html');await page.waitForFunction(()=>window.fxQA&&window.castleView);
  const report=await page.evaluate(()=>{
   const q=fxQA,v=castleView,out={};q.startGame();q.player.xpNeeded=1e9;q.clearEnemies();q.draw();
   if(v.quality!==VesperGraphics.current)throw Error('Quality not applied');
   // Halos: one instance per torch on the built floor.
   out.halos=v.environment.halos.count===q.torches.length;
   // Swing trail and impact: the enemy's hit flash (set by real damage) triggers one impact.
   const e=q.spawnEnemy(q.player.x,q.player.y-1,'brute');e.hp=e.maxHp=9999;q.player.facing=-Math.PI/2;q.attemptAttack();
   let trailSeen=false;for(let i=0;i<6;i++){q.tick(.02);q.draw();trailSeen=trailSeen||v.ribbon.visible&&v.vfx.trail.points.length>1;}
   out.trail=trailSeen;out.impact=v.impactBatch.count>=1||v.vfx.impacts.items.length>=1;
   for(let i=0;i<30;i++){q.tick(.03);q.draw();}
   out.trailEnds=!v.ribbon.visible;out.impactEnds=v.impactBatch.count===0;
   // Death puff: five motes per puff, removed after its life; bosses are excluded elsewhere.
   q.killEnemy(e);q.draw();out.puff=v.puffBatch.count===5;for(let i=0;i<30;i++){q.tick(.03);q.draw();}out.puffEnds=v.puffBatch.count===0;
   // Paused simulation time freezes effects: spawn an impact, pause, redraw, nothing advances.
   const e2=q.spawnEnemy(q.player.x,q.player.y-1,'bone');e2.hp=e2.maxHp=9999;q.setAttackTimer(0);q.attemptAttack();q.tick(.02);q.draw();const frozen=v.vfx.impacts.items.map(i=>i.age).join();
   q.setState('inventory');for(let i=0;i<5;i++){q.tick(.1);q.draw();}out.pauseFrozen=frozen!==''&&v.vfx.impacts.items.map(i=>i.age).join()===frozen;q.setState('playing');
   // Heavy hit scorch follows the preset budget (none on Low).
   q.setAttackTimer(0);for(let i=0;i<40;i++){q.tick(.25);}q.abilities.reset?.();e2.x=q.player.x;e2.y=q.player.y-1;q.activateAbility('execution');for(let i=0;i<12;i++){q.tick(.03);q.draw();}
   out.scorch=v.vfx.scorch.items.length;out.scorchBudget=VesperVFX.budgets[v.quality].scorch;
   // Telegraph progress: grow shapes end exactly on the fill; walls never scale.
   q.clearEnemies();const H=[{shape:'circle',radius:1.5},{shape:'rect',width:2,height:1,angle:.4},{shape:'cross',radius:2,width:.6,angle:0},{shape:'wall',width:6,height:.8,gap:1.4,gapX:1,angle:0}];
   out.telegraph=H.map((spec,i)=>{const h={id:'fx'+i,x:q.player.x+(i-1.5)*3,y:q.player.y+2,age:0,warning:1,duration:1,color:'#e2643d',kind:'fire',...spec};q.combat.hazards.push(h);q.draw();const m=v.dynamic.get('hazard:'+h.id),pg=m.userData.progress,early={visible:pg.visible,scale:pg.scale.x,opacity:pg.children[0].material.opacity};
    h.age=.999;q.draw();const late={scale:pg.scale.x,opacity:pg.children[0].material.opacity};h.age=1.2;q.draw();const after=pg.visible;q.combat.hazards.splice(q.combat.hazards.indexOf(h),1);
    return {shape:spec.shape,early,late,hiddenWhenActive:!after};});
   q.draw();return out;
  });
  const t=report.telegraph,grow=t.filter(x=>x.shape!=='wall'),wall=t.find(x=>x.shape==='wall');
  const checks={halos:report.halos,trail:report.trail&&report.trailEnds,impact:report.impact&&report.impactEnds,puff:report.puff&&report.puffEnds,pauseFrozen:report.pauseFrozen,
   scorchBudget:report.scorch<=report.scorchBudget&&(report.scorchBudget===0?report.scorch===0:report.scorch>=1),
   telegraphGrow:grow.every(x=>x.early.visible&&x.early.scale<.1&&x.late.scale>.99&&x.hiddenWhenActive),telegraphWall:wall.early.scale===1&&wall.late.scale===1&&wall.late.opacity>wall.early.opacity&&wall.hiddenWhenActive};
  for(const [k,ok] of Object.entries(checks))if(!ok)throw Error(`${quality} effect check failed: ${k} ${JSON.stringify(report)}`);
  if(errors.length)throw Error(JSON.stringify(errors));
  console.log(JSON.stringify({viewport,quality,...checks,scorch:report.scorch,errors}));await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
