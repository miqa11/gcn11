'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createWorldGames,ROUTE}=require('../city-world-games-engine');
const vehicles=require('../city-vehicles'),world=require('../city-world');
const {createCityMotionController}=require('../server-city-motion');
function setup(count=8){
 let time=100000;const players=new Map(),sockets=new Map(),broadcasts=[];
 for(let i=0;i<count;i++){
  const id='p'+i;players.set(id,{id,userKey:id,name:id,x:2200,y:1620+i*25,dir:'right',inputX:0,inputY:0});
  sockets.set(id,{id,events:[],handlers:{},emit(event,data){this.events.push({event,data});},on(event,fn){this.handlers[event]=fn;}});
 }
 const io={sockets:{sockets},to:()=>({emit:(event,data)=>broadcasts.push({event,data})})};
 const garage=vehicles.createGarage(world,{players,now:()=>time});
 let blocked=false;
 const engine=createWorldGames({io,players,world,garage,roomName:'city',now:()=>time,canPlayTogether:()=>!blocked});
 for(const s of sockets.values())engine.bind(s);
 function call(id,event,data={}){time+=500;let result;sockets.get(id).handlers['city:world:'+event](data,r=>result=r);return result;}
 function room(){return [...engine.rooms.values()][0];}
 function accept(host,id){assert.ok(call(host,'invite',{targetId:id}).ok);const i=sockets.get(id).events.findLast(e=>e.event==='city:world:invited').data;assert.ok(call(id,'respond',{id:i.id,accept:true}).ok);}
 function ready(game,n=2){assert.ok(call('p0','create',{game}).ok);for(let i=1;i<n;i++)accept('p0','p'+i);assert.ok(call('p0','start').ok);time=room().startAt;engine.tick();return room();}
 return {engine,players,garage,sockets,broadcasts,call,room,accept,ready,advance:ms=>{time+=ms;engine.tick();},setTime:t=>time=t,block:()=>blocked=true};
}

test('host-only start, 2–6 accepted members, pending seats and decline',()=>{
 const h=setup();h.call('p0','create',{game:'tag'});assert.ok(h.call('p0','start').error);
 for(let i=1;i<=5;i++)assert.ok(h.call('p0','invite',{targetId:'p'+i}).ok);
 assert.ok(h.call('p0','invite',{targetId:'p6'}).error);
 const i=h.sockets.get('p1').events.findLast(e=>e.event==='city:world:invited').data;
 assert.ok(h.call('p2','respond',{id:i.id,accept:true}).error);
 assert.ok(h.call('p1','respond',{id:i.id,accept:false}).ok);
 assert.ok(h.call('p0','invite',{targetId:'p6'}).ok);
 assert.ok(h.call('p1','start').error);
});

test('invitation expiry and competing invitations cannot join two lobbies',()=>{
 const h=setup();h.call('p0','create',{game:'battle'});h.call('p0','invite',{targetId:'p1'});
 const i=h.sockets.get('p1').events.findLast(e=>e.event==='city:world:invited').data;
 h.call('p2','create',{game:'race'});assert.ok(h.call('p2','invite',{targetId:'p1'}).error);
 h.advance(31000);assert.ok(h.call('p1','respond',{id:i.id,accept:true}).error);
 assert.ok(h.call('p2','invite',{targetId:'p1'}).ok);
});

test('six racers get equal temporary cars; ordered checkpoints decide winner and cars are cleaned',()=>{
 const h=setup(),r=h.ready('race',6);assert.equal(h.garage.list().filter(v=>v.worldGameId).length,6);
 assert.equal(new Set(h.garage.list().filter(v=>v.worldGameId).map(v=>v.speed)).size,1);
 const p=h.players.get('p0');Object.assign(p,ROUTE[2]);h.engine.tick();assert.equal(r.stats.p0.checkpoint,0);
 for(const cp of ROUTE){Object.assign(p,cp);h.engine.tick();}
 assert.equal(r.phase,'finished');assert.deepEqual(r.result.winners,['p0']);
 assert.equal(h.garage.list().filter(v=>v.worldGameId).length,0);assert.equal(p.vehicleId,null);assert.equal(p.x,2200);
 p.x+=100;p.inputX=1;
 h.advance(13000);assert.equal(h.engine.rooms.size,0);assert.equal(p.gameId,null);
 assert.equal(p.x,2300);assert.equal(p.inputX,1);
});

