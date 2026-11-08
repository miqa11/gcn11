'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createWorldGames}=require('../city-world-games-engine'),{difficulty,bossDifficulty,weapon}=require('../server-city-zombies'),{createZombieRewards}=require('../server-city-zombie-rewards');
const vehicles=require('../city-vehicles'),realWorld=require('../city-world');
function setup(world={...realWorld,blockers:[],isWalkable:(x,y,r=0)=>x>r&&y>r&&x<2880-r&&y<3420-r}){
 let at=100000,saves=0;const players=new Map(),sockets=new Map(),events=[],users=new Map();
 for(const id of ['a','b','outsider']){players.set(id,{id,userKey:id,name:id,x:620,y:360});users.set(id,{coins:100});sockets.set(id,{id,handlers:{},on(event,fn){this.handlers[event]=fn;},emit:(event,data)=>events.push({to:id,event,data})});}
 const io={sockets:{sockets},to:to=>({emit:(event,data)=>events.push({to,event,data})})},garage=vehicles.createGarage(world,{players});
 const rewardOptions={registeredUsers:users,io,saveAuthUsers:()=>saves++,ensureCoins:()=>{},changeCoins:(u,k,delta)=>u.coins+=delta,spendableCoins:u=>u.coins,now:()=>at};
 const engine=createWorldGames({io,players,world,garage,roomName:'city',now:()=>at,awardZombieVictory:createZombieRewards(rewardOptions)});for(const s of sockets.values())engine.bind(s);
 const call=(id,event,data={})=>{at+=600;let r;sockets.get(id).handlers['city:world:'+event](data,x=>r=x);return r;};
 assert.ok(call('a','create',{game:'zombies'}).ok);assert.ok(call('a','invite',{targetId:'b'}).ok);const invitation=events.findLast(e=>e.event==='city:world:invited').data;assert.ok(call('b','respond',{id:invitation.id,accept:true}).ok);
 const room=[...engine.rooms.values()][0];
 return {engine,players,events,users,garage,room,call,rewardOptions,get saves(){return saves;},start(){assert.ok(call('a','start').ok);at=room.startAt;engine.tick();},tick(ms=100){at+=ms;engine.tick();},clock(ms){at+=ms;}};
}
test('ten waves grow in strength while weapons improve with no player coin cost',()=>{
 for(let n=2;n<=10;n++){const a=difficulty(n-1,2),b=difficulty(n,2);for(const k of ['count','hp','speed','damage'])assert.ok(b[k]>a[k]);assert.ok(weapon(n).damage>weapon(n-1).damage);assert.ok(weapon(n).cooldown<weapon(n-1).cooldown);}
 const h=setup();h.start();assert.equal(h.room.zombie.wave,1);assert.ok(h.room.zombie.enemies.length>0);assert.equal(h.room.stats.a.hp,100);assert.equal(h.users.get('a').coins,100);
});
test('zombies only hurt enrolled players; spectators and other people are never targets',()=>{
 const h=setup();h.start();const e=h.room.zombie.enemies[0],a=h.players.get('a'),b=h.players.get('b'),outsider=h.players.get('outsider');Object.assign(a,{x:1000,y:360});Object.assign(b,{x:1100,y:360});Object.assign(outsider,{x:e.x,y:e.y});
 assert.ok(h.call('outsider','shoot',{angle:0,wave:10,reward:99999999}).error);assert.equal(outsider.worldFrozen,undefined);assert.equal(outsider.hp,undefined);
 Object.assign(e,{x:a.x+5,y:a.y,routeAt:Infinity,targetId:'a',path:[]});h.tick(100);assert.ok(h.room.stats.a.hp<100);assert.equal(h.room.stats.b.hp,100);assert.equal(outsider.worldFrozen,undefined);assert.equal(h.users.get('outsider').coins,100);
});
test('server shooting checks angle, cooldown, hit geometry and excludes friendly fire',()=>{
 const h=setup();h.start();const p=h.players.get('a'),e=h.room.zombie.enemies[0];Object.assign(p,{x:e.x-60,y:e.y});Object.assign(h.players.get('b'),{x:e.x-30,y:e.y});
 assert.ok(h.call('a','shoot',{angle:NaN}).error);const hp=e.hp;assert.ok(h.call('a','shoot',{angle:0,damage:99999,weaponId:'minigun',cooldown:0}).ok);assert.equal(e.hp,hp-weapon(1).damage);assert.equal(h.room.stats.b.hp,100);assert.deepEqual(Object.keys(h.events.findLast(e=>e.event==='city:world:shot').data.from).sort(),['x','y']);
 h.room.stats.a.lastShot+=600;assert.ok(h.call('a','shoot',{angle:0}).error);
});
test('a wall blocks a zombie shot and the visible tracer',()=>{
 const base={...realWorld,blockers:[],isWalkable:(x,y,r=0)=>x>r&&y>r&&x<2880-r&&y<3420-r&&!(x>995-r&&x<1005+r&&y>300-r&&y<430+r)};
 const h=setup(base);h.start();const e=h.room.zombie.enemies[0],hp=e.hp;Object.assign(h.players.get('a'),{x:950,y:360});Object.assign(e,{x:1050,y:360});assert.ok(h.call('a','shoot',{angle:0}).ok);assert.equal(e.hp,hp);assert.ok(h.events.findLast(e=>e.event==='city:world:shot').data.to.x<1010);
});
test('real-map zombies spawn on walkable ground and movement never cuts through buildings',()=>{
 const h=setup(realWorld);h.start();for(let i=0;i<20;i++){h.tick(100);for(const e of h.room.zombie.enemies)assert.ok(realWorld.isWalkable(e.x,e.y,8));}assert.ok(h.room.zombie.enemies.length);
});
test('ten completed waves pay 50,000 real account coins once, including downed teammates',()=>{
 const h=setup();h.start();
 // Exercise every real server shot and wave transition; time advances between shots, with ticks between waves.
 for(let wave=1;wave<=10;wave++){
  assert.equal(h.room.zombie.wave,wave);assert.equal(h.users.get('a').coins,100);
  h.room.stats.b.hp=0;h.room.stats.b.out=true;h.players.get('b').worldFrozen=true;
  let shots=0;while(h.room.zombie.enemies.length){assert.ok(++shots<500);const e=h.room.zombie.enemies[0];Object.assign(h.players.get('a'),{x:e.x-50,y:e.y});assert.ok(h.call('a','shoot',{angle:0,reward:99999999,wave:10}).ok);}
  h.tick();assert.equal(h.room.zombie.phase,'boss');assert.equal(h.users.get('a').coins,100);while(h.room.zombie.enemies.length){assert.ok(++shots<500);const e=h.room.zombie.enemies[0];Object.assign(h.players.get('a'),{x:e.x-60,y:e.y});assert.ok(h.call('a','shoot',{angle:0}).ok);}h.tick();if(wave<10){assert.equal(h.room.zombie.phase,'break');assert.equal(h.room.stats.b.hp,100);assert.equal(h.room.stats.b.out,false);assert.equal(h.room.zombieEngine.snapshot().weapon.level,wave+1);h.tick(10001);}
 }
 assert.equal(h.room.phase,'finished');assert.equal(h.room.zombie.enemies.length,0);assert.equal(h.users.get('a').coins,50100);assert.equal(h.users.get('b').coins,50100);assert.equal(h.users.get('outsider').coins,100);assert.equal(h.saves,1);
 for(let i=0;i<5;i++)h.tick(100);assert.equal(h.users.get('a').coins,50100);
 const restarted=createZombieRewards(h.rewardOptions);assert.deepEqual(restarted(h.room.id,[h.players.get('a'),h.players.get('b')]),{});assert.equal(h.users.get('a').coins,50100);
 assert.ok(h.events.some(e=>e.event==='city:world:public'&&e.data.some(r=>r.game==='zombies'&&r.zombie)));
});
test('wipe, disconnect and timeout clean up zombies without rewarding an incomplete match',()=>{
 for(const reason of ['wipe','disconnect','timeout']){const h=setup();h.start();if(reason==='wipe'){h.room.stats.a.hp=h.room.stats.b.hp=0;h.tick();}if(reason==='disconnect')h.engine.remove('b');if(reason==='timeout')h.tick(900001);assert.equal(h.room.phase,'finished');assert.equal(h.room.zombie.enemies.length,0);assert.equal(h.saves,0);assert.equal(h.users.get('a').coins,100);h.tick(13000);assert.equal(h.players.get('a').gameId,null);assert.equal(h.engine.rooms.size,0);}
});
test('reward persistence deduplicates accounts; guests cannot receive site money',()=>{
 const h=setup(),a=h.players.get('a'),b=h.players.get('b');b.userKey=a.userKey;h.users.get('outsider').isGuest=true;
 const paid=createZombieRewards(h.rewardOptions)('verified-server-match',[a,b,h.players.get('outsider')]);assert.deepEqual(paid,{a:50000});assert.equal(h.users.get('a').coins,50100);assert.equal(h.users.get('outsider').coins,100);
});

