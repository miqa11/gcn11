"use strict";

const combat=require('./city-combat');
const {randomUUID}=require('node:crypto');
const {createZombieMatch}=require('./server-city-zombies');
const DEFINITIONS = {
  zombies: {name:'ზომბების ათი ტალღა',icon:'🧟',rules:'გაუძელით ათ ტალღას ერთად. ყოველი ტალღა ძლიერდება; იარაღი ავტომატურად უმჯობესდება, თანაგუნდელები ტალღებს შორის ბრუნდებიან. ათივე ტალღის დასრულება: 50 000 მონეტა თითო რეგისტრირებულ მონაწილეს. ზომბები მხოლოდ მონაწილეებს ერჩიან.'},
  race: {name:"ქუჩის რბოლა", icon:"🏁", rules:"გაიარე ყველა საკონტროლო წერტილი რიგით. მანქანები ყველასთვის ერთნაირია. პირველი ფინიშზე იგებს."},
  hide: {name:"დამალობანა", icon:"👀", rules:"ერთ მაძებარს 20 წამი აქვს მოსაცდელად. დანარჩენები ქალაქში იმალებიან. დაჭერა: 40 ნაბიჯის წრეში 2 წამი."},
  battle: {name:"იარაღის ბრძოლა", icon:"🎯", rules:"ისროლე მიმართულებით. სამი მოხვედრა აგდებს მეტოქეს; 3 წამში ის ბრუნდება. 5 ქულა ან დროის ბოლოს მეტი ქულა იგებს."},
  tag: {name:"დაჭერობანა", icon:"🟠", rules:"გამოექეცი მდევარს. მის წრეში უწყვეტად 2 წამი დარჩენისას აგებ და მაყურებელი ხდები. ბოლო გაქცეული იგებს; ყველას დაჭერისას — მდევარი."}
};
const ROUTE = [{x:1500,y:360},{x:2160,y:360},{x:2160,y:780},{x:540,y:780},{x:540,y:360},{x:1500,y:360}];
const RADIUS=40, HOLD=2000;

