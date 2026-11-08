'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGaicanians,DAY}=require('../server-gaicanians'),{createGaicanianAI,validate}=require('../server-gaicanians-ai');
const {createNavigation}=require('../server-gaicanians-nav'),{residents,places}=require('../server-gaicanians-data'),world=require('../city-world');
function harness({saved,configured=false,generate,online=false}={}){
 let at=saved?.at||100000,writes=0,snapshot=saved,calls=[];const players=new Map(),users=new Map([['alice',{coins:100,cityActivities:{inventory:{sticker:3}}}]]),events=[];
 const p={id:'socket',userKey:'alice',name:'Alice',x:1850,y:1195};if(online)players.set(p.id,p);
 const options={io:{to:room=>({emit:(event,data)=>events.push({room,event,data})})},players,world,registeredUsers:users,garage:{list:()=>[]},now:()=>at,read:()=>snapshot,write:v=>{snapshot=v;writes++;},getEvents:()=>events.filter(e=>e.observation),aiFactory:()=>({configured,async generate(c,opts){calls.push(c);if(generate)return generate(c,opts);return {lines:c.mode==='reflection'?[]:c.characters.map(c=>({speakerId:c.id,text:'გამარჯობა! '+c.name,factIds:[c.facts[0].id]})),intention:{action:'none',jobId:'none'},reflection:c.mode==='reflection'?'ვარჯიში მნიშვნელოვანია.':''};}})};
 const engine=createGaicanians(options),handlers={};engine.attach({id:p.id,on:(name,fn)=>handlers[name]=fn});
 return {engine,options,players,users,events,p,calls,get snapshot(){return snapshot;},get writes(){return writes;},handlers,advance(ms){at+=ms;engine.tick();},setTime:t=>at=t,async command(event,data){let result;await handlers['city:gaicanians:'+event](data,r=>result=r);return result;}};
}

test('three distinct persistent adult biographies and private details stay out of public snapshots',()=>{
 const h=harness(),people=Object.values(h.engine.debug().people);assert.equal(people.length,3);assert.equal(new Set(people.map(c=>c.biography)).size,3);assert.ok(people.every(c=>c.age>=18));
 for(const c of people)assert.ok(!JSON.stringify(h.engine.state()).includes(c.secret));h.engine.save();const re=harness({saved:JSON.parse(JSON.stringify(h.snapshot))});assert.deepEqual(re.engine.debug().people,people.reduce((o,c)=>(o[c.id]=c,o),{}));
});

test('offline simulation earns private wages, learns skills and executes long-term purchases without model calls',()=>{
 const h=harness({configured:true});h.advance(DAY*15);for(let i=0;i<10;i++)h.engine.tick();
 const c=h.engine.debug().people.lumo;assert.ok(c.skills.repair>residents[0].skills.repair);assert.ok(c.projects.length>0);assert.ok(c.memories.some(m=>m.type==='milestone'));assert.equal(h.calls.length,0);assert.equal(h.users.get('alice').coins,100);
});

test('residents form relationships and exchange knowledge without player direction',()=>{
 const h=harness();h.advance(DAY*10);for(let i=0;i<5;i++)h.engine.tick();const values=Object.values(h.engine.debug().people);
 assert.ok(values.some(c=>Object.values(c.relationships).some(r=>r.friendship>.2)));assert.ok(values.some(c=>c.beliefs.some(b=>b.source==='heard')));
});

test('navigation routes stay on walkable segments around city buildings',()=>{
 const nav=createNavigation(world);for(const [a,b]of [[places.homeLumo,places.garden],[places.homeMiko,places.arcade],[places.stage,places.square]]){const route=nav.route(a,b);assert.ok(route.length);let from=a;for(const point of route){assert.ok(world.isWalkable(point.x,point.y,8));assert.ok(nav.clear(from,point));from=point;}}
});

test('a working resident has an event-caused mood, skill and wage change',()=>{
 const h=harness(),c=h.engine.debug().people.lumo;Object.assign(c,{activity:'work',place:'arcade',x:places.arcade.x,y:places.arcade.y,path:[],decisionAt:9999999,jobMinutes:.9});const before=c.money;h.advance(10000);assert.ok(c.money>before);assert.equal(c.emotion.cause,'work');assert.ok(c.emotion.valence>0);assert.ok(c.emotion.satisfaction>.5);
});

test('different needs and traits lead to different autonomous choices',()=>{
 const h=harness(),all=h.engine.debug().people;for(const c of Object.values(all)){c.path=[];c.decisionAt=0;c.needs={energy:.9,hunger:.05,social:.05,fun:.05};}
 all.lumo.needs.energy=.01;all.miko.needs.hunger=.99;h.advance(1000);assert.equal(all.lumo.activity,'rest');assert.equal(all.miko.activity,'eat');
});

