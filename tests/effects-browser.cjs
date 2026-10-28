/* Graphics v2 effects: trails, impacts, death puffs, telegraph progress and halos read simulation state only. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 for(const [viewport,quality] of [[{width:393,height:852},'low'],[{width:960,height:720},'high']]){
  const context=await browser.newContext({viewport,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(q=>{requestAnimationFrame=()=>0;localStorage.setItem('vesperGraphics',q);},quality);
  await page.route('**/index.html',r=>{let h=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');h=h.replace("const stick=$('stick')","window.fxQA={get world(){return world},get cam(){return cam},startGame,tick,draw,dropEquipment,clearLoot(){loots=[]},collectEquipment,get run(){return runEquipment},attemptAttack,activateAbility,spawnEnemy,killEnemy,combat,abilities,setAttackTimer(v){attackTimer=v},get player(){return player},get enemies(){return enemies},clearEnemies(){enemies=[]},get torches(){return torches},get time(){return time},get state(){return state},setState(s){state=s}};const stick=$('stick')");r.fulfill({body:h,contentType:'text/html'});});
  await page.goto((process.env.BASE_URL||'http://127.0.0.1:3011')+'/index.html');await page.waitForFunction(()=>window.fxQA&&window.castleView);
  await page.evaluate(async()=>{window.__cut=(await import('./art-materials.js')).cutUniforms;});
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
   // Characters (W3): rim materials, swing sweep, enemy wind-up, cape motion and the two-phase death.
   q.combat.hazards.length=0;q.clearEnemies();q.draw();const hero=v.dynamic.get(q.player),rig=hero.userData.rig;let rim=0,total=0;hero.traverse(o=>{if(o.isMesh&&o.visible&&o.material?.isMeshStandardMaterial){total++;if(o.material.userData.rim)rim++;}});
   out.rim=total>0&&rim/total>.8;
   out.cape=rig.cape.userData.keep===true&&rig.cape.parent===rig.body;const capeIdle=rig.cape.rotation.x;
   const target=q.spawnEnemy(q.player.x,q.player.y-1,'brute');target.hp=target.maxHp=9999;q.setAttackTimer(0);for(let i=0;i<20;i++)q.tick(.05);q.setAttackTimer(0);q.attemptAttack();const arm=[];for(let i=0;i<6;i++){q.tick(.02);q.draw();arm.push(+rig.arms[1].upper.rotation.x.toFixed(3));}
   out.swing=new Set(arm).size>=4&&arm[arm.length-1]>arm[0];out.swingSamples=arm;
   const foe=q.spawnEnemy(q.player.x+3,q.player.y,'bone');foe.hp=foe.maxHp=9999;foe.state='preparing';foe.action='melee';foe.stateTime=.6;q.draw();const foeRig=v.dynamic.get(foe).userData.rig,r0=foeRig.arms[1].upper.rotation.x;foe.stateTime=.1;q.draw();out.windup=foeRig.arms[1].upper.rotation.x<r0-.5;
   foe.state='chasing';const px=q.player.x;q.player.x+=.3;q.draw();q.player.x+=.3;q.draw();out.capeMoves=Math.abs(rig.cape.rotation.x-capeIdle)>.15;q.player.x=px;
   q.killEnemy(foe);const t0=q.time;let mid=null;while(q.time-t0<.32){q.tick(.04);q.draw();}mid=v.dynamic.get(foe);out.deathMid=!!mid&&mid.userData.rig.legs[0].lower.rotation.x>.5;
   while(q.time-t0<VesperVFX.deathDuration+.08){q.tick(.04);q.draw();}out.deathEnds=!v.dynamic.has(foe);
   // Loot (W5): rarity beam, ring and bonus glint while on the ground; collapse/flash and rarity toast on pickup.
   // Earlier kills may randomly drop loot; start the loot checks from an empty floor.
   q.clearEnemies();q.clearLoot();q.draw();const E=VesperEquipment,drop=E.item('duskdagger',[{stat:'speed',value:.05}]);q.dropEquipment(drop,q.player.x+.4,q.player.y);q.tick(.5);q.draw();
   out.lootGlow=v.lootBeams.count===1&&v.lootRings.count===1&&v.lootGlints.count===1;
   q.player.x+=.4;q.tick(.04);q.collectEquipment();q.tick(.04);q.draw();out.pickup=v.vfx.pickups.items.length===1&&v.lootBeams.count===1&&v.lootRings.count===0&&document.getElementById('toast').dataset.rarity==='rare';
   for(let i=0;i<20;i++){q.tick(.04);q.draw();}out.pickupEnds=v.lootBeams.count===0&&v.vfx.pickups.items.length===0;
   // Inventory icons: every item renders its own icon.
   const keys=Object.keys(E.definitions),seen={};for(let batch=0;batch<2;batch++){q.run.bag=Array(6).fill(null);for(const k of keys.slice(batch*6,batch*6+6))E.collect(q.run,E.item(k));document.getElementById('inventory-button').click();for(const svg of document.querySelectorAll('#backpack-slots svg[data-icon]'))seen[svg.dataset.icon]=svg.innerHTML;document.getElementById('inventory-close').click();}
   out.icons=keys.every(k=>seen[k])&&new Set(Object.values(seen)).size===keys.length;
   // Camera (W6): wall cutaway in front of the hero, and frustum chunk culling.
   q.clearEnemies();q.clearLoot();const room=q.world.rooms.find(r=>!q.world.walk(r.cx,r.y+r.h)),P=q.player;P.x=room.cx+.5;P.y=room.y+room.h-.6;q.cam.x=P.x;q.cam.y=P.y;
   const sample=(x,y,z,box=24)=>{q.draw();const canvas=v.renderer.domElement,ctx=document.createElement('canvas').getContext('2d');ctx.canvas.width=canvas.width;ctx.canvas.height=canvas.height;ctx.drawImage(canvas,0,0);const p=new v.camera.position.constructor(x,y,z).project(v.camera),px=Math.round((p.x+1)/2*canvas.width),py=Math.round((1-p.y)/2*canvas.height);return Array.from(ctx.getImageData(px-box/2,py-box/2,box,box).data);};
   const cutOn=v.updateCutaway;const legs=sample(P.x,.3,P.y+.45),far=sample(P.x,.3,room.y+.5);
   const uniforms=window.__cut;v.updateCutaway=function(){cutOn.apply(this,arguments);for(const c of uniforms.cutCentres.value)c.w=0;};const legsOff=sample(P.x,.3,P.y+.45),farOff=sample(P.x,.3,room.y+.5);v.updateCutaway=cutOn;
   const diff=(a,b)=>a.reduce((n,x,i)=>n+Math.abs(x-b[i]),0)/a.length;out.cutLegs=diff(legs,legsOff);out.cutFar=diff(far,farOff);
   const oldRule=[...v.environment.chunks.values()].filter(g=>Math.abs(g.userData.center.x-P.x)<22&&Math.abs(g.userData.center.y-P.y)<26).length,shown=[...v.environment.chunks.values()].filter(g=>g.visible);
   out.frustum={shown:shown.length,oldRule,heroChunk:shown.some(g=>g.userData.box.containsPoint(new v.camera.position.constructor(P.x,0,P.y)))};
   q.draw();return out;
  });
  const t=report.telegraph,grow=t.filter(x=>x.shape!=='wall'),wall=t.find(x=>x.shape==='wall');
  const checks={halos:report.halos,trail:report.trail&&report.trailEnds,impact:report.impact&&report.impactEnds,puff:report.puff&&report.puffEnds,pauseFrozen:report.pauseFrozen,
   scorchBudget:report.scorch<=report.scorchBudget&&(report.scorchBudget===0?report.scorch===0:report.scorch>=1),
   telegraphGrow:grow.every(x=>x.early.visible&&x.early.scale<.1&&x.late.scale>.99&&x.hiddenWhenActive),telegraphWall:wall.early.scale===1&&wall.late.scale===1&&wall.late.opacity>wall.early.opacity&&wall.hiddenWhenActive,
   rim:report.rim,cape:report.cape&&report.capeMoves,swing:report.swing,windup:report.windup,death:report.deathMid&&report.deathEnds,
   loot:report.lootGlow&&report.pickup&&report.pickupEnds,icons:report.icons,
   cutaway:report.cutLegs>3&&report.cutFar<.5,frustum:report.frustum.shown>0&&report.frustum.shown<=report.frustum.oldRule&&report.frustum.heroChunk};
  for(const [k,ok] of Object.entries(checks))if(!ok)throw Error(`${quality} effect check failed: ${k} ${JSON.stringify(report)}`);
  if(errors.length)throw Error(JSON.stringify(errors));
  console.log(JSON.stringify({viewport,quality,...checks,scorch:report.scorch,cutLegs:+report.cutLegs.toFixed(1),cutFar:+report.cutFar.toFixed(2),chunks:report.frustum,errors}));await context.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
