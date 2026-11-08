"use strict";
const crypto=require("node:crypto"),G=require("./bura-game"),Bot=require("./bura-bot");
const STAKE=30,RETURN=58;
function weekKey(now){const d=new Date(now+4*3600000);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
function createBura({io,registeredUsers,spendableCoins,changeCoins,saveAuthUsers,notifyGameInvite=()=>{},onStart=()=>{},isVisiblyOnline=()=>true,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,rng=Math.random,moveMs=30000,reconnectMs=40000,botMs=1000,roundMs=5000}){
 const rooms=new Map(),byUser=new Map(),cooldowns=new Map(),rates=new Map();
 const timer=(f,ms)=>{const t=setTimer(f,ms);t?.unref?.();return t;};
 const emit=(p,event,data)=>{if(p.socketId){const sk=io.sockets.sockets.get(p.socketId);if(sk?._regUser?.usernameLower===p.lc)sk.emit(event,data);}};
 const blocked=(a,b)=>{const x=registeredUsers.get(a),y=registeredUsers.get(b);return !x||!y||(x.blockedUsers||[]).includes(b)||(y.blockedUsers||[]).includes(a);};
 function balance(lc){const u=registeredUsers.get(lc);return u&&!u.isGuest?spendableCoins(u,lc):null;}
 function coins(lc,delta){const u=registeredUsers.get(lc);if(u)changeCoins(u,lc,delta,{save:false});}
 function coinNotice(lc){io.to(`user:${lc}`).emit("coins:changed",{coins:balance(lc)});}
 // A process restart voids unfinished matches and returns each reserved stake once.
 let recovered=false;
 for(const [lc,u] of registeredUsers)if(u.buraEscrow){const amount=u.buraEscrow.amount;delete u.buraEscrow;if(amount===STAKE){coins(lc,STAKE);recovered=true;}}
 if(recovered)saveAuthUsers();
 function rank(u){const w=weekKey(now());return u.buraWeekly?.week===w?{...u.buraWeekly}:{week:w,wins:0,losses:0,net:0};}
 function rankings(){return [...registeredUsers.values()].filter(u=>!u.isGuest).map(u=>({username:u.username,...rank(u)})).filter(u=>u.wins||u.losses).sort((a,b)=>b.wins-a.wins||b.net-a.net||a.losses-b.losses||a.username.localeCompare(b.username)).slice(0,50);}
 function publicRooms(){return [...rooms.values()].filter(r=>r.status==="lobby"&&!r.bot).map(r=>({roomId:r.id,hostUsername:r.players[0].username,playerCount:r.players.length,maxPlayers:2,status:r.status,stake:STAKE}));}
 function list(){io.emit("bura:publicRooms",publicRooms());}
 function view(r,p){return {serverNow:now(),roomId:r.id,status:r.status,version:r.version,hostUsername:r.players[0].username,bot:r.bot,stake:r.bot?0:STAKE,coins:balance(p.lc),players:r.players.map((a,seat)=>({username:a.username,avatar:a.avatar,seat,connected:a.connected,ready:a.ready,bot:!!a.bot})),mySeat:r.players.indexOf(p),game:r.game?G.viewForSeat(r.game,r.players.indexOf(p)):null,deadline:r.deadline||null,nextRoundAt:r.nextRoundAt||null,reconnectUntil:r.players.map(a=>a.reconnectUntil||null),paused:r.status==="playing"&&r.players.some(a=>!a.connected),messages:r.messages.slice(),settlement:r.settlement||null,weekly:rank(registeredUsers.get(p.lc)||{})};}
 function publish(r,{chatOnly=false}={}){
  if(!chatOnly)r.version++;
  for(const p of r.players)if(!p.bot){
   const data=view(r,p);if(chatOnly)data.chatOnly=true;emit(p,"bura:room",data);
  }
 }
 function clearMove(r){clearTimer(r.moveTimer);clearTimer(r.botTimer);r.moveTimer=r.botTimer=null;}
 function settle(r){
  if(r.settled)return;r.settled=true;r.status="ended";r.deadline=null;clearMove(r);clearTimer(r.roundTimer);
  const winner=r.game.winner;
  if(!r.bot){
   const valid=r.players.every(p=>registeredUsers.get(p.lc)?.buraEscrow?.matchId===r.id&&registeredUsers.get(p.lc).buraEscrow.amount===STAKE);
   if(valid){
    for(const [i,p] of r.players.entries()){const u=registeredUsers.get(p.lc);delete u.buraEscrow;const w=rank(u);if(i===winner){coins(p.lc,RETURN);w.wins++;w.net+=28;}else{w.losses++;w.net-=30;}u.buraWeekly=w;}
    r.settlement={winner,profit:28,loss:30,fee:2};saveAuthUsers();for(const p of r.players)coinNotice(p.lc);
   }else{
    for(const p of r.players){const u=registeredUsers.get(p.lc);if(u?.buraEscrow?.matchId===r.id){delete u.buraEscrow;coins(p.lc,STAKE);}}
    r.settlement={void:true};saveAuthUsers();
   }
  }
  for(const p of r.players){clearTimer(p.graceTimer);p.reconnectUntil=null;if(byUser.get(p.lc)===r.id)byUser.delete(p.lc);}
  publish(r);list();r.cleanupTimer=timer(()=>remove(r),600000);
 }
 function schedule(r){
  clearMove(r);if(r.status!=="playing")return;
  if(r.game.finished)return settle(r);
  if(r.game.round.phase==="done"){
   r.deadline=null;if(!r.roundTimer){r.nextRoundAt=now()+roundMs;r.roundTimer=timer(()=>{r.roundTimer=null;r.nextRoundAt=null;if(r.status!=="playing")return;G.startRound(r.game,undefined,rng);r.remaining=moveMs;schedule(r);publish(r);},roundMs);}return;
  }
  if(r.players.some(p=>!p.connected)){r.deadline=null;return;}
  if(r.game.round.phase==="collect"){
   const remaining=r.game.round.history.at(-1).completedAt+G.TRICK_DISPLAY_MS-now();
   if(remaining>0){
    r.deadline=null;
    r.moveTimer=timer(()=>{schedule(r);if(!r.settled)publish(r);},remaining);
    return;
   }
  }
  r.deadline=now()+(r.remaining??moveMs);r.remaining=null;
  const seat=r.game.round.turnSeat;
  r.moveTimer=timer(()=>{r.moveTimer=null;if(r.status!=="playing")return;G.timeout(r.game,seat);r.remaining=moveMs;schedule(r);if(!r.settled)publish(r);},Math.max(1,r.deadline-now()));
  const bot=r.players.find(p=>p.bot);
  if(bot){const v=G.viewForSeat(r.game,r.players.indexOf(bot)),choice=Bot.choose(v);if(choice)r.botTimer=timer(()=>{r.botTimer=null;const result=G.act(r.game,v.mySeat,choice.action,choice,now);if(result.ok){r.remaining=moveMs;schedule(r);if(!r.settled)publish(r);}},botMs);}
 }
 function closeInvites(r){for(const [lc,inv] of r.pending){clearTimer(inv.timer);io.to(`user:${lc}`).emit("bura:inviteClosed",{roomId:r.id});}r.pending.clear();}
 function remove(r){clearMove(r);clearTimer(r.roundTimer);clearTimer(r.cleanupTimer);closeInvites(r);rooms.delete(r.id);for(const p of r.players){clearTimer(p.graceTimer);if(byUser.get(p.lc)===r.id)byUser.delete(p.lc);}list();}
 function start(r){
  if(r.status!=="lobby"||r.players.length!==2||!r.players.every(p=>p.connected&&p.ready))return;
  if(!r.bot){
   if(blocked(r.players[0].lc,r.players[1].lc)){r.players.forEach(p=>p.ready=false);return errorRoom(r,"დაბლოკილ მოთამაშესთან თამაში ვერ დაიწყება.");}
   if(!r.players.every(p=>{const u=registeredUsers.get(p.lc);return u&&!u.isGuest&&!u.buraEscrow&&balance(p.lc)>=STAKE;})){r.players.forEach(p=>p.ready=false);return errorRoom(r,"ორივე მოთამაშეს მინიმუმ 30 თავისუფალი მონეტა სჭირდება.");}
   for(const p of r.players){coins(p.lc,-STAKE);registeredUsers.get(p.lc).buraEscrow={matchId:r.id,amount:STAKE};}saveAuthUsers();r.players.forEach(p=>coinNotice(p.lc));
  }
  clearTimer(r.cleanupTimer);closeInvites(r);r.game=G.createGame();r.status="playing";onStart();G.startRound(r.game,undefined,rng);schedule(r);list();
 }
 function errorRoom(r,message){for(const p of r.players)emit(p,"bura:error",{message});publish(r);}
 function person(s,u,lc){return {lc,username:u.username,avatar:u.avatar||"avatar1.png",socketId:s.id,connected:true,ready:false};}
 function attach(socket){
  const on=(event,handler)=>socket.on(event,data=>handler(data&&typeof data==="object"&&!Array.isArray(data)?data:{}));
  let actionWindow={at:now(),count:0};
  const identity=()=>{const lc=socket._regUser?.usernameLower,u=registeredUsers.get(lc);return u?{lc,u}:null;};
  const err=(message,code)=>socket.emit("bura:error",{message,code});
  function limited(lane,ms){const key=socket.id+":"+lane,last=rates.get(key);if(last!==undefined&&now()-last<ms)return true;rates.set(key,now());return false;}
  function member(id){const a=identity(),r=typeof id==="string"?rooms.get(id):null,p=a&&r?.players.find(p=>p.lc===a.lc&&p.socketId===socket.id);return p?{r,p,seat:r.players.indexOf(p)}:null;}
  function bind(r,p){const previous=p.socketId;if(previous&&previous!==socket.id)io.sockets.sockets.get(previous)?.emit("bura:replaced");clearTimer(p.graceTimer);p.socketId=socket.id;p.connected=true;p.reconnectUntil=null;if(r.status!=="ended")byUser.set(p.lc,r.id);else if(byUser.get(p.lc)===r.id)byUser.delete(p.lc);}
  on("bura:listPublicRooms",()=>{if(!limited("list",500)){socket.emit("bura:publicRooms",publicRooms());const a=identity();if(a)socket.emit("bura:balance",{coins:balance(a.lc)});}});
  on("bura:rankings",()=>{if(!limited("rank",1000))socket.emit("bura:rankings",{week:weekKey(now()),rows:rankings()});});
  on("bura:invite",(data={})=>{
   const a=identity();if(!a)return;if(limited(Array.isArray(data.toUsernames)&&data.toUsernames.length?"sendInvite":"createRoom",750))return err("მოიცადე წამი და მოწვევა ხელახლა გაგზავნე.");
   if(a.u.isGuest)return err("ცოცხალ მოთამაშესთან სათამაშოდ შედი ანგარიშში; ბოტთან თამაში უფასოა.");
   let r=rooms.get(byUser.get(a.lc));if(r&&(r.status!=="lobby"||r.players[0].lc!==a.lc))return err("ჯერ დატოვე ან დაასრულე მიმდინარე ბურა.");
   if(!r){r={id:crypto.randomBytes(12).toString("hex"),status:"lobby",bot:false,players:[person(socket,a.u,a.lc)],pending:new Map(),messages:[],version:0};rooms.set(r.id,r);byUser.set(a.lc,r.id);r.cleanupTimer=timer(()=>{for(const p of r.players)emit(p,"bura:closed");remove(r);},600000);}else bind(r,r.players[0]);
   const invited=[],cooldown=[],unavailable=[];
   for(const name of [...new Set(Array.isArray(data.toUsernames)?data.toUsernames.filter(n=>typeof n==="string").slice(0,6):[])]){
    const lc=name.trim().toLowerCase(),u=registeredUsers.get(lc),key=a.lc+"|"+lc;
    if(lc===a.lc||r.pending.has(lc)||r.players.some(p=>p.lc===lc))continue;
    if((cooldowns.get(key)||0)>now()){cooldown.push(u?.username||name);continue;}
    if(r.players.length>=2||!u||u.isGuest||!isVisiblyOnline(lc)||blocked(a.lc,lc)||byUser.has(lc)){unavailable.push(name);continue;}
    const inv={timer:timer(()=>{r.pending.delete(lc);io.to(`user:${lc}`).emit("bura:inviteClosed",{roomId:r.id});},45000)};r.pending.set(lc,inv);
    io.to(`user:${lc}`).emit("bura:invited",{roomId:r.id,fromUsername:a.u.username,stake:STAKE,expiresAt:now()+45000});r.kicked?.delete(lc);notifyGameInvite(lc,"bura",r.id,a.u.username);invited.push(u.username);
   }
   for(const [key,end] of cooldowns)if(end<=now())cooldowns.delete(key);
   socket.emit("bura:inviteSent",{invited,cooldown,unavailable});publish(r);list();
  });
  on("bura:declineInvite",(d={})=>{const a=identity(),r=rooms.get(d.roomId),inv=a&&r?.pending.get(a.lc);if(!inv)return;clearTimer(inv.timer);r.pending.delete(a.lc);cooldowns.set(r.players[0].lc+"|"+a.lc,now()+60000);emit(r.players[0],"bura:inviteDeclined",{username:a.u.username});socket.emit("bura:inviteClosed",{roomId:r.id});});
  on("bura:join",(d={})=>{
   const a=identity(),r=rooms.get(d.roomId);if(!a||limited("join",300))return;if(!r)return err("მაგიდა აღარ არსებობს. ბალანსი თამაშების გვერდზე გადაამოწმე.","ROOM_CLOSED");
   const existing=r.players.find(p=>p.lc===a.lc);
   if(existing){if(byUser.has(a.lc)&&byUser.get(a.lc)!==r.id)return err("უკვე სხვა ბურას თამაშობ.");bind(r,existing);if(r.status==="playing"&&!r.game.finished){if(r.deadline)r.remaining=Math.max(1,r.deadline-now());schedule(r);}publish(r);return;}
   if(a.u.isGuest||r.kicked?.has(a.lc)||r.bot||r.status!=="lobby"||r.players.length>=2||blocked(a.lc,r.players[0].lc)||byUser.has(a.lc))return err("მაგიდასთან შემოერთება ახლა ვერ ხერხდება.");
   r.players.push(person(socket,a.u,a.lc));byUser.set(a.lc,r.id);closeInvites(r);publish(r);list();
  });
  on("bura:bot",()=>{const a=identity();if(!a||limited("bot",1500))return;if(byUser.has(a.lc))return err("ჯერ დატოვე მიმდინარე ბურა.");const r={id:crypto.randomBytes(12).toString("hex"),status:"lobby",bot:true,players:[{...person(socket,a.u,a.lc),ready:true},{lc:"$bot",username:"ბურას ოსტატი",avatar:"avatar2.png",bot:true,connected:true,ready:true}],pending:new Map(),messages:[],version:0};rooms.set(r.id,r);byUser.set(a.lc,r.id);start(r);publish(r);});
  on("bura:kick",(d={})=>{const m=member(d.roomId);if(!m||m.seat!==0||m.r.status!=="lobby"||typeof d.username!=="string")return;const {r}=m,p=r.players.find(p=>p.lc===d.username.toLowerCase()&&p!==r.players[0]);if(!p)return;r.kicked??=new Set();r.kicked.add(p.lc);clearTimer(p.graceTimer);emit(p,"bura:kicked");r.players=r.players.filter(a=>a!==p);byUser.delete(p.lc);r.players[0].ready=false;publish(r);list();});
  on("bura:ready",(d={})=>{const m=member(d.roomId);if(!m||m.r.status!=="lobby")return;m.p.ready=true;start(m.r);if(!m.r.settled)publish(m.r);});
  on("bura:action",(d={})=>{
   const m=member(d.roomId);if(!m||m.r.status!=="playing")return;if(now()-actionWindow.at>=1000)actionWindow={at:now(),count:0};if(++actionWindow.count>20)return err("მოქმედებები ძალიან სწრაფად იგზავნება — სცადე ხელახლა.");
   const {r,seat}=m;if(r.players.some(p=>!p.connected))return err("დაელოდე მოწინააღმდეგის დაბრუნებას.");
   if(d.version!==r.version){socket.emit("bura:room",view(r,m.p));return err("მაგიდა განახლდა — სცადე ხელახლა.");}
   if(r.game.round.phase==="collect"&&!r.deadline)return err("დაელოდე მაგიდის გასუფთავებას.");
   if(r.deadline&&now()>=r.deadline){G.timeout(r.game,r.game.round.turnSeat);r.remaining=moveMs;schedule(r);if(!r.settled)publish(r);return;}
   const result=G.act(r.game,seat,d.action,d,now);if(!result.ok)return err(result.error);r.remaining=moveMs;schedule(r);if(!r.settled)publish(r);
  });
  on("bura:chat",(d={})=>{const m=member(d.roomId);if(!m||limited("chat",800)||typeof d.text!=="string")return;const text=d.text.trim().slice(0,240);if(!text)return;m.r.messages.push({username:m.p.username,text,at:now()});if(m.r.messages.length>40)m.r.messages.shift();publish(m.r,{chatOnly:true});});
  on("bura:leave",(d={})=>{const m=member(d.roomId);if(!m){socket.emit("bura:left");return;}const {r,p,seat}=m;if(r.status==="playing"){G.forfeitMatch(r.game,seat,"leave");settle(r);}else if(r.status==="lobby"){if(seat===0){r.players.forEach(p=>emit(p,"bura:closed"));remove(r);}else{r.players.splice(seat,1);byUser.delete(p.lc);publish(r);list();}}socket.emit("bura:left");});
  on("disconnect",()=>{
   for(const key of rates.keys())if(key.startsWith(socket.id+":"))rates.delete(key);
   const a=identity(),r=a&&rooms.get(byUser.get(a.lc)),p=r?.players.find(p=>p.socketId===socket.id);if(!p||r.status==="ended")return;
   p.connected=false;p.ready=false;p.reconnectUntil=now()+reconnectMs;if(r.deadline)r.remaining=Math.max(1,r.deadline-now());clearMove(r);r.deadline=null;
   p.graceTimer=timer(()=>{p.graceTimer=null;if(p.connected)return;if(r.status==="playing"){G.forfeitMatch(r.game,r.players.indexOf(p),"disconnect");settle(r);}else{r.players.forEach(p=>emit(p,"bura:closed"));remove(r);}},reconnectMs);publish(r);
  });
 }
 return {attach,rooms,byUser,rankings,publicRooms,viewForPlayer:view,close(){let changed=false;for(const r of [...rooms.values()]){for(const p of r.players){const u=registeredUsers.get(p.lc);if(u?.buraEscrow?.matchId===r.id){delete u.buraEscrow;coins(p.lc,STAKE);changed=true;}}remove(r);}if(changed)saveAuthUsers();}};
}
module.exports={createBura,weekKey};