test('race cars participate in authoritative movement; countdown freezes and old epochs reset',()=>{
 const h=setup();h.call('p0','create',{game:'race'});h.accept('p0','p1');h.call('p0','start');
 const p=h.players.get('p0'),controller=createCityMotionController(world,h.garage),initial=controller.view(p);
 assert.equal(initial.blocked,true);h.setTime(h.room().startAt);h.engine.tick();const active=controller.view(p);
 assert.equal(active.blocked,false);assert.ok(active.epoch>initial.epoch);
 const x=p.x;controller.process(p,{epoch:active.epoch,commands:[{seq:1,x:1,y:0,dt:50}]});assert.ok(p.x>x);
 assert.ok(controller.process(p,{epoch:initial.epoch,commands:[{seq:1,x:1,y:0,dt:50}]}).reset);
});

test('tag requires continuous two seconds; breaking contact resets progress',()=>{
 const h=setup(),r=h.ready('tag');const seeker=h.players.get(r.seekerId),runner=h.players.get(r.ids.find(id=>id!==r.seekerId));
 Object.assign(runner,{x:seeker.x+10,y:seeker.y});h.engine.tick();h.advance(1900);assert.equal(r.stats[runner.id].out,false);
 runner.x+=100;h.advance(50);assert.equal(r.stats[runner.id].hold,0);
 runner.x=seeker.x+10;h.advance(100);h.advance(1999);assert.equal(r.stats[runner.id].out,false);h.advance(1);assert.equal(r.stats[runner.id].out,true);assert.equal(r.phase,'finished');
});

test('hide seeker is frozen for 20 seconds and cannot capture before hiding time ends',()=>{
 const h=setup(),r=h.ready('hide'),seeker=h.players.get(r.seekerId),runner=h.players.get(r.ids.find(id=>id!==r.seekerId));
 runner.x=seeker.x+10;runner.y=seeker.y;h.engine.tick();assert.equal(seeker.worldFrozen,true);
 h.advance(19999);assert.equal(r.stats[runner.id].out,false);h.advance(1);assert.equal(seeker.worldFrozen,false);
 h.advance(2000);assert.equal(r.stats[runner.id].out,true);
});

test('shots validate angle, range, cooldown, health, respawn and only affect accepted opponents',()=>{
 const h=setup(),r=h.ready('battle'),a=h.players.get('p0'),b=h.players.get('p1');
 Object.assign(a,{x:600,y:360});Object.assign(b,{x:700,y:360});
 assert.ok(h.call('p0','shoot',{angle:NaN}).error);
 for(let i=0;i<3;i++)assert.ok(h.call('p0','shoot',{angle:0}).ok);
 assert.equal(r.stats.p0.score,1);assert.equal(r.stats.p1.hp,0);assert.equal(b.worldFrozen,true);
 assert.ok(h.call('p1','shoot',{angle:Math.PI}).error);
 assert.equal(h.players.get('p2').worldFrozen,undefined);
 h.advance(3000);assert.equal(r.stats.p1.hp,3);assert.equal(b.worldFrozen,false);
});

test('walls block hits and outsiders cannot shoot or start',()=>{
 const h=setup(),r=h.ready('battle'),a=h.players.get('p0'),b=h.players.get('p1');
 const wall=world.blockers.find(w=>w.w>50&&w.h>50);Object.assign(a,{x:wall.x-15,y:wall.y+wall.h/2});Object.assign(b,{x:wall.x+wall.w+15,y:a.y});
 h.call('p0','shoot',{angle:0});assert.equal(r.stats.p1.hp,3);
 assert.ok(h.call('p2','shoot',{angle:0}).error);assert.ok(h.call('p2','start').error);
});

test('disconnect transfers lobby host and active match cleanup releases reservations',()=>{
 const h=setup();h.call('p0','create',{game:'race'});h.accept('p0','p1');h.engine.remove('p0');assert.equal(h.room().hostId,'p1');
 h.accept('p1','p2');h.call('p1','start');h.engine.remove('p1');assert.equal(h.room().phase,'finished');assert.equal(h.garage.list().filter(v=>v.worldGameId).length,0);
 h.advance(13000);assert.equal(h.players.get('p2').gameId,null);
});

test('account/session blocks end a match and time limits produce results',()=>{
 const h=setup();const r=h.ready('battle');h.block();h.advance(50);assert.equal(r.phase,'finished');
 const k=setup(),timed=k.ready('battle');k.advance(181000);assert.equal(timed.phase,'finished');assert.equal(timed.result.winners.length,2);
});
