/* Tap-based inventory view. The game owns run state, combat pause and world drops. */
(() => {
 'use strict';
 window.VesperInventoryUI={create(adapter){
  const E=window.VesperEquipment,dialog=document.getElementById('inventory-dialog'),button=document.getElementById('inventory-button');
  let selected=null,confirmDrop=false,focusBefore=null,inert=[];
  const label=i=>i?E.definition(i).name:'Empty';
  function icon(item){const d=E.definition(item),axe=['graveaxe','executioner','ashbringer'].includes(item.key),shape=d.kind==='shield'?'<path d="M24 5 39 11v12c0 9-8 16-15 20C17 39 9 32 9 23V11Z"/><path d="M24 11v25M15 21h18"/>':axe?'<path d="m15 42 16-34M22 12c10-8 18-2 19 5l-8 9-11-5Z"/>':'<path d="m12 39 20-25 9-9-3 14-21 25Z"/><path d="m10 29 13 10M8 44l6-7"/>';return '<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round">'+shape+'</svg>';}
  const card=(i,extra='')=>i?`<span class="item-icon">${icon(i)}</span><span>${label(i)}</span><small>${E.rarities[E.definition(i).rarity].label}${extra}</small>`:'<span>Empty slot</span>';
  const rarity=i=>i?'rarity-'+E.definition(i).rarity:'';
  function describe(i){const d=E.definition(i);return [d.hands===2?'Two-handed weapon':d.kind==='shield'?'Shield':'One-handed weapon',d.damage!==undefined?'+'+d.damage+' main-hand damage':'',d.speed?Math.round(d.speed*100)+'% attack speed':'',d.defence?'Defence '+d.defence:'',d.shield?'Shield capacity '+d.shield+' (recovers after 4s without damage)':'',d.effect||'',...E.rolledModifiers(i).map(b=>{const unit=b.key==='damage'?' damage':b.key==='speed'?'% attack speed':'% critical chance';return 'Rolled '+E.modifiers[b.key].label+': +'+(b.key==='damage'?b.value:Math.round(b.value*100))+unit;})].filter(Boolean).join(' · ');}
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
      const compare=document.createElement('p');compare.className='item-comparison';compare.textContent=(slot==='main'?'Main hand':'Off hand')+' replaces '+label(current)+': '+(result.ok?summary(result.stats)+' · Δ damage '+(result.stats.damage-stats.damage).toFixed(1)+' · Δ attacks/sec '+(1/result.stats.attackRate-1/stats.attackRate).toFixed(2)+' · Δ crit '+((result.stats.crit-stats.crit)*100).toFixed(1)+' percentage points · Δ shield '+(result.stats.shield-stats.shield):result.error);info.append(compare);
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
