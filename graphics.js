/* Presentation settings only. Never changes simulation, collision or equipment statistics. */
(()=>{'use strict';
const presets=Object.freeze({low:Object.freeze({label:'Low',pixelRatio:.85,detail:0,lights:0,particles:36,bump:false}),medium:Object.freeze({label:'Medium',pixelRatio:1.25,detail:1,lights:2,particles:72,bump:true}),high:Object.freeze({label:'High',pixelRatio:1.75,detail:2,lights:3,particles:120,bump:true})});
const themes=Object.freeze([
 {name:'Forgotten Crypt',stone:'#717e87',floor:'#46515c',trim:'#999e99',fog:'#172c40',ambient:'#9bb8dc',accent:'#82b8d0',cloth:'#3c4c66',metal:'#797a70'},
 {name:'Plague Halls',stone:'#627566',floor:'#39483b',trim:'#8d9776',fog:'#1d3024',ambient:'#a6bd99',accent:'#afd46b',cloth:'#53603b',metal:'#77734c'},
 {name:'Crimson Chapel',stone:'#645c68',floor:'#383442',trim:'#a5988b',fog:'#2c1d2c',ambient:'#b4a8d0',accent:'#f27969',cloth:'#812d43',metal:'#af8958'},
 {name:'Hollow Sanctum',stone:'#586979',floor:'#343f50',trim:'#9aa9ae',fog:'#162c3c',ambient:'#86bcd8',accent:'#8cdaef',cloth:'#38435f',metal:'#788b96'},
 {name:'Throne of Ash',stone:'#545353',floor:'#353335',trim:'#a99368',fog:'#272630',ambient:'#b6b1c7',accent:'#e5b969',cloth:'#4e3547',metal:'#b19459'}
].map(Object.freeze));
const choose=(saved,mobile)=>presets[saved]?saved:mobile?'low':'medium';
const api={presets,themes,choose,current:'medium',set(value){if(!presets[value])return false;this.current=value;try{localStorage.setItem('vesperGraphics',value)}catch{};if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('vesper-graphics-change',{detail:value}));return true;}};
if(typeof module!=='undefined')module.exports=api;else{let saved;try{saved=localStorage.getItem('vesperGraphics')}catch{};api.current=choose(saved,matchMedia('(pointer: coarse)').matches||innerWidth<650);window.VesperGraphics=api;const select=document.getElementById('graphics-quality');if(select){select.value=api.current;select.addEventListener('change',()=>api.set(select.value));select.addEventListener('keydown',e=>e.stopPropagation());}document.body.classList.toggle('quality-low',api.current==='low');window.addEventListener('vesper-graphics-change',()=>document.body.classList.toggle('quality-low',api.current==='low'));}
})();
