/* Real-browser persistent play (ARPG Phase 2 PR5) on the actual game page with real IndexedDB: New Character, committed
 * kills/XP/levels/ash/potions/cooldowns, Continue after reload, checkpoint respawn, a death pending across reload, the
 * second-tab lease, a failed save that pauses and retries, New Character confirmation, legacy keys and the unsaved trial.
 * The hook below is injected into an isolated copy of the page only; nothing here ships in the game. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.BASE_URL||'http://127.0.0.1:3000';
const hook="window.persistQA={get session(){return session},get state(){return state},get player(){return player},get enemies(){return enemies},killEnemy,hurt,drink,activateAbility,tick,get floor(){return floor},get loots(){return loots},get level(){return level},get ash(){return ash},get cooldowns(){return abilities.cooldowns},get run(){return runEquipment},get start(){return world.start},get seed(){return areaManifest.seed},clearInvul(){invul=0;dashTime=0;}};const stick=$('stick')";
const check=(ok,message)=>{if(!ok)throw Error(message);};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,serviceWorkers:'block',acceptDownloads:true}),errors=[];
 await context.route('**/index.html',route=>route.fulfill({body:fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').replace("const stick=$('stick')",hook),contentType:'text/html'}));
 const open=async page=>{page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/index.html');await page.waitForFunction(()=>window.persistQA&&window.castleView!==undefined&&document.getElementById('start').textContent.length);await page.waitForTimeout(300);};
 const settle=page=>page.waitForFunction(()=>{const s=persistQA.session;return s&&s.pending===0&&s.status==='saved';},null,{timeout:15000});
 const closeStory=async page=>{for(let i=0;i<6&&await page.evaluate(()=>window.VesperStory.paused);i++){await page.locator('#story-choices button').first().click();await page.waitForTimeout(80);}};
 const saved=page=>page.evaluate(()=>{const s=persistQA.session.state,c=s.character;return {xp:c.lifetimeXp,level:c.level,ash:c.ash,potions:s.run.potions,hp:c.resources.hp,deaths:c.deaths,aegis:c.timers.abilityCooldowns.aegis,lifecycle:s.world.lifecycle.mode,instance:s.world.currentInstanceId,killed:s.world.instances[s.world.currentInstanceId]?.killed.slice()||[],items:[s.run.main?.id,s.run.off?.id],points:c.unspentSkillPoints};});
 const page=await context.newPage();await open(page);
 await page.evaluate(()=>{localStorage.setItem('vesperBest','999');localStorage.setItem('vesper-legacy-probe','kept');});
 const legacyBefore=await page.evaluate(()=>({best:localStorage.getItem('vesperBest'),probe:localStorage.getItem('vesper-legacy-probe')}));

 // 1. New Character: nothing stored yet, then one character exists at the Crypt entrance.
 const title=await page.evaluate(()=>({continueHidden:document.getElementById('continue').hidden,start:document.getElementById('start').textContent}));
 check(title.continueHidden&&title.start==='BEGIN YOUR STORY','fresh title: '+JSON.stringify(title));
 await page.locator('#start').click();await page.locator('#story-choices button').first().click();
 await page.waitForFunction(()=>persistQA.state==='playing'&&persistQA.session?.state.world.currentInstanceId);await settle(page);await closeStory(page);
 const created=await saved(page);check(created.level===1&&created.xp===0&&created.potions===2&&created.instance.startsWith('forgotten-crypt:s'),'created: '+JSON.stringify(created));

 // 2. Kills commit XP, drops and level-ups; a level banks a skill point and adds deterministic health.
 const killed=await page.evaluate(()=>{const out=[];for(const e of persistQA.enemies){if(e.dead||e.finalGuard||!e.spawnId)continue;persistQA.killEnemy(e);out.push(e.spawnId);if(out.length>=6)break;}return out;});
 await settle(page);
 const afterKills=await saved(page),runtime=await page.evaluate(()=>({level:persistQA.level,maxHp:persistQA.player.maxHp,xp:persistQA.player.xp,loots:persistQA.loots.filter(l=>l.dropId).length}));
 check(afterKills.killed.length===killed.length&&killed.every(id=>afterKills.killed.includes(id)),'kills not committed: '+JSON.stringify(afterKills));
 check(afterKills.xp>0&&afterKills.level===runtime.level&&runtime.loots>0,'progress: '+JSON.stringify({afterKills,runtime}));
 if(afterKills.level>1)check(runtime.maxHp===115+5*(afterKills.level-1)&&afterKills.points===afterKills.level-1,'level growth: '+JSON.stringify({afterKills,runtime}));
 // Walk onto an ash drop: the pick-up commits ash once.
 await page.evaluate(()=>{const l=persistQA.loots.find(l=>l.dropId&&l.kind==='ash');persistQA.player.x=l.x;persistQA.player.y=l.y;for(let i=0;i<5;i++)persistQA.tick(.016);});
 await settle(page);const afterAsh=await saved(page);check(afterAsh.ash>0&&afterAsh.ash===await page.evaluate(()=>persistQA.ash),'ash: '+JSON.stringify(afterAsh));

 // 3. Potion and ability commit before taking effect; a double tap spends once.
 const potionsBefore=(await saved(page)).potions;check(potionsBefore>=1,'no potion to test');
 await page.evaluate(()=>{persistQA.player.hp=20;persistQA.drink();persistQA.drink();});await settle(page);
 const afterPotion=await saved(page);check(afterPotion.potions===potionsBefore-1&&afterPotion.hp>20,'potion (double tap spends one): '+JSON.stringify({potionsBefore,afterPotion}));
 await page.evaluate(()=>persistQA.activateAbility('aegis'));await settle(page);
 const afterAbility=await saved(page);check(afterAbility.aegis>15&&await page.evaluate(()=>persistQA.cooldowns.aegis>15),'ability: '+JSON.stringify(afterAbility));

 // 4. A second tab cannot open the same character while this one plays.
 const tabB=await context.newPage();await open(tabB);
 await tabB.locator('#continue').click();await tabB.waitForFunction(()=>/another tab/.test(document.getElementById('save-note').textContent),null,{timeout:8000}).catch(async e=>{throw Error('tab B: '+JSON.stringify(await tabB.evaluate(()=>({note:document.getElementById('save-note').textContent,state:persistQA.state,session:!!persistQA.session}))));});
 await tabB.close();

 // 5. Reload and Continue: committed progress, cooldowns and the same area (killed enemies stay dead).
 const before=await saved(page);await page.reload();await open(page);
 const cont=await page.evaluate(()=>({hidden:document.getElementById('continue').hidden,text:document.getElementById('continue').textContent,start:document.getElementById('start').textContent}));
 check(!cont.hidden&&cont.text==='CONTINUE · LVL '+before.level&&cont.start==='NEW CHARACTER','continue title: '+JSON.stringify(cont));
 await page.locator('#continue').click();await page.waitForFunction(()=>persistQA.state==='playing'&&persistQA.session);await settle(page);
 const restored=await saved(page),world=await page.evaluate(()=>({dead:persistQA.enemies.filter(e=>e.dead&&e.spawnId).map(e=>e.spawnId),level:persistQA.level,ash:persistQA.ash,potions:persistQA.player.potions,aegis:persistQA.cooldowns.aegis,items:[persistQA.run.main?.id,persistQA.run.off?.id],at:[persistQA.player.x,persistQA.player.y],start:[persistQA.start.cx+.5,persistQA.start.cy+.5]}));
 check(restored.xp===before.xp&&restored.ash===before.ash&&restored.potions===before.potions&&restored.instance===before.instance,'continue state: '+JSON.stringify({before,restored}));
 check(world.level===before.level&&world.ash===before.ash&&world.potions===before.potions&&JSON.stringify(world.items)===JSON.stringify(before.items),'continue runtime: '+JSON.stringify(world));
 check(world.aegis>0&&world.aegis<=20,'cooldown reset on reload: '+JSON.stringify(world));
 check(before.killed.every(id=>world.dead.includes(id))&&world.dead.length===before.killed.length,'killed enemies revived: '+JSON.stringify(world.dead));
 check(world.at[0]===world.start[0]&&world.at[1]===world.start[1],'not at the entrance checkpoint');

 // 6. Death keeps everything and respawns at the entrance with full health, not a new run.
 await page.evaluate(()=>{persistQA.clearInvul();persistQA.player.hp=1;persistQA.hurt(9999);});await page.waitForFunction(()=>persistQA.state==='dead');await settle(page);
 const dead=await saved(page);check(dead.lifecycle==='dead-pending-respawn'&&dead.hp===0&&dead.deaths===1,'death: '+JSON.stringify(dead));
 await page.locator('#retry').click();await page.waitForFunction(()=>persistQA.state==='playing');await settle(page);
 const risen=await saved(page),riseRuntime=await page.evaluate(()=>({hp:persistQA.player.hp,maxHp:persistQA.player.maxHp,dead:persistQA.enemies.filter(e=>e.dead&&e.spawnId).length}));
 check(risen.lifecycle==='alive'&&risen.xp===before.xp&&risen.ash===before.ash&&risen.potions===before.potions&&risen.deaths===1&&risen.instance===before.instance,'respawn: '+JSON.stringify(risen));
 check(riseRuntime.hp===riseRuntime.maxHp&&riseRuntime.dead===before.killed.length,'respawn runtime: '+JSON.stringify(riseRuntime));
 // A death left pending across a reload respawns once on Continue.
 await page.evaluate(()=>{persistQA.clearInvul();persistQA.player.hp=1;persistQA.hurt(9999);});await page.waitForFunction(()=>persistQA.state==='dead');await settle(page);
 await page.reload();await open(page);await page.locator('#continue').click();await page.waitForFunction(()=>persistQA.state==='playing');await settle(page);
 const pending=await saved(page);check(pending.lifecycle==='alive'&&pending.deaths===2&&pending.xp===before.xp&&await page.evaluate(()=>persistQA.player.hp===persistQA.player.maxHp),'pending death on reload: '+JSON.stringify(pending));

 // 7. A failed save pauses play honestly, nothing is acknowledged, the unsaved progress can be exported, and retry applies it once.
 await page.evaluate(()=>{const orig=IDBDatabase.prototype.transaction;window.__restoreIDB=()=>{IDBDatabase.prototype.transaction=orig;};IDBDatabase.prototype.transaction=function(names,mode,...rest){if(mode==='readwrite')throw new DOMException('Quota exceeded','QuotaExceededError');return orig.call(this,names,mode,...rest);};});
 const failXp=(await saved(page)).xp;
 await page.evaluate(()=>{const e=persistQA.enemies.find(e=>!e.dead&&!e.finalGuard&&e.spawnId);persistQA.killEnemy(e);});
 await page.waitForFunction(()=>persistQA.state==='savefail'&&!document.getElementById('savefail').classList.contains('hidden'));
 const failing=await page.evaluate(()=>({status:persistQA.session.status,label:document.getElementById('save-status').textContent,text:document.getElementById('savefail-text').textContent,xp:persistQA.session.state.character.lifetimeXp}));
 check(failing.status==='failed'&&failing.label==='NOT SAVED'&&/Not saved/.test(failing.text)&&failing.xp===failXp,'save failure: '+JSON.stringify(failing));
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#save-export-unsaved').click()]);
 const file=JSON.parse(fs.readFileSync(await download.path(),'utf8'));check(file.source==='unsaved'&&file.saved===false&&file.envelope.payload.character.lifetimeXp>failXp,'unsaved export: '+JSON.stringify({source:file.source,saved:file.saved}));
 await page.evaluate(()=>window.__restoreIDB());await page.locator('#save-retry').click();
 await page.waitForFunction(()=>persistQA.state==='playing');await settle(page);
 const retried=await saved(page);check(retried.xp>failXp&&retried.killed.length===before.killed.length+1,'retry: '+JSON.stringify(retried));

 // 8. New Character is never silent: the first tap only explains; the saved character stays active.
 await page.evaluate(()=>{document.getElementById('pausebtn').click();});await page.locator('#quit').click();await page.waitForFunction(()=>persistQA.state==='title'&&persistQA.session===null&&!document.getElementById('continue').hidden&&/LVL/.test(document.getElementById('continue').textContent));
 await page.locator('#start').click();
 const confirm=await page.evaluate(()=>({start:document.getElementById('start').textContent,note:document.getElementById('save-note').textContent,story:window.VesperStory.paused}));
 check(confirm.start==='CONFIRM NEW CHARACTER'&&/export it first/.test(confirm.note)&&!confirm.story,'new character confirmation: '+JSON.stringify(confirm));
 const stillThere=await page.evaluate(async()=>{const S=VesperSaveStore,store=S.createStore({adapter:S.indexedDBAdapter(),sessionId:'probe'}),a=await store.activeCharacter(),l=await store.load(a.characterId);return {ok:l.ok,xp:l.envelope?.payload.character.lifetimeXp};});
 check(stillThere.ok&&stillThere.xp===retried.xp,'saved character replaced: '+JSON.stringify(stillThere));
 const legacyAfter=await page.evaluate(()=>({best:localStorage.getItem('vesperBest'),probe:localStorage.getItem('vesper-legacy-probe')}));
 check(JSON.stringify(legacyAfter)===JSON.stringify(legacyBefore),'legacy keys changed: '+JSON.stringify(legacyAfter));

 // 9. No storage: only an explicitly labelled unsaved trial, exported as unsaved.
 const noStore=await browser.newContext({viewport:{width:393,height:852},serviceWorkers:'block',acceptDownloads:true});
 await noStore.addInitScript(()=>{Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true});});
 await noStore.route('**/index.html',route=>route.fulfill({body:fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').replace("const stick=$('stick')",hook),contentType:'text/html'}));
 const trialPage=await noStore.newPage();await open(trialPage);
 await trialPage.waitForFunction(()=>document.getElementById('start').textContent==='PLAY UNSAVED TRIAL');
 await trialPage.locator('#start').click();await trialPage.locator('#story-choices button').first().click();await trialPage.waitForFunction(()=>persistQA.state==='playing'&&persistQA.session);await closeStory(trialPage);
 const trial=await trialPage.evaluate(()=>({label:document.getElementById('save-status').textContent,note:document.getElementById('save-note').textContent}));
 check(trial.label==='UNSAVED TRIAL','trial label: '+JSON.stringify(trial));
 await trialPage.evaluate(()=>document.getElementById('pausebtn').click());
 const [trialDownload]=await Promise.all([trialPage.waitForEvent('download'),trialPage.locator('#pause-export').click()]);
 const trialFile=JSON.parse(fs.readFileSync(await trialDownload.path(),'utf8'));check(trialFile.source==='unsaved'&&trialFile.saved===false,'trial export label');
 await noStore.close();

 check(!errors.length,'page errors: '+JSON.stringify(errors));
 await browser.close();
 console.log(JSON.stringify({persistenceBrowser:'passed',created,afterKills:{xp:afterKills.xp,level:afterKills.level,killed:afterKills.killed.length},restored:{xp:restored.xp,ash:restored.ash,potions:restored.potions,aegis:world.aegis},deaths:pending.deaths,retried:{xp:retried.xp},trial:trial.label}));
})().catch(e=>{console.error(e);process.exit(1);});
