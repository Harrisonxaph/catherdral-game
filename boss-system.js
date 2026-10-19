/* Data-driven encounters. Simulation time only; no renderer or DOM dependencies. */
(()=>{'use strict';
const definitions=Object.freeze({1:Object.freeze({id:'snakeling',name:'The Snakeling',windup:1.3,recovery:1.6,interval:2.2,damage:12}),3:Object.freeze({id:'flameghoul',name:'The Flameghoul',windup:1.6,recovery:1.7,interval:1.8,damage:19}),5:Object.freeze({id:'king',name:'The Undead King',windup:1.3,recovery:1.5,interval:1.7,damage:24})});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function createRuntime(api){let boss=null,room=null,config=null,candles=[],active=false,turn=0,action=null,sequence=null,axes=[],clock=0,lastExtinguish=0;
const inside=p=>p.x>=room.x&&p.x<=room.x+room.w&&p.y>=room.y&&p.y<=room.y+room.h;
function clearHazards(){for(const h of api.combat.hazards)if(h.bossOwned)h.spent=true;}
function reset(e,r,floor){clearHazards();boss=e;room=r;config=definitions[floor];candles=[];active=false;turn=0;action=null;sequence=null;axes=[];clock=0;lastExtinguish=0;
 if(!boss||!config)return;Object.assign(boss,{isBoss:true,bossId:config.id,bossName:config.name,state:'idle',stateTime:0,cooldown:1.2,stunLock:0,statuses:[],controlResistance:{durationCap:.75,postRecoveryImmunity:2},attackInterruptible:true,majorMechanicActive:false});
 if(config.id==='king')candles=[[1.3,1.3],[r.w-1.3,1.3],[1.3,r.h-1.3],[r.w-1.3,r.h-1.3]].map(([x,y],i)=>({id:i,x:r.x+x,y:r.y+y,lit:false}));
}
function cinematic(kind){sequence={kind,elapsed:0,duration:kind==='victory'?4:3};api.clearInput();api.sequence?.(sequence);}
function skip(){if(!sequence)return false;const kind=sequence.kind;sequence=null;api.sequence?.(null);if(kind==='awakening'){clock=0;lastExtinguish=0;active=true;boss.state='recovering';boss.stateTime=1.4;}return true;}
function nearestCandle(){if(!boss||boss.dead||!api.ready()||sequence)return null;return candles.filter(c=>!c.lit&&distance(c,api.player())<1.65).sort((a,b)=>distance(a,api.player())-distance(b,api.player()))[0]||null;}
function interact(){const c=nearestCandle();if(!c)return false;c.lit=true;api.effect(c.x,c.y,'#ffd28a',8,1);if(!active&&candles.every(c=>c.lit))cinematic('awakening');return true;}
function modifyDamage(e,damage){if(e!==boss)return damage;if(!active||!inside(api.player()))return 0;return damage*(candles.some(c=>!c.lit)?.2:1);}
function hazard(options){return api.combat.addHazard({owner:boss,bossOwned:true,interruptible:false,cancelOnStun:false,interval:.75,damage:config.damage,warning:config.windup,duration:.3,kind:config.id==='snakeling'?'poison':'fire',color:config.id==='snakeling'?'#91d34e':'#ff8545',...options});}
function halfPolygon(angle){let poly=[[room.x,room.y],[room.x+room.w,room.y],[room.x+room.w,room.y+room.h],[room.x,room.y+room.h]],out=[];const side=p=>(p[0]-boss.x)*Math.cos(angle)+(p[1]-boss.y)*Math.sin(angle);for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=side(a),db=side(b);if(da>=0)out.push([a[0]-boss.x,a[1]-boss.y]);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t-boss.x,a[1]+(b[1]-a[1])*t-boss.y]);}}return out;}
function begin(name){const p=api.player(),enraged=boss.hp<boss.maxHp*.5;boss.enraged=enraged;boss.aim=Math.atan2(p.y-boss.y,p.x-boss.x);boss.action=name;boss.state='preparing';boss.attackInterruptible=['melee','acid'].includes(name);boss.majorMechanicActive=!boss.attackInterruptible;let h=null,duration=.3;
 if(name==='acid'){duration=10;const x=p.x,y=p.y;h=hazard({x,y,radius:.85,warning:1.5,duration,interruptible:true,cancelOnStun:true,acidFlight:{x:boss.x,y:boss.y}});}
 if(name==='cross'){duration=enraged?4:3.5;h=hazard({x:boss.x,y:boss.y,shape:'cross',radius:Math.min(room.w,room.h)*.34,width:.65,angle:boss.aim,angularSpeed:enraged?.9:.55,duration,warning:1.5});}
 if(name==='wall'){duration=(room.h+.7)/1.5;h=hazard({x:room.x+room.w/2,y:room.y+.05,shape:'wall',width:room.w,height:.65,gap:2.8,gapX:clamp(p.x-(room.x+room.w/2),-room.w/2+1.6,room.w/2-1.6),velocityY:1.5,duration,warning:1.8});}
 if(name==='half'){h=hazard({x:boss.x,y:boss.y,shape:'polygon',points:halfPolygon(boss.aim),warning:1.65,duration:.35});}
 if(name==='melee'){h=hazard({x:boss.x+Math.cos(boss.aim)*.75,y:boss.y+Math.sin(boss.aim)*.75,radius:.95,warning:.7,duration:.2,interruptible:true,cancelOnStun:true});}
 if(name==='whirlwind'){duration=enraged?3:2.3;h=hazard({x:boss.x,y:boss.y,radius:2.5,warning:1.4,duration,kind:'physical',color:'#e4c295'});}
 if(name==='axe'){duration=Infinity;axes=axes.filter(h=>!h.spent);if(axes.length>=3)axes.shift().spent=true;const candidates=[{x:clamp(p.x,room.x+3,room.x+room.w-3),y:clamp(p.y,room.y+3,room.y+room.h-3)},...[[3,3],[room.w-3,3],[3,room.h-3],[room.w-3,room.h-3],[room.w/2,room.h/2]].map(([x,y])=>({x:room.x+x,y:room.y+y}))];const target=candidates.find(t=>axes.every(a=>distance(a,t)>2.8)&&distance(t,boss)>2.8)||candidates[0];h=hazard({...target,radius:1.05,warning:1.6,duration,kind:'physical',color:'#d2b4e2',axe:true,tossFlight:{x:boss.x,y:boss.y}});if(h)axes.push(h);}
 if(name==='extinguish'){boss.stateTime=1;action={name,elapsed:0,warning:1,duration:0,h:null};api.notice('THE KING DRAWS BREATH','A candle is about to go dark');return;}
 if(!h){boss.state='recovering';boss.stateTime=1;boss.majorMechanicActive=false;boss.attackInterruptible=true;return;}
 boss.stateTime=h.warning;action={name,elapsed:0,warning:h.warning,duration:name==='acid'||duration===Infinity?.35:duration,h};
}
function choose(){const id=config.id;if(id==='snakeling'){const pools=api.combat.hazards.filter(h=>h.bossOwned&&h.acidFlight&&!h.spent&&h.age<h.warning+h.duration);if(turn%3===2){if(pools.length)return null;turn++;return 'cross';}if(pools.length>=2)return null;turn++;return 'acid';}turn++;if(id==='flameghoul')return ['wall','melee','half','melee'][((turn-1)%4)];if(clock-lastExtinguish>(boss.hp<boss.maxHp*.5?10:17)&&candles.some(c=>c.lit)){lastExtinguish=clock;return 'extinguish';}return ['melee','whirlwind','axe','whirlwind'][(turn-1)%4];}
function defeat(e){if(e!==boss)return;active=false;action=null;clearHazards();boss.majorMechanicActive=false;boss.attackInterruptible=true;if(config.id==='king')cinematic('victory');else api.notice(config.name.toUpperCase()+' FALLS','The chamber is safe. Claim your reward.');}
function tick(dt){if(sequence){sequence.elapsed+=dt;if(sequence.elapsed>=sequence.duration)skip();return;}if(!boss||boss.dead)return;clock+=dt;boss.hit=Math.max(0,(boss.hit||0)-dt);boss.phase+=dt;boss.enraged=boss.hp<boss.maxHp*.5;
 if(!active){if(config.id!=='king'&&api.ready()&&inside(api.player())){active=true;boss.state='recovering';boss.stateTime=1.4;api.notice(config.name.toUpperCase(),'Watch the ground. Strike during recovery.');}return;}
 if(boss.state==='stunned'){if(action&&['melee','acid'].includes(action.name)){if(action.h&&action.elapsed<action.warning)action.h.spent=true;action=null;}return;}
 if(!inside(api.player())){if(action){action=null;for(const h of api.combat.hazards)if(h.bossOwned&&!h.axe)h.spent=true;}boss.state='recovering';boss.stateTime=1;boss.majorMechanicActive=false;boss.attackInterruptible=true;return;}
 if(action){action.elapsed+=dt;const a=action;if(a.elapsed>=a.warning&&boss.state==='preparing'){boss.state='attacking';if(a.name==='extinguish'){const c=candles.filter(c=>c.lit)[turn%candles.filter(c=>c.lit).length];if(c)c.lit=false;api.notice('THE CROWN IS VEILED','Relight the dark candle to break its protection');}}
  if(a.elapsed>=a.warning+a.duration){action=null;boss.state='recovering';boss.stateTime=config.recovery;boss.majorMechanicActive=false;boss.attackInterruptible=true;}return;}
 if(boss.state==='recovering'){boss.stateTime-=dt;if(boss.stateTime>0)return;boss.state='chasing';boss.cooldown=config.interval*(boss.enraged?.72:1);}
 boss.cooldown=Math.max(0,boss.cooldown-dt);const p=api.player(),d=distance(boss,p);boss.aim=Math.atan2(p.y-boss.y,p.x-boss.x);
 if(d>1.7){const speed=config.id==='snakeling'?.65:boss.enraged?1.3:1;const dx=Math.cos(boss.aim)*speed*dt,dy=Math.sin(boss.aim)*speed*dt;if(boss.x+dx>room.x+1&&boss.x+dx<room.x+room.w-1&&boss.y+dy>room.y+1&&boss.y+dy<room.y+room.h-1)api.move(boss,dx,dy);}
 if(boss.cooldown<=0){const next=choose();if(next)begin(next);else boss.cooldown=.7;}
}
return {reset,tick,begin,interact,nearestCandle,modifyDamage,defeat,skip,get boss(){return boss},get candles(){return candles},get active(){return active},get action(){return action},get sequence(){return sequence},get protected(){return candles.some(c=>!c.lit)}};
}
const api=Object.freeze({definitions,createRuntime});if(typeof module!=='undefined')module.exports=api;else window.VesperBosses=api;
})();
