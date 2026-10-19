/* Data and layout only: the existing simulation and both renderers consume this world. */
(() => {
  const floors = [
    {name:'The Forgotten Crypt', roster:['bone','guardian'], columns:3, rows:4, roomSize:10, loops:1, enemies:2, health:1, damage:1.09, final:'boss', guards:1, bossHealth:165},
    {name:'Plague Halls', roster:['ghoul','plague','guardian'], columns:4, rows:4, roomSize:11, loops:2, enemies:3, health:1.22, damage:1.2, final:'elite', guards:2},
    {name:'Crimson Chapel', roster:['brute','summoner','cultist'], columns:4, rows:5, roomSize:12, loops:3, enemies:3, health:1.48, damage:1.34, final:'boss', guards:2, bossHealth:440},
    {name:'Hollow Sanctum', roster:['wraith','brute','guardian','cultist','plague','summoner'], columns:5, rows:5, roomSize:13, loops:4, enemies:4, health:1.78, damage:1.5, final:'elite', guards:3},
    {name:'Throne of Ash', roster:['bone','guardian','ghoul','plague','brute','summoner','cultist','wraith'], columns:5, rows:6, roomSize:14, loops:5, enemies:4, health:2.12, damage:1.7, final:'boss', guards:3, bossHealth:680}
  ].map((f,i)=>Object.freeze({...f,roster:Object.freeze(f.roster),number:i+1}));
  function get(number) {
    if(!Number.isInteger(number)||number<1||number>floors.length)throw new RangeError('Unknown floor');
    return floors[number-1];
  }
  function generate(config, random=Math.random) {
    const pitch=config.roomSize+4, W=(config.columns+1)*pitch+6, H=config.rows*pitch+6;
    const g=new Uint8Array(W*H).fill(1), rooms=[], ix=(x,y)=>y*W+x;
    const carve=(x,y)=>{g[ix(x,y)]=0;};
    function room(x,y,w,h){const r={x,y,w,h,cx:Math.floor(x+w/2),cy:Math.floor(y+h/2)};rooms.push(r);for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)carve(xx,yy);return r;}
    function link(a,b){for(let x=Math.min(a.cx,b.cx);x<=Math.max(a.cx,b.cx);x++){carve(x,a.cy);carve(x,a.cy+1);}for(let y=Math.min(a.cy,b.cy);y<=Math.max(a.cy,b.cy);y++){carve(b.cx,y);carve(b.cx+1,y);}}
    // A guaranteed connected winding route, with randomized room extents and optional loops.
    for(let row=0;row<config.rows;row++)for(let col=0;col<config.columns;col++){
      const c=row%2?config.columns-1-col:col;
      const w=config.roomSize-Math.floor(random()*2),h=config.roomSize-Math.floor(random()*2);
      const r=room(3+c*pitch,3+row*pitch,w,h);if(rooms.length>1)link(rooms[rooms.length-2],r);
    }
    for(let n=0;n<config.loops;n++){
      const row=n%(config.rows-1),col=Math.floor(n/(config.rows-1))%config.columns;
      const a=rooms.find(r=>Math.floor((r.x-3)/pitch)===col&&Math.floor((r.y-3)/pitch)===row);
      const b=rooms.find(r=>Math.floor((r.x-3)/pitch)===col&&Math.floor((r.y-3)/pitch)===row+1);link(a,b);
    }
    // The final chamber is outside the exploration grid and has one approach.
    const approach=rooms[rooms.length-1];
    const exit=room(3+config.columns*pitch,approach.y,config.roomSize,config.roomSize);
    link(approach,exit);
    return {W,H,g,rooms,start:rooms[0],exit,config,ix,walk:(x,y)=>x>=0&&y>=0&&x<W&&y<H&&g[ix(x,y)]===0};
  }
  const api=Object.freeze({floors:Object.freeze(floors),get,generate});
  if(typeof module!=='undefined')module.exports=api;
  else window.VesperFloors=api;
})();