test('nearby public conversation needs no consent and remembers the same player across restart',async()=>{
 const h=harness({configured:true,online:true});assert.equal(h.handlers['city:gaicanians:talk'],undefined);
 let r=await h.engine.hear(h.p,'I collect blue pebbles.');assert.ok(r.ok);assert.ok(r.generated);h.advance(9000);
 r=await h.engine.hear(h.p,'Do you remember?');assert.ok(r.ok);const playerCalls=h.calls.filter(c=>c.mode==='nearby');assert.equal(playerCalls.at(-1).conversation[0].text,'I collect blue pebbles.');assert.equal(playerCalls.at(-1).language,'en');
 h.engine.save();const re=harness({configured:true,online:true,saved:JSON.parse(JSON.stringify(h.snapshot))});r=await re.engine.hear(re.p,'What did I collect?');assert.ok(r.ok);assert.ok(re.calls.find(c=>c.mode==='nearby').player.remembered.some(text=>text.includes('blue pebbles')));
 assert.ok(h.events.some(e=>e.event==='city:message'&&e.data.gaicanianId==='lumo'));
 assert.equal(re.engine.state().people.find(c=>c.id==='lumo').bubble.text,r.text);
});

test('forgetting during a pending model reply prevents delivery and saving',async()=>{
 let release;const h=harness({configured:true,online:true,generate:context=>new Promise(r=>release=()=>r({lines:[{speakerId:'lumo',text:'secret answer',factIds:['identity-lumo']}],intention:{action:'none',jobId:'none'},reflection:''}))});
 const pending=h.engine.talk(h.p,{id:'lumo',text:'Private message'});h.engine.forget(h.p);release();const result=await pending;assert.ok(result.error);assert.ok(!JSON.stringify(h.snapshot).includes('Private message'));assert.ok(!JSON.stringify(h.snapshot).includes('secret answer'));assert.ok(!h.events.some(e=>e.event==='city:message'));
});

test('memory expiry removes old transcripts even if another resident was visited recently',async()=>{
 const h=harness({configured:true,online:true});await h.engine.talk(h.p,{id:'lumo',text:'temporary secret'});h.engine.save();const saved=JSON.parse(JSON.stringify(h.snapshot));saved.at+=31*86400000;for(const u of Object.values(saved.users))u.lastAt=saved.at;
 const re=harness({saved});assert.ok(!JSON.stringify(re.engine.debug().people).includes('temporary secret'));
});

test('only nearby citizens witness an event; private dialogue never enters shared context',()=>{
 const h=harness(),all=h.engine.debug().people;Object.assign(all.lumo,{x:600,y:360});Object.assign(all.miko,{x:2400,y:1620});h.engine.observe('სიგნალი აინთო.',600,360);assert.ok(all.lumo.memories.some(m=>m.text==='სიგნალი აინთო.'));assert.ok(!all.miko.memories.some(m=>m.text==='სიგნალი აინთო.'));
});

test('model output cannot invent referenced events or execute arbitrary wallet/command intentions',()=>{
 const context={characters:[{id:'lumo',facts:[{id:'known'}]}]};const valid={lines:[{speakerId:'lumo',text:'Hello',factIds:['known']}],intention:{action:'rest',jobId:'none'},reflection:''};assert.equal(validate(valid,context),valid);
 assert.throws(()=>validate({...valid,money:99999},context));assert.throws(()=>validate({...valid,intention:{action:'shell',jobId:'none'}},context));assert.throws(()=>validate({...valid,lines:[{speakerId:'lumo',text:'A player won',factIds:['fake-win']}]},context));
});

test('Gemini adapter uses server-only key, stateless structured outputs and persisted quotas',async()=>{
 const ledger={};let calls=0,requests=[];const context={mode:'player',characters:[{id:'lumo',facts:[{id:'known'}]}]};const output={lines:[{speakerId:'lumo',text:'Hi!',factIds:['known']}],intention:{action:'none',jobId:'none'},reflection:''};
 const fetchImpl=async(url,options)=>{calls++;requests.push({url,options});return {ok:true,text:async()=>JSON.stringify({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(output)}]}]})};};
 const ai=createGaicanianAI({apiKey:'test-secret',ledger,dailyLimit:1,fetchImpl,now:()=>100000});assert.ok((await ai.generate(context)).lines.length);assert.equal(JSON.parse(requests[0].options.body).store,false);assert.equal(requests[0].options.headers['x-goog-api-key'],'test-secret');assert.ok(!requests[0].url.includes('test-secret'));
 const restarted=createGaicanianAI({apiKey:'test-secret',ledger,dailyLimit:1,fetchImpl,now:()=>100000});await assert.rejects(()=>restarted.generate(context));assert.equal(calls,1);
});

