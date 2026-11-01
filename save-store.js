/* Persistent character repository (docs/arpg/SPEC.md section 5): revisioned snapshots, rotating and pinned backups,
 * a fenced writer lease, corruption quarantine and recovery over IndexedDB. ARPG Phase 1A: not loaded by the game yet.
 * Storage goes through an adapter so Node tests inject an in-memory store with failure injection; browsers use IndexedDB. */
(() => {
 'use strict';
 const node=typeof module!=='undefined';
 const C=node?require('./character-state.js'):window.VesperCharacter;
 const DB_NAME='vesper-arpg',DB_VERSION=1;
 const STORES=Object.freeze([{name:'characters',key:'characterId'},{name:'backups',key:'key'},{name:'meta',key:'key'},{name:'leases',key:'characterId'},{name:'quarantine',key:'key'}]);
 const ALL=STORES.map(s=>s.name);
 const pad=n=>String(n).padStart(16,'0');
 const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
 // Snapshot of caller data that refuses, rather than normalises, anything JSON would silently change: NaN/Infinity,
 // undefined, functions, symbols, bigints, array holes, cycles and non-plain objects all fail instead of becoming null.
 function strictSnapshot(v,path='payload',seen=new Set()){
  if(v===null||typeof v==='string'||typeof v==='boolean')return v;
  if(typeof v==='number'){if(!Number.isFinite(v))throw new StoreError('invalid',path+' is not a finite number');return v;}
  if(typeof v!=='object')throw new StoreError('invalid',path+' is not JSON data');
  if(seen.has(v))throw new StoreError('invalid',path+' is circular');seen.add(v);
  let out;
  if(Array.isArray(v)){out=[];for(let i=0;i<v.length;i++){if(!(i in v))throw new StoreError('invalid',path+'['+i+'] is a hole');out.push(strictSnapshot(v[i],path+'['+i+']',seen));}}
  else{const proto=Object.getPrototypeOf(v);if(proto!==Object.prototype&&proto!==null)throw new StoreError('invalid',path+' is not a plain object');out={};for(const k of Object.keys(v))Object.defineProperty(out,k,{value:strictSnapshot(v[k],path+'.'+k,seen),enumerable:true,writable:true,configurable:true});}
  seen.delete(v);return out;
 }
 const failure=(code,message,extra)=>({ok:false,code,message,...extra});
 class StoreError extends Error{constructor(code,message){super(message);this.code=code;}}
 // Storage errors become stable codes; nothing is reported as saved unless its transaction completed.
 const storageCode=e=>e instanceof StoreError?e.code:e?.name==='QuotaExceededError'?'quota':e?.name==='InvalidStateError'||e?.code==='unavailable'?'unavailable':'storage';

 // In-memory adapter: same transaction contract as IndexedDB (all-or-nothing). `failAfter` injects an error at the Nth
 // write; `latency` yields to the event loop on every request so concurrent transactions would interleave without the lock.
 function memoryAdapter({latency=false}={}){
  const data=new Map(ALL.map(n=>[n,new Map()]));let fail=null,writes=0,lock=Promise.resolve();
  return {
   kind:'memory',data,
   failAfter(count,name='AbortError'){fail={count,name};writes=0;},
   clearFailure(){fail=null;},
   // Like IndexedDB, read-write transactions on the same stores run one after another, never interleaved.
   transact(names,mode,work){
    if(mode!=='readwrite')return this.run(names,mode,work);
    const turn=lock.then(()=>this.run(names,mode,work));lock=turn.then(()=>{},()=>{});return turn;
   },
   async run(names,mode,work){
    const staged=new Map(names.map(n=>[n,new Map([...data.get(n)].map(([k,v])=>[k,clone(v)]))]));
    const store=n=>{if(!staged.has(n))throw new StoreError('storage','store '+n+' is not in this transaction');return staged.get(n);};
    const write=()=>{if(mode!=='readwrite')throw new StoreError('storage','read-only transaction');if(fail&&++writes>fail.count){const e=new Error('Injected '+fail.name);e.name=fail.name;fail=null;throw e;}};
    const io=()=>latency?new Promise(r=>setTimeout(r,0)):null;
    const tx={get:async(n,k)=>{await io();return clone(store(n).get(k));},getAll:async n=>{await io();return [...store(n).values()].map(clone);},put:async(n,v)=>{await io();write();store(n).set(v[STORES.find(s=>s.name===n).key],clone(v));},delete:async(n,k)=>{await io();write();store(n).delete(k);}};
    const result=await work(tx);
    if(mode==='readwrite')for(const [n,m] of staged)data.set(n,m);
    return result;
   },
   close(){}
  };
 }

 // IndexedDB adapter. Work functions only await this transaction's own requests, so the transaction stays active.
 function indexedDBAdapter({indexedDB=globalThis.indexedDB,name=DB_NAME,onBlocked=null,onVersionChange=null}={}){
  let opening=null;
  const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=e=>{e.preventDefault?.();reject(r.error);};});
  function open(){
   if(opening)return opening;
   opening=new Promise((resolve,reject)=>{
    if(!indexedDB)return reject(new StoreError('unavailable','IndexedDB is not available'));
    let req;try{req=indexedDB.open(name,DB_VERSION);}catch(e){return reject(new StoreError('unavailable',e.message));}
    req.onupgradeneeded=()=>{const db=req.result;for(const s of STORES)if(!db.objectStoreNames.contains(s.name))db.createObjectStore(s.name,{keyPath:s.key});};
    req.onblocked=()=>onBlocked?.();
    req.onerror=()=>{opening=null;reject(new StoreError(req.error?.name==='VersionError'?'unsupported':'unavailable',req.error?.message||'open failed'));};
    // A newer page version upgrading the database closes this connection instead of blocking it.
    req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();opening=null;onVersionChange?.();};resolve(db);};
   });
   return opening;
  }
  return {
   kind:'indexeddb',
   async transact(names,mode,work){
    const db=await open();
    return new Promise((resolve,reject)=>{
     let tx;try{tx=db.transaction(names,mode,{durability:'strict'});}catch(e){try{tx=db.transaction(names,mode);}catch(e2){return reject(e2);}}
     let result,failed=null;
     const api={get:(n,k)=>request(tx.objectStore(n).get(k)),getAll:n=>request(tx.objectStore(n).getAll()),put:(n,v)=>request(tx.objectStore(n).put(v)),delete:(n,k)=>request(tx.objectStore(n).delete(k))};
     tx.oncomplete=()=>failed?reject(failed):resolve(result);
     tx.onabort=()=>reject(failed||tx.error||new StoreError('storage','transaction aborted'));
     Promise.resolve().then(()=>work(api)).then(r=>{result=r;},e=>{failed=e;try{tx.abort();}catch{}});
    });
   },
   async close(){if(opening){const db=await opening.catch(()=>null);db?.close();opening=null;}}
  };
 }

 // Emergency export (Phase 2 PR4): versioned JSON text, bounded in size, labelled with what it is and what it is not.
 const EXPORT_FORMAT='vesper-character-export',EXPORT_VERSION=1,MAX_EXPORT_BYTES=16*1024*1024;
 const EXPORT_NOTICE=Object.freeze({
  stored:'Copy of the save stored in this browser.',
  unsaved:'NOT SAVED in this browser: this file is the only copy of these changes.',
  limits:'This version cannot import files; keep this file for a future import tool. The checksum detects accidental damage only and does not guarantee the file can be restored.'
 });
 const byteLength=text=>new TextEncoder().encode(text).length;
 const sha256=async text=>{const bytes=new TextEncoder().encode(text),hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');};
 const unsigned=env=>({...env,integrity:null});

 function createStore({adapter,sessionId,clock=()=>Date.now(),digest=sha256,schema=C,leaseMs=15000,backupCount=5}={}){
  if(!adapter)throw new TypeError('A storage adapter is required');
  if(typeof sessionId!=='string'||!/^[A-Za-z0-9:._-]{1,96}$/.test(sessionId))throw new TypeError('A session ID is required');
  let queue=Promise.resolve();
  // One command at a time per store; a failed command never blocks the next one.
  const serial=fn=>{const run=queue.then(fn,fn);queue=run.then(()=>{},()=>{});return run;};
  const guard=fn=>serial(async()=>{try{return await fn();}catch(e){return failure(storageCode(e),e?.message||String(e));}});
  const iso=()=>new Date(clock()).toISOString();
  const sign=async env=>({...env,integrity:{algorithm:'SHA-256',digest:await digest(schema.canonical(unsigned(env)))}});
  // The checksum alone, for records of any version (older ones are validated by their own migration step).
  async function checksumOk(raw){if(!raw||typeof raw!=='object'||!raw.integrity||typeof raw.integrity.digest!=='string')return false;try{return await digest(schema.canonical(unsigned(raw)))===raw.integrity.digest;}catch{return false;}}
  // Integrity first (accidental corruption, not anti-cheat), then the schema's own validation.
  async function inspect(raw){
   if(!raw||typeof raw!=='object')return {status:'corrupt',errors:[{path:'',message:'not a save record'}]};
   const check=schema.validate(raw);
   if(check.code==='unsupported')return {status:'unsupported',errors:check.errors};
   if(!raw.integrity||typeof raw.integrity.digest!=='string')return {status:'corrupt',errors:[{path:'integrity',message:'missing checksum'}]};
   let expected;try{expected=await digest(schema.canonical(unsigned(raw)));}catch{return {status:'corrupt',errors:[{path:'integrity',message:'checksum could not be computed'}]};}
   if(expected!==raw.integrity.digest)return {status:'corrupt',errors:[{path:'integrity',message:'checksum mismatch'}]};
   return check.ok?{status:'valid',errors:[]}:{status:'corrupt',errors:check.errors};
  }
  // Backups may predate a schema upgrade: verify their own checksum, then migrate them to the current version (each
  // step validated). The migrated envelope is what a restore writes; a backup that cannot migrate is never restored.
  async function inspectBackup(raw){
   if(!await checksumOk(raw))return {status:'corrupt',errors:[{path:'integrity',message:'checksum mismatch'}]};
   const m=schema.migrate(raw);
   if(!m.ok)return {status:m.code==='unsupported'?'unsupported':'corrupt',errors:m.errors};
   return {status:'valid',errors:[],envelope:m.envelope,migrated:!!m.migrated};
  }
  // One labelled export file; anything over the size bound is refused rather than truncated.
  function exportFile({id,source,status,revision,envelope}){
   const text=JSON.stringify({format:EXPORT_FORMAT,version:EXPORT_VERSION,exportedAt:iso(),source,saved:source==='stored',status,characterId:id,revision,notice:EXPORT_NOTICE[source]+' '+EXPORT_NOTICE.limits,envelope});
   const bytes=byteLength(text);
   if(bytes>MAX_EXPORT_BYTES)return failure('too-large','the export exceeds the size limit; nothing was exported',{bytes});
   return {ok:true,source,saved:source==='stored',status,revision,bytes,text};
  }
  async function describeBackups(id,all){
   const out=[];
   for(const b of all.filter(b=>b.characterId===id).sort((a,b)=>b.revision-a.revision||(b.pinned?1:0)-(a.pinned?1:0))){const state=await inspectBackup(b.envelope),c=state.envelope?.payload?.character;out.push({key:b.key,revision:b.revision,pinned:!!b.pinned,savedAt:b.savedAt,status:state.status,summary:state.status==='valid'?{level:c.level,ash:c.ash,items:state.envelope.payload.items.length,unlocked:state.envelope.payload.campaign.unlockedLocations.length,migrated:state.migrated}:null});}
   return out;
  }
  // The revision a recovery choice is made against: 0 when nothing is stored, null for a damaged non-integer revision.
  const choiceRevision=raw=>raw?(Number.isSafeInteger(raw.revision)?raw.revision:null):0;
  const leaseOk=(lease,epoch)=>lease&&lease.sessionId===sessionId&&lease.epoch===epoch&&lease.expiresAt>clock();
  const backupKey=(id,rev,pinned)=>id+(pinned?'#pinned#':'#')+pad(rev);
  // Prune rotating backups only inside a successful write; pinned pre-migration backups are never pruned.
  async function prune(tx,id,keep){const all=(await tx.getAll('backups')).filter(b=>b.characterId===id&&!b.pinned).sort((a,b)=>b.revision-a.revision);for(const b of all.slice(keep))await tx.delete('backups',b.key);}

  // Writer lease with a fencing epoch: an expired holder loses the lease, and its stale epoch can no longer commit.
  const acquireLease=id=>guard(()=>adapter.transact(['leases'],'readwrite',async tx=>{
   const lease=await tx.get('leases',id),now=clock();
   if(lease&&lease.sessionId!==sessionId&&lease.expiresAt>now)return failure('locked','another tab is writing this character',{holder:lease.sessionId,expiresAt:lease.expiresAt});
   const epoch=lease&&lease.sessionId===sessionId&&lease.expiresAt>now?lease.epoch:(lease?.epoch||0)+1;
   await tx.put('leases',{characterId:id,sessionId,epoch,expiresAt:now+leaseMs});return {ok:true,epoch};
  }));
  const renewLease=(id,epoch)=>guard(()=>adapter.transact(['leases'],'readwrite',async tx=>{const lease=await tx.get('leases',id);if(!leaseOk(lease,epoch))return failure('fenced','the writer lease was lost');await tx.put('leases',{...lease,expiresAt:clock()+leaseMs});return {ok:true,epoch};}));
  const releaseLease=(id,epoch)=>guard(()=>adapter.transact(['leases'],'readwrite',async tx=>{const lease=await tx.get('leases',id);if(leaseOk(lease,epoch))await tx.put('leases',{...lease,expiresAt:0});return {ok:true};}));

  // Compare-and-swap write: lease, expected revision and candidate are checked in one transaction, which also moves the
  // previous revision into backups. Validation and signing (WebCrypto) finish before the IndexedDB transaction opens.
  async function commitPayload(id,input,options,createdAt){
   // Repository-owned snapshot taken synchronously, so later caller mutations cannot reach the signed record; a value
   // the snapshot would have to change is refused here and never saved.
   let payload;try{payload=strictSnapshot(input);}catch(e){return failure('invalid','the candidate save is invalid',{errors:[{path:'',message:e.message}]});}
   const now=iso(),rev=Math.max(options.expectedRevision,options.revisionFloor||0)+1;
   const env=schema.envelope(payload,{characterId:id,revision:rev,createdAt:createdAt||now,savedAt:now,sessionId,leaseEpoch:options.epoch});
   const check=schema.validate(env);if(!check.ok)return failure(check.code||'invalid','the candidate save is invalid',{errors:check.errors});
   const signed=await sign(env);
   return adapter.transact(ALL,'readwrite',async tx=>{
    const lease=await tx.get('leases',id);if(!leaseOk(lease,options.epoch))return failure('fenced','the writer lease was lost; reload before saving');
    const current=await tx.get('characters',id);
    if(options.quarantineCurrent&&schema.canonical(current??null)!==options.quarantineCurrent)return failure('conflict','the save changed during recovery; reload and choose again');
    if(!options.quarantineCurrent){
     if(current&&options.expectedRevision===0)return failure('exists','a character already exists; it is never replaced silently');
     if(current&&current.revision!==options.expectedRevision)return failure('conflict','the save changed since it was loaded',{revision:current.revision});
     if(!current&&options.expectedRevision!==0)return failure('conflict','the save no longer exists');
     if(current&&current.createdAt!==signed.createdAt)return failure('conflict','creation time changed');
    }
    if(current&&options.quarantineCurrent)await tx.put('quarantine',{key:id+'#'+pad(current.revision|0)+'#'+pad(clock()),characterId:id,savedAt:now,raw:current});
    else if(current)await tx.put('backups',{key:backupKey(id,current.revision,!!options.pinPrevious),characterId:id,revision:current.revision,pinned:!!options.pinPrevious,savedAt:current.savedAt,envelope:current});
    await tx.put('characters',signed);
    await tx.put('meta',{key:'active',characterId:id});
    await prune(tx,id,backupCount);
    return {ok:true,revision:signed.revision,envelope:signed};
   });
  }

  // Read the latest record without generating anything. Corrupt bytes are reported, never deleted.
  const readCurrent=id=>adapter.transact(['characters'],'readonly',tx=>tx.get('characters',id));
  const load=id=>guard(async()=>{
   const raw=await readCurrent(id);if(!raw)return failure('missing','no saved character');
   const result=await inspect(raw);
   if(result.status==='unsupported')return failure('unsupported','this save was made by a newer game version and is read-only',{errors:result.errors});
   if(result.status==='corrupt')return failure('corrupt','the latest save failed its checks; choose a backup',{errors:result.errors,raw});
   const migrated=schema.migrate(raw);
   return {ok:true,envelope:raw,needsMigration:!!migrated.migrated};
  });
  const activeCharacter=()=>guard(async()=>{const meta=await adapter.transact(['meta'],'readonly',tx=>tx.get('meta','active'));return meta?{ok:true,characterId:meta.characterId}:failure('missing','no active character');});
  // A new character never replaces an existing one under the same ID.
  const create=(id,payload,epoch)=>guard(()=>commitPayload(id,payload,{expectedRevision:0,epoch}));
  const commit=(id,payload,{expectedRevision,epoch,createdAt})=>guard(async()=>{
   if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)return failure('invalid','an expected revision is required');
   const current=await readCurrent(id);
   if(current){const state=await inspect(current);if(state.status==='unsupported')return failure('unsupported','a newer save is never overwritten');if(state.status==='corrupt')return failure('corrupt','the latest save is corrupt; restore a backup first');}
   return commitPayload(id,payload,{expectedRevision,epoch},createdAt||current?.createdAt);
  });
  // Backups newest first, each re-verified, with a summary so the player can compare progress before restoring.
  const listBackups=id=>guard(async()=>({ok:true,backups:await describeBackups(id,await adapter.transact(['backups'],'readonly',tx=>tx.getAll('backups')))}));
  // Recovery overview read without writing anything: 'saved' (the latest record is good), 'recovery-required' (it is
  // corrupt or missing while backups exist), 'read-only' (made by a newer version; never overwritten) or 'missing'.
  // The recommended choice is the newest backup that passes its checks; corrupt, unsupported or unmigratable backups
  // are listed with their status but never recommended or restored. `expectedRevision` is what a restore must name.
  const recoveryOptions=id=>guard(async()=>{
   const [raw,all]=await adapter.transact(['characters','backups'],'readonly',async tx=>[await tx.get('characters',id),await tx.getAll('backups')]);
   const current=raw?await inspect(raw):null,backups=await describeBackups(id,all);
   const state=!raw?(backups.length?'recovery-required':'missing'):current.status==='valid'?'saved':current.status==='unsupported'?'read-only':'recovery-required';
   const good=backups.find(b=>b.status==='valid');
   return {ok:true,state,current:raw?{revision:Number.isSafeInteger(raw.revision)?raw.revision:null,status:current.status,savedAt:typeof raw.savedAt==='string'?raw.savedAt:null}:null,
    expectedRevision:choiceRevision(raw),backups,recommended:state==='recovery-required'&&good?good.key:null};
  });
  // Restore rolls the character back to a chosen backup as a new revision; nothing is merged into the current one.
  // A corrupt or unreadable latest record is quarantined (kept for export), never silently dropped.
  // Restoring over a good save discards its newer progress, so the caller must name the revision the player compared
  // against (`expectedRevision` from recoveryOptions); a save that moved on since then is a conflict and is kept.
  const restoreBackup=(id,key,epoch,{expectedRevision}={})=>guard(async()=>{
   const [backup,current]=await adapter.transact(['backups','characters'],'readonly',async tx=>[await tx.get('backups',key),await tx.get('characters',id)]);
   if(!backup||backup.characterId!==id)return failure('missing','no such backup');
   const state=await inspectBackup(backup.envelope);if(state.status!=='valid')return failure(state.status,'that backup failed its checks or cannot be migrated; storage is unchanged',{errors:state.errors});
   const currentState=current?await inspect(current):null;
   if(currentState?.status==='unsupported')return failure('unsupported','a newer save is never overwritten');
   if(expectedRevision===undefined&&currentState?.status==='valid')return failure('invalid','restoring over a good save requires the expected revision');
   if(expectedRevision!==undefined&&expectedRevision!==choiceRevision(current))return failure('conflict','the save changed since the backups were compared; storage is unchanged',{revision:choiceRevision(current)});
   const corrupt=currentState?.status==='corrupt',floor=Math.max(backup.revision,Number.isSafeInteger(current?.revision)?current.revision:0);
   return commitPayload(id,state.envelope.payload,{expectedRevision:corrupt?floor:current?current.revision:0,epoch,quarantineCurrent:corrupt?schema.canonical(current):false,revisionFloor:floor},backup.envelope.createdAt);
  });
  // Persist a pure migration: the pre-migration record is pinned and outlives rotation. Repeating it is a no-op.
  const migrateStored=(id,epoch)=>guard(async()=>{
   const raw=await readCurrent(id);if(!raw)return failure('missing','no saved character');
   // A corrupt record is never migrated: re-signing it would launder the damage into a valid-looking save.
   const result=schema.migrate(raw);if(result.code!=='unsupported'&&!await checksumOk(raw))return failure('corrupt','the latest save failed its checks; restore a backup before migrating');if(!result.ok)return failure(result.code||'invalid','migration failed; the original save is unchanged',{errors:result.errors});
   if(!result.migrated)return {ok:true,migrated:false,revision:raw.revision};
   const committed=await commitPayload(id,result.envelope.payload,{expectedRevision:raw.revision,epoch,pinPrevious:true},raw.createdAt);
   return committed.ok?{...committed,migrated:true}:committed;
  });
  // Emergency export of exactly what is stored, including corrupt bytes, as versioned JSON text.
  const exportLatest=id=>guard(async()=>{const raw=await readCurrent(id);if(!raw)return failure('missing','no saved character');const state=await inspect(raw);return exportFile({id,source:'stored',status:state.status,revision:Number.isSafeInteger(raw.revision)?raw.revision:null,envelope:raw});});
  // Emergency export of in-memory progress that is not (or not known to be) stored: it must pass the save schema and is
  // labelled unsaved. It never touches storage and is not queued behind pending writes, so it still works when storage
  // is denied, full, hung or held by another tab. The envelope carries the revision a commit would have written.
  async function exportUnsaved(id,input,{baseRevision=0,createdAt=null}={}){
   try{
    if(!Number.isSafeInteger(baseRevision)||baseRevision<0)return failure('invalid','a base revision is required');
    let payload;try{payload=strictSnapshot(input);}catch(e){return failure('invalid','the unsaved state is invalid; nothing was exported',{errors:[{path:'',message:e.message}]});}
    const now=iso(),env=schema.envelope(payload,{characterId:id,revision:baseRevision+1,createdAt:createdAt||now,savedAt:now,sessionId,leaseEpoch:0});
    const check=schema.validate(env);if(!check.ok)return failure(check.code||'invalid','the unsaved state is invalid; nothing was exported',{errors:check.errors});
    return exportFile({id,source:'unsaved',status:'valid',revision:baseRevision+1,envelope:await sign(env)});
   }catch(e){return failure(storageCode(e),e?.message||String(e));}
  }
  // Bounded check of an export file: size before parsing, then format, label and the envelope's checksum and schema.
  // It reports what the file holds; it writes nothing (import tooling is Phase 6).
  async function verifyExport(text){
   try{
    if(typeof text!=='string')return failure('invalid-export','not an export file');
    const bytes=byteLength(text);if(bytes>MAX_EXPORT_BYTES)return failure('too-large','the file exceeds the export size limit',{bytes});
    let file;try{file=JSON.parse(text);}catch{return failure('invalid-export','the file is not valid JSON');}
    if(!file||typeof file!=='object'||Array.isArray(file)||file.format!==EXPORT_FORMAT)return failure('invalid-export','not a VESPER character export');
    if(file.version!==EXPORT_VERSION)return failure('unsupported','this export was made by a different game version');
    if(!['stored','unsaved'].includes(file.source)||file.saved!==(file.source==='stored'))return failure('invalid-export','the export label is invalid');
    const state=await inspect(file.envelope);
    if(state.status==='valid'&&file.envelope.characterId!==file.characterId)return {ok:true,source:file.source,saved:file.saved,status:'corrupt',characterId:file.characterId,errors:[{path:'characterId',message:'label does not match the save'}]};
    return {ok:true,source:file.source,saved:file.saved,status:state.status,characterId:file.characterId,revision:state.status==='valid'?file.envelope.revision:null,errors:state.errors};
   }catch(e){return failure('invalid-export',e?.message||String(e));}
  }
  const quarantined=id=>guard(async()=>({ok:true,records:(await adapter.transact(['quarantine'],'readonly',tx=>tx.getAll('quarantine'))).filter(q=>q.characterId===id)}));
  return Object.freeze({sessionId,acquireLease,renewLease,releaseLease,load,activeCharacter,create,commit,listBackups,recoveryOptions,restoreBackup,migrateStored,exportLatest,exportUnsaved,verifyExport,quarantined});
 }

 const api=Object.freeze({DB_NAME,DB_VERSION,STORES,EXPORT_FORMAT,EXPORT_VERSION,MAX_EXPORT_BYTES,EXPORT_NOTICE,memoryAdapter,indexedDBAdapter,createStore,sha256});
 if(node)module.exports=api;else window.VesperSaveStore=api;
})();
