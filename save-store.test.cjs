const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('./character-state.js');
const S=require('./save-store.js');
const ID='0f1e2d3c-aaaa-4bbb-8ccc-123456789abc';
const basePayload=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'tests/fixtures/save-v1-full.json'),'utf8')).payload;
const withAsh=(p,ash)=>({...p,character:{...p.character,ash}});
const snapshot=adapter=>JSON.stringify([...adapter.data].map(([n,m])=>[n,[...m]]));
// Deterministic clock shared by every store on the same adapter, like tabs sharing one origin.
function setup(){const adapter=S.memoryAdapter(),time={now:Date.parse('2026-10-28T12:00:00Z')},clock=()=>time.now;const store=(sessionId='tab-a',extra={})=>S.createStore({adapter,sessionId,clock,leaseMs:10000,...extra});return {adapter,time,store};}
async function created(){const env=setup(),a=env.store('tab-a'),lease=await a.acquireLease(ID);assert.ok(lease.ok);const made=await a.create(ID,basePayload(),lease.epoch);assert.ok(made.ok,JSON.stringify(made));return {...env,a,epoch:lease.epoch,revision:made.revision};}

test('Create and load round-trip a signed revision; loading or a second create never replaces a character',async()=>{
 const {adapter,store}=setup(),a=store();
 assert.equal((await a.load(ID)).code,'missing');assert.equal(snapshot(adapter),snapshot(S.memoryAdapter()),'loading an empty store writes nothing');
 const {epoch}=await a.acquireLease(ID),made=await a.create(ID,basePayload(),epoch);
 assert.ok(made.ok);assert.equal(made.revision,1);assert.match(made.envelope.integrity.digest,/^[0-9a-f]{64}$/);
 const loaded=await a.load(ID);assert.ok(loaded.ok);assert.equal(C.canonical(loaded.envelope.payload),C.canonical(basePayload()));assert.equal(loaded.needsMigration,false);
 assert.deepEqual(await a.activeCharacter(),{ok:true,characterId:ID});
 assert.equal((await a.create(ID,C.dehydrate(C.create()),epoch)).code,'exists');
 assert.equal(C.canonical((await a.load(ID)).envelope.payload),C.canonical(basePayload()));
});

test('Commits are compare-and-swap; stale revisions conflict and change nothing',async()=>{
 const {adapter,a,epoch}=await created();
 const second=await a.commit(ID,withAsh(basePayload(),400),{expectedRevision:1,epoch});assert.ok(second.ok);assert.equal(second.revision,2);
 const before=snapshot(adapter);
 assert.equal((await a.commit(ID,withAsh(basePayload(),999),{expectedRevision:1,epoch})).code,'conflict');assert.equal(snapshot(adapter),before);
 // Commands issued together are serialised: exactly one of two writers expecting the same revision succeeds.
 const [x,y]=await Promise.all([a.commit(ID,withAsh(basePayload(),401),{expectedRevision:2,epoch}),a.commit(ID,withAsh(basePayload(),402),{expectedRevision:2,epoch})]);
 assert.deepEqual([x.ok,y.code],[true,'conflict']);assert.equal((await a.load(ID)).envelope.payload.character.ash,401);
 assert.equal((await a.commit(ID,basePayload(),{expectedRevision:0,epoch})).code,'invalid');
});

test('Overlapping writers from two stores on one database cannot both commit the same revision',async()=>{
 const adapter=S.memoryAdapter({latency:true}),clock=()=>Date.parse('2026-10-28T12:00:00Z'),a=S.createStore({adapter,sessionId:'tab-a',clock}),a2=S.createStore({adapter,sessionId:'tab-a',clock});
 const {epoch}=await a.acquireLease(ID);assert.ok((await a.create(ID,basePayload(),epoch)).ok);
 const results=await Promise.all([a.commit(ID,withAsh(basePayload(),1),{expectedRevision:1,epoch}),a2.commit(ID,withAsh(basePayload(),2),{expectedRevision:1,epoch})]);
 assert.deepEqual(results.map(r=>r.ok).sort(),[false,true]);assert.equal(results.find(r=>!r.ok).code,'conflict');
 assert.equal((await a.listBackups(ID)).backups.length,1,'exactly one revision was replaced');
});

test('Invalid candidates are refused before any write and leave the saved character intact',async()=>{
 const {adapter,a,epoch}=await created(),before=snapshot(adapter),p=basePayload();
 p.character.stash[5]=p.character.equipment.main;
 const r=await a.commit(ID,p,{expectedRevision:1,epoch});assert.equal(r.code,'invalid');assert.ok(r.errors.some(e=>/also owned/.test(e.message)));
 assert.equal(snapshot(adapter),before);
});