test('the deadline rejects late shots and cannot convert an overdue final wave into a reward',()=>{
 const h=setup();h.start();h.room.zombie.wave=10;h.room.zombie.enemies=[];h.clock(900001);assert.ok(h.call('a','shoot',{angle:0}).error);h.tick();assert.equal(h.room.phase,'finished');assert.equal(h.saves,0);
});


test('each wave ends in one scaled boss and cannot advance or reward before its death',()=>{
 const h=setup();h.start();h.room.zombie.enemies=[];h.tick();assert.equal(h.room.zombie.phase,'boss');const boss=h.room.zombie.enemies[0],d=difficulty(1,2);assert.equal(boss.kind,'boss');assert.ok(boss.hp>d.hp*3);assert.ok(boss.speed>d.speed);assert.ok(boss.damage>d.damage);assert.ok(h.room.zombieEngine.snapshot().enemies.some(e=>e.kind==='boss'));h.tick(100);assert.equal(h.room.zombie.wave,1);assert.equal(h.users.get('a').coins,100);
 for(let wave=2;wave<=10;wave++){const a=bossDifficulty(wave-1,2),b=bossDifficulty(wave,2);for(const k of ['hp','speed','damage'])assert.ok(b[k]>a[k]);}assert.ok(bossDifficulty(1,6).hp>bossDifficulty(1,2).hp);
});

