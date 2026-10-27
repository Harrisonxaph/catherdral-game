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

function seeded(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('New weapon rolls are eligible, bounded and immutable; legacy starters and legendaries stay unchanged',()=>{
 const snapshot=JSON.stringify(E.definitions),run=E.createRun();
 assert.equal(run.main.modifiers,undefined);assert.equal(run.off.modifiers,undefined);
 for(const key of Object.keys(E.definitions))for(const value of [0,.4,.8,.999999]){
  const instance=E.generate(key,()=>value),d=E.definition(instance),mods=instance.modifiers||[];
  if(d.kind==='weapon'&&d.rarity!=='legendary'){
   assert.equal(mods.length,1);const config=E.modifiers[mods[0].key],range=config[d.rarity];
   assert.ok(mods[0].value>=range[0]&&mods[0].value<=range[1]);
   assert.ok(Object.isFrozen(instance)&&Object.isFrozen(mods)&&Object.isFrozen(mods[0]));
  }else assert.equal(mods.length,0);
  assert.equal(d,E.definitions[key]);
 }
 for(const key of ['rustbound','duskdagger'])for(const [index,bonusKey] of Object.keys(E.modifiers).entries())for(const end of [0,1]){
  const draws=[(index+.1)/3,end],rolled=E.generate(key,()=>draws.shift()),range=E.modifiers[bonusKey][E.definition(rolled).rarity];
  assert.deepEqual(rolled.modifiers,[{key:bonusKey,value:range[end]}]);
 }
 for(const key of ['cryptshield','bulwark','ashbringer'])assert.equal(E.generate(key,()=>{throw Error('Ineligible item consumed modifier RNG');}).modifiers,undefined);
 assert.equal(JSON.stringify(E.definitions),snapshot);assert.equal(Object.keys(E.definitions).length,12);
});
test('Rolled damage is weighted once in dual wield and never rerolled by transactions',()=>{
 const r=E.createRun(),main=E.generate('rustbound',()=>0),off=E.generate('rustbound',()=>0);
 for(const i of [main,off])assert.ok(E.collect(r,i).ok);
 assert.ok(E.equip(r,0,'main').ok);assert.ok(E.equip(r,1,'off').ok);
 assert.equal(E.stats(base,r).damage,34.2); // 30 + (2+1) + (2+1)*0.4
 const expected=E.stats(base,r),snapshot=JSON.stringify(r);
 E.preview(base,r,0,'main');assert.equal(JSON.stringify(r),snapshot);
 for(let n=0;n<20;n++){assert.ok(E.unequip(r,'off').ok);const index=r.bag.findIndex(i=>i?.id===off.id);assert.ok(E.equip(r,index,'off').ok);assert.deepEqual(E.stats(base,r),expected);}
 const index=r.bag.findIndex(i=>i?.key==='cryptshield'),dropped=E.drop(r,index);
 assert.ok(E.collect(r,dropped).ok);assert.deepEqual(E.stats(base,r),expected);
});
test('Rolled speed and critical chance add to base gear bonuses within existing caps',()=>{
 const fast=E.generate('duskdagger',()=>.4),critical=E.generate('rustbound',()=>.8);
 const r={...E.createRun(),main:fast,off:critical};
 assert.ok(Math.abs(E.stats(base,r).attackRate-.36/(1+.12+.04)/1.2)<1e-12);
 assert.equal(E.stats(base,r).crit,.02);
 assert.equal(E.stats({...base,crit:.75},r).crit,.75);
 const both={...r,main:E.generate('rustbound',()=>.8)};assert.ok(Math.abs(E.stats({...base,crit:.1},both).crit-.14)<1e-12);
 assert.equal(E.stats({...base,attackRate:.01},r).attackRate,.13);
 const forged={id:999,key:'rustbound',modifiers:[{key:'speed',value:999},{key:'damage',value:999}]};
 assert.equal(E.itemStats(forged).speed,.04);assert.equal(E.itemStats(forged).damage,2);
 assert.equal(E.itemStats({id:995,key:'rustbound',modifiers:[{key:'toString',value:3}]}).damage,2);
 for(const bad of [NaN,Infinity,-10])assert.equal(E.itemStats({id:998,key:'rustbound',modifiers:[{key:'damage',value:bad}]}).damage,2);
 assert.equal(E.itemStats({id:997,key:'cryptshield',modifiers:[{key:'damage',value:3}]}).damage,undefined);
 assert.equal(E.itemStats({id:996,key:'ashbringer',modifiers:[{key:'damage',value:3}]}).damage,29);
 const defence=E.stats(base,{...r,off:E.item('oathguard')});assert.ok(defence.reduction<=E.balance.maxReduction);assert.ok(defence.shield<=E.balance.maxShield);
});
test('Rolled two-hand displacement fails atomically when full and survives successful drop/recollect',()=>{
 const r=E.createRun(),two=E.generate('mournblade',()=>0);E.collect(r,two);
 for(let i=1;i<6;i++)E.collect(r,E.generate('duskdagger',()=>.8));
 const before=JSON.stringify(r);assert.equal(E.equip(r,0,'main').ok,false);assert.equal(JSON.stringify(r),before);
 E.drop(r,5);assert.ok(E.equip(r,0,'main').ok);assert.equal(r.main,two);assert.equal(r.off,null);
 assert.equal(E.stats(base,r).damage,46);assert.ok(E.valid(r));
 assert.equal(E.collect(r,two).ok,false);E.drop(r,4);assert.ok(E.unequip(r,'main').ok);
 const index=r.bag.findIndex(i=>i?.id===two.id),drop=E.drop(r,index);assert.equal(drop,two);assert.ok(E.collect(r,drop).ok);
 assert.deepEqual(drop.modifiers,two.modifiers);
});
test('Same seeds repeat drop keys and modifiers with unique ownership IDs and once-only boss rewards',()=>{
 const sequence=()=>{const random=seeded(842);return Array.from({length:100},()=>E.roll('chest',3,random));};
 const a=sequence(),b=sequence(),strip=i=>i?{key:i.key,modifiers:i.modifiers}:null;
 assert.deepEqual(a.map(strip),b.map(strip));assert.ok(a.some(i=>i?.modifiers?.length));
 for(let i=0;i<a.length;i++)if(a[i])assert.notEqual(a[i].id,b[i].id);
 const encounter={kind:'boss',members:[{dead:true}]};const reward=E.encounterReward(encounter,1,()=>0);
 assert.equal(reward.modifiers.length,1);assert.equal(E.encounterReward(encounter,1,()=>0),null);
});
