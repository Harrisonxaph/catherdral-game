const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('./equipment.js');
const base={damage:30,attackRate:.36,crit:0};
function withItem(run,key){const item=E.item(key);assert.ok(E.collect(run,item).ok);return run.bag.findIndex(i=>i?.id===item.id);}
test('Twelve items span three rarities and all loadouts calculate consistently',()=>{
 assert.ok(Object.keys(E.definitions).length>=12);assert.equal(new Set(Object.values(E.definitions).map(d=>d.rarity)).size,3);
 const r=E.createRun(),one=E.stats(base,r);assert.equal(one.damage,32);assert.ok(one.reduction>0);assert.equal(one.shield,12);
 assert.ok(E.equip(r,withItem(r,'rustbound'),'off').ok);const dual=E.stats(base,r);assert.equal(dual.configuration,'Dual wield');assert.equal(dual.shield,0);assert.equal(dual.reduction,0);assert.equal(dual.attackRate,one.attackRate/1.2);assert.equal(dual.damage,32.8);
 assert.ok(E.equip(r,withItem(r,'ashbringer'),'main').ok);const two=E.stats(base,r);assert.equal(two.configuration,'Two-handed');assert.equal(r.off,null);assert.ok(two.damage>dual.damage);assert.ok(two.attackRate>one.attackRate);assert.ok(E.valid(r));
});
test('Capacity and displacement transactions fail atomically without item loss',()=>{
 const r=E.createRun();withItem(r,'ashbringer');for(let i=1;i<6;i++)withItem(r,'duskdagger');const before=JSON.stringify(r);
 assert.equal(E.equip(r,0,'main').ok,false);assert.equal(JSON.stringify(r),before);assert.equal(E.collect(r,E.item('rustbound')).ok,false);
 E.drop(r,5);assert.ok(E.equip(r,0,'main').ok);assert.equal(r.off,null);assert.equal(r.bag.filter(Boolean).length,6);assert.equal(E.unequip(r,'main').ok,false);assert.ok(E.valid(r));
});
test('Invalid slots, shields in main and two-handed off-hand weapons are rejected',()=>{
 const r=E.createRun(),shield=withItem(r,'bulwark'),two=withItem(r,'mournblade');
 assert.equal(E.equip(r,shield,'main').ok,false);assert.equal(E.equip(r,two,'off').ok,false);assert.equal(E.equip(r,99).ok,false);
 assert.ok(E.equip(r,two,'main').ok);assert.equal(E.equip(r,shield,'off').ok,false);assert.ok(E.valid(r));
});
test('Repeated swaps and previews do not stack bonuses or mutate the base stats',()=>{
 const r=E.createRun(),i=withItem(r,'duskdagger'),snapshot=JSON.stringify(r),baseBefore=JSON.stringify(base);E.preview(base,r,i,'main');assert.equal(JSON.stringify(r),snapshot);
 E.equip(r,i,'main');const expected=E.stats(base,r);
 for(let n=0;n<50;n++){E.equip(r,r.bag.findIndex(i=>i?.key==='rustbound'),'main');E.equip(r,r.bag.findIndex(i=>i?.key==='duskdagger'),'main');assert.deepEqual(E.stats(base,r),expected);}
 assert.equal(JSON.stringify(base),baseBefore);
});
test('Potion consumption cannot duplicate or exceed healing and capacity',()=>{
 const r=E.createRun();assert.ok(E.addPotion(r));assert.equal(E.addPotion(r),false);assert.equal(r.potions,3);assert.equal(E.usePotion(r,110,115),5);assert.equal(r.potions,2);assert.equal(E.usePotion(r,115,115),0);assert.equal(r.potions,2);
});
test('Weighted boss rarity boundaries and once-only generic completion rewards',()=>{
 const roll=(floor,value)=>E.definition(E.roll('boss',floor,()=>value)).rarity;
 assert.equal(roll(1,.71),'common');assert.equal(roll(1,.73),'rare');assert.equal(roll(3,.93),'rare');assert.equal(roll(3,.95),'legendary');assert.equal(roll(5,.64),'rare');assert.equal(roll(5,.66),'legendary');
 const encounter={kind:'boss',members:[{dead:true},{dead:false}]};assert.equal(E.encounterReward(encounter,3),null);encounter.members[1].dead=true;assert.ok(E.encounterReward(encounter,3));assert.equal(E.encounterReward(encounter,3),null);
 assert.equal(E.encounterReward({kind:'elite',members:[{dead:true}]},2),null);
});
test('Seeded weighted distribution follows configured probabilities; ordinary/chest rolls are bounded',()=>{
 let value=14;const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};const counts={rare:0,legendary:0};
 for(let i=0;i<20000;i++)counts[E.definition(E.roll('boss',5,random)).rarity]++;
 assert.ok(Math.abs(counts.legendary/20000-.35)<.02);assert.equal(E.roll('ordinary',1,()=>.1),null);assert.equal(E.definition(E.roll('ordinary',5,()=>.01)).rarity,'common');assert.equal(E.roll('chest',1,()=>.99),null);
});
test('Unique passives are capped; ownership IDs prevent double collection',()=>{
 const r=E.createRun(),i=withItem(r,'kingsmercy'),same=r.bag[i];assert.equal(E.collect(r,same).ok,false);E.equip(r,i,'main');E.equip(r,withItem(r,'kingsmercy'),'off');assert.equal(E.stats(base,r).onHit,2);
});
// Rolled bonus modifiers. All randomness below is injected or seeded.
const seeded=start=>{let value=start>>>0;return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};};
const sequence=values=>{let i=0;return ()=>values[i++%values.length];};
test('All twelve original item definitions and effects are unchanged',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(E.definitions)),{
  rustbound:{name:'Rustbound Sword',kind:'weapon',hands:1,rarity:'common',damage:2},
  graveaxe:{name:'Gravedigger Axe',kind:'weapon',hands:1,rarity:'common',damage:5,speed:-.05},
  cryptshield:{name:'Crypt Guardian Shield',kind:'shield',rarity:'common',defence:4,shield:12},
  mournblade:{name:'Mourner’s Greatsword',kind:'weapon',hands:2,rarity:'common',damage:15},
  bloodforged:{name:'Bloodforged Blade',kind:'weapon',hands:1,rarity:'rare',damage:8,critHeal:2,effect:'Restore 2 health on a critical strike.'},
  bulwark:{name:'Bulwark of the Dead',kind:'shield',rarity:'rare',defence:8,shield:24},
  duskdagger:{name:'Dusk Dagger',kind:'weapon',hands:1,rarity:'rare',damage:5,speed:.12,effect:'12% increased attack speed.'},
  executioner:{name:'Executioner’s Axe',kind:'weapon',hands:2,rarity:'rare',damage:23,critDamage:.25,effect:'Critical strikes deal an additional 25% damage.'},
  ashbringer:{name:'Ashbringer',kind:'weapon',hands:2,rarity:'legendary',damage:29,fire:.2,effect:'On a health hit: a small fire burst for 20% strike damage, once every 3 seconds.'},
  kingsmercy:{name:'King’s Mercy',kind:'weapon',hands:1,rarity:'legendary',damage:13,onHit:1.2,effect:'Restore 1.2 health per successful strike, once per attack.'},
  oathguard:{name:'Oathguard',kind:'shield',rarity:'legendary',defence:11,shield:32,poisonReduction:.3,effect:'Take 30% less poison damage before ordinary defence.'},
  twinmoon:{name:'Twin Moon',kind:'weapon',hands:1,rarity:'legendary',damage:12,crit:.08,critDamage:.35,effect:'Moon’s Edge: +8% critical chance and +35% critical damage.'}
 });
 const r=E.createRun();assert.deepEqual(E.modifiers(r.main),[]);assert.deepEqual(E.modifiers(r.off),[]);assert.deepEqual(E.modifiers(E.item('duskdagger')),[]);
 assert.equal(E.stats(base,r).damage,32);
});
test('Modifier eligibility: weapons only, never legendary, never shields; invalid instances are rejected',()=>{
 for(const key of ['rustbound','graveaxe','mournblade','bloodforged','duskdagger','executioner'])assert.deepEqual(E.eligibleModifiers(key),['damage','speed','crit']);
 for(const key of ['cryptshield','bulwark','oathguard','ashbringer','kingsmercy','twinmoon']){assert.deepEqual(E.eligibleModifiers(key),[]);assert.deepEqual(E.rollModifiers(key,()=>0),[]);}
 assert.equal(E.rollModifiers('rustbound',()=>.35).length,0);assert.equal(E.rollModifiers('rustbound',()=>0).length,1);
 // Rare: chance passes, extra roll passes → two distinct stats.
 const two=E.rollModifiers('duskdagger',sequence([0,0,0,0,0,0]));assert.deepEqual(two.map(m=>m.stat),['damage','speed']);assert.deepEqual(two.map(m=>m.value),[2,.04]);
 const top=E.rollModifiers('bloodforged',sequence([0,0,.999,.999,.999,.999]));assert.deepEqual(top,[{stat:'crit',value:.05},{stat:'speed',value:.08}]);
 assert.equal(E.rollModifiers('rustbound',sequence([0,0,0,.999])).length,1);
 for(const [key,mods]of [['rustbound',[{stat:'damage',value:4}]],['rustbound',[{stat:'defence',value:1}]],['rustbound',[{stat:'damage',value:1},{stat:'crit',value:.02}]],['duskdagger',[{stat:'damage',value:2},{stat:'damage',value:3}]],['cryptshield',[{stat:'crit',value:.02}]],['twinmoon',[{stat:'crit',value:.02}]],['rustbound',[{stat:'damage',value:NaN}]],['rustbound',{}]])assert.throws(()=>E.item(key,mods),RangeError);
 const r=E.createRun(),forged=Object.freeze({id:999999,key:'rustbound',mods:[{stat:'damage',value:40}]});assert.equal(E.collect(r,forged).ok,false);assert.deepEqual(r.bag,Array(6).fill(null));
});
test('Rolled modifiers stack once per equipped item with the off-hand damage rule',()=>{
 const r=E.createRun(),main=E.item('duskdagger',[{stat:'damage',value:3},{stat:'crit',value:.04}]),off=E.item('rustbound',[{stat:'speed',value:.05}]);
 assert.ok(E.collect(r,main).ok);assert.ok(E.collect(r,off).ok);
 assert.ok(E.equip(r,r.bag.indexOf(main),'main').ok);assert.ok(E.equip(r,r.bag.indexOf(off),'off').ok);
 const s=E.stats(base,r);assert.equal(s.configuration,'Dual wield');assert.equal(s.damage,30+5+3+2*.4);assert.equal(s.crit,.04);
 assert.ok(Math.abs(s.attackRate-base.attackRate/((1+.12+.05)*1.2))<1e-12);
 // Off-hand rolled damage is scaled by the same 40% as base off-hand damage.
 const r2=E.createRun(),heavy=E.item('rustbound',[{stat:'damage',value:3}]);E.collect(r2,heavy);E.equip(r2,r2.bag.indexOf(heavy),'off');assert.ok(Math.abs(E.stats(base,r2).damage-(30+2+(2+3)*.4))<1e-9);
 // Swapping back and forth never accumulates bonuses; bag items contribute nothing.
 const expected=E.stats(base,r);for(let n=0;n<40;n++){assert.ok(E.unequip(r,'off').ok);assert.ok(E.equip(r,r.bag.indexOf(off),'off').ok);}assert.deepEqual(E.stats(base,r),expected);
 assert.ok(E.unequip(r,'off').ok);assert.equal(E.stats(base,r).crit,.04);assert.equal(E.stats(base,r).attackRate,base.attackRate/1.12);
});
test('Modified loadouts stay within existing offensive and defensive caps',()=>{
 const maxed=key=>E.item(key,E.eligibleModifiers(key).slice(0,E.affixes.maxCount[E.definition({key}).rarity]).map(stat=>({stat,value:E.affixes.pool[stat].ranges[E.definition({key}).rarity][1]})));
 const r=E.createRun(),a=E.item('duskdagger',[{stat:'speed',value:.08},{stat:'crit',value:.05}]),b=E.item('bloodforged',[{stat:'speed',value:.08},{stat:'crit',value:.05}]);E.collect(r,a);E.collect(r,b);E.equip(r,r.bag.indexOf(a),'main');E.equip(r,r.bag.indexOf(b),'off');
 const high=E.stats({damage:30,attackRate:.36,crit:.7},r);assert.equal(high.crit,.75);
 assert.ok(E.stats({damage:30,attackRate:.1,crit:0},r).attackRate>=.13);
 const s=E.stats(base,r);assert.ok(1/s.attackRate<=1.7*E.balance.dualSpeed/base.attackRate);assert.equal(s.shield,0);assert.equal(s.reduction,0);
 // Defensive values are unaffected by offensive modifiers.
 const g=E.createRun(),blade=maxed('rustbound');E.collect(g,blade);E.equip(g,g.bag.indexOf(blade),'main');const plain=E.stats(base,E.createRun()),mod=E.stats(base,g);
 assert.equal(mod.defence,plain.defence);assert.equal(mod.reduction,plain.reduction);assert.equal(mod.shield,plain.shield);assert.ok(mod.reduction<=E.balance.maxReduction&&mod.shield<=E.balance.maxShield);
 const diff=E.difference(plain,mod);assert.equal(diff.damage,3);assert.equal(diff.crit,0);assert.equal(diff.attacksPerSecond,0);assert.equal(diff.shield,0);assert.equal(diff.defence,0);
});
test('Inventory transactions keep each instance and its rolled modifiers intact',()=>{
 const r=E.createRun(),great=E.item('mournblade',[{stat:'damage',value:3}]),dagger=E.item('duskdagger',[{stat:'speed',value:.06}]);
 E.collect(r,great);E.collect(r,dagger);for(let i=0;i<4;i++)E.collect(r,E.item('graveaxe'));
 // Two-hand swap needs room for both displaced items; the bag is full, so it must fail atomically.
 const before=JSON.stringify(r);assert.equal(E.equip(r,r.bag.indexOf(great),'main').ok,false);assert.equal(JSON.stringify(r),before);
 const dropped=E.drop(r,5);assert.ok(E.equip(r,r.bag.indexOf(great),'main').ok);assert.equal(r.main,great);assert.deepEqual(E.modifiers(r.main),[{stat:'damage',value:3}]);assert.equal(E.stats(base,r).damage,30+15+3);
 assert.ok(E.equip(r,r.bag.indexOf(dagger),'main').ok);assert.equal(r.main,dagger);assert.ok(r.bag.includes(great));assert.equal(E.modifiers(great)[0].value,3);
 assert.equal(E.collect(r,dropped).ok,false);assert.ok(E.valid(r));
 assert.ok(Object.isFrozen(great)&&Object.isFrozen(great.mods)&&Object.isFrozen(great.mods[0]));assert.throws(()=>{great.mods.push({stat:'crit',value:.05});});
 const preview=E.preview(base,r,r.bag.indexOf(great),'main');assert.ok(preview.ok);assert.equal(preview.stats.damage,48);assert.equal(r.main,dagger);
});
test('Seeded drops are repeatable, legendary drops never roll, and roll frequency follows configuration',()=>{
 const run=seed=>{const random=seeded(seed),out=[];for(let i=0;i<300;i++){const it=E.roll('chest',3,random);out.push(it&&[it.key,it.mods]);}return JSON.stringify(out);};
 assert.equal(run(77),run(77));assert.notEqual(run(77),run(78));
 const random=seeded(5);
 for(let i=0;i<20000;i++){const it=E.roll('boss',5,random),d=E.definition(it);assert.ok(E.validModifiers(it.key,E.modifiers(it)));if(d.rarity==='legendary'||d.kind==='shield')assert.equal(E.modifiers(it).length,0);}
 // Measure real roll() drops: rarity shares stay on the configured table and modifier rates follow affixes.
 const share=rarity=>{const keys=Object.keys(E.definitions).filter(k=>E.definitions[k].rarity===rarity);return keys.filter(k=>E.eligibleModifiers(k).length).length/keys.length;};
 const drops=seeded(11),count={common:0,rare:0,legendary:0},modded={common:0,rare:0},doubles={rare:0};let total=0;
 for(let i=0;i<200000;i++){
  const it=E.roll('chest',2,drops);if(!it)continue;total++;const rarity=E.definition(it).rarity,n=E.modifiers(it).length;count[rarity]++;
  if(n)modded[rarity]++;if(n===2)doubles[rarity]++;if(rarity==='common')assert.ok(n<=1);
 }
 assert.ok(Math.abs(total/200000-E.tables.chestChance)<.01);
 for(const [rarity,weight]of E.tables.chest)assert.ok(Math.abs(count[rarity]/total-weight/100)<.01,rarity);
 for(const rarity of ['common','rare'])assert.ok(Math.abs(modded[rarity]/count[rarity]-E.affixes.chance[rarity]*share(rarity))<.02,rarity);
 assert.ok(Math.abs(doubles.rare/modded.rare-E.affixes.extraChance.rare)<.03);
 const ordinary=seeded(12);for(let i=0;i<5000;i++){const it=E.roll('ordinary',4,ordinary);if(it)assert.equal(E.definition(it).rarity,'common');}
 const encounter={kind:'boss',members:[{dead:true}]},reward=E.encounterReward(encounter,5,seeded(9));assert.ok(reward);assert.equal(E.encounterReward(encounter,5,seeded(9)),null);
});
test('Saved instances restore with their own IDs and the allocator only moves upwards',()=>{
 const restored=E.restore({id:500000,key:'duskdagger',mods:[{stat:'damage',value:3}]});
 assert.deepEqual(JSON.parse(JSON.stringify(restored)),{id:500000,key:'duskdagger',mods:[{stat:'damage',value:3}]});assert.ok(Object.isFrozen(restored)&&Object.isFrozen(restored.mods));
 assert.ok(E.nextId()>500000);assert.ok(E.item('rustbound').id>500000);
 const next=E.nextId();assert.equal(E.reserve(10),next);assert.equal(E.reserve(next+5),next+5);assert.equal(E.item('rustbound').id,next+5);
 for(const bad of [{id:0,key:'rustbound',mods:[]},{id:7,key:'nope',mods:[]},{id:7,key:'rustbound',mods:[{stat:'damage',value:9}]},null])assert.throws(()=>E.restore(bad),RangeError);
 // A restored item behaves like any other instance in atomic run transactions.
 const r=E.createRun();assert.ok(E.collect(r,restored).ok);assert.equal(E.collect(r,restored).ok,false);assert.ok(E.valid(r));
});
test('Review: inherited names are not items, and an exhausted allocator throws instead of reusing IDs',()=>{
 for(const key of ['toString','constructor','__proto__'])assert.throws(()=>E.item(key),RangeError);
 assert.throws(()=>E.restore({id:9,key:'toString',mods:[]}),RangeError);assert.equal(E.validModifiers('constructor',[]),false);assert.deepEqual(E.eligibleModifiers('toString'),[]);
 // Kept last in this file: it exhausts the process-wide allocator.
 E.reserve(Number.MAX_SAFE_INTEGER);const last=E.item('rustbound');assert.equal(last.id,Number.MAX_SAFE_INTEGER);
 assert.throws(()=>E.item('rustbound'),/exhausted/);assert.throws(()=>E.item('rustbound'),/exhausted/);assert.equal(E.nextId(),Number.MAX_SAFE_INTEGER+1);
});
