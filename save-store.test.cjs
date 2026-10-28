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
 const {a,epoch}=await created(),less=basePayload();
 const id=less.character.backpack[2];less.character.backpack[2]=null;less.items=less.items.filter(i=>i.id!==id);
 assert.ok((await a.commit(ID,less,{expectedRevision:1,epoch})).ok);
 const {backups}=await a.listBackups(ID),restored=await a.restoreBackup(ID,backups[0].key,epoch);
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
 const restored=await v2.restoreBackup(ID,pinned.key,lease.epoch);assert.ok(restored.ok,JSON.stringify(restored));assert.equal(restored.revision,3);
 const loaded=await v2.load(ID);assert.ok(loaded.ok);assert.equal(loaded.envelope.schemaVersion,2);assert.equal(loaded.envelope.payload.character.title,'Penitent');
 // A backup whose migration fails is reported and never restored.
 const broken=S.createStore({adapter,sessionId:'tab-a',clock:()=>time.now,schema:{...schema,migrate:e=>e.schemaVersion===2?C.migrate(e,{...plan,target:2}):{ok:false,code:'invalid',errors:[{path:'',message:'boom'}]}}});
 const before=snapshot(adapter);
 assert.equal((await broken.listBackups(ID)).backups.find(b=>b.pinned).status,'corrupt');
 assert.equal((await broken.restoreBackup(ID,pinned.key,lease.epoch)).code,'corrupt');assert.equal(snapshot(adapter),before);
});
