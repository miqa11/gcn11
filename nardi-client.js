(function(){
 "use strict";
 const $=id=>document.getElementById(id),E=window.NardiRules,socket=io();window.attachTempBanGuard?.(socket);
 let room=null,picked=new Set(),online=[],myName="",busy=false,connected=false,offset=0,chatKey="";
 const reasons={bearoff:"ქვები გაყვანილია",drop:"გადავების დათმობა",timeoutDrop:"კუბის პასუხის დრო ამოიწურა",timeout:"სვლის დრო ამოიწურა",timeouts:"დრო ზედიზედ ორჯერ ამოიწურა",disconnect:"კავშირი ვერ აღდგა",leave:"მატჩის დათმობა"};
 let selectedFrom=null,selectedDie=null,boardSeat=null;

 function stored(kind,key){try{return window[kind].getItem(key);}catch{return null;}}
 function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 function toast(text){if(room?.game&&$("gameScreen").classList.contains("active")){$("hint").textContent=text;$("hint").classList.add("feedback");return;}$("toast").textContent=text;$("toast").classList.remove("hidden");clearTimeout(toast.timer);toast.timer=setTimeout(()=>$("toast").classList.add("hidden"),4000);}
 function screen(name){document.querySelectorAll(".bu-screen").forEach(n=>n.classList.toggle("active",n.id===name+"Screen"));}
 function avatar(p){const img=node("img","bu-avatar");img.src="/"+(p?.avatar||"avatar1.png");img.alt="";return img;}
 function showDialog(id){document.querySelectorAll("dialog[open]").forEach(d=>{if(d.id!==id)d.close();});const d=$(id);if(!d.open)d.showModal();}
 document.querySelectorAll("[data-dialog]").forEach(b=>b.addEventListener("click",()=>showDialog(b.dataset.dialog)));
 document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>b.closest("dialog").close()));
 document.querySelectorAll("dialog").forEach(d=>d.addEventListener("click",e=>{if(e.target!==d)return;const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}));
 function reset(){room=null;selectedFrom=null;selectedDie=null;boardSeat=null;busy=false;screen("setup");history.replaceState(null,"","/nardi.html");socket.emit("nardi:listPublicRooms");}
 function leave(){if(!room)return reset();if(room.status==="playing"&&!confirm(room.bot?"დატოვებ ბოტთან თამაშს?":"მატჩის დატოვება დათმობაა და შენახული 30 მონეტა დაიკარგება. დატოვებ?"))return;socket.emit("nardi:leave",{roomId:room.roomId});}
 $("lobbyBack").addEventListener("click",leave);$("gameBack").addEventListener("click",leave);$("againBtn").addEventListener("click",leave);
 $("createBtn").addEventListener("click",()=>socket.emit("nardi:invite",{toUsernames:[],target:Number($("targetSelect").value)}));$("botBtn").addEventListener("click",()=>socket.emit("nardi:bot",{target:Number($("targetSelect").value)}));
 $("readyBtn").addEventListener("click",()=>{if(room)socket.emit("nardi:ready",{roomId:room.roomId});});
 $("sendInvites").addEventListener("click",()=>{socket.emit("nardi:invite",{toUsernames:[...picked]});picked.clear();paintInviteList();});
 function paintInviteList(){
  const box=$("inviteList");box.replaceChildren();const full=room?.players.length>=2;
  const people=full?[]:online.filter(u=>!!u.isGuest===guestPlayer&&!room?.players.some(p=>p.username.toLowerCase()===u.username.toLowerCase())&&u.username.toLowerCase()!==myName.toLowerCase());
  for(const u of people){const row=node("label","bu-list-row"),input=node("input");input.type="checkbox";input.checked=picked.has(u.username);input.addEventListener("change",()=>{if(input.checked)picked.add(u.username);else picked.delete(u.username);$("sendInvites").disabled=!picked.size;});row.append(avatar(u),node("span","name",u.username),input);box.append(row);}
  if(!people.length)box.append(node("div","bu-empty",full?"მაგიდა სავსეა.":"ონლაინ მოთამაშე ჯერ არ არის — შეგიძლია ბოტთან ითამაშო."));$("sendInvites").disabled=!picked.size||full;
 }
 function paintLobby(){
  screen("lobby");const box=$("lobbyPlayers");box.replaceChildren();for(const p of room.players){const row=node("div","bu-list-row");row.append(avatar(p),node("span","name",p.username),node("small",null,p.ready?"მზადაა ✓":p.connected?"მზადებას ელის":"კავშირი გაწყდა"));if(room.mySeat===0&&p.seat!==0){const kick=node("button","bu-btn danger","მოშორება");kick.addEventListener("click",()=>socket.emit("nardi:kick",{roomId:room.roomId,username:p.username}));row.append(kick);}box.append(row);}
  if(room.players.length<2)box.append(node("div","bu-empty","თავისუფალი ადგილი — მოიწვიე მოთამაშე"));
  const me=room.players[room.mySeat];$("readyBtn").disabled=!connected||me.ready;$("readyBtn").textContent=me.ready?"მზად ხარ — მეტოქეს ველით":"მზად ვარ · 30 მონეტა";
  $("lobbyHint").textContent=`მატჩი ${room.target} ქულამდე. `+(room.players.length<2?"პირველი შემოერთებული მოთამაშე დაიკავებს მეორე ადგილს.":"მატჩი დაიწყება, როცა ორივე მზად იქნებით.");
  $("inviteSection").hidden=room.mySeat!==0;paintInviteList();
 }
 function send(action,data={}){if(!room||busy||!connected)return;busy=true;socket.emit("nardi:action",{roomId:room.roomId,version:room.version,action,...data});paintActions();}
 function who(seat){return seat===room.mySeat?"შენ":room.players[seat]?.username||"მეტოქე";}
 function mountBoard(){
  const g=room.game;if(boardSeat===g.mySeat&&$("board").children.length)return;boardSeat=g.mySeat;const board=$("board");board.replaceChildren();
  for(let display=0;display<24;display++){
   const logical=display<12?12+display:23-display,point=g.mySeat===0?logical:23-logical,column=display%12;
   const b=node("button","na-point"+(display>=12?" bottom":"")+(column%2===0?" even":""));b.type="button";b.dataset.point=point;b.id="point-"+point;b.style.gridColumn=String(column<6?column+1:column+2);b.style.gridRow=display<12?"1":"3";b.addEventListener("click",()=>pointClick(point));board.append(b);
  }
  const bar=node("div","na-bar"),opp=node("button","na-bar-slot"),mine=node("button","na-bar-slot"),cube=node("button","na-cube");opp.id="barOpp";opp.disabled=true;mine.id="barMine";mine.addEventListener("click",()=>{selectedFrom="bar";paintBoard();});cube.id="cube";cube.addEventListener("click",()=>{if(room.game.canDouble)send("double");});bar.append(opp,cube,mine);board.append(bar);
  for(const [id,row] of [["offOpp",1],["offMine",3]]){const b=node("button","na-off"+(id==="offMine"?" mine":""));b.id=id;b.style.gridRow=row;b.disabled=id!=="offMine";b.addEventListener("click",()=>{if(selectedFrom!==null){const m=filteredMoves().filter(m=>m.from===selectedFrom&&m.to==="off").sort((a,b)=>b.die-a.die)[0];if(m)send("move",m);}});board.append(b);}
  const dice=node("div","na-dice-track");dice.id="diceTrack";const caption=node("div","na-dice-caption");caption.id="diceCaption";board.append(dice,caption);
 }
 function filteredMoves(){return (room?.game?.legalMoves||[]).filter(m=>selectedDie===null||m.die===selectedDie);}
 function pointClick(point){
  const g=room.game;if(busy||!connected||room.paused||g.turnSeat!==g.mySeat||g.phase!=="move")return;
  const moves=filteredMoves(),dest=moves.filter(m=>m.from===selectedFrom&&m.to===point).sort((a,b)=>b.die-a.die)[0];
  if(dest){send("move",dest);return;}
  if(moves.some(m=>m.from===point)){selectedFrom=selectedFrom===point?null:point;paintBoard();paintActions();}
 }
 function checker(seat,count,index=0){const n=node("span","na-checker "+(seat===0?"white":"dark"));n.style.setProperty("--i",String(index));n.setAttribute("aria-hidden","true");if(count>5&&index===4)n.append(node("span","na-checker-count",count));return n;}
 function dieFace(value){const b=node("button","na-die"),layout={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};b.type="button";for(const i of layout[value]){const dot=node("span","na-pip");dot.style.gridColumn=i%3+1;dot.style.gridRow=Math.floor(i/3)+1;b.append(dot);}return b;}
 function paintBoard(){
  const g=room.game;mountBoard();const active=connected&&!busy&&!room.paused&&g.turnSeat===g.mySeat&&g.phase==="move";
  if(selectedDie!==null&&!g.legalMoves.some(m=>m.die===selectedDie))selectedDie=null;
  const moves=filteredMoves();if(selectedFrom!==null&&!moves.some(m=>m.from===selectedFrom))selectedFrom=null;if(g.position.bar[g.mySeat]&&moves.some(m=>m.from==="bar"))selectedFrom="bar";
  const last=g.moves.at(-1)||g.lastTurn?.moves.at(-1);
  for(let p=0;p<24;p++){
   const b=$("point-"+p),count=Math.abs(g.position.board[p]),seat=g.position.board[p]>0?0:1;const number=E.distance(g.mySeat,p);b.replaceChildren(node("span","na-point-num",number));
   for(let i=0;i<Math.min(count,5);i++)b.append(checker(seat,count,i));
   const origin=active&&moves.some(m=>m.from===p),dest=active&&moves.some(m=>m.from===selectedFrom&&m.to===p);b.disabled=!origin&&!dest;b.classList.toggle("origin",origin);b.classList.toggle("selected",selectedFrom===p);b.classList.toggle("destination",dest);b.classList.toggle("last",last?.from===p||last?.to===p);b.setAttribute("aria-label",`პუნქტი ${number} · ${count?`${seat===g.mySeat?"შენი":"მეტოქის"} ${count} ქვა`:"ცარიელი"}`);b.setAttribute("aria-pressed",String(selectedFrom===p));
  }
  for(const [id,s] of [["barMine",g.mySeat],["barOpp",1-g.mySeat]]){const b=$(id),n=g.position.bar[s];b.replaceChildren();if(n)b.append(checker(s,n));b.append(node("span",null,n));b.setAttribute("aria-label",`${s===g.mySeat?"შენი":"მეტოქის"} ბარი · ${n} ქვა`);b.disabled=id!=="barMine"||!active||!n;b.classList.toggle("selected",selectedFrom==="bar"&&id==="barMine");}
  for(const [id,s] of [["offMine",g.mySeat],["offOpp",1-g.mySeat]]){const b=$(id),n=g.position.off[s];b.replaceChildren(node("span","na-off-count",n),node("span",null,"/15"));if(n)b.append(node("span","na-off-stack"+(s===1?" dark":"")));b.setAttribute("aria-label",`${s===g.mySeat?"გასვლა":"მეტოქის გასვლა"} · ${n} ქვა`);const dest=active&&moves.some(m=>m.from===selectedFrom&&m.to==="off");b.disabled=id!=="offMine"||!dest;b.classList.toggle("destination",id==="offMine"&&dest);}
  const cube=$("cube");cube.textContent=g.cube;cube.disabled=!connected||busy||room.paused||!g.canDouble;cube.classList.toggle("available",!cube.disabled);cube.setAttribute("aria-label",`კუბი ${g.cube} · ${g.crawford?"კროუფორდი":g.cubeOwner===null?"საერთო":who(g.cubeOwner)+" ფლობს"}`);
  const track=$("diceTrack");track.replaceChildren();const values=g.dice.length?(g.dice[0]===g.dice[1]?[...g.dice,...g.dice]:g.dice):g.lastTurn?.dice||[];const available=g.remaining.slice();
  for(const value of values){const b=dieFace(value),i=available.indexOf(value),used=i<0;if(i>=0)available.splice(i,1);b.classList.toggle("used",used);b.classList.toggle("selected",!used&&selectedDie===value);b.disabled=!active||used||!g.legalMoves.some(m=>m.die===value);b.setAttribute("aria-label",`კამათელი ${value}${used?" · გამოყენებულია":""}`);b.setAttribute("aria-pressed",String(selectedDie===value));b.addEventListener("click",()=>{selectedDie=selectedDie===value?null:value;paintBoard();paintActions();});track.append(b);}
  $("diceCaption").textContent=g.phase==="preRoll"?(g.lastTurn?.passed?"წინა სვლა ვერ შესრულდა":"წინა სვლა"):g.phase==="cubeAnswer"?`კუბი → ${g.pendingDouble.value}`:g.phase==="done"?"ხელი დასრულდა":`დარჩენილია ${g.remaining.length} სვლა${selectedDie!==null?" · "+selectedDie:""}`;
  $("modeLabel").textContent=(room.bot?"ბოტთან · უფასო":"მატჩის ფსონი · 30 მონეტა")+` · ხელი ${g.roundNumber}`;
  $("score").replaceChildren(node("b",null,g.score[g.mySeat]),node("small",null,"/ "+g.target),node("b",null,g.score[1-g.mySeat]));$("score").setAttribute("aria-label",`შენ ${g.score[g.mySeat]}, მეტოქე ${g.score[1-g.mySeat]}, მიზანი ${g.target}`);
  $("playersLabel").textContent=`შენ · ${g.mySeat===0?"თეთრი":"შავი"} · ${g.pips[g.mySeat]} ნაბიჯი | ${who(1-g.mySeat)} · ${g.pips[1-g.mySeat]}`;
  $("pauseNotice").classList.toggle("hidden",!room.paused);paintActions();paintResult();tick();
 }
 function paintActions(){
  if(!room?.game)return;$("hint").classList.remove("feedback");const g=room.game,enabled=connected&&!busy&&!room.paused,mine=g.turnSeat===g.mySeat,answer=mine&&g.phase==="cubeAnswer";
  const can={roll:mine&&g.phase==="preRoll",undo:g.canUndo,finish:g.canFinish,double:g.canDouble,take:answer,drop:answer};
  for(const b of document.querySelectorAll("[data-action]")){b.hidden=(b.dataset.action==="take"||b.dataset.action==="drop")?!answer:answer;b.disabled=!enabled||!can[b.dataset.action];}
  $("doubleBtn").textContent=`გადავება ×${g.cube*2}`;
  $("turnLabel").textContent=!connected?"კავშირი გაწყდა":room.paused?"დაბრუნებას ველით…":g.finished?"მატჩი დასრულდა":g.phase==="done"?"ხელის შედეგი":mine?"შენი სვლაა":"მეტოქის სვლაა";
  $("hint").textContent=g.crawford&&g.phase==="preRoll"?"კროუფორდის ხელი · კუბი არ გამოიყენება":answer?`${who(g.pendingDouble.bySeat)} გთავაზობს ${g.pendingDouble.value} ქულას · დათმობა ${g.cube} ქულა ღირს`:g.phase==="cubeAnswer"?"გადავების პასუხს ველით…":g.phase==="move"&&mine?(g.canFinish?"შესაძლებელი სვლები შესრულდა — დაადასტურე დასრულება.":g.position.bar[g.mySeat]?"ჯერ ბარზე მყოფი ქვები დააბრუნე — მონიშნულ პუნქტს შეეხე.":"ქვა → მწვანე პუნქტი · სიგრძის ასარჩევად კამათელს შეეხე."):g.phase==="preRoll"&&mine?"გააგორე კამათელი ან გაგორებამდე შესთავაზე გადავება.":"კუბი მხოლოდ მატჩის ქულებს ზრდის · ფსონი ფიქსირებულია.";
 }
 function paintResult(){const g=room.game,box=$("roundResult"),done=g.phase==="done"||g.finished;box.classList.toggle("hidden",!done);$("actions").hidden=done;$("againBtn").classList.toggle("hidden",!g.finished);box.replaceChildren();if(!done)return;const reason=g.forfeitReason||g.result?.reason,mult=g.result?.multiplier;box.append(node("b",null,g.finished?(g.winner===g.mySeat?"მატჩი შენია!":"მატჩი დასრულდა"):`${who(g.result.winner)} +${g.result.points} · ${mult===3?"კოქსი":mult===2?"მარსი":"ოინი"}`));
  if(g.finished)box.append(node("p",null,room.bot?"ბოტთან თამაში · უფასო":room.settlement?.void?"მატჩი გაუქმდა · ფსონი დაბრუნდა":(g.winner===g.mySeat?"+28 მონეტა · შენახული 30 დაბრუნდა":"−30 მონეტა")+" · "+(reasons[reason]||"შედეგი")));else box.append(node("p","bu-next","შემდეგი ხელი მალე დაიწყება…"));
 }
 document.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>send(b.dataset.action)));
 $("fullscreenBtn").hidden=!document.fullscreenEnabled;$("fullscreenBtn").addEventListener("click",async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $("app").requestFullscreen();$("menuDialog").close();}catch{toast("ამ მოწყობილობაზე სრული ეკრანი მიუწვდომელია.");}});
 function tick(){if(!room?.game)return;const g=room.game,t=$("timer"),remaining=room.deadline?Math.max(0,Math.ceil((room.deadline-Date.now()-offset)/1000)):null;t.textContent=remaining===null?"—":remaining+" წმ";t.classList.toggle("low",remaining!==null&&remaining<=5);if(room.paused){const end=room.reconnectUntil.find(Boolean);$("pauseNotice").textContent=`მოთამაშის დაბრუნებას ველით · ${Math.max(0,Math.ceil((end-Date.now()-offset)/1000))} წმ`;}if(room.nextRoundAt){const n=$("roundResult").querySelector(".bu-next");if(n)n.textContent=`შემდეგი ხელი · ${Math.max(0,Math.ceil((room.nextRoundAt-Date.now()-offset)/1000))} წმ`;}}
 setInterval(tick,250);
 function paintChat(){const key=JSON.stringify(room?.messages||[]);if(key===chatKey)return;chatKey=key;const box=$("chatMessages");box.replaceChildren();for(const m of room?.messages||[]){const n=node("div","bu-chat-msg");n.append(node("b",null,m.username),node("span",null,m.text));box.append(n);}box.scrollTop=box.scrollHeight;}
 $("chatForm").addEventListener("submit",e=>{e.preventDefault();const text=$("chatInput").value.trim();if(!room||!text)return;socket.emit("nardi:chat",{roomId:room.roomId,text});$("chatInput").value="";});
 $("historyBtn").addEventListener("click",()=>{const box=$("historyBody");box.replaceChildren();for(const r of (room?.game?.results||[]).slice().reverse()){const n=node("div","bu-history-row");n.append(node("b",null,`ხელი ${r.round} · ${who(r.winner)} +${r.points}`),node("p",null,`${r.multiplier===3?"კოქსი":r.multiplier===2?"მარსი":"ოინი"} · კუბი ${r.cube} · ${r.score[0]} : ${r.score[1]}`));box.append(n);}if(!box.children.length)box.append(node("p",null,"დასრულებული ხელი ჯერ არ არის."));showDialog("historyDialog");});
 $("rankingBtn").addEventListener("click",()=>{socket.emit("nardi:rankings");showDialog("rankingDialog");});
 socket.on("nardi:rankings",({rows})=>{const box=$("rankingBody");box.replaceChildren();if(!rows.length)return box.append(node("p",null,"ამ კვირის შედეგები ჯერ არ არის."));const table=node("table","bu-ranking"),head=node("tr");["მოთამაშე","მოგება","წაგება","მონეტები"].forEach(t=>head.append(node("th",null,t)));table.append(head);for(const r of rows){const tr=node("tr");[r.username,r.wins,r.losses,(r.net>0?"+":"")+r.net].forEach(t=>tr.append(node("td",null,t)));table.append(tr);}box.append(table);});
 socket.on("connect",()=>{connected=true;const token=stored("localStorage","gaicani_auth_token");socket.emit(token?"auth:token":"auth:guest",token?{token}:{preferredUsername:stored("sessionStorage","gaicani_guest_username")||null});});
 let guestPlayer=false;
 socket.on("auth:authenticated",({username,isGuest})=>{myName=username;guestPlayer=!!isGuest;if(isGuest){try{sessionStorage.setItem("gaicani_guest_username",username);}catch{}}$("botBtn").disabled=false;$("loading").classList.add("hidden");$("createBtn").disabled=false;socket.emit("users:listOnline");socket.emit("nardi:listPublicRooms");const id=room?.roomId||new URLSearchParams(location.search).get("room");if(id)socket.emit("nardi:join",{roomId:id});else socket.emit("nardi:resume");});
 socket.on("auth:invalid",()=>{location.href="/";});
 socket.on("connect_error",()=>{$("loading").classList.add("hidden");toast("სერვერთან კავშირი ვერ ხერხდება. ხელახლა დაკავშირებას ვცდით…");});
 socket.on("disconnect",()=>{connected=false;busy=false;if(room?.game){paintBoard();paintActions();}toast("კავშირი გაწყდა — დაბრუნებისთვის 40 წამია.");});
 socket.on("users:onlineList",({users})=>{online=users||[];paintInviteList();});socket.on("users:onlineChanged",()=>socket.emit("users:listOnline"));
 socket.on("nardi:balance",({coins})=>{$("setupBalance").textContent=coins===null?"":coins+" 🪙";});
 socket.on("coins:changed",({coins})=>{$("setupBalance").textContent=coins+" 🪙";});
 socket.on("nardi:room",data=>{
  const chatOnly=data.chatOnly&&room?.roomId===data.roomId&&room.version===data.version;
  if(room?.status==="lobby"&&data.status==="playing")$("toast").classList.add("hidden");
  room=data;offset=(data.serverNow||Date.now())-Date.now();
  if(chatOnly){paintChat();return;}
  busy=false;selectedFrom=null;if(selectedDie!==null&&!data.game?.remaining.includes(selectedDie))selectedDie=null;history.replaceState(null,"","/nardi.html?room="+encodeURIComponent(data.roomId));if(data.status==="lobby")paintLobby();else{screen("game");paintBoard();}paintChat();
 });
 socket.on("nardi:error",({message,code})=>{busy=false;if(code==="ROOM_CLOSED")reset();if(room?.game)paintBoard();toast(message);});
 socket.on("nardi:publicRooms",rooms=>{rooms=rooms.filter(r=>!!r.guestTable===guestPlayer);const box=$("publicRooms");box.replaceChildren();for(const r of rooms){const row=node("div","bu-list-row"),b=node("button","bu-btn secondary","შემოერთება · 30");b.addEventListener("click",()=>socket.emit("nardi:join",{roomId:r.roomId}));b.disabled=r.playerCount>=2;row.append(node("span","name",r.hostUsername+` · ${r.playerCount}/2 · ${r.target} ქულამდე`),b);box.append(row);}if(!rooms.length)box.append(node("div","bu-empty","ღია მაგიდა ჯერ არ არის."));});
 socket.on("nardi:inviteSent",d=>{if(d.invited.length)toast("მოწვევა გაიგზავნა: "+d.invited.join(", "));if(d.cooldown.length)toast("უარის შემდეგ მოიცადე 1 წუთი: "+d.cooldown.join(", "));if(d.unavailable.length)toast("ახლა ვერ მოიწვევ: "+d.unavailable.join(", "));});
 socket.on("nardi:inviteDeclined",({username})=>toast(username+"-მ მოწვევა უარყო."));
 socket.on("nardi:invited",d=>{const bar=$("inviteBar");bar.replaceChildren();bar.dataset.room=d.roomId;bar.classList.remove("hidden");const yes=node("button","bu-btn","მიღება"),no=node("button","bu-btn secondary","უარი");yes.onclick=()=>{bar.classList.add("hidden");socket.emit("nardi:join",{roomId:d.roomId});};no.onclick=()=>{bar.classList.add("hidden");socket.emit("nardi:declineInvite",{roomId:d.roomId});};bar.append(node("span",null,d.fromUsername+" გიწვევს ნარდზე · მატჩის ფსონი 30 მონეტა"),yes,no);});
 socket.on("nardi:inviteClosed",d=>{if($("inviteBar").dataset.room===d.roomId)$("inviteBar").classList.add("hidden");});
 socket.on("nardi:kicked",()=>{reset();toast("მასპინძელმა მაგიდიდან მოგაშორა.");});socket.on("nardi:left",reset);socket.on("nardi:closed",()=>{reset();toast("მაგიდა დაიხურა.");});socket.on("nardi:replaced",()=>{reset();toast("ნარდი სხვა ჩანართში გახსენი — თამაში იქ გრძელდება.");});
})();
