/* Renderer-independent enemy definitions, state machine, damage and hazard runtime. */
(() => {
  'use strict';
  const definitions=Object.freeze({
    bone:{name:'Skeleton Warrior',hp:35,speed:1.55,damage:9,xp:12,detect:7,range:1.25,cooldown:1.3,windup:.48,color:'#c8c0aa'},
    guardian:{name:'Skeleton Guardian',hp:68,shield:55,speed:1.05,damage:12,xp:20,detect:7,range:1.3,cooldown:1.8,windup:.65,color:'#78899c'},
    ghoul:{name:'Ghoul',hp:28,speed:2.15,damage:10,xp:14,detect:8,range:3.1,cooldown:2.1,windup:.65,color:'#8b9c76',ability:'lunge'},
    plague:{name:'Plague Ghoul',hp:36,speed:1.7,damage:8,xp:18,detect:8,range:3.5,cooldown:3.8,windup:.8,color:'#71a63d',ability:'poison'},
    brute:{name:'Demon Brute',hp:115,speed:.87,damage:20,xp:26,detect:8,range:2.5,cooldown:3,windup:1.1,color:'#a74637',ability:'slam'},
    summoner:{name:'Demon Summoner',hp:42,speed:1.15,damage:7,xp:28,detect:9,range:6,cooldown:5,windup:1.2,color:'#9a5fc0',ability:'summon',ranged:true},
    cultist:{name:'Fallen Cultist',hp:40,speed:1.3,damage:11,xp:20,detect:9,range:7,cooldown:2.3,windup:.75,color:'#72549e',ability:'bolt',ranged:true},
    wraith:{name:'Wraith',hp:32,speed:1.9,damage:9,xp:19,detect:8,range:1.35,cooldown:1.1,windup:.38,color:'#81c3d4',ability:'teleport'}
  });
  const limits=Object.freeze({active:18,attackers:3,hazards:24,projectiles:48,minions:12,perSummoner:3});
  const states=Object.freeze(['idle','patrol','detecting','chasing','preparing','attacking','recovering','stunned','dead']);
  function create(type,x,y,config,random=Math.random){
    const d=definitions[type];if(!d)throw new RangeError('Unknown enemy '+type);
    const elite=config.number===5,health=config.health*(elite?1.25:1),damage=config.damage*(elite?1.12:1);
    return {type,x,y,homeX:x,homeY:y,hp:Math.round(d.hp*health),maxHp:Math.round(d.hp*health),shield:Math.round((d.shield||0)*health),maxShield:Math.round((d.shield||0)*health),speed:d.speed*(1+Math.min(.24,config.number*.02)),dmg:d.damage*damage,xp:d.xp,r:type==='brute'?.42:.3,hit:0,phase:random()*Math.PI*2,aim:0,dead:false,elite,state:'idle',stateTime:0,cooldown:random()*.8,abilityCooldown:3+random()*2,poolCooldown:0,stunLock:0,stuck:0,combo:false,statuses:[]};
  }
  function damage(e,amount){
    if(e.dead)return {health:0,shield:0};
    // A shield-breaking hit is fully absorbed: the next strike can reach health.
    if(e.shield>0){const shield=Math.min(e.shield,amount);e.shield=Math.max(0,e.shield-amount);return {health:0,shield};}
    e.hp-=amount;return {health:amount,shield:0};
  }
  function createRuntime(api){
    const hazards=[],pool=[],statuses=[];
    let serial=0,clock=0;
    const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    function visible(a,b){const w=api.world(),n=Math.ceil(distance(a,b)*4);for(let i=1;i<=n;i++){const t=i/(n||1);if(!w.walk(Math.floor(a.x+(b.x-a.x)*t),Math.floor(a.y+(b.y-a.y)*t)))return false;}return true;}
    function contains(h,p){return h.shape==='rect'?Math.abs(p.x-h.x)<=h.width/2&&Math.abs(p.y-h.y)<=h.height/2:distance(h,p)<=h.radius;}
    function addHazard(options){
      if(hazards.length>=limits.hazards)return null;
      const h=pool.pop()||{};
      Object.assign(h,{id:++serial,x:0,y:0,shape:'circle',radius:1,width:1,height:1,warning:.65,duration:1,damage:8,interval:.8,kind:'poison',color:'#80ba45',age:0,nextTick:0,owner:null,cancelOnStun:false,oneShot:false,poison:0,spent:false},options);
      hazards.push(h);return h;
    }
    function setState(e,state,duration=0){e.state=state;e.stateTime=duration;}
    // Stage 5 can protect an action and its warnings without changing any player ability.
    function cancel(e,reason='death'){for(const h of hazards)if(h.owner===e&&h.age<h.warning&&(reason!=='stun'||h.interruptible!==false))h.spent=true;e.telegraph=null;}
    function stun(e,duration=.22,options={}){
      const strong=options.source==='ability',boss=e.type==='boss'||e.isBoss;
      const policy={immune:false,durationCap:boss?.75:Infinity,shieldMultiplier:.5,postRecoveryImmunity:strong?1.5:.68,...e.controlResistance};
      if(e.dead||policy.immune||e.state==='stunned'||e.stunLock>0||e.attackInterruptible===false||e.majorMechanicActive||!strong&&(boss||e.shield>0))return false;
      duration=Math.min(duration,policy.durationCap);if(strong&&e.shield>0)duration*=policy.shieldMultiplier;if(duration<=0)return false;
      cancel(e,'stun');e.combo=false;e.followup=false;e.stunLock=duration+policy.postRecoveryImmunity;e.cooldown=Math.max(e.cooldown||0,.65);setState(e,'stunned',duration);return true;
    }
    function status(kind,duration,damage,interval=1){const old=statuses.find(s=>s.kind===kind);if(old){old.remaining=Math.max(old.remaining,duration);old.damage=Math.max(old.damage,damage);return;}statuses.push({kind,remaining:duration,damage,interval,next:interval});}
    function targetStatus(e,kind,duration,damage,interval=1){const old=e.statuses.find(s=>s.kind===kind);if(old){old.remaining=Math.max(old.remaining,duration);return;}e.statuses.push({kind,remaining:duration,damage,interval,next:interval});}
    function advanceStatuses(list,dt,hit){for(let i=list.length-1;i>=0;i--){const s=list[i],elapsed=Math.min(dt,s.remaining);s.remaining-=dt;s.next-=elapsed;if(s.next<=0){hit(s.damage,s.kind);s.next+=s.interval;}if(s.remaining<=0)list.splice(i,1);}}
    function move(e,dx,dy,dt,speed=e.speed){const length=Math.hypot(dx,dy)||1;api.move(e,dx/length*speed*dt,dy/length*speed*dt);}
    function navigate(e,p,dt,retreat=false){
      const w=api.world(),field=api.flow(),cx=Math.floor(e.x),cy=Math.floor(e.y);let gx=p.x-e.x,gy=p.y-e.y;
      if(retreat||!visible(e,p)){
        let score=retreat?-1:32000,best=null;
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=cx+dx+.5,y=cy+dy+.5;if(!api.free(x,y,e.r))continue;const v=field[w.ix(cx+dx,cy+dy)];if(v>=32000)continue;if(retreat?v>score:v<score){score=v;best={x,y};}}
        if(best){gx=best.x-e.x;gy=best.y-e.y;}
      }
      if(e.type==='wraith'){gx+=Math.sin(e.phase)*.25;gy+=Math.cos(e.phase)*.25;}
      e.aim=Math.atan2(gy,gx);const ox=e.x,oy=e.y;move(e,gx,gy,dt);
      e.stuck=distance({x:ox,y:oy},e)<dt*.08?e.stuck+dt:0;
      if(e.stuck>.7){const a=e.aim+(Math.sin(e.phase)>0?1:-1)*Math.PI/2;move(e,Math.cos(a),Math.sin(a),dt, e.speed);if(e.stuck>2)e.stuck=0;}
    }
    function prepare(e,p){
      const d=definitions[e.type];let ability=d.ability||'melee';if(ability==='teleport')ability='melee';if(e.type==='plague'&&e.poolCooldown>0)ability='lunge';if(e.type==='brute'&&e.abilityCooldown>0)ability='melee';
      if(ability==='summon'&&api.enemies().filter(m=>!m.dead&&m.master===e).length>=limits.perSummoner)ability='bolt';
      e.telegraph=null;e.action=ability;e.aim=Math.atan2(p.y-e.y,p.x-e.x);e.target={x:p.x,y:p.y};
      const warning=e.followup?.24:d.windup;e.followup=false;setState(e,'preparing',warning);
      if(ability==='lunge'){
        const length=Math.min(2.4,distance(e,p));e.target={x:e.x+Math.cos(e.aim)*length,y:e.y+Math.sin(e.aim)*length};
        e.telegraph=addHazard({...e.target,radius:1,warning,duration:.18,damage:0,kind:'lunge',color:'#e6b676',owner:e,cancelOnStun:true,oneShot:true});
      }
      if(ability==='bolt'||ability==='summon')e.telegraph=addHazard({x:e.x,y:e.y,radius:.65,warning,duration:.15,damage:0,kind:'magic',color:'#b583ed',owner:e,cancelOnStun:true,oneShot:true});
      if(['slam','poison','melee'].includes(ability)){
        const melee=ability==='melee';const x=melee?e.x+Math.cos(e.aim)*.65:ability==='poison'?p.x:e.x,y=melee?e.y+Math.sin(e.aim)*.65:ability==='poison'?p.y:e.y;
        e.telegraph=addHazard({x,y,radius:melee?.8:ability==='slam'?2:1.15,warning,duration:ability==='poison'?4:.15,damage:e.dmg,kind:ability==='poison'?'poison':ability==='slam'?'fire':'melee',color:ability==='poison'?'#80ba45':ability==='slam'?'#f29b4b':'#dbad71',owner:e,cancelOnStun:true,oneShot:ability!=='poison',poison:ability==='poison'?e.dmg*.35:0});
      }
      if(!e.telegraph){e.cooldown=.6;setState(e,'recovering',.3);}
    }
    function execute(e){
      const p=api.player();
      if(e.action==='bolt'&&visible(e,p)){api.bolt(e.x,e.y,Math.atan2(e.target.y-e.y,e.target.x-e.x),e.dmg,4.2,false);}
      if(e.action==='lunge'){
        const dx=e.target.x-e.x,dy=e.target.y-e.y,length=Math.min(2.4,Math.hypot(dx,dy)),angle=Math.atan2(dy,dx);
        // Substeps prevent lunges tunnelling through a one-tile wall.
        for(let step=0;step<12;step++)api.move(e,Math.cos(angle)*length/12,Math.sin(angle)*length/12);
        if(distance(e,p)<1&&visible(e,p))api.hurt(e.dmg,e.x,e.y);
      }
      if(e.action==='summon'){
        for(let i=0;i<3;i++){
          const all=api.enemies();if(all.filter(m=>!m.dead&&m.master===e).length>=limits.perSummoner||all.filter(m=>!m.dead&&m.minion).length>=limits.minions)break;
          const a=e.aim+i*Math.PI*2/3,x=e.x+Math.cos(a)*1.2,y=e.y+Math.sin(a)*1.2;
          if(!api.free(x,y,.3))continue;const m=api.spawn(x,y,'ghoul');m.master=e;m.minion=true;m.hp=m.maxHp=Math.round(m.maxHp*.5);m.dmg*=.65;m.xp=0;m.speed*=.9;m.state='detecting';m.stateTime=.3;
          api.effect(x,y,'#ac72d4',8,1.5);
        }
      }
      if(e.type==='plague'&&e.action==='poison')e.poolCooldown=6;
      if(e.type==='brute'&&e.action==='slam')e.abilityCooldown=6;
      if(e.type==='bone'&&!e.combo&&api.random()<.25){e.combo=true;e.followup=true;e.cooldown=.3;}else{e.combo=false;e.cooldown=definitions[e.type].cooldown;}
      setState(e,'attacking',e.action==='lunge'?.18:.13);
    }
    function tick(dt){
      clock+=dt;const p=api.player(),all=api.enemies();
      advanceStatuses(statuses,dt,(amount,kind)=>api.hurt(amount,undefined,undefined,kind));
      for(const e of all){
        if(e.dead){e.state='dead';continue;}
        e.stunLock=Math.max(0,(e.stunLock||0)-dt);
        if(e.state==='stunned'){e.stateTime-=dt;if(e.stateTime<=0)setState(e,e.type==='boss'||e.isBoss?'chasing':'recovering',.25);}
        if(e.type!=='boss')advanceStatuses(e.statuses||[],dt,(amount)=>api.damage(e,amount));
      }
      const active=all.filter(e=>!e.dead&&e.type!=='boss'&&!e.isBoss&&distance(e,p)<12&&api.allowed(e)).sort((a,b)=>distance(a,p)-distance(b,p)).slice(0,limits.active);
      let attackers=active.filter(e=>['preparing','attacking'].includes(e.state)).length;
      // Finish nearby attacks first; distant windups are cancelled instead of stored for later.
      for(const e of all)if(e.type!=='boss'&&!e.isBoss&&!e.dead&&!active.includes(e)&&['preparing','attacking'].includes(e.state)){cancel(e);setState(e,'recovering',.5);}
      for(const e of active){
        const d=definitions[e.type];e.hit=Math.max(0,e.hit-dt);e.cooldown=Math.max(0,e.cooldown-dt);e.abilityCooldown-=dt;e.poolCooldown-=dt;e.phase+=dt*2;if(e.state!=='stunned')e.stateTime-=dt;
        const range=distance(e,p),sight=visible(e,p);
        if(e.state==='stunned')continue;
        if(e.state==='preparing'){if(e.stateTime<=0)execute(e);continue;}
        if(e.state==='attacking'){if(e.stateTime<=0)setState(e,'recovering',e.combo?.15:.4);continue;}
        if(e.state==='recovering'){if(e.stateTime<=0)setState(e,'chasing');continue;}
        if(e.state==='idle'||e.state==='patrol'){
          if(range<d.detect&&sight){setState(e,'detecting',.35);continue;}
          if(e.stateTime<=0)setState(e,e.state==='idle'?'patrol':'idle',1.5+api.random());
          if(e.state==='patrol'){const angle=e.phase*.3,target={x:e.homeX+Math.cos(angle),y:e.homeY+Math.sin(angle)};move(e,target.x-e.x,target.y-e.y,dt,e.speed*.3);}continue;
        }
        if(e.state==='detecting'){if(e.stateTime<=0)setState(e,'chasing');continue;}
        if(range>d.detect+3){setState(e,'idle',1);continue;}
        if(e.type==='wraith'&&e.abilityCooldown<=0&&range<5&&sight){
          const angle=e.aim+Math.PI/2,x=e.x+Math.cos(angle)*2,y=e.y+Math.sin(angle)*2;
          if(api.free(x,y,e.r)&&distance({x,y},p)>1.5&&visible(e,{x,y})){api.effect(e.x,e.y,d.color,8,1);e.x=x;e.y=y;api.effect(x,y,d.color,8,1);setState(e,'recovering',.4);}e.abilityCooldown=4.5;continue;
        }
        if(e.cooldown<=0&&range<(e.type==='brute'&&e.abilityCooldown>0?1.3:d.range)&&sight&&attackers<limits.attackers){prepare(e,p);attackers++;continue;}
        if(d.ranged&&range<3&&sight)navigate(e,p,dt,true);
        else if(!d.ranged||range>d.range*.8||!sight)navigate(e,p,dt);
      }
      // Bounded local separation; skip committed attacks so the ground warnings stay accurate.
      for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
        const a=active[i],b=active[j],length=distance(a,b),gap=a.r+b.r+.12;if(length>=gap)continue;
        const dx=(a.x-b.x)/(length||1)||1,dy=(a.y-b.y)/(length||1),push=Math.min(.035,(gap-length)*.3);
        if(!['preparing','attacking','stunned'].includes(a.state))api.move(a,dx*push,dy*push);
        if(!['preparing','attacking','stunned'].includes(b.state))api.move(b,-dx*push,-dy*push);
      }
      for(let i=hazards.length-1;i>=0;i--){const h=hazards[i];h.age+=dt;
        if(h.owner&&(h.owner.dead||h.owner.state==='stunned'&&h.interruptible!==false)&&h.age<h.warning&&h.cancelOnStun)h.spent=true;
        if(h.age>=h.warning&&!h.spent&&h.age<h.warning+h.duration){
          if(h.age>=h.nextTick){h.nextTick=h.age+h.interval;
            if(h.damage>0&&contains(h,p)&&(!h.owner||visible(h,p))){api.hurt(h.damage,undefined,undefined,h.kind);if(h.poison)status('poison',2.5,h.poison,1);}
            if(h.oneShot)h.spent=true;
          }
        }
        if(h.age>=h.warning+h.duration||(h.spent&&h.age<h.warning)){hazards.splice(i,1);if(pool.length<limits.hazards)pool.push(h);}
      }
    }
    function reset(){while(hazards.length)pool.push(hazards.pop());statuses.length=0;clock=0;}
    return {tick,reset,hazards,statuses,addHazard,contains,visible,stun,status,targetStatus,cancel,get clock(){return clock}};
  }
  const api=Object.freeze({definitions,limits,states,create,damage,createRuntime});
  if(typeof module!=='undefined')module.exports=api;else window.VesperEnemies=api;
})();
