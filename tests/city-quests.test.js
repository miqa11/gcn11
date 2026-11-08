'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCityQuests}=require('../server-city-quests'),quests=require('../city-quests-data');
const {createCityActivities}=require('../server-city-activities'),world=require('../city-world'),vehicles=require('../city-vehicles');
function setup(){
 let time=100000,saves=0;const p={id:'s1',userKey:'alice',name:'ალისა',x:0,y:0},players=new Map([[p.id,p]]),users=new Map([['alice',{coins:100,cityActivities:{}}]]),events=[];
 const io={to:room=>({emit:(event,data)=>events.push({room,event,data})})};
 let seat=0;const options={players,registeredUsers:users,io,now:()=>time,saveAuthUsers:()=>saves++,ensureCoins:u=>u.coins||=0,spendableCoins:u=>u.coins,changeCoins:(u,key,delta)=>{u.coins+=delta;seat+=delta;}};
 const engine=createCityQuests(options);
 return {engine,options,p,players,users,events,user:users.get('alice'),get saves(){return saves;},get seat(){return seat;},advance:ms=>time+=ms,setTime:at=>time=at};
}
function completeAll(user){user.cityActivities={collection:{'fish-common':{count:5},'bug-common':{count:5}},records:{deliveries:3,parkour:25000},claims:{'photo:citizen:nino':1,'photo:landmark:tower':1,'photo:vehicle:lada':1,'treasure:0':1}};}

test('six supported quests total 50,000 and cannot be claimed early',()=>{
 const h=setup();assert.equal(quests.length,6);assert.equal(quests.reduce((n,q)=>n+q.reward,0),50000);
 for(const q of quests)assert.ok(h.engine.claim(h.p,q.id).error);
 assert.equal(h.user.coins,100);assert.equal(h.saves,0);
});

test('saved achievements backfill; each reward pays once across engine restart and reconnection',()=>{
 const h=setup();completeAll(h.user);
 for(const q of quests){assert.equal(h.engine.claim(h.p,q.id).reward,q.reward);assert.equal(h.engine.claim(h.p,q.id).reward,0);}
 assert.equal(h.user.coins,50100);assert.equal(h.engine.state(h.p).claimedReward,50000);assert.equal(h.saves,6);
 const restored=JSON.parse(JSON.stringify(h.user));h.users.set('alice',restored);
 const restarted=createCityQuests(h.options);h.players.delete(h.p.id);const p={...h.p,id:'reconnected'};h.players.set(p.id,p);
 for(const q of quests)assert.equal(restarted.claim(p,q.id).reward,0);
 assert.equal(restored.coins,50100);
});

test('guests and removed sockets cannot claim account money',()=>{
 const h=setup();completeAll(h.user);h.user.isGuest=true;assert.ok(h.engine.claim(h.p,quests[0].id).error);
 h.user.isGuest=false;h.players.delete(h.p.id);assert.ok(h.engine.claim(h.p,quests[0].id).error);assert.equal(h.user.coins,100);
});

test('only trusted records count: purchases and repeated identical photos do not complete quests',()=>{
 const h=setup();h.user.cityActivities={inventory:{'fish-common':99},collection:{'bug-common':{count:-1}},records:{deliveries:'3',parkour:0,photos:Array(10).fill({subjectId:'same'})},claims:{'photo:citizen:same':1}};
 const rows=h.engine.state(h.p).quests;assert.equal(rows.find(q=>q.activity==='fishing').progress,0);assert.equal(rows.find(q=>q.activity==='bugs').progress,0);assert.equal(rows.find(q=>q.activity==='photography').progress,1);assert.equal(rows.find(q=>q.activity==='delivery').progress,0);
});

test('one-time campaign bypasses only the normal daily activity cap and uses shared wallet updates',()=>{
 const h=setup();completeAll(h.user);h.user.cityActivities.earned={day:'today',coins:600};
 assert.equal(h.engine.claim(h.p,'river-angler').reward,7500);assert.equal(h.user.cityActivities.earned.coins,600);assert.equal(h.seat,7500);
 assert.ok(h.events.some(e=>e.room==='user:alice'&&e.event==='coins:changed'&&e.data.coins===7600));
});

test('socket ignores client amounts/progress, handles duplicate claims and rate limits requests',()=>{
 const h=setup(),handlers={};h.engine.attach({id:h.p.id,on:(event,fn)=>handlers[event]=fn});let result;
 const call=(event,data)=>{handlers['city:quest:'+event](data,r=>result=r);return result;};
 assert.ok(call('claim',{questId:'river-angler',reward:50000,progress:5}).error);completeAll(h.user);
 assert.equal(call('claim',{questId:'river-angler',reward:99999999}).reward,7500);assert.equal(call('claim',{questId:'river-angler'}).reward,0);
 assert.ok(call('claim',{questId:'__proto__'}).error);assert.ok(call('claim',{questId:{}}).error);
 for(let i=0;i<10;i++)call('state',{});assert.ok(result.error);assert.equal(h.user.coins,7600);
});

test('real activity success advances the campaign; failed/replayed attempts do not',()=>{
 const h=setup(),location=require('../city-activities-data').activities.find(a=>a.id==='fishing').location;Object.assign(h.p,location);
 const garage=vehicles.createGarage(world,{players:h.players});let pushes=0;
 const activities=createCityActivities({...h.options,world,garage,randomInt:()=>0,onComplete:p=>{pushes++;h.engine.push(p);}});
 let serial=0;const command=packet=>activities.command(h.p,{requestId:'req-'+(++serial),...packet});
 let result=command({action:'start',activityId:'fishing'});const early=command({action:'act',token:result.state.active.token,verb:'reel'});assert.ok(early.error);assert.equal(pushes,0);
 command({action:'cancel',token:result.state.active.token});
 for(let i=0;i<5;i++){
  h.advance(61000);result=command({action:'start',activityId:'fishing'});assert.ok(result.ok);
  h.setTime(result.state.active.challenge.at);const token=result.state.active.token;
  result=command({action:'act',token,verb:'reel'});assert.ok(result.ok);assert.equal(result.state.active.status,'success');
  assert.ok(command({action:'act',token,verb:'reel'}).error);
 }
 assert.equal(pushes,5);assert.equal(h.engine.state(h.p).quests.find(q=>q.activity==='fishing').progress,5);assert.equal(h.engine.claim(h.p,'river-angler').reward,7500);
});
