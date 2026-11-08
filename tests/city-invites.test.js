'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCityInviteGuard}=require('../server-city-invite-guard'),{createCityGameEngine}=require('../city-game-engine'),{createWorldGames}=require('../city-world-games-engine');
const world=require('../city-world'),vehicles=require('../city-vehicles');
function setup(t){
 let at=100000;const players=new Map(),users=new Map(),sockets=new Map(),events=[];
 for(const id of ['a','b','c']){players.set(id,{id,userKey:id,name:id,x:id==='a'?620:780,y:360});users.set(id,{coins:100});sockets.set(id,{id,join(){},leave(){},handlers:{},on(event,fn){this.handlers[event]=fn;},emit:(event,data)=>events.push({to:id,event,data})});}
 const io={sockets:{sockets},to:()=>({emit(){}})},guard=createCityInviteGuard({now:()=>at});
 const direct=createCityGameEngine({io,players,registeredUsers:users,clock:()=>at,inviteGuard:guard});
 const lobby=createWorldGames({io,players,world,garage:vehicles.createGarage(world,{players}),roomName:'city',now:()=>at,inviteGuard:guard});
 for(const socket of sockets.values()){direct.bind(socket);lobby.bind(socket);}t.after(()=>{for(const id of players.keys()){direct.remove(id);lobby.remove(id);}});
 return {players,users,events,direct,lobby,guard,advance:ms=>at+=ms,call(id,event,data={}){let result;sockets.get(id).handlers[event](data,r=>result=r);return result;}};
}
test('direct invitation works at the same 175-unit range shown by the player card',t=>{
 const h=setup(t);assert.ok(h.call('a','city:game:invite',{targetId:'b'}).ok);const i=h.events.findLast(e=>e.event==='city:game:inviteRequest').data;
 assert.ok(h.call('b','city:game:inviteRespond',{inviteId:i.inviteId,accept:true}).ok);assert.ok(h.players.get('a').gameId);assert.equal(h.players.get('a').gameId,h.players.get('b').gameId);
});
test('a decline blocks that sender/recipient for one minute across direct and lobby invites',t=>{
 const h=setup(t);h.call('a','city:game:invite',{targetId:'b'});const id=h.events.findLast(e=>e.event==='city:game:inviteRequest').data.inviteId;
 h.call('b','city:game:inviteRespond',{inviteId:id,accept:false});let r=h.call('a','city:game:invite',{targetId:'b'});assert.equal(r.retryAfterMs,60000);
 assert.ok(h.call('a','city:world:create',{game:'hide'}).ok);h.advance(400);r=h.call('a','city:world:invite',{targetId:'b'});assert.ok(r.retryAfterMs>59000);
 h.advance(59000);assert.ok(h.call('a','city:world:invite',{targetId:'b'}).error);h.advance(1000);assert.ok(h.call('a','city:world:invite',{targetId:'b'}).ok);
});
test('a lobby decline also blocks a direct invitation after the host leaves the lobby',t=>{
 const h=setup(t);h.call('a','city:world:create',{game:'race'});h.call('a','city:world:invite',{targetId:'b'});const i=h.events.findLast(e=>e.event==='city:world:invited').data;
 h.call('b','city:world:respond',{id:i.id,accept:false});h.call('a','city:world:leave');assert.equal(h.call('a','city:game:invite',{targetId:'b'}).retryAfterMs,60000);
});
test('failed/blocked attempts do not impose a general wait on a different free player',t=>{
 const h=setup(t);h.users.get('b').blockedUsers=['a'];assert.ok(h.call('a','city:game:invite',{targetId:'b'}).error);assert.ok(h.call('a','city:game:invite',{targetId:'c'}).ok);
});
test('outgoing and cross-mode pending invitations cannot overlap; cancellation releases the reservation',t=>{
 const h=setup(t);h.call('a','city:game:invite',{targetId:'b'});assert.ok(h.call('a','city:game:invite',{targetId:'c'}).error);assert.ok(h.call('c','city:world:create',{game:'hide'}).ok);assert.ok(h.call('c','city:world:invite',{targetId:'b'}).error);
 const i=h.events.findLast(e=>e.event==='city:game:inviteRequest').data;h.call('a','city:game:inviteCancel',{inviteId:i.inviteId});h.advance(400);assert.ok(h.call('c','city:world:invite',{targetId:'b'}).ok);
});
test('expired invitations release immediately even if their timeout callback has not run',t=>{
 const h=setup(t);h.call('a','city:game:invite',{targetId:'b'});h.advance(26000);assert.ok(h.call('a','city:game:invite',{targetId:'b'}).ok);
});
test('cooldown follows account identities through a changed socket and does not block the reverse direction',()=>{
 let at=100000;const guard=createCityInviteGuard({now:()=>at}),a={id:'old-a',userKey:'Alice'},b={id:'old-b',userKey:'Bob'};guard.decline(a,b);
 assert.equal(guard.check({...a,id:'new-a'},{...b,id:'new-b'},'direct').retryAfterMs,60000);assert.equal(guard.check(b,a,'direct'),null);at+=60000;assert.equal(guard.check(a,b,'direct'),null);
});