test('Five rotating backups are kept; the previous good revision survives every failed write',async()=>{
 const {adapter,a,epoch}=await created();
 for(let rev=1;rev<=9;rev++)assert.ok((await a.commit(ID,withAsh(basePayload(),rev*10),{expectedRevision:rev,epoch})).ok);
 const list=await a.listBackups(ID);assert.deepEqual(list.backups.map(b=>b.revision),[9,8,7,6,5]);assert.ok(list.backups.every(b=>b.status==='valid'&&b.summary.items===12));
 // Abort at every write boundary of a commit: characters, backups, meta and pruning are all-or-nothing.
 let succeeded=-1;
 for(let n=0;n<16&&succeeded<0;n++){const before=snapshot(adapter);adapter.failAfter(n);const r=await a.commit(ID,withAsh(basePayload(),5000+n),{expectedRevision:10,epoch});adapter.clearFailure();
  if(r.ok){succeeded=n;break;}
  assert.equal(r.code,'storage');assert.equal(snapshot(adapter),before,'abort after '+n+' writes left a partial save');}
 assert.ok(succeeded>=4,'a commit writes the backup, record, metadata and prunes');assert.equal((await a.load(ID)).envelope.payload.character.ash,5000+succeeded);
});

test('Quota and unavailable storage report honest codes and never claim a save',async()=>{
 const {adapter,a,epoch}=await created(),before=snapshot(adapter);
 adapter.failAfter(1,'QuotaExceededError');const r=await a.commit(ID,withAsh(basePayload(),1),{expectedRevision:1,epoch});assert.deepEqual([r.ok,r.code],[false,'quota']);assert.equal(snapshot(adapter),before);
 const none=S.createStore({adapter:S.indexedDBAdapter({indexedDB:undefined}),sessionId:'tab-z'});
 assert.equal((await none.load(ID)).code,'unavailable');assert.equal((await none.acquireLease(ID)).code,'unavailable');
});

test('The writer lease fences stale tabs: a second tab is read-only until the lease expires',async()=>{
 const {adapter,time,store,a,epoch}=await created(),b=store('tab-b');
 const blocked=await b.acquireLease(ID);assert.equal(blocked.code,'locked');assert.equal(blocked.holder,'tab-a');
 assert.ok((await b.load(ID)).ok,'a read-only tab can still load');
 assert.equal((await b.commit(ID,withAsh(basePayload(),7),{expectedRevision:1,epoch})).code,'fenced','borrowing an epoch is not enough');
 assert.ok((await a.renewLease(ID,epoch)).ok);
 time.now+=10001;const taken=await b.acquireLease(ID);assert.ok(taken.ok);assert.equal(taken.epoch,epoch+1);
 const before=snapshot(adapter);
 assert.equal((await a.commit(ID,withAsh(basePayload(),8),{expectedRevision:1,epoch})).code,'fenced');assert.equal((await a.renewLease(ID,epoch)).code,'fenced');assert.equal(snapshot(adapter),before);
 assert.equal((await a.acquireLease(ID)).code,'locked');
 assert.ok((await b.commit(ID,withAsh(basePayload(),9),{expectedRevision:1,epoch:taken.epoch})).ok);
 assert.ok((await b.releaseLease(ID,taken.epoch)).ok);const back=await a.acquireLease(ID);assert.ok(back.ok);assert.equal(back.epoch,taken.epoch+1);
});