test('provider outages back off and unconfigured mode does not fabricate generated responses',async()=>{
 let calls=0;const ai=createGaicanianAI({apiKey:'test',fetchImpl:async()=>{calls++;return {ok:false};},now:()=>100000});await assert.rejects(()=>ai.generate({}));await assert.rejects(()=>ai.generate({}));assert.equal(calls,1);
 const h=harness({online:true});const r=await h.engine.talk(h.p,{id:'lumo',text:'Tell me something'});assert.ok(r.error);assert.ok(!r.generated);
});

test('validated higher-level model intentions change an eligible job, without touching player coins',async()=>{
 const h=harness({configured:true,online:true,generate:async()=>({lines:[{speakerId:'lumo',text:'მუსიკასაც ვცდი.',factIds:['state-lumo']}],intention:{action:'changeJob',jobId:'musician'},reflection:''})});
 h.engine.debug().people.lumo.skills.music=3;const result=await h.engine.talk(h.p,{id:'lumo',text:'What would you like to try?'});assert.ok(result.ok);assert.equal(h.engine.debug().people.lumo.job,'musician');assert.equal(h.users.get('alice').coins,100);
});

test('player-specific memory never appears in autonomous dialogue prompts',async()=>{
 const h=harness({configured:true,online:true});await h.engine.talk(h.p,{id:'lumo',text:'My private password is a blue pebble.'});
 const all=h.engine.debug().people;for(const c of Object.values(all)){c.activity='social';c.path=[];c.place='square';c.x=1080;c.y=1740;c.decisionAt=9999999;c.pauseUntil=0;c.lastSocial=-1e9;}
 h.advance(31000);await new Promise(r=>setTimeout(r,0));const shared=h.calls.filter(c=>c.mode==='social'||c.mode==='reflection');assert.ok(shared.length);assert.ok(!JSON.stringify(shared).includes('private password'));
});

test('semantic model appraisal changes simulated emotion and a validated goal becomes a real plan',async()=>{
 const h=harness({configured:true,online:true,generate:async()=>({lines:[{speakerId:'lumo',text:'ამ სიტყვებმა მაწყენინა.',factIds:['state-lumo']}],experience:'hurtful',intention:{action:'practice',jobId:'none',goalId:'synth'},reflection:''})});
 const result=await h.engine.talk(h.p,{id:'lumo',text:'Your work looks terrible.'});assert.ok(result.ok);const c=h.engine.debug().people.lumo;assert.equal(c.emotion.cause,'interrupt');assert.ok(c.emotion.valence<0);assert.equal(c.goal.item,'synth');assert.equal(c.proposal.action,'practice');assert.equal(h.users.get('alice').coins,100);
});

test('ordinary nearby speech selects one listener and an addressed nearby resident takes priority',async()=>{
 const h=harness({configured:true,online:true}),all=h.engine.debug().people;
 Object.assign(h.p,{x:1080,y:1740});Object.assign(all.lumo,{x:1080,y:1740});Object.assign(all.nela,{x:1120,y:1740});
 let r=await h.engine.hear(h.p,'Hello everyone');assert.ok(r.ok);assert.equal(h.calls.at(-1).characters[0].id,'lumo');
 h.setTime(109000);r=await h.engine.hear(h.p,'ნელა, როგორ ხარ?');assert.ok(r.ok);assert.equal(h.calls.at(-1).characters[0].id,'nela');assert.equal(h.calls.at(-1).language,'ka');
 assert.equal(h.events.filter(e=>e.event==='city:message').length,2);
});

test('distant, interior, vehicle, game and wall-separated speech never calls the model',async()=>{
 const h=harness({configured:true,online:true}),all=h.engine.debug().people;Object.assign(h.p,{x:1080,y:1740});for(const c of Object.values(all))Object.assign(c,{x:2400,y:1620});
 assert.ok((await h.engine.hear(h.p,'Hello')).ignored);
 Object.assign(all.lumo,{x:1080,y:1740});for(const field of ['interiorId','vehicleId','rideId','gameId','activityLocked']){h.p[field]=true;assert.ok((await h.engine.hear(h.p,'Hello')).ignored);delete h.p[field];}
 // A location inside a building cannot hear a player on its opposite side.
 const building=world.blockers.find(l=>l.w>80&&l.h>80);assert.ok(building);
 Object.assign(h.p,{x:building.x-12,y:building.y+building.h/2});Object.assign(all.lumo,{x:building.x+12,y:h.p.y});
 assert.ok((await h.engine.hear(h.p,'Hello')).ignored);assert.equal(h.calls.length,0);
});

