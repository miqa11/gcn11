'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCityLife}=require('../server-city-life'),data=require('../city-life-data'),world=require('../city-world');
function setup(at=10000){let time=at;const a={id:'a',userKey:'alice',name:'ალისა',x:620,y:335},b={id:'b',userKey:'bob',name:'ბობი',x:620,y:335};const players=new Map([[a.id,a],[b.id,b]]),events=[];const io={to:room=>({emit:(event,value)=>events.push({room,event,value})})};const engine=createCityLife({io,players,world,roomName:'city',now:()=>time});return {engine,a,b,players,events,time:at=>time=at,advance:ms=>{time+=ms;engine.tick();}};}

test('all events and pickups use walkable outdoor locations',()=>{
 for(const p of [...data.events,...data.litter])assert.ok(world.isWalkable(p.x,p.y,11));assert.equal(new Set(data.litter.map(p=>p.id)).size,12);
});
test('two citizens share cleanup progress; removed items cannot be replayed',()=>{
 const h=setup(),id=h.engine.state().event.id;
 for(let i=0;i<data.litter.length;i++){const p=i%2?h.a:h.b;Object.assign(p,{x:data.litter[i].x,y:data.litter[i].y});assert.ok(h.engine.act(p,{eventId:id,targetId:data.litter[i].id}).ok);}
 const view=h.engine.state();assert.equal(view.event.done,true);assert.equal(view.event.progress,12);assert.equal(view.event.contributors.length,2);assert.equal(view.event.litter.length,0);
 assert.ok(h.engine.act(h.a,{eventId:id,targetId:'litter-0'}).error);assert.equal(h.engine.state().event.progress,12);assert.ok(h.events.some(e=>e.event==='city:life:state'));
});
test('distance, occupied activity, stale events and removed players reject contributions',()=>{
 const h=setup(),id=h.engine.state().event.id;h.a.x=2000;assert.ok(h.engine.act(h.a,{eventId:id,targetId:'litter-0'}).error);
 h.a.x=620;h.a.gameId='game';assert.ok(h.engine.act(h.a,{eventId:id,targetId:'litter-0'}).error);h.a.gameId=null;
 assert.ok(h.engine.act(h.a,{eventId:'old',targetId:'litter-0'}).error);h.players.delete(h.a.id);assert.ok(h.engine.act(h.a,{eventId:id,targetId:'litter-0'}).error);
});
test('event rotation reaches every client and late joiners receive the same event',()=>{
 const h=setup();const old=h.engine.state().event.id;h.time(data.duration+600);h.engine.tick();assert.equal(h.engine.state().event.kind,'concert');assert.notEqual(h.engine.state().event.id,old);
 const handlers={};h.engine.attach({id:h.b.id,on:(event,fn)=>handlers[event]=fn});let reply;handlers['city:life:sync']({},r=>reply=r);assert.equal(reply.state.event.id,h.engine.state().event.id);
});
test('concert checks the server beat and prevents repeated taps in one beat',()=>{
 const h=setup(data.duration+100),id=h.engine.state().event.id;Object.assign(h.a,data.events[1]);assert.ok(h.engine.act(h.a,{eventId:id}).error);
 h.time(data.duration+600);assert.ok(h.engine.act(h.a,{eventId:id}).ok);assert.ok(h.engine.act(h.a,{eventId:id}).error);
 h.time(data.duration+1800);assert.ok(h.engine.act(h.a,{eventId:id}).ok);assert.equal(h.engine.state().event.progress,2);
});
test('pet reactions use synchronized animal positions, enforce cooldowns and expire',()=>{
 const h=setup(),animal=world.animals[0];const first=data.animalAt(animal,10000);Object.assign(h.a,{x:first.x,y:first.y});assert.ok(h.engine.pet(h.a,animal.id).ok);assert.equal(h.engine.state().reactions.length,1);assert.ok(h.engine.pet(h.a,animal.id).error);
 h.advance(5000);assert.equal(h.engine.state().reactions.length,0);const next=data.animalAt(animal,15000);Object.assign(h.a,{x:next.x,y:next.y});assert.ok(h.engine.pet(h.a,animal.id).ok);h.b.x=0;assert.ok(h.engine.pet(h.b,animal.id).error);
});
test('socket endpoints reject malformed/unknown targets and rate limit spam',()=>{
 const h=setup(),handlers={};h.engine.attach({id:h.a.id,on:(event,fn)=>handlers[event]=fn});let result;
 handlers['city:life:act'](null,r=>result=r);assert.ok(result.error);handlers['city:life:pet']({animalId:'__proto__'},r=>result=r);assert.ok(result.error);
 for(let i=0;i<10;i++)handlers['city:life:sync']({},r=>result=r);assert.ok(result.error);h.engine.remove(h.a.id);handlers['city:life:sync']({},r=>result=r);assert.ok(result.ok);
});
test('a wall prevents petting from the other side',()=>{
 const h=setup(),wall=world.blockers.find(r=>r.w>50&&r.h>50);const animal={id:'test-pet',kind:'cat',x:wall.x+5,y:wall.y+10};
 const isolated=createCityLife({io:{to:()=>({emit(){}})},players:h.players,world:{...world,animals:[animal]},roomName:'city',now:()=>10000});
 Object.assign(h.a,{x:wall.x-5,y:wall.y+10});assert.ok(isolated.pet(h.a,'test-pet').error);
});
