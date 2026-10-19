/* Presentation timing only. Never writes an enemy, hazard, cooldown or combat state. */
(()=>{'use strict';
const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{v=clamp(v);return v*v*(3-2*v)};
const definitions=Object.freeze({
 snakeling:Object.freeze({deathDuration:1.8,barHeight:2.55,flameCount:0}),
 flameghoul:Object.freeze({deathDuration:2.1,barHeight:3.1,flameCount:18}),
 king:Object.freeze({deathDuration:4,barHeight:3.35,flameCount:0})
});
const budgets=Object.freeze({low:Object.freeze({flames:8,hazardMotes:48,debris:12}),medium:Object.freeze({flames:14,hazardMotes:96,debris:24}),high:Object.freeze({flames:18,hazardMotes:144,debris:36})});
function pose(enemy,time,{action=null,sequence=null,moving=false}={}){
 const id=enemy.bossId,def=definitions[id]||definitions.king,dead=!!enemy.dead,victory=dead&&id==='king'&&sequence?.kind==='victory',elapsed=victory?sequence.elapsed:Math.max(0,time-(enemy.deadAt??time)),death=dead?clamp(elapsed/def.deathDuration):0;
 const preparing=!dead&&enemy.state==='preparing',attacking=!dead&&enemy.state==='attacking',stunned=!dead&&enemy.state==='stunned',warning=action?.warning||1,attackPhase=action?clamp((action.elapsed-warning)/Math.max(.2,action.duration)):0;
 return {id,animation:dead?'death':stunned?'stunned':enemy.hit>0?'hit':preparing?'windup':attacking?'attack':moving?'movement':'idle',clock:time+(sequence?.elapsed||0),moving:!dead&&!stunned&&moving,preparing,attacking,stunned,windup:preparing?clamp((action?.elapsed||0)/warning):0,strike:attacking?Math.sin(Math.PI*clamp(attackPhase*2.5)):0,attackPhase,hit:!dead?clamp((enemy.hit||0)/.19):0,death,collapse:dead?smooth(death):0,kneel:dead&&id==='king'?(victory?smooth(elapsed/.85):1):0,drop:dead&&id==='king'?(victory?smooth((elapsed-.85)/.65):1):0,candleFlare:victory?smooth((elapsed-1.15)/.3)*(1-.35*smooth((elapsed-3.2)/.8)):0,rubble:victory?smooth((elapsed-1.7)/.8):0,victory,elapsed};
}
// Local samples lie strictly inside the same geometry used by damage. Transform
// them by h.angle and h.x/y at draw time, including moving walls/rotating crosses.
function sampleHazard(h,contains,count=36){
 const radius=h.radius||1,hw=h.shape==='wall'||h.shape==='rect'?h.width/2:radius,hh=h.shape==='wall'||h.shape==='rect'?h.height/2:radius;
 let minX=-hw,maxX=hw,minY=-hh,maxY=hh;if(h.shape==='polygon'&&h.points?.length){minX=Math.min(...h.points.map(p=>p[0]));maxX=Math.max(...h.points.map(p=>p[0]));minY=Math.min(...h.points.map(p=>p[1]));maxY=Math.max(...h.points.map(p=>p[1]));}
 const local={...h,x:0,y:0,angle:0},points=[];for(let i=1;i<=count*24&&points.length<count;i++){const x=minX+(maxX-minX)*((i*.61803398875)%1),y=minY+(maxY-minY)*((i*.41421356237)%1),padding=.12;
  if([[0,0],[padding,0],[-padding,0],[0,padding],[0,-padding]].every(([dx,dy])=>contains(local,{x:x+dx,y:y+dy})))points.push({x,y,phase:i*.71});}
 return points;
}
const api=Object.freeze({definitions,budgets,pose,sampleHazard});if(typeof module!=='undefined')module.exports=api;else window.VesperBossPresentation=api;
})();
