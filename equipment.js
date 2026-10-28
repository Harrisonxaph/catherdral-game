/* Pure run inventory, equipment calculations and weighted loot. No DOM or renderer dependency. */
(() => {
 'use strict';
 const balance=Object.freeze({capacity:6,potions:3,dualSpeed:1.2,offDamage:.4,twoHandRate:1.35,maxReduction:.45,maxShield:60,shieldDelay:4,shieldRegen:4,fireCooldown:3});
 const rarities=Object.freeze({common:{label:'Common',color:'#d4d2cc'},rare:{label:'Rare',color:'#68b7ff'},legendary:{label:'Legendary',color:'#f4c46b'}});
 const definitions=Object.freeze({
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
 // Rolled bonus modifiers: configurable pool for newly generated non-legendary equipment.
 // Values are per item; existing loadout clamps in stats() still bound the totals.
 const deepFreeze=o=>{Object.values(o).forEach(v=>v&&typeof v==='object'&&deepFreeze(v));return Object.freeze(o);};
 const affixes=deepFreeze({
  chance:{common:.35,rare:.6,legendary:0},extraChance:{common:0,rare:.4,legendary:0},maxCount:{common:1,rare:2,legendary:0},
  pool:{
   damage:{name:'Honed',kinds:['weapon'],step:1,ranges:{common:[1,3],rare:[2,5]}},
   speed:{name:'Hastened',kinds:['weapon'],step:.01,ranges:{common:[.03,.05],rare:[.04,.08]}},
   crit:{name:'Omened',kinds:['weapon'],step:.01,ranges:{common:[.02,.03],rare:[.03,.05]}}
  }
 });
 const none=Object.freeze([]);
 const eligibleModifiers=key=>{const spec=Object.hasOwn(definitions,key)?definitions[key]:null;return spec?Object.keys(affixes.pool).filter(stat=>affixes.pool[stat].kinds.includes(spec.kind)&&affixes.pool[stat].ranges[spec.rarity]&&affixes.maxCount[spec.rarity]>0):[];};
 function validModifiers(key,mods){
  const spec=Object.hasOwn(definitions,key)?definitions[key]:null;if(!spec||!Array.isArray(mods)||mods.length>(affixes.maxCount[spec.rarity]||0))return false;
  const allowed=eligibleModifiers(key),seen=new Set();
  return mods.every(m=>{if(!m||!allowed.includes(m.stat)||seen.has(m.stat)||!Number.isFinite(m.value))return false;const [lo,hi]=affixes.pool[m.stat].ranges[spec.rarity];seen.add(m.stat);return m.value>=lo-1e-9&&m.value<=hi+1e-9;});
 }
 let serial=0;
 const known=key=>typeof key==='string'&&Object.hasOwn(definitions,key);
 const instance=(id,key,mods)=>{if(!known(key))throw new RangeError('Unknown item '+key);if(!Number.isSafeInteger(id)||id<1)throw new RangeError('Item IDs are exhausted');if(!validModifiers(key,mods))throw new RangeError('Invalid modifiers for '+key);return Object.freeze({id,key,mods:mods.length?Object.freeze(mods.map(m=>Object.freeze({stat:m.stat,value:m.value}))):none});};
 const item=(key,mods=none)=>{const made=instance(serial+1,key,mods);serial++;return made;};
 // Persistence: saved instances keep their own ID, and the allocator never falls below a durable high-water mark.
 const nextId=()=>serial+1;
 function reserve(next){if(!Number.isSafeInteger(next)||next<1)throw new RangeError('Invalid item ID reservation');serial=Math.max(serial,next-1);return serial+1;}
 function restore(record){if(!record||!Number.isSafeInteger(record.id)||record.id<1)throw new RangeError('Invalid item ID');const made=instance(record.id,record.key,record.mods);reserve(record.id+1);return made;}
 const definition=instance=>instance?definitions[instance.key]:null;
 const modifiers=instance=>instance?.mods||none;
 const bonus=(instance,stat)=>modifiers(instance).reduce((n,m)=>n+(m.stat===stat?m.value:0),0);
 function rollModifiers(key,random=Math.random){
  const spec=definitions[key],pool=eligibleModifiers(key),chance=spec?affixes.chance[spec.rarity]||0:0;
  if(!pool.length||!chance||random()>=chance)return none;
  const count=Math.min(pool.length,affixes.maxCount[spec.rarity],1+(random()<affixes.extraChance[spec.rarity]?1:0)),mods=[];
  while(mods.length<count){
   const stat=pool.splice(Math.min(pool.length-1,Math.floor(random()*pool.length)),1)[0],{step,ranges}=affixes.pool[stat],[lo,hi]=ranges[spec.rarity],steps=Math.round((hi-lo)/step);
   mods.push({stat,value:+(lo+Math.min(steps,Math.floor(random()*(steps+1)))*step).toFixed(4)});
  }
  return mods;
 }
 function describeModifier(m){const name=affixes.pool[m.stat]?.name||m.stat;return m.stat==='damage'?name+': +'+m.value+' damage':m.stat==='speed'?name+': +'+Math.round(m.value*100)+'% attack speed':m.stat==='crit'?name+': +'+Math.round(m.value*100)+'% critical chance':name;}
 function createRun(){return {main:item('rustbound'),off:item('cryptshield'),bag:Array(balance.capacity).fill(null),potions:2};}
 function valid(run){
  if(!Array.isArray(run.bag)||run.bag.length!==balance.capacity)return false;
  const main=definition(run.main),off=definition(run.off);
  if(main&&main.kind!=='weapon')return false;
  if(main?.hands===2&&off)return false;
  if(off?.hands===2)return false;
  if(off?.kind==='weapon'&&(!main||main.hands!==1))return false;
  const all=[run.main,run.off,...run.bag].filter(Boolean);return all.every(i=>definition(i)&&validModifiers(i.key,modifiers(i)))&&new Set(all.map(i=>i.id)).size===all.length;
 }
 function transaction(run,action){
  const draft={...run,bag:run.bag.slice()};const error=action(draft);
  if(error)return {ok:false,error};if(!valid(draft))return {ok:false,error:'That equipment configuration is not valid.'};
  Object.assign(run,draft);return {ok:true};
 }
 function stash(run,equipment){if(!equipment)return true;const space=run.bag.indexOf(null);if(space<0)return false;run.bag[space]=equipment;return true;}
 function collect(run,equipment){if(!equipment||!definition(equipment))return {ok:false,error:'Unknown equipment.'};if([run.main,run.off,...run.bag].some(i=>i?.id===equipment.id))return {ok:false,error:'Already collected.'};return transaction(run,d=>stash(d,equipment)?null:'Backpack full — drop or equip an item first.');}
 function equip(run,index,slot='main'){
  if(!Number.isInteger(index)||index<0||index>=balance.capacity||!run.bag[index])return {ok:false,error:'Select a backpack item.'};
  if(!['main','off'].includes(slot))return {ok:false,error:'Unknown equipment slot.'};
  return transaction(run,d=>{
   const equipment=d.bag[index],spec=definition(equipment),main=definition(d.main);d.bag[index]=null;
   if(spec.kind==='shield'&&slot!=='off')return 'Shields belong in the off hand.';
   if(spec.hands===2&&slot!=='main')return 'Two-handed weapons belong in the main hand.';
   if(slot==='off'&&(main?.hands===2||spec.kind==='weapon'&&!main))return 'Equip a one-handed main-hand weapon first.';
   const displaced=spec.hands===2?[d.main,d.off]:[d[slot]];
   if(spec.hands===2){d.main=equipment;d.off=null;}else d[slot]=equipment;
   for(const old of displaced)if(!stash(d,old))return 'Not enough backpack space for displaced equipment.';
  });
 }
 function unequip(run,slot){
  if(!['main','off'].includes(slot)||!run[slot])return {ok:false,error:'That slot is empty.'};
  return transaction(run,d=>{if(!stash(d,d[slot]))return 'Backpack full — free a slot first.';d[slot]=null;if(slot==='main'&&definition(d.off)?.kind==='weapon'){d.main=d.off;d.off=null;}});
 }
 function drop(run,index){if(!Number.isInteger(index)||!run.bag[index])return null;const equipment=run.bag[index];run.bag[index]=null;return equipment;}
 function stats(base,run){
  const main=definition(run.main),off=definition(run.off),dual=main?.hands===1&&off?.kind==='weapon';
  const gear=[run.main,run.off].filter(i=>definition(i)),sum=key=>gear.reduce((n,i)=>n+(definition(i)[key]||0)+bonus(i,key),0);
  const damage=base.damage+(main?main.damage+bonus(run.main,'damage'):0)+(off?.kind==='weapon'?(off.damage+bonus(run.off,'damage'))*balance.offDamage:0);
  const speed=Math.max(.65,Math.min(1.7,1+sum('speed')))*(dual?balance.dualSpeed:1);
  const defence=Math.max(0,sum('defence'));
  return {damage:main?damage:base.damage*.7,attackRate:Math.max(.13,base.attackRate*(main?.hands===2?balance.twoHandRate:1)/speed),crit:Math.min(.75,(base.crit||0)+sum('crit')),critMultiplier:1.9+Math.min(.8,sum('critDamage')),defence,reduction:Math.min(balance.maxReduction,defence/(defence+60)),shield:off?.kind==='shield'?Math.min(balance.maxShield,sum('shield')):0,onHit:Math.min(2,sum('onHit')),critHeal:Math.min(3,sum('critHeal')),fire:Math.min(.25,sum('fire')),poisonReduction:Math.min(.4,sum('poisonReduction')),configuration:main?.hands===2?'Two-handed':dual?'Dual wield':off?.kind==='shield'?(main?'Weapon & shield':'Unarmed & shield'):main?'One-handed':'Unarmed'};
 }
 function difference(before,after){return {damage:after.damage-before.damage,attacksPerSecond:1/after.attackRate-1/before.attackRate,crit:after.crit-before.crit,critMultiplier:after.critMultiplier-before.critMultiplier,defence:after.defence-before.defence,reduction:after.reduction-before.reduction,shield:after.shield-before.shield};}
 function preview(base,run,index,slot){const draft={...run,bag:run.bag.slice()},result=equip(draft,index,slot);return result.ok?{...result,stats:stats(base,draft)}:result;}
 function weighted(entries,random=Math.random){let roll=Math.min(.999999,Math.max(0,random()))*entries.reduce((n,e)=>n+e[1],0);for(const [value,weight]of entries){roll-=weight;if(roll<0)return value;}return entries.at(-1)[0];}
 const tables=Object.freeze({boss:{1:[['common',72],['rare',28]],3:[['rare',94],['legendary',6]],5:[['rare',65],['legendary',35]]},ordinaryChance:.075,potionChance:.045,chestChance:.55,chest:[['common',75],['rare',23],['legendary',2]]});
 function roll(source,floor,random=Math.random){
  if(source==='ordinary'&&random()>=tables.ordinaryChance||source==='chest'&&random()>=tables.chestChance)return null;
  const weights=source==='boss'?tables.boss[floor]:source==='ordinary'?[['common',1]]:tables.chest;
  if(!weights)return null;const rarity=weighted(weights,random),keys=Object.keys(definitions).filter(k=>definitions[k].rarity===rarity),key=keys[Math.min(keys.length-1,Math.floor(random()*keys.length))];return item(key,rollModifiers(key,random));
 }
 function encounterReward(encounter,floor,random=Math.random){if(encounter.rewarded||encounter.kind!=='boss'||!encounter.members.length||!encounter.members.every(e=>e.dead))return null;encounter.rewarded=true;return roll('boss',floor,random);}
 function addPotion(run){if(run.potions>=balance.potions)return false;run.potions++;return true;}
 function usePotion(run,hp,maxHp){if(run.potions<=0||hp>=maxHp)return 0;run.potions--;return Math.min(maxHp-hp,Math.round(maxHp*.42));}
 const api=Object.freeze({balance,rarities,definitions,affixes,item,nextId,reserve,restore,definition,modifiers,eligibleModifiers,validModifiers,rollModifiers,describeModifier,difference,createRun,valid,collect,equip,unequip,drop,stats,preview,weighted,tables,roll,encounterReward,addPotion,usePotion});
 if(typeof module!=='undefined')module.exports=api;else window.VesperEquipment=api;
})();