test('A corrupt latest save is reported, kept and quarantined on restore; backups are chosen explicitly',async()=>{
 const {adapter,a,epoch}=await created();
 for(let rev=1;rev<=3;rev++)assert.ok((await a.commit(ID,withAsh(basePayload(),rev*100),{expectedRevision:rev,epoch})).ok);
 const stored=adapter.data.get('characters').get(ID);stored.payload.character.ash=999999;
 const load=await a.load(ID);assert.equal(load.code,'corrupt');assert.ok(load.errors.some(e=>/checksum/.test(e.message)));assert.equal(load.raw.payload.character.ash,999999);
 assert.equal((await a.commit(ID,withAsh(basePayload(),1),{expectedRevision:4,epoch})).code,'corrupt');
 const exported=JSON.parse((await a.exportLatest(ID)).text);assert.equal(exported.envelope.payload.character.ash,999999,'export keeps the corrupt bytes');
 const {backups}=await a.listBackups(ID);assert.deepEqual(backups.map(b=>[b.revision,b.status,b.summary.ash]),[[3,'valid',200],[2,'valid',100],[1,'valid',340]]);
 const restored=await a.restoreBackup(ID,backups[0].key,epoch);assert.ok(restored.ok,JSON.stringify(restored));assert.equal(restored.revision,5);
 const after=await a.load(ID);assert.ok(after.ok);assert.equal(after.envelope.payload.character.ash,200);
 const q=await a.quarantined(ID);assert.equal(q.records.length,1);assert.equal(q.records[0].raw.payload.character.ash,999999);
 // A damaged backup cannot be restored; schema-invalid bytes with a valid checksum are still corrupt.
 adapter.data.get('backups').get(backups[1].key).envelope.payload.items.push({id:1,key:'rustbound',mods:[],upgradeRank:0});
 assert.equal((await a.restoreBackup(ID,backups[1].key,epoch)).code,'corrupt');
 assert.equal((await a.restoreBackup(ID,'nope',epoch)).code,'missing');
});

test('Restoring a valid backup rolls back as a new revision; items are not appended to the current save',async()=>{
 const {adapter,a,epoch}=await created(),less=basePayload();
 const id=less.character.backpack[2];less.character.backpack[2]=null;less.items=less.items.filter(i=>i.id!==id);
 assert.ok((await a.commit(ID,less,{expectedRevision:1,epoch})).ok);
 const {backups}=await a.listBackups(ID),before=snapshot(adapter);
 assert.equal((await a.restoreBackup(ID,backups[0].key,epoch)).code,'invalid','restoring over a good save must name the revision compared against');
 assert.equal((await a.restoreBackup(ID,backups[0].key,epoch,{expectedRevision:1})).code,'conflict');assert.equal(snapshot(adapter),before);
 const restored=await a.restoreBackup(ID,backups[0].key,epoch,{expectedRevision:2});
 assert.equal(restored.revision,3);const now=(await a.load(ID)).envelope.payload;assert.equal(now.items.length,12);assert.equal(new Set(now.items.map(i=>i.id)).size,12);
 assert.deepEqual((await a.listBackups(ID)).backups.map(b=>b.revision),[2,1]);
});

test('Saves from a newer version are read-only: never overwritten, restored over or migrated',async()=>{
 const {adapter,a,epoch}=await created();
 const stored=adapter.data.get('characters').get(ID);stored.schemaVersion=2;const before=snapshot(adapter);
 assert.equal((await a.load(ID)).code,'unsupported');
 assert.equal((await a.commit(ID,basePayload(),{expectedRevision:1,epoch})).code,'unsupported');
 assert.equal((await a.migrateStored(ID,epoch)).code,'unsupported');
 assert.equal(snapshot(adapter),before);
});

test('Stored migrations pin the pre-migration backup, survive rotation and are idempotent (synthetic v1 to v2)',async()=>{
 const {adapter,time,store}=setup(),plain=store('tab-a'),lease=await plain.acquireLease(ID);assert.ok((await plain.create(ID,basePayload(),lease.epoch)).ok);
 const strip=e=>({...e,schemaVersion:1,payload:{...e.payload,character:(({title,...rest})=>rest)(e.payload.character)}});
 const validate=e=>e?.schemaVersion===2?(e.payload?.character?.title==='Penitent'?C.validate(strip(e)):{ok:false,code:'invalid',errors:[{path:'title',message:'missing'}]}):C.validate(e);
 const plan={target:2,steps:{1:e=>{e.schemaVersion=2;e.payload.character.title='Penitent';return e;}},validators:{1:C.validate,2:validate}};
 const schema={...C,validate,migrate:e=>C.migrate(e,plan),envelope:(p,m)=>({...C.envelope(p,m),schemaVersion:2})};
 const v2=S.createStore({adapter,sessionId:'tab-a',clock:()=>time.now,schema});
 assert.equal((await v2.load(ID)).needsMigration,true);
 const m=await v2.migrateStored(ID,lease.epoch);assert.ok(m.ok,JSON.stringify(m));assert.equal(m.migrated,true);assert.equal(m.revision,2);
 assert.equal((await v2.migrateStored(ID,lease.epoch)).migrated,false,'repeating a completed migration is a no-op');
 for(let rev=2;rev<9;rev++)assert.ok((await v2.commit(ID,(await v2.load(ID)).envelope.payload,{expectedRevision:rev,epoch:lease.epoch})).ok);
 const {backups}=await v2.listBackups(ID),pinned=backups.filter(b=>b.pinned);
 assert.equal(pinned.length,1);assert.equal(pinned[0].revision,1);assert.equal(adapter.data.get('backups').get(pinned[0].key).envelope.schemaVersion,1);
 assert.equal(backups.filter(b=>!b.pinned).length,5);
 // An old build reading the migrated save sees a newer version and refuses to write it.
 assert.equal((await plain.load(ID)).code,'unsupported');assert.equal((await plain.commit(ID,basePayload(),{expectedRevision:9,epoch:lease.epoch})).code,'unsupported');
 // A failing migration leaves the original record untouched.
 const broken=S.createStore({adapter,sessionId:'tab-a',clock:()=>time.now,schema:{...schema,migrate:()=>({ok:false,code:'invalid',errors:[{path:'',message:'boom'}]})}});
 const before=snapshot(adapter);assert.equal((await broken.migrateStored(ID,lease.epoch)).ok,false);assert.equal(snapshot(adapter),before);
});

