/* Tap-based inventory view. The game owns run state, combat pause and world drops. */
(() => {
 'use strict';
 window.VesperInventoryUI={create(adapter){
  const E=window.VesperEquipment,dialog=document.getElementById('inventory-dialog'),button=document.getElementById('inventory-button');
  let selected=null,confirmDrop=false,focusBefore=null,inert=[];
  const label=i=>i?E.definition(i).name:'Empty';
  // Original line-art icon per item (48px grid, stroked with the rarity colour); generic shapes remain the fallback.
  const icons={
   rustbound:'<path d="M38 8 18 28l2 2 20-20 1-5Z"/><path d="m14 26 8 8M12 36l5-5M9 39l3 3"/><path d="M29 16l2 1M25 20l1 2"/>',
   graveaxe:'<path d="M14 42 34 10"/><path d="M28 12c6-4 12-2 13 4l-9 6-7-4Z"/>',
   cryptshield:'<path d="M24 5 39 10v12c0 9-7 16-15 21C16 38 9 31 9 22V10Z"/><path d="M24 12v22M17 20h14"/>',
   mournblade:'<path d="M21 6l3-3 3 3v26h-6Z"/><path d="M14 33h20M24 33v8M21 44h6"/>',
   bloodforged:'<path d="M12 38C20 30 30 18 38 7c-1 10-8 21-18 31Z"/><path d="m10 34 6 6M8 42l4-4"/><path d="M38 31c0 3-2 5-4 5s-4-2-4-5c0-2 4-6 4-6s4 4 4 6Z"/>',
   bulwark:'<rect x="12" y="5" width="24" height="38" rx="4"/><path d="M12 15h24M12 33h24"/><path d="M17 10h.01M31 10h.01M17 38h.01M31 38h.01"/>',
   duskdagger:'<path d="M30 10 18 28l2 2 12-14 1-6Z"/><path d="m15 26 7 7M13 35l4-4"/><path d="M39 31a6 6 0 1 1-6-8 5 5 0 0 0 6 8Z"/>',
   executioner:'<path d="M12 44 30 6"/><path d="M24 10c8-5 17 0 17 10l-13 6-8-8Z"/><path d="M25 18l-6 3"/>',
   ashbringer:'<path d="M12 44 30 8"/><path d="M25 12c7-4 15 0 15 9l-11 5-7-7Z"/><path d="M37 30c3 3 2 7-1 9 0-3-2-4-3-6-1 3-3 4-3 7-2-2-3-5-1-8 2-2 3-4 2-7 3 1 4 3 6 5Z"/>',
   kingsmercy:'<path d="M21 6l3-3 3 3v24h-6Z"/><path d="M16 31h16M24 31v6"/><path d="M19 46l1-6 4 3 4-3 1 6Z"/>',
   oathguard:'<circle cx="24" cy="24" r="18"/><circle cx="24" cy="24" r="12"/><path d="M21 29v-8M24 29v-10M27 29v-9M21 29c0 3 1 5 4 5s5-2 4-5"/>',
   twinmoon:'<path d="M26 8 14 30l2 2 12-20V8Z"/><path d="m11 28 7 7M9 37l4-4"/><path d="M39 13a5 5 0 1 1-5-6 4 4 0 0 0 5 6Z"/><path d="M42 27a4 4 0 1 1-4-5 3 3 0 0 0 4 5Z"/>'
  };
  function icon(item){const d=E.definition(item),axe=['graveaxe','executioner','ashbringer'].includes(item.key),shape=icons[item.key]||(d.kind==='shield'?'<path d="M24 5 39 11v12c0 9-8 16-15 20C17 39 9 32 9 23V11Z"/><path d="M24 11v25M15 21h18"/>':axe?'<path d="m15 42 16-34M22 12c10-8 18-2 19 5l-8 9-11-5Z"/>':'<path d="m12 39 20-25 9-9-3 14-21 25Z"/><path d="m10 29 13 10M8 44l6-7"/>');return '<svg viewBox="0 0 48 48" aria-hidden="true" data-icon="'+item.key+'" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'+shape+'</svg>';}
  const bonusCount=i=>{const n=E.modifiers(i).length;return n?` · ✦ ${n} bonus${n>1?'es':''}`:'';};
  const card=(i,extra='')=>i?`<span class="item-icon">${icon(i)}</span><span>${label(i)}</span><small>${E.rarities[E.definition(i).rarity].label}${bonusCount(i)}${extra}</small>`:'<span>Empty slot</span>';
  const rarity=i=>i?'rarity-'+E.definition(i).rarity:'';
  function describe(i){const d=E.definition(i);return [d.hands===2?'Two-handed weapon':d.kind==='shield'?'Shield':'One-handed weapon',d.damage!==undefined?'+'+d.damage+' main-hand damage':'',d.speed?Math.round(d.speed*100)+'% attack speed':'',d.defence?'Defence '+d.defence:'',d.shield?'Shield capacity '+d.shield+' (recovers after 4s without damage)':'',d.effect||'',...E.modifiers(i).map(m=>'✦ '+E.describeModifier(m))].filter(Boolean).join(' · ');}
  const signed=(v,digits=1,unit='')=>(v>0?'+':v<0?'−':'±')+Math.abs(v).toFixed(digits)+unit;
  function delta(before,after){const d=E.difference(before,after);return `Δ damage ${signed(d.damage)} · Δ attacks/sec ${signed(d.attacksPerSecond,2)} · Δ crit ${signed(d.crit*100,0,'%')} · Δ shield ${signed(d.shield,0)} · Δ defence ${signed(d.defence,0)}`;}
  function summary(s){return `${s.configuration} · Damage ${s.damage.toFixed(1)} · ${(1/s.attackRate).toFixed(2)} attacks/sec · Defence ${s.defence} (${Math.round(s.reduction*100)}%) · Shield ${s.shield} · Crit ${Math.round(s.crit*100)}% ×${s.critMultiplier.toFixed(2)}`;}
  function render(message=''){
   const run=adapter.run(),base=adapter.base(),stats=E.stats(base,run),main=E.definition(run.main);
   document.getElementById('inventory-summary').textContent=summary(stats);
   document.getElementById('inventory-potions').textContent=`Health potions: ${run.potions} / ${E.balance.potions} · Backpack: ${run.bag.filter(Boolean).length} / 6`;
   document.getElementById('equipped-slots').innerHTML=['main','off'].map(slot=>`<button class="inventory-slot ${rarity(run[slot])}" data-slot="${slot}"><b>${slot==='main'?'MAIN HAND':'OFF HAND'}</b>${slot==='off'&&main?.hands===2?'<span>Occupied by main-hand weapon</span>':card(run[slot])}</button>`).join('');
   document.getElementById('backpack-slots').innerHTML=run.bag.map((i,index)=>`<button class="inventory-slot ${rarity(i)} ${selected?.index===index?'selected':''}" data-index="${index}"><b>SLOT ${index+1}</b>${card(i)}</button>`).join('');
   const item=selected?.slot?run[selected.slot]:selected?run.bag[selected.index]:null;
   const info=document.getElementById('inventory-info'),actions=document.getElementById('inventory-actions');actions.innerHTML='';
   if(!item){info.textContent='Tap an item to inspect, compare, equip or drop it.';}
   else{
    info.textContent=label(item)+' — '+describe(item)+(selected.slot?' · Equipped.':'');
    if(selected.slot)actions.innerHTML='<button data-action="unequip">Unequip to backpack</button>';
    else{
     const d=E.definition(item),slots=d.kind==='shield'?['off']:d.hands===2?['main']:['main','off'];
     for(const slot of slots){const result=E.preview(base,run,selected.index,slot),current=slot==='off'&&main?.hands===2?run.main:run[slot];
      const compare=document.createElement('p');compare.className='item-comparison';compare.textContent=(slot==='main'?'Main hand':'Off hand')+' replaces '+label(current)+': '+(result.ok?summary(result.stats):result.error);info.append(compare);
      if(result.ok){const diff=document.createElement('p');diff.className='item-difference';diff.dataset.targetSlot=slot;diff.textContent=delta(stats,result.stats);info.append(diff);}
      const b=document.createElement('button');b.dataset.action='equip';b.dataset.targetSlot=slot;b.textContent='Equip '+(slot==='main'?'main hand':'off hand');b.disabled=!result.ok;actions.append(b);
     }
     const drop=document.createElement('button');drop.dataset.action=confirmDrop?'confirm-drop':'drop';drop.textContent=confirmDrop?'Confirm drop on ground':'Drop item';actions.append(drop);
    }
   }
   document.getElementById('inventory-message').textContent=message;
  }
  function open(){if(dialog.open||!adapter.canOpen())return;selected=null;confirmDrop=false;focusBefore=document.activeElement;adapter.pause();inert=[...document.body.children].filter(el=>el!==dialog&&el instanceof HTMLElement&&!el.inert);inert.forEach(el=>el.inert=true);render();dialog.showModal();document.getElementById('inventory-close').focus();}
  function close(){if(!dialog.open)return;dialog.close();inert.forEach(el=>el.inert=false);inert=[];adapter.resume();if(focusBefore?.isConnected)focusBefore.focus();}
  button.addEventListener('click',open);document.getElementById('inventory-close').addEventListener('click',close);
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.addEventListener('click',e=>{
   const node=e.target.closest('button');if(!node)return;
   if(node.dataset.index!==undefined){selected={index:Number(node.dataset.index)};confirmDrop=false;render();return;}
   if(node.dataset.slot){selected={slot:node.dataset.slot};confirmDrop=false;render();return;}
   if(!selected)return;
   let result;
   if(node.dataset.action==='equip')result=E.equip(adapter.run(),selected.index,node.dataset.targetSlot);
   else if(node.dataset.action==='unequip')result=E.unequip(adapter.run(),selected.slot);
   else if(node.dataset.action==='drop'){confirmDrop=true;render('Tap Confirm drop to place this item on the ground.');return;}
   else if(node.dataset.action==='confirm-drop'){
    const item=adapter.run().bag[selected.index];if(!item)return;
    // Verify a safe world position before removing the item from the backpack.
    if(!adapter.drop(item)){render('No safe space to drop this item here.');return;}
    E.drop(adapter.run(),selected.index);result={ok:true};
   }else return;
   if(result.ok){adapter.changed();selected=null;confirmDrop=false;}render(result.ok?'Equipment updated.':result.error);
  });
  addEventListener('keydown',e=>{if(e.isComposing||e.repeat)return;if(e.key.toLowerCase()==='i'){e.preventDefault();dialog.open?close():open();}});
  return {open,close,render,get isOpen(){return dialog.open;}};
 }};
})();
