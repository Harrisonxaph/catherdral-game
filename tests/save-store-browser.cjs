/* Real-browser IndexedDB checks for the persistent character repository (ARPG Phase 1A; recovery and export: Phase 2 PR4).
 * A bare harness page loads only the pure modules; the real game page must not write anything before New Character. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.BASE_URL||'http://127.0.0.1:3000';
const harness='<!doctype html><meta charset="utf-8"><title>save store harness</title><script src="./equipment.js"></script><script src="./abilities.js"></script><script src="./floors.js"></script><script src="./character-state.js"></script><script src="./save-store.js"></script>';
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

 // Phase 2 PR4: recovery selection and emergency export against real IndexedDB, across a closed and reopened connection.
 const recovery=await tabA.evaluate(async({ID,payload})=>{
  const S=VesperSaveStore;let adapter=S.indexedDBAdapter(),store=S.createStore({adapter,sessionId:'tab-a'});const {epoch}=await store.acquireLease(ID);
  const saved=await store.recoveryOptions(ID);
  const raw=await adapter.transact(['characters'],'readonly',tx=>tx.get('characters',ID));raw.payload.character.ash=7777777;
  await adapter.transact(['characters'],'readwrite',tx=>tx.put('characters',raw));await adapter.close();
  adapter=S.indexedDBAdapter();store=S.createStore({adapter,sessionId:'tab-a'});
  const need=await store.recoveryOptions(ID);
  const stale=await store.restoreBackup(ID,need.recommended,epoch,{expectedRevision:need.expectedRevision-1}),stillCorrupt=(await store.load(ID)).code;
  const corruptExport=await store.exportLatest(ID),corruptCheck=await store.verifyExport(corruptExport.text);
  const restored=await store.restoreBackup(ID,need.recommended,epoch,{expectedRevision:need.expectedRevision});await adapter.close();
  const reopened=S.createStore({adapter:S.indexedDBAdapter(),sessionId:'tab-a'}),after=await reopened.recoveryOptions(ID),loaded=await reopened.load(ID);
  const stored=await reopened.exportLatest(ID),storedCheck=await reopened.verifyExport(stored.text);
  const unsaved=await reopened.exportUnsaved(ID,{...payload,character:{...payload.character,ash:31337}},{baseRevision:after.expectedRevision}),unsavedCheck=await reopened.verifyExport(unsaved.text);
  return {saved:saved.state,need:need.state,needCurrent:need.current.status,recommended:need.backups.find(b=>b.key===need.recommended)?.revision,stale:stale.code,stillCorrupt,
   corruptExport:[corruptExport.status,corruptCheck.status],restored:restored.ok&&restored.revision,after:after.state,ash:loaded.envelope?.payload.character.ash,
   stored:[storedCheck.source,storedCheck.saved,storedCheck.status],unsaved:[unsavedCheck.source,unsavedCheck.saved,unsavedCheck.status,JSON.parse(unsaved.text).envelope.payload.character.ash]};
 },{ID,payload:fixture});
 check(recovery.saved==='saved'&&recovery.need==='recovery-required'&&recovery.needCurrent==='corrupt'&&recovery.recommended===6&&recovery.stale==='conflict'&&recovery.stillCorrupt==='corrupt'
  &&recovery.corruptExport.join()==='corrupt,corrupt'&&recovery.restored===9&&recovery.after==='saved'&&recovery.ash===50
  &&recovery.stored.join()==='stored,true,valid'&&recovery.unsaved.join()==='unsaved,false,valid,31337','recovery selection/export: '+JSON.stringify(recovery));

 // Denied or unavailable storage: no fake saved session, but unsaved progress can still be exported.
 const denied=await tabA.evaluate(async({ID,payload})=>{
  const S=VesperSaveStore,refusing={open(){throw new DOMException('The operation is insecure.','SecurityError');}};
  const store=S.createStore({adapter:S.indexedDBAdapter({indexedDB:refusing}),sessionId:'tab-a'}),none=S.createStore({adapter:S.indexedDBAdapter({indexedDB:null}),sessionId:'tab-a'});
  const lease=await store.acquireLease(ID),load=await store.load(ID),options=await store.recoveryOptions(ID),exported=await store.exportUnsaved(ID,payload,{baseRevision:0});
  return {lease:lease.code,load:load.code,options:options.code,noneLoad:(await none.load(ID)).code,exported:exported.ok&&exported.saved===false,check:(await store.verifyExport(exported.text)).status};
 },{ID,payload:fixture});
 check(denied.lease==='unavailable'&&denied.load==='unavailable'&&denied.options==='unavailable'&&denied.noneLoad==='unavailable'&&denied.exported&&denied.check==='valid','denied storage: '+JSON.stringify(denied));

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

 // Since Phase 2 PR5 the game loads these modules and reads the save database at boot, but it never creates a character
 // (or writes anything) until the player chooses New Character.
 const game=await context.newPage();game.on('pageerror',e=>errors.push(e.message));
 await game.goto(base+'/index.html');await game.waitForFunction(()=>window.castleView!==undefined&&/BEGIN YOUR STORY/.test(document.getElementById('start').textContent));await game.waitForTimeout(500);
 const untouched=await game.evaluate(async()=>{const S=VesperSaveStore,adapter=S.indexedDBAdapter(),store=S.createStore({adapter,sessionId:'probe'}),active=await store.activeCharacter();const records=await adapter.transact(['characters','meta','leases'],'readonly',async tx=>[(await tx.getAll('characters')).length,(await tx.getAll('meta')).length,(await tx.getAll('leases')).length]);await adapter.close();return {active:active.code,records,modules:[!!window.VesperCharacter,!!window.VesperSaveStore,!!window.VesperSession]};});
 check(untouched.active==='missing'&&untouched.records.join()==='0,0,0'&&untouched.modules.every(Boolean),'game wrote persistence before New Character: '+JSON.stringify(untouched));
 check(!errors.length,'page errors: '+JSON.stringify(errors));
 await browser.close();
 console.log(JSON.stringify({saveStoreBrowser:'passed',reopen:first,aborted:true,secondTab:second,recovered,recovery,denied,upgrade,gameUntouched:untouched.records}));
})().catch(e=>{console.error(e);process.exit(1);});