test('Review: a corrupt record is never migrated or re-signed',async()=>{
 const {adapter,time,store}=setup(),plain=store('tab-a'),lease=await plain.acquireLease(ID);assert.ok((await plain.create(ID,basePayload(),lease.epoch)).ok);
 const validate=e=>e?.schemaVersion===2?C.validate({...e,schemaVersion:1}):C.validate(e);
 const plan={target:2,steps:{1:e=>{e.schemaVersion=2;return e;}},validators:{1:C.validate,2:validate}};
 const v2=S.createStore({adapter,sessionId:'tab-a',clock:()=>time.now,schema:{...C,validate,migrate:e=>C.migrate(e,plan),envelope:(p,m)=>({...C.envelope(p,m),schemaVersion:2})}});
 adapter.data.get('characters').get(ID).payload.character.ash=777;const before=snapshot(adapter);
 assert.equal((await v2.load(ID)).code,'corrupt');
 const m=await v2.migrateStored(ID,lease.epoch);assert.equal(m.code,'corrupt');assert.equal(snapshot(adapter),before);
});

test('Review: corruption recovery is compare-and-swap; a stale restore cannot replace newer progress',async()=>{
 const adapter=S.memoryAdapter({latency:true}),clock=()=>Date.parse('2026-10-28T12:00:00Z'),a=S.createStore({adapter,sessionId:'tab-a',clock}),a2=S.createStore({adapter,sessionId:'tab-a',clock});
 const {epoch}=await a.acquireLease(ID);assert.ok((await a.create(ID,basePayload(),epoch)).ok);
 for(let rev=1;rev<3;rev++)assert.ok((await a.commit(ID,withAsh(basePayload(),rev*100),{expectedRevision:rev,epoch})).ok);
 adapter.data.get('characters').get(ID).payload.character.ash=999999;
 const {backups}=await a.listBackups(ID);
 const results=await Promise.all([a.restoreBackup(ID,backups[0].key,epoch),a2.restoreBackup(ID,backups[1].key,epoch)]);
 assert.deepEqual(results.map(r=>r.ok).sort(),[false,true]);assert.equal(results.find(r=>!r.ok).code,'conflict');
 assert.equal((await a.quarantined(ID)).records.length,1,'only the corrupt record is quarantined');
 // A recovered save that then progresses is never overwritten by a restore that inspected the old corrupt bytes.
 const winner=results.find(r=>r.ok),progressed=await a.commit(ID,withAsh(basePayload(),4242),{expectedRevision:winner.revision,epoch});assert.ok(progressed.ok);
 assert.equal((await a.load(ID)).envelope.payload.character.ash,4242);
});

test('Review: the stored record is a snapshot; caller mutations during signing cannot desynchronise its checksum',async()=>{
 const adapter=S.memoryAdapter(),clock=()=>Date.parse('2026-10-28T12:00:00Z');let release;const gate=new Promise(r=>release=r);
 const slow=async text=>{await gate;return S.sha256(text);};
 const a=S.createStore({adapter,sessionId:'tab-a',clock,digest:slow}),{epoch}=await a.acquireLease(ID),payload=basePayload();
 const pending=a.create(ID,payload,epoch);await new Promise(r=>setTimeout(r,0));payload.character.ash+=1;release();
 assert.ok((await pending).ok);const loaded=await a.load(ID);assert.ok(loaded.ok,JSON.stringify(loaded.errors));assert.equal(loaded.envelope.payload.character.ash,basePayload().character.ash);
});