test('building-edge upper bodies remain hittable when feet have clear sight',()=>{
 const w={...realWorld,blockers:[],isWalkable:(x,y)=>x>0&&y>=100&&x<2880&&y<3420};const h=setup(w);h.start();h.room.zombie.enemies=[h.room.zombie.enemies[0]];const e=h.room.zombie.enemies[0];Object.assign(e,{x:700,y:104});Object.assign(h.players.get('a'),{x:640,y:104});const hp=e.hp;const result=h.call('a','shoot',{angle:Math.atan2(-14+8,60)});assert.ok(result.hit);assert.equal(e.hp,hp-weapon(1).damage);
});

test('recent published zombie frames compensate delayed aim and reject stale/future timestamps',()=>{
 const h=setup();h.start();const e=h.room.zombie.enemies[0];h.room.zombie.enemies=[e];Object.assign(e,{x:700,y:360});Object.assign(h.players.get('a'),{x:640,y:360});const frame=h.room.zombieEngine.snapshot();e.y+=60;h.clock(-450); // call advances 600ms: this shot refers to a frame only 150ms old.
 const hp=e.hp;assert.ok(h.call('a','shoot',{angle:0,observedAt:frame.at}).hit);assert.equal(e.hp,hp-weapon(1).damage);
 // Stale and forged future timestamps use current geometry instead.
 assert.equal(h.call('a','shoot',{angle:0,observedAt:frame.at}).hit,false);assert.equal(h.call('a','shoot',{angle:0,observedAt:Infinity}).hit,false);
});


test('boss melee targets only participants and delayed shots cannot cross current walls',()=>{
 const h=setup();h.start();h.room.zombie.enemies=[];h.tick();const e=h.room.zombie.enemies[0],a=h.players.get('a'),outside=h.players.get('outsider');Object.assign(e,{x:700,y:360,speed:0,path:[],routeAt:Infinity,targetId:'a',attackAt:0});Object.assign(a,{x:705,y:360});Object.assign(outside,{x:700,y:360});h.tick();assert.ok(h.room.stats.a.hp<100);assert.equal(outside.worldFrozen,undefined);assert.ok(!h.room.stats.outsider);
 const base={...realWorld,blockers:[],isWalkable:(x,y)=>x>0&&x<2880&&y>0&&y<3420},k=setup(base);k.start();const z=k.room.zombie.enemies[0];k.room.zombie.enemies=[z];Object.assign(z,{x:700,y:360});Object.assign(k.players.get('a'),{x:640,y:360});const frame=k.room.zombieEngine.snapshot(),hp=z.hp;base.isWalkable=(x,y)=>!(x>=665&&x<=675);k.clock(-450);assert.equal(k.call('a','shoot',{angle:0,observedAt:frame.at}).hit,false);assert.equal(z.hp,hp);
});
