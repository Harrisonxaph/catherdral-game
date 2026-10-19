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
