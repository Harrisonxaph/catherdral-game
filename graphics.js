/* Presentation settings only. Never changes simulation, collision or equipment statistics. */
(()=>{'use strict';
const presets=Object.freeze({low:Object.freeze({label:'Low',pixelRatio:.85,detail:0,lights:0,particles:36,bump:false}),medium:Object.freeze({label:'Medium',pixelRatio:1.25,detail:1,lights:2,particles:72,bump:true}),high:Object.freeze({label:'High',pixelRatio:1.75,detail:2,lights:3,particles:120,bump:true})});
const themes=Object.freeze([
 {name:'Forgotten Crypt',stone:'#717e87',floor:'#46515c',trim:'#999e99',fog:'#172c40',ambient:'#9bb8dc',accent:'#82b8d0',cloth:'#3c4c66',metal:'#797a70',torch:'#ffb46a',exposure:1.2,fogDensity:.022,grade:'#050c16',motes:Object.freeze({color:'#b9c3cc',speed:.05,size:1.4})},
 {name:'Plague Halls',stone:'#627566',floor:'#39483b',trim:'#8d9776',fog:'#1d3024',ambient:'#a6bd99',accent:'#afd46b',cloth:'#53603b',metal:'#77734c',torch:'#e2d16a',exposure:1.15,fogDensity:.026,grade:'#07120a',motes:Object.freeze({color:'#b8d46a',speed:.08,size:1.9})},
 {name:'Crimson Chapel',stone:'#645c68',floor:'#383442',trim:'#a5988b',fog:'#2c1d2c',ambient:'#b4a8d0',accent:'#f27969',cloth:'#812d43',metal:'#af8958',torch:'#ff8a6e',exposure:1.2,fogDensity:.018,grade:'#16050d',motes:Object.freeze({color:'#dccbd8',speed:.12,size:2.4})},
 {name:'Hollow Sanctum',stone:'#586979',floor:'#343f50',trim:'#9aa9ae',fog:'#162c3c',ambient:'#86bcd8',accent:'#8cdaef',cloth:'#38435f',metal:'#788b96',torch:'#86d0ff',exposure:1.3,fogDensity:.024,grade:'#030b18',motes:Object.freeze({color:'#9fe3ff',speed:.2,size:1.8})},
 {name:'Throne of Ash',stone:'#545353',floor:'#353335',trim:'#a99368',fog:'#272630',ambient:'#b6b1c7',accent:'#e5b969',cloth:'#4e3547',metal:'#b19459',torch:'#ff9a4a',exposure:1.25,fogDensity:.02,grade:'#120803',lightBase:.6,motes:Object.freeze({color:'#c4bcb3',speed:-.16,size:1.6})}
].map(Object.freeze));
const choose=(saved,mobile)=>presets[saved]?saved:mobile?'low':'medium';
// Baked environment light: per-instance colour multipliers computed once per floor build (no per-frame cost).
const lighting=Object.freeze({base:.7,lantern:.3,radius:4.6,height:1.1,peak:1.15,max:1.8,wallRows:Object.freeze([.74,.88,1]),cap:.6});
const rgb=hex=>{const n=parseInt(hex.slice(1),16);return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];};
function lightField(torches,torch,base=lighting.base){
 const R=lighting.radius,cells=new Map(),key=(x,z)=>x+':'+z,color=rgb(torch);
 for(const t of torches){const k=key(Math.floor(t.x/R),Math.floor(t.y/R));if(!cells.has(k))cells.set(k,[]);cells.get(k).push(t);}
 return function sample(x,y,z){
  let warm=0;const cx=Math.floor(x/R),cz=Math.floor(z/R);
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const t of cells.get(key(cx+i,cz+j))||[]){const dy=lighting.height-y,d=Math.sqrt((t.x-x)**2+(t.y-z)**2+dy*dy*.5);if(d<R)warm+=(1-d/R)**2*lighting.peak;}
  return color.map(c=>Math.min(lighting.max,base+warm*c));
 };
}
// Ambient occlusion for a walkable floor cell: darker beside walls and in corners.
function occlusion(walk,x,y){let n=0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(!walk(x+dx,y+dy))n+=1;for(const [dx,dy] of [[1,1],[1,-1],[-1,1],[-1,-1]])if(!walk(x+dx,y+dy))n+=.5;return Math.max(lighting.cap,1-n*.07);}
const api={presets,themes,choose,lighting,lightField,occlusion,current:'medium',set(value){if(!presets[value])return false;this.current=value;try{localStorage.setItem('vesperGraphics',value)}catch{};if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('vesper-graphics-change',{detail:value}));return true;}};
if(typeof module!=='undefined')module.exports=api;else{let saved;try{saved=localStorage.getItem('vesperGraphics')}catch{};api.current=choose(saved,matchMedia('(pointer: coarse)').matches||innerWidth<650);window.VesperGraphics=api;const select=document.getElementById('graphics-quality');if(select){select.value=api.current;select.addEventListener('change',()=>api.set(select.value));select.addEventListener('keydown',e=>e.stopPropagation());}document.body.classList.toggle('quality-low',api.current==='low');window.addEventListener('vesper-graphics-change',()=>document.body.classList.toggle('quality-low',api.current==='low'));}
})();