function createWorldGames({io,players,world,garage,roomName,canPlayTogether=()=>true,now=Date.now,awardZombieVictory=()=>({}),inviteGuard=require('./server-city-invite-guard').createCityInviteGuard({now})}) {
  const rooms=new Map(), membership=new Map(), pending=new Map(), lastRequests=new Map();
  let sequence=0, lastPush=0;
  const emit=(id,event,data)=>io.sockets.sockets.get(id)?.emit(event,data);
  const fail=message=>({error:message});
  const available=p=>p&&!p.interiorId&&!p.rideId&&!p.vehicleId&&!p.gameId&&!p.activityLocked&&!p.gardenSeatId&&!p.gardenDance;
  const roomFor=id=>rooms.get(membership.get(id));
  const zero=p=>{p.inputX=p.inputY=0;p.vehicleSpeed=0;p.action="idle";p.actionUntil=0;};
  function publicRoom(r) {
    return {id:r.id,hostId:r.hostId,game:r.game,name:DEFINITIONS[r.game].name,rules:DEFINITIONS[r.game].rules,
      phase:r.phase,startAt:r.startAt||0,endAt:r.endAt||0,seekerId:r.seekerId||null,result:r.result||null,
      checkpoints:r.game==='race'?ROUTE:[],radius:RADIUS,holdMs:HOLD,weapon:r.game==='battle'?combat.battleWeapon:null,zombie:r.zombieEngine?.snapshot()||null,
      players:r.ids.map(id=>{const p=players.get(id),s=r.stats[id]||{};return {id,name:p?.name||s.name,x:p?.x,y:p?.y,dir:p?.dir,
        aimAngle:s.aimAngle,checkpoint:s.checkpoint||0,score:s.score||0,kills:s.kills||0,hp:s.hp??3,out:!!s.out,respawnAt:s.respawnAt||0,hold:s.hold||0};}),
      invitations:[...pending.values()].filter(i=>i.roomId===r.id).map(i=>({id:i.id,targetId:i.targetId,name:players.get(i.targetId)?.name,expiresAt:i.expiresAt}))};
  }
  function send(r) { const data=publicRoom(r); for(const id of r.ids)emit(id,'city:world:room',data); }
  function cancelInvitation(i) {
    pending.delete(i.id);inviteGuard.release(i.id);emit(i.targetId,'city:world:inviteClosed',{id:i.id});
  }
  function releasePlayer(r,id) {
    const p=players.get(id);membership.delete(id);
    if(p&&p.worldGameId===r.id) {
      if(p.vehicleId&&garage.find(p.vehicleId)?.worldGameId===r.id)garage.removeRaceCars(r.id,p.id);
      if(r.phase!=='finished') {
        if(r.origins[id])Object.assign(p,r.origins[id]);
        p.worldFrozen=false;zero(p);
      }
      p.worldGameId=null;p.gameId=null;
    }
    emit(id,'city:world:room',null);
  }
  function destroy(r) {
    for(const i of [...pending.values()])if(i.roomId===r.id)cancelInvitation(i);
    for(const id of [...r.ids])releasePlayer(r,id);
    r.zombieEngine?.clear();garage.removeRaceCars(r.id);rooms.delete(r.id);
  }
  function finish(r,winners,text,zombieVictory=false) {
    if(r.phase==='finished')return;
    r.phase='finished';r.result={winners,text,rewards:{}};r.cleanupAt=now()+12000;
    if(zombieVictory&&r.game==='zombies')r.result.rewards=awardZombieVictory(r.id,r.ids.map(id=>players.get(id)).filter(Boolean));
    r.zombieEngine?.clear();
    garage.removeRaceCars(r.id);
    for(const id of r.ids){const p=players.get(id);if(p){if(r.origins[id])Object.assign(p,r.origins[id]);p.worldFrozen=false;zero(p);}}
    send(r);
  }
  function leave(id) {
    for(const i of [...pending.values()])if(i.targetId===id)cancelInvitation(i);
    const r=roomFor(id);if(!r)return;
    releasePlayer(r,id);r.ids=r.ids.filter(x=>x!==id);
    if(!r.ids.length){destroy(r);return;}
    if(r.hostId===id)r.hostId=r.ids[0];
    if(r.phase!=='lobby'&&r.phase!=='finished'&&(r.ids.length<2||r.seekerId===id))finish(r,r.ids,'მატჩი დასრულდა — მოთამაშემ თამაში დატოვა.');
    else send(r);
  }
  function join(r,p) {
    membership.set(p.id,r.id);r.ids.push(p.id);r.stats[p.id]={name:p.name,checkpoint:0,score:0,hp:3,out:false,hold:0};
    p.gameId=p.worldGameId=r.id;p.worldFrozen=false;zero(p);
  }
  function create(id,game) {
    const p=players.get(id);if(!available(p)||membership.has(id))return fail('ჯერ ქუჩაში ფეხით დაბრუნდი და მიმდინარე თამაში დაასრულე.');
    if(inviteGuard.busy(p))return fail('ჯერ უპასუხე ან გააუქმე მიმდინარე მოწვევა.');
    if(!Object.hasOwn(DEFINITIONS,game))return fail('აირჩიე თამაში.');
    const r={id:'world-'+(++sequence)+(game==='zombies'?'-'+randomUUID():''),hostId:id,game,phase:'lobby',ids:[],stats:{},origins:{},createdAt:now()};
    rooms.set(r.id,r);join(r,p);send(r);return {ok:true};
  }
  function invite(id,targetId) {
    for(const i of [...pending.values()])if(now()>=i.expiresAt)cancelInvitation(i);
    const r=roomFor(id),from=players.get(id),to=players.get(targetId);
    if(!r||r.hostId!==id||r.phase!=='lobby')return fail('მოწვევა მხოლოდ ლობის შემქმნელს შეუძლია.');
    if(!available(to)||to===from||!r.ids.every(x=>canPlayTogether(players.get(x),to)))return fail('ამ მოთამაშის მოწვევა ახლა შეუძლებელია.');
    if([...pending.values()].some(i=>i.targetId===targetId))return fail('მოთამაშე უკვე ელოდება მოწვევას.');
    if(r.ids.length+[...pending.values()].filter(i=>i.roomId===r.id).length>=6)return fail('ლობის მაქსიმუმი 6 მოთამაშეა.');
    const denied=inviteGuard.check(from,to,'world');if(denied)return denied;
    const i={id:'invite-'+(++sequence),roomId:r.id,fromId:id,targetId,expiresAt:now()+30000};pending.set(i.id,i);inviteGuard.reserve(from,to,i.id,'world',i.expiresAt);
    emit(targetId,'city:world:invited',{...i,fromName:from.name,game:r.game,name:DEFINITIONS[r.game].name,rules:DEFINITIONS[r.game].rules});send(r);return {ok:true};
  }
  function respond(id,data) {
    const i=pending.get(data.id),r=i&&rooms.get(i.roomId),p=players.get(id);
    if(!i||i.targetId!==id)return fail('მოწვევა აღარ მოქმედებს.');
    cancelInvitation(i);
    if(!r||r.phase!=='lobby'||now()>=i.expiresAt)return fail('მოწვევის დრო ამოიწურა.');
    if(data.accept===true){
      if(!available(p)||r.ids.length>=6||!r.ids.every(x=>canPlayTogether(players.get(x),p)))return fail('ლობის შემოერთება ახლა შეუძლებელია.');
      join(r,p);
    }else if(data.accept===false){const from=players.get(i.fromId);if(from){const cooldown=inviteGuard.decline(from,p);emit(i.fromId,'city:world:declined',{targetId:id,name:p.name,...cooldown});}}
    send(r);return {ok:true};
  }
  function start(id) {
    const r=roomFor(id);if(!r||r.hostId!==id||r.phase!=='lobby')return fail('დაწყება მხოლოდ ლობის შემქმნელს შეუძლია.');
    if(r.ids.length<2||r.ids.length>6)return fail('საჭიროა 2–6 მოთამაშე.');
    if(!r.ids.every(x=>players.get(x)?.worldGameId===r.id))return fail('მოთამაშე მიუწვდომელია.');
    for(const i of [...pending.values()])if(i.roomId===r.id)cancelInvitation(i);
    if(r.game==='race'){
      const result=garage.spawnRaceCars(r.id,r.ids.map(x=>players.get(x)));
      if(result.error)return result;
      r.origins=result.origins;
    } else for(const pid of r.ids){const p=players.get(pid);r.origins[pid]={x:p.x,y:p.y,dir:p.dir};}
    if(r.game!=='race'){
      const spots=[];for(let x=600;x<=1800;x+=80)if(world.isWalkable(x,360,12)&&!garage.list().some(v=>Math.hypot(v.x-x,v.y-360)<70))spots.push({x,y:360});
      if(spots.length<r.ids.length)return fail('შეკრების გზა დაკავებულია. მოგვიანებით სცადე.');
      r.ids.forEach((pid,index)=>Object.assign(players.get(pid),spots[index]));
    }
    r.phase='countdown';r.startAt=now()+5000;r.endAt=r.startAt+(r.game==='zombies'?900000:r.game==='race'?240000:180000);
    if(r.game==='zombies')r.zombieEngine=createZombieMatch({room:r,players,world,garage,now,onFinish:(w,t,v)=>finish(r,w,t,v),onShot:data=>io.to(roomName).emit('city:world:shot',data)});
    if(r.game==='hide'||r.game==='tag')r.seekerId=r.ids[Math.floor(Math.random()*r.ids.length)];
    for(const pid of r.ids){const p=players.get(pid);p.worldFrozen=true;zero(p);}
    send(r);return {ok:true};
  }
  function lineClear(a,b) {
    const steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/6);
    for(let k=1;k<steps;k++)if(!world.isWalkable(a.x+(b.x-a.x)*k/steps,a.y+(b.y-a.y)*k/steps,2))return false;
    return true;
  }
  function shoot(id,data) {
    const r=roomFor(id),p=players.get(id),s=r?.stats[id],at=now();
    if(r?.game==='zombies'){const result=r.zombieEngine?.shoot(id,data)||fail('მატჩი ჯერ არ დაწყებულა.');send(r);return result;}
    if(!r||r.game!=='battle'||r.phase!=='playing'||!p||(s.respawnAt>at||s.hp<=0))return fail('სროლა ახლა შეუძლებელია.');
    if(!Number.isFinite(data.angle)||Math.abs(data.angle)>Math.PI*2)return fail('დამიზნება არასწორია.');
    const gun=combat.battleWeapon;if(at-(s.lastShot??-Infinity)<gun.cooldown)return {error:'გადატენვა…',code:'COOLDOWN',retryAfterMs:gun.cooldown-(at-s.lastShot)};
    s.lastShot=at;s.aimAngle=data.angle;
    const origin=combat.muzzle(p),targets=r.ids.filter(targetId=>targetId!==id&&players.has(targetId)&&r.stats[targetId].hp>0&&!(r.stats[targetId].respawnAt>at)).map(targetId=>{const t=players.get(targetId);return {id:targetId,x:t.x,y:t.y-10,radius:18};});
    const shot=combat.raycast(world,origin,data.angle,gun.range,targets),best=shot.hit&&players.get(shot.hit.id);
    io.to(roomName).emit('city:world:shot',{roomId:r.id,from:origin,to:shot.to,...combat.shotMeta(data,id,gun),hit:!!best});
    if(best){const target=r.stats[best.id];target.hp--;
      if(target.hp<=0){s.score++;target.respawnAt=at+3000;best.worldFrozen=true;zero(best);if(s.score>=5)finish(r,[id],p.name+' იმარჯვებს!');}
    }
    send(r);return {ok:true,hit:!!best};
  }
  function tick() {
    const at=now();
    for(const i of [...pending.values()])if(at>=i.expiresAt){cancelInvitation(i);const r=rooms.get(i.roomId);if(r)send(r);}
    for(const r of [...rooms.values()]){
      if(r.phase==='lobby'){if(at-r.createdAt>300000)destroy(r);continue;}
      if(r.phase==='finished'){if(at>=r.cleanupAt)destroy(r);continue;}
      if(!r.ids.every(a=>r.ids.every(b=>a===b||canPlayTogether(players.get(a),players.get(b))))){finish(r,[],'მატჩი დასრულდა — მოწვევები დაიბლოკა.');continue;}
      if(r.phase==='countdown'&&at>=r.startAt){r.phase='playing';for(const id of r.ids)players.get(id).worldFrozen=false;}
      if(r.phase!=='playing')continue;
      if(r.game==='zombies'){if(at>=r.endAt)finish(r,[],'დრო ამოიწურა — ათი ტალღა ვერ დასრულდა.');else r.zombieEngine.tick();continue;}
      for(const id of r.ids){
        const p=players.get(id),s=r.stats[id];if(!p)continue;
        if(r.game==='race'&&!s.out){const cp=ROUTE[s.checkpoint];
          if(cp&&Math.hypot(p.x-cp.x,p.y-cp.y)<65&&garage.find(p.vehicleId)?.worldGameId===r.id){s.checkpoint++;if(s.checkpoint===ROUTE.length){finish(r,[id],p.name+' პირველი მივიდა ფინიშზე!');break;}}
        }
        if(r.game==='battle'&&s.respawnAt&&at>=s.respawnAt){Object.assign(p,r.origins[id]);s.hp=3;s.respawnAt=0;p.worldFrozen=false;zero(p);}
        if((r.game==='tag'||r.game==='hide')&&id!==r.seekerId&&!s.out){
          const seeker=players.get(r.seekerId),hiding=r.game==='hide'&&at<r.startAt+20000;
          if(seeker)seeker.worldFrozen=hiding;
          const inCircle=!hiding&&seeker&&Math.hypot(p.x-seeker.x,p.y-seeker.y)<=RADIUS&&lineClear(seeker,p);
          if(!inCircle){s.holdSince=null;s.hold=0;}else{if(s.holdSince==null)s.holdSince=at;s.hold=Math.min(1,(at-s.holdSince)/HOLD);if(s.hold===1){s.out=true;p.worldFrozen=true;zero(p);}}
        }
      }
      if(r.phase!=='playing')continue;
      if(r.game==='tag'||r.game==='hide'){
        const runners=r.ids.filter(id=>id!==r.seekerId&&!r.stats[id].out);
        if(!runners.length){finish(r,[r.seekerId],'მდევარმა ყველა მოთამაშე დაიჭირა!');continue;}
        if(r.game==='tag'&&r.ids.length>2&&runners.length===1){finish(r,runners,'ბოლო გაქცეული იმარჯვებს!');continue;}
      }
      if(at>=r.endAt){
        let winners=[];
        if(r.game==='race'){const best=Math.max(...r.ids.map(id=>r.stats[id].checkpoint));winners=r.ids.filter(id=>r.stats[id].checkpoint===best);}
        else if(r.game==='battle'){const best=Math.max(...r.ids.map(id=>r.stats[id].score));winners=r.ids.filter(id=>r.stats[id].score===best);}
        else winners=r.ids.filter(id=>id!==r.seekerId&&!r.stats[id].out);
        finish(r,winners,'დრო ამოიწურა. შედეგები დაფაზეა.');
      }
    }
    if(at-lastPush>=200){lastPush=at;io.to(roomName).emit('city:world:clock',{now:at});for(const r of rooms.values())if(r.phase!=='lobby')send(r);io.to(roomName).emit('city:world:public',[...rooms.values()].filter(r=>r.phase!=='lobby').map(publicRoom));}
  }
  function bind(socket) {
    const handle=(event,fn)=>socket.on('city:world:'+event,(data,ack)=>{
      data=data&&typeof data==='object'?data:{};
      if(!players.has(socket.id)){if(typeof ack==='function')ack(fail('ჯერ ქალაქში შემოდი.'));return;}
      const key=socket.id+':'+event,at=now();if(at-(lastRequests.get(key)??-Infinity)<(event==='shoot'?80:300)){if(typeof ack==='function')ack(fail('ცოტა მოიცადე.'));return;}
      lastRequests.set(key,at);const result=fn(data)||{ok:true};if(typeof ack==='function')ack(result);
    });
    handle('create',d=>create(socket.id,d.game));handle('invite',d=>invite(socket.id,d.targetId));handle('respond',d=>respond(socket.id,d));
    handle('start',()=>start(socket.id));handle('leave',()=>leave(socket.id));handle('shoot',d=>shoot(socket.id,d));
    handle('sync',()=>{const r=roomFor(socket.id);emit(socket.id,'city:world:room',r?publicRoom(r):null);emit(socket.id,'city:world:public',[...rooms.values()].filter(r=>r.phase!=='lobby').map(publicRoom));return {ok:true};});
  }
  function remove(id){leave(id);for(const key of lastRequests.keys())if(key.startsWith(id+':'))lastRequests.delete(key);}
  return {bind,tick,remove,rooms,definitions:DEFINITIONS};
}
module.exports={createWorldGames,DEFINITIONS,ROUTE};
