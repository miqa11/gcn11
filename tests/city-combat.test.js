'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {zombieWeapon,battleWeapon,muzzle,raycast,shotMeta}=require('../city-combat'),{createTrigger}=require('../city-shooting');
const ground={isWalkable:()=>true};
test('every wave has a distinct gun, with monotonically stronger and faster upgrades',()=>{
 const guns=Array.from({length:10},(_,i)=>zombieWeapon(i+1));assert.equal(new Set(guns.map(g=>g.id)).size,10);assert.equal(new Set(guns.map(g=>g.name)).size,10);assert.ok(guns.some(g=>g.id==='ak47'));assert.ok(guns.some(g=>g.kind==='smg'));
 for(let i=1;i<10;i++){assert.ok(guns[i].damage>guns[i-1].damage);assert.ok(guns[i].cooldown<guns[i-1].cooldown);assert.ok(guns[i].range>guns[i-1].range);}assert.equal(zombieWeapon(Infinity).level,1);assert.equal(zombieWeapon(100).level,10);assert.equal(battleWeapon.damage,1);
});
test('ray/circle intersection hits the visible upper body, nearest first, at arbitrary angles',()=>{
 const p={x:100,y:100},from=muzzle(p),targets=[{id:'far',x:250,y:90,radius:18},{id:'near',x:160,y:90,radius:18}];
 const shot=raycast(ground,from,Math.atan2(74-from.y,160-from.x),480,targets);assert.equal(shot.hit.id,'near');assert.ok(shot.to.x<160);
 assert.equal(raycast(ground,from,Math.PI,480,targets).hit,null);assert.equal(raycast(ground,from,0,20,targets).hit,null);
});
test('walls stop damage and tracer endpoints before an occluded target',()=>{
 const world={isWalkable:(x,y)=>x<140||x>150},origin={x:100,y:92};const shot=raycast(world,origin,0,480,[{id:'target',x:165,y:92,radius:18}]);assert.equal(shot.hit,null);assert.ok(shot.to.x<=150);assert.equal(shotMeta({requestId:'x'.repeat(100),damage:9999},'a',battleWeapon).requestId,null);
});
function triggerHarness(){let at=0,ready=true,gun=zombieWeapon(1);const calls=[];const trigger=createTrigger({now:()=>at,getReady:()=>ready,getGun:()=>gun,onShot:(id,done)=>calls.push({id,done})});return {trigger,calls,advance(ms){at+=ms;trigger.tick();},setReady:v=>ready=v,setGun:v=>gun=v};}
test('held fire sends at weapon cadence without burst catch-up or key-repeat exploits',()=>{
 const h=triggerHarness();h.trigger.press('key');for(let i=0;i<20;i++)h.trigger.press('key');assert.equal(h.calls.length,1);h.calls[0].done({ok:true});h.advance(531);assert.equal(h.calls.length,1);h.advance(1);assert.equal(h.calls.length,2);h.calls[1].done({ok:true});h.advance(10000);assert.equal(h.calls.length,3);h.trigger.release('key');h.advance(2000);assert.equal(h.calls.length,3);
});
test('release, cancellation and loss of readiness stop automatic fire until a fresh press',()=>{
 const h=triggerHarness();h.trigger.press('pointer');h.calls[0].done({ok:true});h.setReady(false);h.advance(600);h.setReady(true);h.advance(600);assert.equal(h.calls.length,1);h.trigger.press('pointer');assert.equal(h.calls.length,2);h.trigger.stop();h.advance(2000);assert.equal(h.calls.length,2);
});
test('latency queue is bounded and server cooldown feedback reschedules quietly',()=>{
 const h=triggerHarness();h.setGun(zombieWeapon(10));h.trigger.press('pointer');for(let i=0;i<10;i++)h.advance(113);assert.equal(h.calls.length,4);h.calls[0].done({code:'COOLDOWN',retryAfterMs:500});h.advance(499);assert.equal(h.calls.length,4);h.advance(20);assert.equal(h.calls.length,5);assert.ok(h.trigger.stats().pending<=4);
});
