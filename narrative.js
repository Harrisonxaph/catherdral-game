(() => {
  'use strict';
  const chapter = window.VesperChapter, key = 'vesperNarrative:v1';
  const fresh = () => ({version:1, deaths:0, flags:[], entries:[]});
  let save = fresh(), storageAvailable = true;
  try { const data = JSON.parse(localStorage.getItem(key)); if(data?.version===1 && Array.isArray(data.flags) && Array.isArray(data.entries)) save={version:1,deaths:Number.isSafeInteger(data.deaths)&&data.deaths>=0?data.deaths:0,flags:data.flags.filter(x=>typeof x==='string').slice(0,100),entries:data.entries.filter(x=>typeof x.id==='string'&&typeof x.title==='string'&&typeof x.text==='string').slice(-100)}; } catch {}
  const events = new EventTarget();
  let adapter, objects=[], nearby=null, run=null, previousFocus, inertElements=[];
  const dialog=document.createElement('dialog');dialog.id='story-dialog';dialog.setAttribute('aria-labelledby','story-heading');
  dialog.innerHTML='<div class="story-sheet"><header><span class="story-kicker" id="story-kicker"></span><button id="story-close" aria-label="Close story window">Close</button></header><div id="story-content"></div><div id="story-choices"></div><p class="story-footnote">The world waits while you read.</p></div>';
  document.body.append(dialog);
  const tracker=document.createElement('button');tracker.id='quest-tracker';tracker.hidden=true;tracker.setAttribute('aria-label','Open quest journal');document.body.append(tracker);
  const interact=document.createElement('button');interact.id='story-interact';interact.hidden=true;document.body.append(interact);
  const $=id=>document.getElementById(id);
  function persist(){try{localStorage.setItem(key,JSON.stringify(save));}catch{storageAvailable=false;}}
  function has(id){return save.flags.includes(id);}
  function record(id,title,text){if(has(id))return;save.flags.push(id);save.entries.push({id,title,text});persist();}
  function node(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
  function open(kicker,title,text,choices=[],portrait=false){
    if(!dialog.open){previousFocus=document.activeElement;adapter?.clearInput();inertElements=[...document.body.children].filter(el=>el!==dialog&&el instanceof HTMLElement&&!el.inert);inertElements.forEach(el=>el.inert=true);dialog.showModal();}
    $('story-kicker').textContent=kicker;
    const body=$('story-content');body.replaceChildren();
    if(portrait){const img=document.createElement('img');img.src='./images/forgotten-knight.png';img.alt='The Forgotten Knight in a weathered closed helm';img.className='knight-portrait';body.append(img);}
    const heading=node('h2',title);heading.id='story-heading';body.append(heading,node('p',text,'story-prose'));
    const actions=$('story-choices');actions.replaceChildren();
    for(const [label,callback] of choices){const button=node('button',label);button.onclick=callback;actions.append(button);}
    dialog.scrollTop=0;$('story-close').focus();
  }
  function close(){dialog.close();adapter?.clearInput();inertElements.forEach(el=>el.inert=false);inertElements=[];if(previousFocus?.isConnected)previousFocus.focus();}
  $('story-close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  function talk(id='greeting') {const line=chapter.knight[id];record('knight','The Forgotten Knight','A knight waits beside the place where I awoke. He has seen me before.');record('dialogue:'+id,'The Forgotten Knight — '+id,line.text);open('CONVERSATION', 'The Forgotten Knight',line.text,line.choices.map(([label,next])=>[label,()=>{record('choice:'+id+':'+label,'My words to the knight',label);if(next)talk(next);else close();}]),true);updateTracker();}
  function journal(){
    open('CHAPTER I · JOURNAL',chapter.title,'Escape the Forgotten Crypt.\n'+(has('escape')?'Completed in a previous or current life.':'Recover the crown splinter, break the seal and reach the far stair.'));
    const body=$('story-content');
    for(const [id,label] of [['knight','Speak with the Forgotten Knight (optional)'],['keeper','Defeat the Crypt Keeper'],['crown','Recover the crown splinter'],['seal','Break the crypt seal'],['escape','Leave through the stairway']])body.append(node('p',(has(id)?'Complete — ':'Unfinished — ')+label,'quest-line'));
    body.append(node('h3','Discoveries & conversations'));
    for(const entry of [...save.entries].reverse()){const section=document.createElement('section');section.append(node('h3',entry.title),node('p',entry.text,'story-prose'));body.append(section);}
    body.append(node('p',storageAvailable?'Memories are saved on this device. Runs restart on refresh.':'Device storage is unavailable. Memories last only for this session.','story-footnote'));
  }
  tracker.onclick=journal;
  function updateTracker(){tracker.textContent=has('escape')?'CHAPTER I · COMPLETE · Journal':`ESCAPE THE FORGOTTEN CRYPT\n${!run?.keeper?'Silence the Crypt Keeper':!run?.crown?'Recover the crown splinter':!run?.seal?'Break the seal':'Find the far stair'} · Journal`;}
  function use(){if(!nearby||!adapter?.playing()||dialog.open)return;const object=nearby;
    if(object.kind==='knight')talk();
    else if(object.kind==='crown'){object.collected=true;run.crown=true;emit('item-collected',{id:'crown'});open('RELIC RECOVERED','A splinter of the Hollow Crown','It is warm against your skin. For an instant, you remember the weight of something whole.',[['Keep the fragment',close]]);}
    else {const lore=chapter.lore[object.kind];record('lore:'+object.kind,lore.title,lore.text);open('FOUND IN THE CRYPT',lore.title,lore.text,[['Return to the crypt',close]]);}
    updateTracker();
  }
  interact.onclick=use;
  addEventListener('keydown',e=>{if(e.nativeEvent?.isComposing||e.isComposing||e.keyCode===229)return;if(dialog.open)return;if(e.key.toLowerCase()==='f'&&!e.repeat){e.preventDefault();use();}if(e.key.toLowerCase()==='l'&&!e.repeat&&adapter?.playing()){e.preventDefault();journal();}});
  function emit(name,detail={}){events.dispatchEvent(new CustomEvent(name,{detail}));}
  function on(name,fn){events.addEventListener(name,e=>fn(e.detail));}
  on('run-start',()=>{record('awakening','Beneath Castle Vesper','I woke without a name. A knight waited nearby. Somewhere above, a bell rang for no one.');updateTracker();});
  on('room-enter',({index,floor})=>{if(floor===1&&index>0)record('room','Beyond the waking chamber','The crypt changes its corridors, but not its hunger. A seal binds the far stair.');});
  on('seal-open',({floor})=>{if(floor!==1)return;run.seal=true;record('seal','The seal breaks','The far stair opens. The crypt has released its breath.');updateTracker();});
  on('boss-defeated',({floor,x,y})=>{if(floor!==1)return;run.keeper=true;objects.push({kind:'crown',x,y,label:'Take crown splinter'});record('keeper','The Crypt Keeper falls','Inside the empty armor, a sliver of a broken crown catches the light.');updateTracker();});
  on('item-collected',({id})=>{if(id==='crown')record('crown','A splinter of the Hollow Crown','Warm metal. A memory of a throne. Why does this broken thing feel like it belongs to me?');});
  on('floor-left',({floor})=>{if(floor!==1)return;record('escape','Chapter I complete','I escaped the Forgotten Crypt with a splinter of the Hollow Crown. The castle beyond remains unexplored.');open('CHAPTER I · COMPLETE','The Forgotten Crypt','Behind you, the crypt falls silent. In your palm, the crown remembers.\n\nChapter I ends here. You may continue the original roguelike; further story chapters are not yet written.',[['Continue the descent',close]]);updateTracker();});
  on('player-died',()=>{save.deaths++;const index=Math.min(save.deaths-1,chapter.memories.length-1),memory=chapter.memories[index];record('memory:'+index,'Death memory '+(index+1),memory);persist();$('deathtag').textContent=memory;});
  window.VesperStory={
    emit,on,get paused(){return dialog.open;},get objects(){return objects.filter(o=>!o.collected);},
    connect(value){adapter=value;},
    opening(start){open('VESPER · THE HOLLOW CROWN','Before the first bell',chapter.opening,[['Start Adventure',()=>{close();start();open('CHAPTER I',chapter.title,'Stone beneath your cheek. Ash on your tongue.\n\nA knight waits near the place where you awoke. Approach him and choose Speak.\n\nYour first task: Escape the Forgotten Crypt.',[['Enter the crypt',close]]);}]]);},
    setup(world,floor){objects=[];nearby=null;run={keeper:false,crown:false,seal:false,room:-1};if(floor!==1)return;const r=world.start;objects=[{kind:'knight',x:r.cx+1.5,y:r.cy+.5,label:'Speak to the Forgotten Knight'},{kind:'letter',x:r.cx-.5,y:r.cy+.5,label:'Read unsent letter'},{kind:'book',x:r.cx+.5,y:r.cy-1.5,label:'Read burial register'},{kind:'inscription',x:world.exit.cx+.5,y:world.exit.cy+1.5,label:'Read the inscription'}];},
    update({world,player,floor,state}){tracker.hidden=state!=='playing';interact.hidden=true;if(state!=='playing'||dialog.open)return;const room=world.rooms.findIndex(r=>player.x>=r.x&&player.x<r.x+r.w&&player.y>=r.y&&player.y<r.y+r.h);if(room>=0&&room!==run.room){run.room=room;emit('room-enter',{index:room,floor});}nearby=objects.filter(o=>!o.collected&&Math.hypot(o.x-player.x,o.y-player.y)<1.65).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0];if(nearby){interact.textContent=nearby.label+' · F';interact.hidden=false;}},
    canLeave(floor){if(floor!==1||run.crown)return true;open('THE FAR STAIR','Something is missing','The crown splinter lies where the Crypt Keeper fell. Return for it before leaving.',[['Return',close]]);return false;}
  };
})();
