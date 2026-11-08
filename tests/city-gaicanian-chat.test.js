'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Exercise the production registration, including validation order, rather than a copied handler.
const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const handler=source.slice(source.indexOf('  socket.on("city:message", (data, ack) => {'),source.indexOf('  socket.on("city:casino:reaction"'));
function setup(){
 let receive;const heard=[],emitted=[],p={id:'alice',name:'Alice',x:1080,y:1740,lastMessageAt:0};
 const socket={on:(event,fn)=>{assert.equal(event,'city:message');receive=fn;},emit:(event,data)=>emitted.push({event,data})};
 const state={p,heard,emitted,respond:async()=>({ok:true})};
 vm.runInNewContext(handler,{socket,cityFind:()=>state.p,cityPlayers:new Map([[p.id,p]]),io:{to:room=>({emit:(event,data)=>emitted.push({room,event,data})})},CITY_ROOM:'city',CITY_CASINO_ROOM:'casino',Date,cleanShortText:(s,max)=>typeof s==='string'?s.trim().slice(0,max):'',findBannedWord:s=>s.includes('blocked'),ABUSE_WORD_MESSAGE:'blocked',gaicanians:{hear:(...args)=>{heard.push(args);return state.respond();}}});
 state.send=data=>{let reply;receive(data,r=>reply=r);return reply;};return state;
}
test('validated public street messages reach the resident engine after immediate player acknowledgement',async()=>{
 const h=setup();let resolve;h.respond=()=>new Promise(r=>resolve=r);
 assert.ok(h.send({text:'Hello',id:'nela',x:9999,y:9999}).ok);assert.equal(h.heard.length,1);assert.equal(h.heard[0][0],h.p);assert.equal(h.heard[0][1],'Hello');
 assert.ok(h.emitted.some(e=>e.event==='city:message'&&e.data.id==='alice'));resolve({error:'provider unavailable'});await new Promise(r=>setImmediate(r));assert.ok(h.emitted.some(e=>e.event==='city:error'&&e.data.message==='provider unavailable'));
});
test('blocked, empty, rate-limited and occupied messages never reach residents',()=>{
 const h=setup();for(const text of ['', 'blocked'])assert.ok(h.send({text}).error);
 h.p.lastMessageAt=Date.now();assert.ok(h.send({text:'Hello'}).error);h.p.lastMessageAt=0;
 for(const field of ['rideId','gameId']){h.p[field]='occupied';assert.ok(h.send({text:'Hello'}).error);delete h.p[field];}
 h.p.interiorId='garden';assert.ok(h.send({text:'Hello'}).error);assert.equal(h.heard.length,0);
});
test('casino messages keep their existing room and do not reach street residents',()=>{
 const h=setup();h.p.interiorId='neon-casino';assert.ok(h.send({text:'Hello casino'}).ok);assert.equal(h.heard.length,0);assert.ok(h.emitted.some(e=>e.room==='casino'));
});
