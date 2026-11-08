'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../city-arcade-games.js'),'utf8');
// Run the actual cabinet code with a deterministic clock and a recording canvas.
function harness(game,{random=()=>.01}={}){
 let at=0,serial=0,finished=null;const frames=new Map(),draws=[];
 class Target{constructor(){this.listeners={};}addEventListener(n,f){(this.listeners[n]||=[]).push(f);}removeEventListener(n,f){this.listeners[n]=(this.listeners[n]||[]).filter(x=>x!==f);}dispatch(n,data={}){const e={key:'',code:'',button:0,detail:1,preventDefault(){},target:this,...data};for(const fn of [...this.listeners[n]||[]])fn(e);}}
 const ctx=new Proxy({fillStyle:'',fillRect(x,y,w,h){draws.push({color:this.fillStyle,x,y,w,h});}}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 class Node extends Target{constructor(tag){super();this.tagName=tag.toUpperCase();this.children=[];this.hidden=false;this.visible=true;this.classList={add(){}};}append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}appendChild(n){this.append(n);return n;}replaceChildren(...n){this.children=[];this.append(...n);}getContext(){return ctx;}setAttribute(){}getClientRects(){return this.visible&&!this.hidden?[{}]:[];}closest(){return ['INPUT','TEXTAREA','SELECT'].includes(this.tagName)?this:null;}focus(){}setPointerCapture(){}}
 const window=new Target(),document=new Target();document.hidden=false;document.createElement=t=>new Node(t);
 const math=Object.create(Math);math.random=random;
 vm.runInNewContext(source,{window,document,Math:math,performance:{now:()=>at},Date:{now:()=>at},requestAnimationFrame:f=>{frames.set(++serial,f);return serial;},cancelAnimationFrame:id=>frames.delete(id)});
 const root=new Node('main'),run=window.GaicaniArcadeGames.mount(game,root,{durationMs:60000,onFinish:s=>finished=s});
 function frame(ms){at+=ms;draws.length=0;const batch=[...frames.values()];frames.clear();for(const f of batch)f(at);}
 const key=(name,type='keydown',extra={})=>window.dispatch(type,{key:name,code:name===' '?'Space':name,...extra});
 const piece=()=>draws.filter(d=>d.color==='#54ddff');
 return {root,run,window,document,frame,key,piece,get finished(){return finished;},get time(){return at;}};
}
test('Tetris soft drop has the same speed at 30 and 144 frames per second',()=>{
 const positions=[];for(const fps of [30,144]){const h=harness('tetris');h.key('ArrowDown');while(h.time<450)h.frame(Math.min(1000/fps,450-h.time));positions.push(Math.min(...h.piece().map(p=>p.y)));h.run.destroy();}assert.equal(positions[0],positions[1]);
});
test('releasing one direction preserves another held direction; blur releases all input',()=>{
 const h=harness('tetris');h.key('ArrowLeft');h.key('ArrowRight');h.key('ArrowRight','keyup');h.frame(1);const start=Math.min(...h.piece().map(p=>p.x));h.frame(120);assert.ok(Math.min(...h.piece().map(p=>p.x))<start);h.window.dispatch('blur');h.frame(1);const stopped=Math.min(...h.piece().map(p=>p.x));h.frame(200);assert.equal(Math.min(...h.piece().map(p=>p.x)),stopped);
});
test('minimized games and form fields do not consume movement keys',()=>{
 const h=harness('tetris');h.frame(1);const x=Math.min(...h.piece().map(p=>p.x));h.root.visible=false;h.key('ArrowLeft');h.frame(150);h.root.visible=true;h.key('ArrowRight','keydown',{target:{closest:()=>({})}});h.frame(1);assert.equal(Math.min(...h.piece().map(p=>p.x)),x);
});
test('Tetris can rotate at spawn; holding Space never repeatedly hard-drops pieces',()=>{
 const h=harness('tetris');h.key('ArrowUp');h.frame(1);assert.equal(h.piece().length,2);h.key('ArrowUp','keyup');h.key(' ');h.frame(1);const count=h.piece().length;for(let i=0;i<10;i++)h.key(' ','keydown',{repeat:true});h.frame(1);assert.equal(h.piece().length,count);assert.equal(h.finished,null);
});
test('Snake may move into the tail cell that is vacated on the same move',()=>{
 const values=[144.1/277,21.1/276],h=harness('snake',{random:()=>values.shift()??.01});h.frame(116);assert.equal(h.run.getScore(),10);for(const key of ['ArrowDown','ArrowLeft','ArrowUp']){h.key(key);h.frame(116);}assert.equal(h.finished,null);
});
test('filling the Snake board completes once instead of hanging while placing food',()=>{
 const cycle=[];for(let y=0;y<14;y++)for(let n=0;n<19;n++)cycle.push({x:y%2?19-n:n+1,y});for(let y=13;y>=0;y--)cycle.push({x:0,y});cycle.reverse();let index=cycle.findIndex(p=>p.x===6&&p.y===7),food=null;
 const snake=[{x:6,y:7},{x:5,y:7},{x:4,y:7}];
 const h=harness('snake',{random:()=>{if(food)snake.unshift(food);food=cycle[(index+1)%cycle.length];const occupied=new Set(snake.map(p=>p.y*20+p.x)),empty=[];for(let y=0;y<14;y++)for(let x=0;x<20;x++)if(!occupied.has(y*20+x))empty.push({x,y});const i=empty.findIndex(p=>p.x===food.x&&p.y===food.y);assert.ok(i>=0);return(i+.1)/empty.length;}});
 for(let n=0;n<277;n++){const next=cycle[(index+1)%cycle.length],head=cycle[index],dx=next.x-head.x,dy=next.y-head.y;h.key(dx>0?'ArrowRight':dx<0?'ArrowLeft':dy>0?'ArrowDown':'ArrowUp');index=(index+1)%cycle.length;h.frame(116);}assert.equal(h.finished,2770);assert.equal(h.run.getScore(),2770);
});


test('keyboard and touch holds are independent, and rotation cancels held controls',()=>{
 const h=harness('tetris'),right=h.root.children[2].children.find(b=>b.textContent==='→');h.key('ArrowLeft');right.dispatch('pointerdown',{pointerId:7});h.key('ArrowLeft','keyup');h.frame(1);const first=Math.min(...h.piece().map(p=>p.x));h.frame(120);assert.ok(Math.min(...h.piece().map(p=>p.x))>first);h.window.dispatch('resize');h.frame(1);const stop=Math.min(...h.piece().map(p=>p.x));h.frame(150);assert.equal(Math.min(...h.piece().map(p=>p.x)),stop);right.dispatch('pointercancel',{pointerId:7});
});