test('leaving before generation finishes prevents a public reply',async()=>{
 let release;const h=harness({configured:true,online:true,generate:async()=>new Promise(r=>release=()=>r({lines:[{speakerId:'lumo',text:'Hello',factIds:['identity-lumo']}],intention:{action:'none',jobId:'none'},reflection:''}))});
 const pending=h.engine.hear(h.p,'Hello');h.p.x=2500;release();assert.ok((await pending).error);assert.ok(!h.events.some(e=>e.event==='city:message'));
});

test('legacy private transcripts are not injected into the new public conversation',async()=>{
 const h=harness({configured:true,online:true});h.engine.debug().people.lumo.memories.push({id:'legacy-private',type:'short',text:'old private secret',playerId:'anything',at:100000});
 const r=await h.engine.hear(h.p,'Hello');assert.ok(r.ok);assert.ok(!JSON.stringify(h.calls).includes('old private secret'));
});

test('provider diagnostics distinguish auth, quota, model and request failures without exposing response bodies',async()=>{
 for(const [status,code]of [[400,'AI_REQUEST'],[401,'AI_AUTH'],[403,'AI_AUTH'],[404,'AI_MODEL'],[429,'AI_QUOTA'],[503,'AI_UNAVAILABLE']]){
  let calls=0;const ai=createGaicanianAI({apiKey:' test-key ',fetchImpl:async()=>{calls++;return {ok:false,status,text:async()=>'sensitive provider detail'};},now:()=>100000});
  await assert.rejects(()=>ai.generate({}),{message:code});await assert.rejects(()=>ai.generate({}),{message:code});assert.equal(calls,1);assert.equal(ai.status().lastFailure,code);
 }
});

const flushDialogue=()=>new Promise(resolve=>setImmediate(resolve));
const replyTo=(c,text='გისმენ!')=>({lines:[{speakerId:c.characters[0].id,text,factIds:[c.characters[0].facts[0].id]}],intention:{action:'none',jobId:'none'},reflection:''});

test('rapid follow-ups queue in order and each sees the preceding answer without an eight-second gap',async()=>{
 const releases=[],h=harness({configured:true,online:true,generate:c=>new Promise(resolve=>releases.push(()=>resolve(replyTo(c,'პასუხი: '+c.message))))});
 const first=h.engine.hear(h.p,'First'),second=h.engine.hear(h.p,'Second'),third=h.engine.hear(h.p,'Third');
 assert.equal(h.calls.length,1);releases.shift()();assert.ok((await first).ok);await flushDialogue();assert.equal(h.calls.length,2);
 assert.deepEqual(h.calls[1].conversation.map(t=>t.text),['First','პასუხი: First']);releases.shift()();assert.ok((await second).ok);await flushDialogue();
 assert.equal(h.calls[2].message,'Third');assert.equal(h.calls[2].conversation.length,4);releases.shift()();assert.ok((await third).ok);
 assert.equal(h.events.filter(e=>e.event==='city:message').length,3);
 // The old account/day ceiling must not quietly stop an ordinary conversation.
 for(let i=0;i<22;i++){const turn=h.engine.hear(h.p,'More '+i);releases.shift()();assert.ok((await turn).ok);await flushDialogue();}
});

test('street speech waits for autonomous generations rather than losing to the character/provider lock',async()=>{
 const releases=[],h=harness({configured:true,online:true,generate:c=>new Promise(resolve=>releases.push({c,done:()=>resolve(replyTo(c))}))});
 const all=Object.values(h.engine.debug().people);for(const c of all)Object.assign(c,{lastReflection:-DAY,lastSocial:100000});h.advance(1000);
 assert.equal(releases.length,3); // Production adapter allows at most two; a third may reject immediately.
 const c=all[0];Object.assign(h.p,{x:c.x,y:c.y});const waiting=h.engine.talk(h.p,{id:c.id,text:'Hello'});
 assert.equal(h.calls.filter(c=>c.mode==='nearby').length,0);for(const r of releases.splice(0))r.done();await flushDialogue();
 assert.equal(h.calls.filter(c=>c.mode==='nearby').length,1);releases.shift().done();assert.ok((await waiting).ok);
});

test('a stressed working resident still answers instead of rejecting an unfamiliar speaker',async()=>{
 const h=harness({configured:true,online:true}),c=h.engine.debug().people.lumo;Object.assign(c,{activity:'work'});c.emotion.stress=.9;
 assert.ok((await h.engine.hear(h.p,'How is your work?')).ok);assert.equal(h.calls.length,1);
});

