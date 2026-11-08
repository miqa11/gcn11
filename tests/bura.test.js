"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),E=require("../bura-engine"),G=require("../bura-game"),Bot=require("../bura-bot"),{createBura,weekKey}=require("../server-bura");
function seeded(seed){return ()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);}
function game(){const g=G.createGame();G.startRound(g,0,seeded(42));g.round.phase="lead";g.round.result=null;g.score=[0,0];g.results=[];return g;}
test("twenty cards, 120 points, ten outranks king and every response must be covered",()=>{
 assert.equal(E.buildDeck().length,20);assert.equal(new Set(E.buildDeck()).size,20);assert.equal(E.handPoints(E.buildDeck()),120);
 assert(E.beats("Th","Kh","s"));assert(!E.beats("Kh","Th","s"));assert(E.beats("Js","Ah","s"));assert(!E.beats("Ah","Js","s"));
 assert(E.canBeatAll(["As","Th"],["Kh","Ks"],"s"));assert(!E.canBeatAll(["As","Jh"],["Kh","Ks"],"s"));
 assert.deepEqual(E.matchCut(["As","Th"],["Kh","Ks"],"s"),["Th","As"]);
 assert(!E.validateLead(["As","As"],["As","Kh"],3).ok);assert(!E.validateLead(["As","Kh"],["As","Kh"],3).ok);assert(!E.validateResponse(["As"],["As"],2).ok);
});
test("both seats see discards face down until the round ends",()=>{
 const g=game(),r=g.round;r.trump="s";r.hands=[["Ah","Kh","Jh"],["Qd","Ac","Tc"]];r.deck=["Js","Ts","Qs","Ks"];
 assert(G.act(g,0,"lead",{cards:["Ah"]}).ok);assert(!G.act(g,1,"cut",{cards:["Qd"]}).ok);assert(G.act(g,1,"discard",{cards:["Qd"]},()=>1234).ok);
 const a=G.viewForSeat(g,0),b=G.viewForSeat(g,1);assert.deepEqual(a.history[0].responseCards,[null]);assert.deepEqual(b.history[0].responseCards,[null]);assert.equal(a.history[0].completedAt,1234);assert.equal(b.history[0].completedAt,1234);
 assert(!JSON.stringify(a).includes('"Qd"'));assert(!JSON.stringify(b).includes('"Qd"'));assert(!("capturedPoints" in a));assert(!("deck" in a));
 assert.equal(r.phase,"collect");assert.deepEqual(r.hands,[["Kh","Jh"],["Ac","Tc"]]);assert(!G.act(g,1,"continue").ok);assert(!G.act(g,0,"lead",{cards:["Kh"]}).ok);
 assert(G.act(g,0,"continue").ok);assert.deepEqual(r.hands,[["Kh","Jh","Js"],["Ac","Tc","Ts"]]);assert.equal(r.phase,"lead");
 G.finishRound(g,0,"count");assert.deepEqual(G.viewForSeat(g,0).result.cardPoints,[14,0]);assert(G.viewForSeat(g,0).result.captured[0].includes("Qd"));
});
test("Var only before leading on one's own turn; false declarations lose at the agreed price",()=>{
 const g=game(),r=g.round;r.currentCall="se";r.captured[0]=["As","Ts","Ah"];assert(G.act(g,0,"var").ok);assert.equal(g.score[0],3);
 for(const viewer of [0,1]){const result=G.viewForSeat(g,viewer).result;assert.equal(result.declarerSeat,0);assert.deepEqual(result.captured[0],["As","Ts","Ah"]);assert.equal(result.cardPoints[0],32);}
 const f=game();f.round.currentCall="davi";assert(G.act(f,0,"var").ok);assert.equal(f.score[1],2);assert.equal(f.round.result.declarerSeat,0);assert.equal(f.round.result.winner,1);
 const h=game();assert(G.act(h,0,"lead",{cards:[h.round.hands[0][0]]}).ok);assert(!G.act(h,1,"var").ok);
});
test("bidding alternates, counteroffers pay the prior price, and Crawford disables one round",()=>{
 const g=game();assert(G.act(g,0,"call").ok);assert(G.act(g,1,"raise").ok);assert.equal(g.round.pendingCall.call,"se");assert(G.act(g,0,"concede").ok);assert.equal(g.score[1],2);
 const h=game();assert(G.act(h,0,"call").ok);assert(G.act(h,1,"accept").ok);assert(!G.act(h,0,"call").ok);
 const c=G.createGame();c.score=[10,2];G.startRound(c,0,seeded(9));assert(c.round.crawford);assert(!G.act(c,0,"call").ok);G.finishRound(c,1,"count");G.startRound(c,0,seeded(10));assert(!c.round.crawford);
});
test("a bid during a response restores the same pending trick after a counteroffer",()=>{
 const g=game(),r=g.round;r.trump="s";r.hands=[["Ah","Kh","Jh"],["Qd","Ac","Tc"]];
 assert(G.act(g,0,"lead",{cards:["Ah","Kh","Jh"]}).ok);assert(G.viewForSeat(g,1).canCall);assert(G.act(g,1,"call").ok);
 assert(!G.act(g,1,"discard",{cards:r.hands[1]}).ok);assert(G.act(g,0,"raise").ok);assert(G.act(g,1,"accept").ok);
 assert.equal(r.phase,"respond");assert.equal(r.turnSeat,1);assert.deepEqual(r.trick.ledCards,["Ah","Kh","Jh"]);assert.equal(r.currentCall,"se");
 assert(G.act(g,1,"discard",{cards:r.hands[1]}).ok);
});
test("malutka interrupts only before a lead; royal bura precedes bura and doubles the price",()=>{
 for(const action of ["malutka","lead"]){
  const g=game();g.round.trump="s";g.round.hands=[["As","Kd","Qc"],["Ah","Kh","Jh"]];
  assert(!G.act(g,1,"lead",{cards:["Ah","Kh"]}).ok);
  assert(G.act(g,1,action,{cards:["Ah","Kh","Jh"]}).ok);assert.equal(g.round.trick.leaderSeat,1);assert.deepEqual(g.round.trick.ledCards,["Ah","Kh","Jh"]);assert(!G.act(g,0,"malutka").ok);
 }
 const r=game();r.round.trump="s";r.round.currentCall="chari";r.round.hands=[["As","Ah","Ad"],["Js","Ts","Ks"]];G.special(r);assert.equal(r.score[0],8);assert.equal(r.round.result.reason,"royal");
 const b=game();b.round.trump="s";b.round.hands[0]=["Js","Qs","Ks"];G.special(b);assert.equal(b.round.result.reason,"bura");
});
test("timeouts lose a round then the match, while accepted actions reset the streak",()=>{
 const g=game();G.timeout(g,0);assert.equal(g.score[1],1);assert(!g.finished);G.startRound(g,0,seeded(7));G.timeout(g,0);assert(g.finished);assert.equal(g.winner,1);
 const h=game();G.timeout(h,0);G.startRound(h,0,seeded(7));assert(G.act(h,0,"lead",{cards:[h.round.hands[0][0]]}).ok);assert.equal(h.timeouts[0],0);
 const b=game();G.act(b,0,"call");G.timeout(b,1);assert.equal(b.score[0],1);
});
test("the final 60:60 trick is a draw and the exposed trump is drawn last",()=>{
 const g=game(),r=g.round;assert.equal(r.deck.at(-1),r.trumpCard);
 const taken=['Ts','As','Kh','Th','Ah','Qh','Kc','Jd'];assert.equal(E.handPoints(taken),55);
 r.hands=[['Js'],['Qc']];r.deck=[];r.captured=[taken,E.buildDeck().filter(c=>!taken.includes(c)&&c!=='Js'&&c!=='Qc')];r.trump='c';
 assert(G.act(g,0,'lead',{cards:['Js']}).ok);assert(G.act(g,1,'discard',{cards:['Qc']}).ok);assert.equal(r.result.winner,null);assert.deepEqual(r.result.cardPoints,[60,60]);assert.deepEqual(g.score,[0,0]);G.startRound(g,undefined,seeded(3));assert.equal(g.round.starter,1);
});
test("bots receive redacted views and complete 200 full matches without illegal moves or lost cards",()=>{
 for(let i=1;i<=200;i++){
  const rng=seeded(i),g=G.createGame();G.startRound(g,undefined,rng);let moves=0;
  while(!g.finished&&moves++<3000){
   const r=g.round,all=[...r.deck,...r.hands.flat(),...r.captured.flat(),...(r.trick?.ledCards||[])];assert.equal(all.length,20);assert.equal(new Set(all).size,20);assert.equal(E.handPoints(all),120);
   if(r.phase==="done"){G.startRound(g,undefined,rng);continue;}
   const view=G.viewForSeat(g,r.turnSeat),choice=Bot.choose(JSON.parse(JSON.stringify(view)));assert(choice);const result=G.act(g,r.turnSeat,choice.action,choice);assert(result.ok,JSON.stringify({view,choice,result}));
  }
  assert(g.finished,"bot match did not finish");assert(g.score[g.winner]>=11);
 }
});
function harness(opts={}){
 let time=Date.UTC(2026,10,8,19,59),serial=0,saves=0;const jobs=new Map(),users=opts.users||new Map([['a',{username:'a',coins:100}],['b',{username:'b',coins:100}],['c',{username:'c',coins:100}]]),sockets=new Map();
 const io={sockets:{sockets},emit(e,d){for(const s of sockets.values())s.emit(e,d);},to(room){return {emit(e,d){for(const s of sockets.values())if('user:'+s._regUser.usernameLower===room)s.emit(e,d);}};}};
 const api=createBura({io,registeredUsers:users,spendableCoins:u=>u.coins,changeCoins:(u,_lc,n)=>{u.coins+=n;assert(u.coins>=0);},saveAuthUsers:()=>saves++,now:()=>time,setTimer:(f,ms)=>{const id=++serial;jobs.set(id,{at:time+ms,f});return id;},clearTimer:id=>jobs.delete(id),rng:seeded(15),...opts});
 function client(lc,id=lc){const handlers=new Map(),out=[];const s={id,_regUser:{usernameLower:lc,username:lc},on:(e,f)=>handlers.set(e,f),emit:(e,d)=>out.push({e,d}),send:(e,d)=>handlers.get(e)?.(d),out};sockets.set(id,s);api.attach(s);return s;}
 function advance(ms){const end=time+ms;let loops=0;while(true){const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;if(++loops>10000)throw Error('timer loop');time=next[1].at;jobs.delete(next[0]);next[1].f();}time=end;}
 function paid(){const a=client('a'),b=client('b');a.send('bura:invite',{toUsernames:['b']});const r=[...api.rooms.values()][0];b.send('bura:join',{roomId:r.id});a.send('bura:ready',{roomId:r.id});b.send('bura:ready',{roomId:r.id});return {a,b,r};}
 return {api,users,client,advance,paid,get time(){return time;},get saves(){return saves;}};
}
test("both players confirm before escrow; settlement is once-only and bot play is free",()=>{
 const h=harness(),{a,b,r}=h.paid();assert.equal(h.users.get('a').coins,70);assert.equal(h.users.get('b').coins,70);
 const outsider=h.client('c');outsider.send('bura:action',{roomId:r.id,version:r.version,action:'var'});assert.equal(r.game.score[0]+r.game.score[1],0);
 b.send('bura:leave',{roomId:r.id});assert.equal(h.users.get('a').coins,128);assert.equal(h.users.get('b').coins,70);b.send('bura:leave',{roomId:r.id});assert.equal(h.users.get('a').coins,128);assert.equal(h.api.rankings()[0].wins,1);
 const a2=h.client('a','a2');a2.send('bura:join',{roomId:r.id});a2.send('bura:bot');const bot=[...h.api.rooms.values()].find(r=>r.bot);assert(bot);a2.send('bura:leave',{roomId:bot.id});assert.equal(h.users.get('a').coins,128);assert.equal(h.api.rankings()[0].wins,1);h.api.close();
});
test("declined invitations cool down for 60 seconds and blocked or broke players cannot start",()=>{
 const h=harness(),a=h.client('a'),b=h.client('b');a.send('bura:invite',{toUsernames:['b']});const r=[...h.api.rooms.values()][0];b.send('bura:declineInvite',{roomId:r.id});h.advance(1000);a.send('bura:invite',{toUsernames:['b']});assert.equal(r.pending.size,0);assert(a.out.some(x=>x.e==='bura:inviteSent'&&x.d.cooldown.includes('b')));
 h.advance(60000);a.send('bura:invite',{toUsernames:['b']});assert.equal(r.pending.size,1);b.send('bura:join',{roomId:r.id});h.users.get('b').coins=29;a.send('bura:ready',{roomId:r.id});b.send('bura:ready',{roomId:r.id});assert.equal(r.status,'lobby');assert.equal(h.users.get('a').coins,100);
 h.users.get('b').coins=100;h.users.get('b').blockedUsers=['a'];a.send('bura:ready',{roomId:r.id});b.send('bura:ready',{roomId:r.id});assert.equal(r.status,'lobby');h.api.close();
});
test("reconnect pauses the move clock for 40 seconds; replacement tabs and stale versions cannot act",()=>{
 const h=harness(),{a,b,r}=h.paid();h.advance(2000);const remain=r.deadline-h.time;a.send('disconnect');assert.equal(r.deadline,null);h.advance(35000);assert.equal(r.status,'playing');
 const a2=h.client('a','a2');a2.send('bura:join',{roomId:r.id});assert.equal(r.deadline-h.time,remain);const revision=r.version;
 a.send('bura:action',{roomId:r.id,version:revision,action:'var'});assert.equal(r.version,revision);
 a2.send('bura:action',{roomId:r.id,version:revision-1,action:'var'});assert.equal(r.version,revision);
 b.send('disconnect');h.advance(40000);assert.equal(r.status,'ended');assert.equal(r.game.winner,0);h.api.close();
});
test("table chat leaves an in-flight lead valid",()=>{
 const h=harness(),{a,b,r}=h.paid();
 Object.assign(r.game.round,{phase:"lead",turnSeat:0,trump:"s",hands:[["Ah","Kh","Jh"],["Qd","Ac","Tc"]]});
 const version=r.version;
 b.send("bura:chat",{roomId:r.id,text:"hello"});
 const chat=a.out.findLast(x=>x.e==="bura:room").d;
 assert.equal(chat.chatOnly,true);assert.equal(chat.version,version);assert.equal(chat.messages.at(-1).text,"hello");
 a.send("bura:action",{roomId:r.id,version,action:"lead",cards:["Ah"]});
 assert.equal(r.game.round.phase,"respond");assert.equal(r.version,version+1);h.api.close();
});
test("the completed trick clears before the winner's clock starts, including across reconnect",()=>{
 const h=harness(),{a,b,r}=h.paid(),round=r.game.round;
 Object.assign(round,{phase:"lead",turnSeat:0,trump:"s",hands:[["Ah","Kh","Jh"],["Qd","Ac","Tc"]],deck:["Js","Ts"],captured:[["Ad","Td"],[]]});
 const send=(p,action,cards)=>p.send("bura:action",{roomId:r.id,version:r.version,action,cards});
 send(a,"lead",["Ah"]);send(b,"discard",["Qd"]);assert.equal(round.phase,"collect");assert.equal(r.deadline,null);
 send(a,"continue");assert.deepEqual(round.deck,["Js","Ts"]);
 h.advance(1000);a.send("disconnect");h.advance(5000);assert.equal(r.deadline,null);
 const a2=h.client("a","a2");a2.send("bura:join",{roomId:r.id});assert.equal(r.deadline-h.time,30000);
 send(a2,"var");assert.equal(round.result.winner,0);assert.deepEqual(round.deck,["Js","Ts"]);h.api.close();
});
test("restart refunds reserved coins once; ranking resets Monday at midnight in Tbilisi",()=>{
 const users=new Map([['a',{username:'a',coins:70,buraEscrow:{matchId:'old',amount:30},buraWeekly:{week:'2026-11-02',wins:2,losses:0,net:56}}]]),h=harness({users});assert.equal(users.get('a').coins,100);assert(!users.get('a').buraEscrow);assert.equal(h.api.rankings().length,1);
 assert.equal(weekKey(Date.UTC(2026,10,8,19,59)),'2026-11-02');assert.equal(weekKey(Date.UTC(2026,10,8,20,0)),'2026-11-09');h.advance(60000);assert.equal(h.api.rankings().length,0);h.api.close();const again=harness({users});assert.equal(users.get('a').coins,100);again.api.close();
});
test("instant invitations, malformed packets and host-only removal are handled safely",()=>{
 const h=harness(),a=h.client('a'),b=h.client('b');a.send('bura:invite',{toUsernames:[]});const r=[...h.api.rooms.values()][0];a.send('bura:invite',{toUsernames:['b']});assert(r.pending.has('b'));
 b.send('bura:join',{roomId:r.id});b.send('bura:kick',{roomId:r.id,username:'a'});assert.equal(r.players.length,2);a.send('bura:kick',{roomId:r.id,username:'b'});assert.equal(r.players.length,1);h.advance(400);b.send('bura:join',{roomId:r.id});assert.equal(r.players.length,1);
 for(const event of ['bura:invite','bura:join','bura:ready','bura:action','bura:chat','bura:kick','bura:declineInvite','bura:leave'])assert.doesNotThrow(()=>b.send(event,null));assert.equal(h.users.get('b').coins,100);h.api.close();
});
test("a legitimate Var match win settles correctly, and a shutdown refunds unfinished stakes",()=>{
 const h=harness(),{a,r}=h.paid();r.game.score=[10,2];r.game.round.phase='lead';r.game.round.turnSeat=0;r.game.round.captured[0]=['As','Ts','Ah'];
 a.send('bura:action',{roomId:r.id,version:r.version,action:'var'});assert.equal(r.status,'ended');assert.equal(h.users.get('a').coins,128);assert.equal(h.users.get('b').coins,70);assert.equal(h.users.get('a').buraWeekly.wins,1);h.api.close();
 const j=harness();j.paid();j.api.close();assert.equal(j.users.get('a').coins,100);assert.equal(j.users.get('b').coins,100);assert(!j.users.get('a').buraEscrow);
});