test('Review: backups from before a schema upgrade are migrated when restored; a failing migration changes nothing',async()=>{
 const {adapter,time,store}=setup(),plain=store('tab-a'),lease=await plain.acquireLease(ID);assert.ok((await plain.create(ID,basePayload(),lease.epoch)).ok);
 const strip=e=>({...e,schemaVersion:1,payload:{...e.payload,character:(({title,...rest})=>rest)(e.payload.character)}});
 const validate=e=>e?.schemaVersion===2?(e.payload?.character?.title==='Penitent'?C.validate(strip(e)):{ok:false,code:'invalid',errors:[{path:'title',message:'missing'}]}):C.validate(e);
 const plan={target:2,steps:{1:e=>{e.schemaVersion=2;e.payload.character.title='Penitent';return e;}},validators:{1:C.validate,2:validate}};
 const schema={...C,validate,migrate:e=>C.migrate(e,plan),envelope:(p,m)=>({...C.envelope(p,m),schemaVersion:2})};
 const v2=S.createStore({adapter,sessionId:'tab-a',clock:()=>time.now,schema});
 assert.ok((await v2.migrateStored(ID,lease.epoch)).ok);
 const {backups}=await v2.listBackups(ID),pinned=backups.find(b=>b.pinned);
 assert.equal(pinned.status,'valid');assert.equal(pinned.summary.migrated,true);
 const restored=await v2.restoreBackup(ID,pinned.key,lease.epoch,{expectedRevision:2});assert.ok(restored.ok,JSON.stringify(restored));assert.equal(restored.revision,3);
 const loaded=await v2.load(ID);assert.ok(loaded.ok);assert.equal(loaded.envelope.schemaVersion,2);assert.equal(loaded.envelope.payload.character.title,'Penitent');
 // A backup whose migration fails is reported and never restored.
 const broken=S.createStore({adapter,sessionId:'tab-a',clock:()=>time.now,schema:{...schema,migrate:e=>e.schemaVersion===2?C.migrate(e,{...plan,target:2}):{ok:false,code:'invalid',errors:[{path:'',message:'boom'}]}}});
 const before=snapshot(adapter);
 assert.equal((await broken.listBackups(ID)).backups.find(b=>b.pinned).status,'corrupt');
 assert.equal((await broken.restoreBackup(ID,pinned.key,lease.epoch)).code,'corrupt');assert.equal(snapshot(adapter),before);
});

test('Review: non-JSON candidate values are refused, never normalised into a saved record',async()=>{
 const {adapter,store}=setup(),a=store(),{epoch}=await a.acquireLease(ID),empty=snapshot(adapter);
 class Slot{}
 const cases=[['NaN',p=>{p.character.stash[10]=NaN;}],['Infinity',p=>{p.character.ash=Infinity;}],['undefined',p=>{p.character.stash[10]=undefined;}],
  ['hole',p=>{delete p.character.stash[10];}],['function',p=>{p.character.stash[10]=()=>null;}],['class instance',p=>{p.character.stash[10]=new Slot();}],
  ['bigint',p=>{p.character.ash=10n;}],['cycle',p=>{p.campaign.questStates.self=p.campaign;}]];
 for(const [name,change] of cases){
  const p=basePayload();change(p);
  const made=await a.create(ID,p,epoch);assert.equal(made.code,'invalid',name+' was accepted');
  assert.equal(snapshot(adapter),empty,name+' wrote to storage');
 }
 // Existing records are protected the same way on commit.
 assert.ok((await a.create(ID,basePayload(),epoch)).ok);const before=snapshot(adapter),p=basePayload();p.character.stash[10]=NaN;
 assert.equal((await a.commit(ID,p,{expectedRevision:1,epoch})).code,'invalid');assert.equal(snapshot(adapter),before);
});

// ---- Phase 2 PR4: emergency export and backup recovery selection
const resign=async env=>({...env,integrity:{algorithm:'SHA-256',digest:await S.sha256(C.canonical({...env,integrity:null}))}});