test('forgetting cancels both the active answer and queued speech before another provider request',async()=>{
 let release;const h=harness({configured:true,online:true,generate:c=>new Promise(r=>release=()=>r(replyTo(c,'old answer')))});
 const first=h.engine.hear(h.p,'First secret'),second=h.engine.hear(h.p,'Queued secret');h.engine.forget(h.p);release();
 assert.ok((await first).error);assert.ok((await second).error);assert.equal(h.calls.length,1);assert.equal(h.events.filter(e=>e.event==='city:message').length,0);assert.ok(!JSON.stringify(h.snapshot).includes('First secret'));assert.ok(!JSON.stringify(h.snapshot).includes('Queued secret'));
});

test('queued speech rechecks presence and does not call the provider after disconnect or walking away',async()=>{
 for(const leave of [h=>h.players.delete(h.p.id),h=>h.p.x=2500]){
  let release;const h=harness({configured:true,online:true,generate:c=>new Promise(r=>release=()=>r(replyTo(c)))});
  const first=h.engine.hear(h.p,'First'),second=h.engine.hear(h.p,'Second');leave(h);release();assert.ok((await first).error);assert.ok((await second).error);assert.equal(h.calls.length,1);
 }
});

test('queue bounds reject excess explicitly and a provider failure releases the queue',async()=>{
 let fail;const h=harness({configured:true,online:true,generate:()=>new Promise((resolve,reject)=>fail=()=>reject(Error('AI_QUOTA')))});
 const turns=Array.from({length:6},(_,i)=>h.engine.hear(h.p,'Hello '+i));assert.match((await h.engine.hear(h.p,'Overflow')).error,/რიგშია/);assert.equal(h.calls.length,1);
 for(const turn of turns){fail();assert.ok((await turn).error);await flushDialogue();}
 const next=h.engine.hear(h.p,'Try again');fail();assert.ok((await next).error);assert.equal(h.calls.length,7);
});

test('waiting residents stay nearby while a slow preceding reply finishes',async()=>{
 const releases=[],h=harness({configured:true,online:true,generate:c=>new Promise(r=>releases.push(()=>r(replyTo(c))))});
 const c=h.engine.debug().people.lumo;Object.assign(c,{path:[{x:c.x+80,y:c.y}],lastReflection:9999999});
 const first=h.engine.hear(h.p,'First'),second=h.engine.hear(h.p,'Second');const x=c.x;h.advance(30000);assert.equal(c.x,x);
 releases.shift()();assert.ok((await first).ok);await flushDialogue();releases.shift()();assert.ok((await second).ok);
});

test('real adapter concurrency remains available for player speech after background calls settle',async()=>{
 const h=harness({online:true}),requests=[],releases=[];
 const engine=createGaicanians({...h.options,aiFactory:opts=>createGaicanianAI({...opts,apiKey:'fixture-only',fetchImpl:async(url,opts)=>{
  const c=JSON.parse(JSON.parse(opts.body).input);requests.push(c);await new Promise(r=>releases.push(r));
  return {ok:true,text:async()=>JSON.stringify({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(replyTo(c))}]}]})};
 }})});
 for(const c of Object.values(engine.debug().people))Object.assign(c,{lastReflection:-DAY,lastSocial:100000});h.setTime(101000);engine.tick();
 assert.equal(requests.length,2);const c=engine.debug().people.lumo;Object.assign(h.p,{x:c.x,y:c.y});
 const waiting=engine.hear(h.p,'Hello');for(const release of releases.splice(0))release();await flushDialogue();assert.equal(requests.length,3);assert.equal(requests[2].mode,'nearby');releases.shift()();assert.ok((await waiting).ok);
});

test('different speakers waiting on one resident retain separate histories',async()=>{
 const releases=[],h=harness({configured:true,online:true,generate:c=>new Promise(r=>releases.push(()=>r(replyTo(c))))});
 const bob={...h.p,id:'bob',userKey:'bob',name:'Bob'};h.players.set(bob.id,bob);
 const aliceFirst=h.engine.hear(h.p,'Alice first'),bobFirst=h.engine.hear(bob,'Bob first'),aliceNext=h.engine.hear(h.p,'Alice next');
 for(const turn of [aliceFirst,bobFirst,aliceNext]){releases.shift()();assert.ok((await turn).ok);await flushDialogue();}
 assert.equal(h.calls[1].conversation.length,0);assert.equal(h.calls[2].conversation[0].text,'Alice first');assert.ok(!JSON.stringify(h.calls[2]).includes('Bob first'));
});
