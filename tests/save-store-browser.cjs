/* Real-browser IndexedDB checks for the persistent character repository (ARPG Phase 1A).
 * A bare harness page loads only the pure modules; the real game page must never create or open the save database. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.BASE_URL||'http://127.0.0.1:3000';
const harness='<!doctype html><meta charset="utf-8"><title>save store harness</title><script src="./equipment.js"></script><script src="./abilities.js"></script><script src="./character-state.js"></script><script src="./save-store.js"></script>';
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/save-v1-full.json'),'utf8')).payload;
const check=(ok,message)=>{if(!ok)throw Error(message);};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({serviceWorkers:'block'}),errors=[];
 await context.route('**/save-harness.html',r=>r.fulfill({body:harness,contentType:'text/html'}));
 const open=async()=>{const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/save-harness.html');await page.waitForFunction(()=>window.VesperSaveStore&&window.VesperCharacter);return page;};
 const tabA=await open(),tabB=await open(),ID='0f1e2d3c-aaaa-4bbb-8ccc-123456789abc';
 await tabA.evaluate(async()=>{await new Promise(r=>{const q=indexedDB.deleteDatabase('vesper-arpg');q.onsuccess=q.onerror=q.onblocked=r;});});

 // Commit seven revisions, close the connection and reopen: the latest revision and five backups persist.
 const first=await tabA.evaluate(async({ID,payload})=>{
  const S=VesperSaveStore,adapter=S.indexedDBAdapter(),store=S.createStore({adapter,sessionId:'tab-a'}),lease=await store.acquireLease(ID);
  const made=await store.create(ID,payload,lease.epoch);if(!made.ok)return made;
  for(let rev=1;rev<7;rev++){const r=await store.commit(ID,{...payload,character:{...payload.character,ash:rev*10}},{expectedRevision:rev,epoch:lease.epoch});if(!r.ok)return r;}
  await adapter.close();
  const reopened=S.createStore({adapter:S.indexedDBAdapter(),sessionId:'tab-a'}),loaded=await reopened.load(ID),backups=await reopened.listBackups(ID);
  window.lease=lease;
  return {ok:loaded.ok,revision:loaded.envelope?.revision,ash:loaded.envelope?.payload.character.ash,items:loaded.envelope?.payload.items.length,backups:backups.backups.map(b=>b.revision+':'+b.status)};
 },{ID,payload:fixture});
 check(first.ok&&first.revision===7&&first.ash===60&&first.items===12,'reopen lost data: '+JSON.stringify(first));
 check(JSON.stringify(first.backups)===JSON.stringify(['6:valid','5:valid','4:valid','3:valid','2:valid']),'backups: '+JSON.stringify(first.backups));

 // A real aborted IndexedDB transaction leaves no partial write.
 const aborted=await tabA.evaluate(async()=>{
  const adapter=VesperSaveStore.indexedDBAdapter();let error='';
  try{await adapter.transact(['meta','characters'],'readwrite',async tx=>{await tx.put('meta',{key:'partial'});throw new Error('boom');});}catch(e){error=e.message;}
  const left=await adapter.transact(['meta'],'readonly',tx=>tx.get('meta','partial'));await adapter.close();return {error,left:left??null};
 });
 check(aborted.error==='boom'&&aborted.left===null,'abort wrote partial data: '+JSON.stringify(aborted));

 // Second tab: read-only while the first holds the lease; a stale epoch is fenced.
 const second=await tabB.evaluate(async({ID,payload})=>{
  const S=VesperSaveStore,store=S.createStore({adapter:S.indexedDBAdapter(),sessionId:'tab-b'});
  const lease=await store.acquireLease(ID),load=await store.load(ID),write=await store.commit(ID,payload,{expectedRevision:7,epoch:1});
  return {lease:lease.code,load:load.ok,write:write.code};
 },{ID,payload:fixture});
 check(second.lease==='locked'&&second.load&&second.write==='fenced','second tab: '+JSON.stringify(second));

 // Corrupt the stored bytes directly: load reports it, restore quarantines it and rolls back to the newest good backup.
 const recovered=await tabA.evaluate(async ID=>{
  const S=VesperSaveStore,adapter=S.indexedDBAdapter(),store=S.createStore({adapter,sessionId:'tab-a'});
  const raw=await adapter.transact(['characters'],'readonly',tx=>tx.get('characters',ID));raw.payload.character.ash=123456;
  await adapter.transact(['characters'],'readwrite',tx=>tx.put('characters',raw));
  const corrupt=await store.load(ID),{backups}=await store.listBackups(ID),restore=await store.restoreBackup(ID,backups[0].key,window.lease.epoch);
  const after=await store.load(ID),q=await store.quarantined(ID);
  return {corrupt:corrupt.code,restore:restore.ok,revision:restore.revision,ash:after.envelope?.payload.character.ash,quarantined:q.records.map(r=>r.raw.payload.character.ash)};
 },ID);
 check(recovered.corrupt==='corrupt'&&recovered.restore&&recovered.revision===8&&recovered.ash===50&&recovered.quarantined[0]===123456,'recovery: '+JSON.stringify(recovered));

 // A newer page version upgrading the database closes this tab's connection instead of being blocked by it.
 const upgrade=await tabA.evaluate(async ID=>{
  let closed=false;const adapter=VesperSaveStore.indexedDBAdapter({onVersionChange:()=>{closed=true;}});
  await adapter.transact(['meta'],'readonly',tx=>tx.get('meta','active'));
  const blocked=await new Promise(resolve=>{const q=indexedDB.open('vesper-arpg',2);q.onblocked=()=>resolve(true);q.onsuccess=()=>{q.result.close();resolve(false);};q.onerror=()=>resolve('error');});
  // The old build now sees a database newer than it understands and reports it rather than touching it.
  const old=VesperSaveStore.createStore({adapter:VesperSaveStore.indexedDBAdapter(),sessionId:'tab-a'}),load=await old.load(ID);
  return {closed,blocked,load:load.code};
 },ID);
 check(upgrade.closed&&upgrade.blocked===false&&upgrade.load==='unsupported','version change: '+JSON.stringify(upgrade));
 await tabA.evaluate(async()=>{await new Promise(r=>{const q=indexedDB.deleteDatabase('vesper-arpg');q.onsuccess=q.onerror=q.onblocked=r;});});

 // The shipped game does not load these modules and never creates or opens the save database.
 const game=await context.newPage();game.on('pageerror',e=>errors.push(e.message));
 await game.goto(base+'/index.html');await game.waitForFunction(()=>window.castleView!==undefined||document.readyState==='complete');
 await game.locator('#start').click();await game.waitForTimeout(1500);
 const untouched=await game.evaluate(async()=>({dbs:(await indexedDB.databases()).map(d=>d.name),modules:[!!window.VesperCharacter,!!window.VesperSaveStore],scripts:[...document.scripts].map(s=>s.src).filter(s=>/character-state|save-store/.test(s))}));
 check(!untouched.dbs.includes('vesper-arpg')&&!untouched.modules[0]&&!untouched.modules[1]&&!untouched.scripts.length,'game touched persistence: '+JSON.stringify(untouched));
 check(!errors.length,'page errors: '+JSON.stringify(errors));
 await browser.close();
 console.log(JSON.stringify({saveStoreBrowser:'passed',reopen:first,aborted:true,secondTab:second,recovered,upgrade,gameUntouched:untouched.dbs}));
})().catch(e=>{console.error(e);process.exit(1);});