test('PR4: stored and unsaved exports are labelled, schema-validated, verifiable and never write',async()=>{
 const {adapter,a}=await created();
 const stored=await a.exportLatest(ID),file=JSON.parse(stored.text);
 assert.deepEqual([stored.source,stored.saved,stored.status,stored.revision],['stored',true,'valid',1]);
 assert.deepEqual([file.format,file.version,file.source,file.saved,file.characterId,file.revision],[S.EXPORT_FORMAT,1,'stored',true,ID,1]);
 assert.match(file.notice,/cannot import/);assert.match(file.notice,/does not guarantee/);assert.doesNotMatch(file.notice,/NOT SAVED/);
 const checked=await a.verifyExport(stored.text);assert.deepEqual([checked.ok,checked.source,checked.saved,checked.status,checked.revision],[true,'stored',true,'valid',1]);
 // Unsaved in-memory progress: validated, labelled unsaved, and storage is untouched.
 const before=snapshot(adapter),unsaved=await a.exportUnsaved(ID,withAsh(basePayload(),777),{baseRevision:1});
 assert.ok(unsaved.ok,JSON.stringify(unsaved));assert.deepEqual([unsaved.source,unsaved.saved,unsaved.revision],['unsaved',false,2]);
 const uf=JSON.parse(unsaved.text);assert.match(uf.notice,/NOT SAVED in this browser/);assert.equal(uf.envelope.payload.character.ash,777);
 assert.equal(snapshot(adapter),before,'export never writes');assert.equal((await a.load(ID)).envelope.payload.character.ash,basePayload().character.ash);
 const uv=await a.verifyExport(unsaved.text);assert.deepEqual([uv.source,uv.saved,uv.status,uv.revision],['unsaved',false,'valid',2]);
 // Invalid in-memory state is refused, never exported as if it were a usable save.
 const dup=basePayload();dup.items.push({...dup.items[0]});
 assert.equal((await a.exportUnsaved(ID,dup,{baseRevision:1})).code,'invalid');
 assert.equal((await a.exportUnsaved(ID,withAsh(basePayload(),NaN),{baseRevision:1})).code,'invalid');
 assert.equal((await a.exportUnsaved(ID,basePayload(),{baseRevision:-1})).code,'invalid');
 // Damaged, mislabelled, foreign, future and oversized files are reported for what they are.
 const tampered=JSON.parse(unsaved.text);tampered.envelope.payload.character.ash=1;
 assert.equal((await a.verifyExport(JSON.stringify(tampered))).status,'corrupt');
 assert.equal((await a.verifyExport(JSON.stringify({...uf,saved:true}))).code,'invalid-export');
 assert.equal((await a.verifyExport(JSON.stringify({...uf,characterId:'someone-else'}))).status,'corrupt');
 assert.equal((await a.verifyExport(JSON.stringify({...uf,version:2}))).code,'unsupported');
 assert.equal((await a.verifyExport(JSON.stringify({...uf,envelope:await resign({...uf.envelope,schemaVersion:2})}))).status,'unsupported');
 assert.equal((await a.verifyExport('{nope')).code,'invalid-export');assert.equal((await a.verifyExport('[]')).code,'invalid-export');assert.equal((await a.verifyExport(null)).code,'invalid-export');
 assert.equal((await a.verifyExport(' '.repeat(S.MAX_EXPORT_BYTES+1))).code,'too-large');
 // A corrupt stored record is exported as it is (labelled corrupt) unless it exceeds the bound, which is refused.
 adapter.data.get('characters').get(ID).junk='x'.repeat(S.MAX_EXPORT_BYTES);
 const big=await a.exportLatest(ID);assert.equal(big.code,'too-large');assert.ok(big.bytes>S.MAX_EXPORT_BYTES);
});

test('PR4: unsaved export works when storage is denied or a write never finishes',async()=>{
 const clock=()=>Date.parse('2026-10-28T12:00:00Z');
 const denied=S.createStore({adapter:{transact(){const e=new Error('denied');e.name='SecurityError';throw e;}},sessionId:'tab-a',clock});
 assert.equal((await denied.load(ID)).code,'storage');assert.equal((await denied.recoveryOptions(ID)).ok,false);
 const r=await denied.exportUnsaved(ID,basePayload(),{baseRevision:0});assert.ok(r.ok,JSON.stringify(r));assert.equal(r.saved,false);assert.equal(r.revision,1);
 const unavailable=S.createStore({adapter:S.indexedDBAdapter({indexedDB:null}),sessionId:'tab-a',clock});
 assert.equal((await unavailable.load(ID)).code,'unavailable');assert.ok((await unavailable.exportUnsaved(ID,basePayload())).ok);
 const hung=S.createStore({adapter:{transact:()=>new Promise(()=>{})},sessionId:'tab-a',clock});void hung.commit(ID,basePayload(),{expectedRevision:1,epoch:1});
 assert.ok((await hung.exportUnsaved(ID,basePayload(),{baseRevision:1})).ok,'not queued behind a pending write');
});

test('PR4: recovery options distinguish saved, recovery-required, read-only and missing, and recommend only a good backup',async()=>{
 const {adapter,store}=setup(),fresh=store('tab-a');
 assert.deepEqual(await fresh.recoveryOptions(ID),{ok:true,state:'missing',current:null,expectedRevision:0,backups:[],recommended:null});
 const {adapter:ad,a,epoch}=await created();void adapter;
 for(let rev=1;rev<=3;rev++)assert.ok((await a.commit(ID,withAsh(basePayload(),rev*100),{expectedRevision:rev,epoch})).ok);
 const saved=await a.recoveryOptions(ID);assert.equal(saved.state,'saved');assert.equal(saved.recommended,null);assert.equal(saved.expectedRevision,4);
 assert.deepEqual(saved.current,{revision:4,status:'valid',savedAt:'2026-10-28T12:00:00.000Z'});assert.deepEqual(saved.backups.map(b=>b.revision),[3,2,1]);
 // Corrupt latest; the newest backup is damaged and the next one is from a newer game version: neither is recommended.
 const backups=ad.data.get('backups'),key=r=>[...backups.keys()].find(k=>backups.get(k).revision===r);
 ad.data.get('characters').get(ID).payload.character.ash=999999;
 backups.get(key(3)).envelope.payload.character.ash=5;
 backups.get(key(2)).envelope=await resign({...backups.get(key(2)).envelope,schemaVersion:2});
 const before=snapshot(ad),need=await a.recoveryOptions(ID);
 assert.equal(need.state,'recovery-required');assert.deepEqual(need.current,{revision:4,status:'corrupt',savedAt:'2026-10-28T12:00:00.000Z'});
 assert.deepEqual(need.backups.map(b=>[b.revision,b.status]),[[3,'corrupt'],[2,'unsupported'],[1,'valid']]);assert.equal(need.recommended,key(1));
 assert.equal(snapshot(ad),before,'inspecting recovery writes nothing');
 assert.equal((await a.restoreBackup(ID,key(3),epoch,{expectedRevision:4})).code,'corrupt');
 assert.equal((await a.restoreBackup(ID,key(2),epoch,{expectedRevision:4})).code,'unsupported');assert.equal(snapshot(ad),before,'a bad backup never replaces anything');
 const restored=await a.restoreBackup(ID,need.recommended,epoch,{expectedRevision:need.expectedRevision});assert.ok(restored.ok,JSON.stringify(restored));
 const after=await a.recoveryOptions(ID);assert.equal(after.state,'saved');assert.equal(after.current.revision,5);assert.equal((await a.load(ID)).envelope.payload.character.ash,basePayload().character.ash);
 assert.equal((await a.quarantined(ID)).records[0].raw.payload.character.ash,999999,'the corrupt bytes are kept');
 // A save from a newer version is read-only: nothing is recommended and nothing restores over it.
 ad.data.get('characters').set(ID,await resign({...ad.data.get('characters').get(ID),schemaVersion:2}));
 const ro=await a.recoveryOptions(ID),frozen=snapshot(ad);assert.equal(ro.state,'read-only');assert.equal(ro.recommended,null);
 assert.equal((await a.restoreBackup(ID,key(1),epoch,{expectedRevision:5})).code,'unsupported');assert.equal(snapshot(ad),frozen);
 // A damaged record whose revision is not even an integer can still be recovered with the choice it reports.
 const odd=await created();assert.ok((await odd.a.commit(ID,withAsh(basePayload(),100),{expectedRevision:1,epoch:odd.epoch})).ok);
 odd.adapter.data.get('characters').get(ID).revision='junk';const oddOptions=await odd.a.recoveryOptions(ID);
 assert.equal(oddOptions.state,'recovery-required');assert.equal(oddOptions.expectedRevision,null);
 assert.equal((await odd.a.restoreBackup(ID,oddOptions.recommended,odd.epoch,{expectedRevision:2})).code,'conflict');
 assert.ok((await odd.a.restoreBackup(ID,oddOptions.recommended,odd.epoch,{expectedRevision:oddOptions.expectedRevision})).ok);
 // A missing latest record with backups left still needs an explicit recovery choice.
 ad.data.get('characters').delete(ID);const gone=await a.recoveryOptions(ID);assert.equal(gone.state,'recovery-required');assert.equal(gone.expectedRevision,0);assert.ok(gone.recommended);
});

test('PR4: a failed restore leaves storage unchanged at every write; stale writers and stale choices are rejected',async()=>{
 for(const corruptLatest of [true,false]){
  for(let n=0;n<3;n++){
   const {adapter,a,epoch}=await created();
   for(let rev=1;rev<=2;rev++)assert.ok((await a.commit(ID,withAsh(basePayload(),rev*100),{expectedRevision:rev,epoch})).ok);
   if(corruptLatest)adapter.data.get('characters').get(ID).payload.character.ash=999999;
   const options=await a.recoveryOptions(ID),choice=options.backups[0].key,before=snapshot(adapter);
   adapter.failAfter(n);const r=await a.restoreBackup(ID,choice,epoch,{expectedRevision:options.expectedRevision});adapter.clearFailure();
   assert.equal(r.ok,false,'aborted after '+n+' writes');assert.equal(snapshot(adapter),before,'nothing partially restored');
   assert.equal((await a.recoveryOptions(ID)).state,corruptLatest?'recovery-required':'saved');
   assert.ok((await a.restoreBackup(ID,choice,epoch,{expectedRevision:options.expectedRevision})).ok,'the same choice succeeds once storage works');
  }
 }
 // Stale choice: the save progressed after the backups were compared, so the old choice is refused and progress kept.
 const {adapter,a,epoch,time,store}=await created();
 assert.ok((await a.commit(ID,withAsh(basePayload(),100),{expectedRevision:1,epoch})).ok);
 const seen=await a.recoveryOptions(ID);assert.ok((await a.commit(ID,withAsh(basePayload(),4242),{expectedRevision:2,epoch})).ok);
 const before=snapshot(adapter),stale=await a.restoreBackup(ID,seen.backups[0].key,epoch,{expectedRevision:seen.expectedRevision});
 assert.equal(stale.code,'conflict');assert.equal(stale.revision,3);assert.equal(snapshot(adapter),before);assert.equal((await a.load(ID)).envelope.payload.character.ash,4242);
 // Stale writer: after another tab takes the lease, this tab's restore is fenced.
 time.now+=10001;const b=store('tab-b');assert.ok((await b.acquireLease(ID)).ok);
 const latest=await a.recoveryOptions(ID),fenced=await a.restoreBackup(ID,latest.backups[0].key,epoch,{expectedRevision:latest.expectedRevision});
 assert.equal(fenced.code,'fenced');assert.equal((await a.load(ID)).envelope.payload.character.ash,4242);
});

// ---- Phase 2 PR5 correction 3: storage that never answers is reported (WebKit/iOS start failure)
test('PR5: an IndexedDB open that never answers is reported as unavailable, after waking WebKit with databases()',async()=>{
 const calls=[],never={};
 const factory={databases(){calls.push('databases');return Promise.resolve([]);},open(){calls.push('open');return never;}};
 const store=S.createStore({adapter:S.indexedDBAdapter({indexedDB:factory,openTimeoutMs:60}),sessionId:'tab-a'});
 const started=Date.now(),r=await store.activeCharacter();
 assert.equal(r.ok,false);assert.equal(r.code,'unavailable');assert.match(r.message,/did not respond/);assert.ok(Date.now()-started<2000);
 assert.equal(calls[0],'databases','databases() is called before the first open');assert.ok(calls.includes('open'));
 // The failure is not cached: the next request tries again.
 const before=calls.filter(c=>c==='open').length;await store.activeCharacter();assert.equal(calls.filter(c=>c==='open').length,before+1);
 // A databases() that never settles cannot block the open past the timeout either.
 const stuck=S.createStore({adapter:S.indexedDBAdapter({indexedDB:{databases:()=>new Promise(()=>{}),open:()=>never},openTimeoutMs:60}),sessionId:'tab-a'});
 assert.equal((await stuck.load(ID)).code,'unavailable');
});

test('PR5: a transaction that never finishes is aborted and reported as a retryable timeout',async()=>{
 let aborted=0;
 const tx={objectStore:()=>({get:()=>({}),getAll:()=>({}),put:()=>({}),delete:()=>({})}),abort(){aborted++;this.onabort?.();}};
 const db={objectStoreNames:{contains:()=>true},transaction:()=>tx,close(){}};
 const factory={open(){const req={result:db};setTimeout(()=>req.onsuccess?.(),0);return req;}};
 const store=S.createStore({adapter:S.indexedDBAdapter({indexedDB:factory,transactionTimeoutMs:60}),sessionId:'tab-a'});
 const r=await store.load(ID);assert.equal(r.ok,false);assert.equal(r.code,'timeout');assert.equal(aborted,1);
});
