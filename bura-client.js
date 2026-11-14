(function(){
 "use strict";
 const $=id=>document.getElementById(id),E=window.BuraRules,socket=io();window.attachTempBanGuard?.(socket);
 let room=null,selected=[],picked=new Set(),online=[],myName="",busy=false,connected=false,offset=0,chatKey="";
 const TRICK_DISPLAY_MS=2000;
 let trickTimer;
 const reasons={var:"„ვარ!“",bura:"ბურა",royal:"სამეფო ბურა",count:"კარტები გათავდა",concede:"დათმობა",timeoutConcede:"დრო — დათმობა",timeout:"დრო ამოიწურა",timeouts:"დრო ზედიზედ ორჯერ ამოიწურა",disconnect:"მოწინააღმდეგე ვერ დაბრუნდა",leave:"მატჩის დათმობა"};
 function stored(kind,key){try{return window[kind].getItem(key);}catch{return null;}}
 function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 function toast(text){$("toast").textContent=text;$("toast").classList.remove("hidden");clearTimeout(toast.timer);toast.timer=setTimeout(()=>$("toast").classList.add("hidden"),4000);}
 function screen(name){document.querySelectorAll(".bu-screen").forEach(n=>n.classList.toggle("active",n.id===name+"Screen"));}
 function avatar(p){const img=node("img","bu-avatar");img.src="/"+(p?.avatar||"avatar1.png");img.alt="";return img;}
 function card(c,button=false){if(!c)return node("div","bu-back");const el=node(button?"button":"div","bu-card-el");if(button){el.type="button";el.dataset.card=c;}window.GaicaniCardArt.paint(el,c);if(button)el.setAttribute("role","button");return el;}
 function tableCard(el,face,slot,from){
  return GaicaniCardMotion.mark(el,room.game.roundNumber+":"+(face||slot),face,from);
 }
 function seatAnchor(seat){return seat===room.mySeat?"#me":"#opponent";}
 function animateTable(render){
  const {roundNumber,history}=room.game,last=history.at(-1),stock=$("stockCards");
  GaicaniCardMotion.animate($("gameScreen"),room.roomId,render,{
   deck:stock,
   collect:(el,key)=>!key.startsWith(roundNumber+":")?stock:
    el.closest(".bu-trick-lane")&&last?document.querySelector(seatAnchor(last.winner)):false
  });
 }
 function showDialog(id){const d=$(id);if(!d.open)d.showModal();}
 document.querySelectorAll("[data-dialog]").forEach(b=>b.addEventListener("click",()=>showDialog(b.dataset.dialog)));
 document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>b.closest("dialog").close()));
 document.querySelectorAll("dialog").forEach(d=>d.addEventListener("click",e=>{if(e.target!==d)return;const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}));
 function reset(){clearTimeout(trickTimer);room=null;selected=[];busy=false;screen("setup");history.replaceState(null,"","/bura.html");socket.emit("bura:listPublicRooms");}
 function leave(){if(!room)return reset();if(room.status==="playing"&&!confirm(room.bot?"დატოვებ ბოტთან თამაშს?":"მატჩის დატოვება დათმობაა და შენახული 30 მონეტა დაიკარგება. დატოვებ?"))return;socket.emit("bura:leave",{roomId:room.roomId});}
 $("lobbyBack").addEventListener("click",leave);$("gameBack").addEventListener("click",leave);$("againBtn").addEventListener("click",leave);
 $("createBtn").addEventListener("click",()=>socket.emit("bura:invite",{toUsernames:[]}));$("botBtn").addEventListener("click",()=>socket.emit("bura:bot"));
 $("readyBtn").addEventListener("click",()=>{if(room)socket.emit("bura:ready",{roomId:room.roomId});});
 $("sendInvites").addEventListener("click",()=>{socket.emit("bura:invite",{toUsernames:[...picked]});picked.clear();paintInviteList();});
 function paintInviteList(){
  const box=$("inviteList");box.replaceChildren();const full=room?.players.length>=2;
  const people=full?[]:online.filter(u=>!!u.isGuest===guestPlayer&&!room?.players.some(p=>p.username.toLowerCase()===u.username.toLowerCase())&&u.username.toLowerCase()!==myName.toLowerCase());
  for(const u of people){const row=node("label","bu-list-row"),input=node("input");input.type="checkbox";input.checked=picked.has(u.username);input.addEventListener("change",()=>{if(input.checked)picked.add(u.username);else picked.delete(u.username);$("sendInvites").disabled=!picked.size;});row.append(avatar(u),node("span","name",u.username),input);box.append(row);}
  if(!people.length)box.append(node("div","bu-empty",full?"მაგიდა სავსეა.":"ონლაინ მოთამაშე ჯერ არ არის — შეგიძლია ბოტთან ითამაშო."));$("sendInvites").disabled=!picked.size||full;
 }
 function paintLobby(){
  screen("lobby");const box=$("lobbyPlayers");box.replaceChildren();for(const p of room.players){const row=node("div","bu-list-row");row.append(avatar(p),node("span","name",p.username),node("small",null,p.ready?"მზადაა ✓":p.connected?"მზადებას ელის":"კავშირი გაწყდა"));if(room.mySeat===0&&p.seat!==0){const kick=node("button","bu-btn danger","მოშორება");kick.addEventListener("click",()=>socket.emit("bura:kick",{roomId:room.roomId,username:p.username}));row.append(kick);}box.append(row);}
  if(room.players.length<2)box.append(node("div","bu-empty","თავისუფალი ადგილი — მოიწვიე მოთამაშე"));
  const me=room.players[room.mySeat];$("readyBtn").disabled=!connected||me.ready;$("readyBtn").textContent=me.ready?"მზად ხარ — მეტოქეს ველით":"მზად ვარ · 30 მონეტა";
  $("lobbyHint").textContent=room.players.length<2?"პირველი შემოერთებული მოთამაშე დაიკავებს მეორე ადგილს.":"მატჩი დაიწყება, როცა ორივე მზად იქნებით.";
  $("inviteSection").hidden=room.mySeat!==0;paintInviteList();
 }
 function paintHand(){
  if(!room?.game)return;const g=room.game;selected=selected.filter(c=>g.myHand.includes(c));const hand=$("myHand");hand.replaceChildren();
  const mine=g.turnSeat===g.mySeat,leading=g.phase==="lead"&&(mine||g.canMalutka),responding=g.phase==="respond"&&mine;
  for(const c of g.myHand){const el=tableCard(card(c,true),c);el.classList.toggle("selected",selected.includes(c));el.setAttribute("aria-pressed",String(selected.includes(c)));el.disabled=!connected||busy||room.paused||g.finished||!(leading||responding);
   el.addEventListener("click",e=>{
    if(selected.includes(c))selected=selected.filter(a=>a!==c);
    else if(leading&&selected.length&&E.cardSuit(selected[0])!==E.cardSuit(c))selected=[c];
    else if(selected.length<(leading?g.maxLead:g.trick.ledCards.length))selected.push(c);
    paintHand();paintActions();if(e.detail===0)[...hand.children].find(n=>n.dataset.card===c)?.focus();
   });hand.append(el);}
 }
 function cardsLane(name,cards,source){const lane=node("div","bu-trick-lane"),row=node("div","bu-table-cards");row.append(...cards.map(c=>source?tableCard(card(c),c,null,source):card(c)));lane.append(node("div","bu-trick-label",name),row);return lane;}
 function who(seat){return seat===room.mySeat?"შენ":room.players[seat]?.username||"მეტოქე";}
 function scorePlayer(player,points){
  const entry=node("div","bu-score-player"),name=node("span","bu-score-name",player.username);
  name.title=player.username;
  entry.append(name,node("b",null,points));
  return entry;
 }
 function completedTrick(trick){
  const lane=node("div","bu-trick-lane"),row=node("div","bu-table-cards bu-trick-pairs");
  const response=trick.hidden?"გატანება · პირქვე":"მოჭრა";
  trick.ledCards.forEach((lead,i)=>{
   const pair=node("div","bu-trick-pair");
   const response=trick.responseCards[i];
   pair.append(tableCard(card(lead),lead,null,seatAnchor(trick.leaderSeat)),
    tableCard(card(response),response,"discard:"+i,seatAnchor(trick.responseSeat)));
   row.append(pair);
  });
  lane.append(node("div","bu-trick-label",who(trick.leaderSeat)+" · "+response),row);
  return lane;
 }
 function varReveal(result){
  const seat=result.declarerSeat,cards=result.captured[seat];
  const title=`${who(seat)} · „ვარ!“ · ${result.cardPoints[seat]} ქულა`;
  const reveal=cardsLane(title,cards,seatAnchor(seat));
  reveal.classList.add("bu-var-reveal");
  if(!cards.length)reveal.lastElementChild.append(node("span","bu-center-note","აღებული კარტები არ არის"));
  return reveal;
 }
 function paintTrick(){if(room?.game)animateTable(drawTrick);}
 function drawTrick(){
  clearTimeout(trickTimer);
  const g=room?.game;
  if(!g)return;
  const area=$("trickArea");
  area.replaceChildren();
  if(g.result?.reason==="var"){
   area.append(varReveal(g.result));
   return;
  }
  if(g.trick&&!g.result){
   area.append(cardsLane(who(g.trick.leaderSeat)+" · სვლა",g.trick.ledCards,seatAnchor(g.trick.leaderSeat)));
   return;
  }
  const last=g.trick?null:g.history.at(-1);
  const remaining=last?last.completedAt+TRICK_DISPLAY_MS-(Date.now()+offset):0;
  if(remaining>0){
   area.append(completedTrick(last));
   trickTimer=setTimeout(paintTrick,remaining);
   return;
  }
  if(g.result){if(g.result.winningHand.length)area.append(cardsLane(reasons[g.result.reason],g.result.winningHand,seatAnchor(g.result.winner)));else{const n=node("div","bu-center-note");n.append(node("strong",null,g.result.winner===null?"ყაიმი":who(g.result.winner)+" — რაუნდი"),node("span",null,reasons[g.result.reason]||"რაუნდი დასრულდა"));area.append(n);}}
  else if(g.phase!=="collect")area.append(node("div","bu-center-note",g.turnSeat===g.mySeat?"შენი სვლაა — აირჩიე კარტები":"მოწინააღმდეგის სვლას ველით"));
 }
 function paintTable(){animateTable(drawTable);}
 function drawTable(){
  const g=room.game,opp=room.players[1-room.mySeat],me=room.players[room.mySeat];$("opponent").replaceChildren(avatar(opp),node("span","bu-player-name",opp.username));const backs=node("div","bu-opponent-cards");for(let i=0;i<g.handCounts[1-room.mySeat];i++)backs.append(tableCard(card(null),null,"opponent:"+i));$("opponent").append(backs);
  $("me").replaceChildren(avatar(me),node("span","bu-player-name",me.username));
  const stock=$("stockCards");stock.replaceChildren(card(g.trumpCard));if(g.deckLeft)stock.append(card(null));$("stockLabel").textContent=`კოზირი · ${g.deckLeft} კარტი`;
  drawTrick();
  $("modeLabel").textContent=(room.bot?"ბოტთან · უფასო":"მატჩის ფსონი · 30 მონეტა")+` · რაუნდი ${g.roundNumber}`;
  $("score").replaceChildren(scorePlayer(me,g.score[g.mySeat]),node("span","bu-score-vs","vs"),scorePlayer(opp,g.score[1-g.mySeat]));
  $("price").textContent=g.crawford?"კროუფორდი · დავი აკრძალულია":`რაუნდის ფასი · ${E.callMultiplier(g.currentCall)} ქულა`;
  $("pauseNotice").classList.toggle("hidden",!room.paused);
  paintHand();paintActions();paintResult();tick();
 }
 function paintActions(){
  const g=room.game,mine=g.turnSeat===g.mySeat,live=!g.finished&&g.phase!=="done",enabled=connected&&!busy&&!room.paused,leading=live&&mine&&g.phase==="lead",responding=live&&mine&&g.phase==="respond",answering=live&&mine&&g.phase==="callAnswer";
  const collecting=live&&g.phase==="collect",canCollect=collecting&&mine&&!!room.deadline,malutka=live&&g.canMalutka;
  const show={lead:leading||malutka||canCollect,cut:responding,discard:responding,var:leading||canCollect,call:live&&g.canCall,malutka,accept:answering,concede:answering,raise:answering&&!!E.nextCall(g.pendingCall?.call)};
  for(const b of document.querySelectorAll("[data-action]")){const a=b.dataset.action;b.hidden=!show[a];b.disabled=!enabled;}
  $("leadBtn").textContent=canCollect?"გაგრძელება":"სვლა";
  const validLead=(mine||selected.length===3)&&E.validateLead(selected,g.myHand,g.maxLead).ok;
  $("leadBtn").disabled=!enabled||(!canCollect&&!validLead);
  const responseValid=!!g.trick&&E.validateResponse(selected,g.myHand,g.trick.ledCards.length).ok;
  $("discardBtn").disabled=!enabled||!responseValid;$("cutBtn").disabled=!enabled||!responseValid||!E.canBeatAll(selected,g.trick?.ledCards||[],g.trump);
  $("callBtn").textContent=E.CALLS[E.nextCall(g.currentCall)]?.label||"დავი";$("raiseBtn").textContent=E.CALLS[E.nextCall(g.pendingCall?.call)]?.label||"აწევა";
  $("turnLabel").textContent=!connected?"კავშირი გაწყდა":room.paused?"კავშირი აღდგება…":g.finished?"მატჩი დასრულდა":g.phase==="done"?"რაუნდის შედეგი":collecting&&!room.deadline?"ხელი დასრულდა":mine?"შენი სვლაა":"მეტოქის სვლაა";
  $("hint").textContent=answering?`${who(g.pendingCall.bySeat)} ამბობს „${E.CALLS[g.pendingCall.call].label}“ — ${E.callMultiplier(g.pendingCall.call)} ქულა. დათმობა: ${E.callMultiplier(g.pendingCall.baseCall)}.`:g.phase==="callAnswer"?"მეტოქის პასუხს ველით…":canCollect?"გააგრძელე თამაში ან თქვი „ვარ!“":leading?`აირჩიე 1–${g.maxLead} ერთი ფერის კარტი. ქულებს თავად ითვლი.`:responding?`აირჩიე ${g.trick.ledCards.length} კარტი. მოჭერი თითოეულს ან გაატანე პირქვე.`:live?"აღებული ქულები რაუნდის ბოლომდე დაფარულია.":"";
 }
 function paintResult(){const g=room.game,box=$("roundResult");box.classList.toggle("hidden",!g.result&&!g.finished);box.replaceChildren();$("againBtn").classList.toggle("hidden",!g.finished);if(!g.result&&!g.finished)return;
  box.append(node("h3",null,g.finished?`მატჩის გამარჯვებული · ${room.players[g.winner].username}`:g.result.winner===null?"ყაიმი":`${room.players[g.result.winner].username} +${g.result.points}`));
  if(g.result){
   const points=g.result.cardPoints;
   box.append(node("p",null,`${reasons[g.result.reason]||"შედეგი"} · ${room.players[g.mySeat].username} ${points[g.mySeat]} vs ${room.players[1-g.mySeat].username} ${points[1-g.mySeat]}`));
  }
  if(g.finished)box.append(node("p",null,room.bot?"უფასო თამაში · მონეტები და რეიტინგი უცვლელია":room.settlement?.void?"მატჩი გაუქმდა · ფსონი დაბრუნდა":g.winner===g.mySeat?"+28 მონეტა · შენახული 30-იც დაბრუნდა":"−30 მონეტა"));else box.append(node("p","bu-next","შემდეგი რაუნდი მალე დაიწყება…"));
 }
 document.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>{
  if(!room?.game||busy||b.hidden||b.disabled)return;
  const action=b.dataset.action==="lead"&&room.game.phase==="collect"?"continue":b.dataset.action;
  busy=true;socket.emit("bura:action",{roomId:room.roomId,version:room.version,action,cards:selected.slice()});paintHand();paintActions();
 }));
 function tick(){if(!room?.game)return;const g=room.game,t=$("timer"),remaining=room.deadline?Math.max(0,Math.ceil((room.deadline-Date.now()-offset)/1000)):null;t.textContent=remaining===null?"—":remaining+" წმ";t.classList.toggle("low",remaining!==null&&remaining<=5);if(room.paused){const end=room.reconnectUntil.find(Boolean);$("pauseNotice").textContent=`მოთამაშის დაბრუნებას ველით · ${Math.max(0,Math.ceil((end-Date.now()-offset)/1000))} წმ`;}if(room.nextRoundAt){const n=$("roundResult").querySelector(".bu-next");if(n)n.textContent=`შემდეგი რაუნდი · ${Math.max(0,Math.ceil((room.nextRoundAt-Date.now()-offset)/1000))} წმ`;}}
 setInterval(tick,250);
 function paintChat(){const key=JSON.stringify(room?.messages||[]);if(key===chatKey)return;chatKey=key;const box=$("chatMessages");box.replaceChildren();for(const m of room?.messages||[]){const n=node("div","bu-chat-msg");n.append(node("b",null,m.username),node("span",null,m.text));box.append(n);}box.scrollTop=box.scrollHeight;}
 $("chatForm").addEventListener("submit",e=>{e.preventDefault();const text=$("chatInput").value.trim();if(!room||!text)return;socket.emit("bura:chat",{roomId:room.roomId,text});$("chatInput").value="";});
 $("historyBtn").addEventListener("click",()=>{const box=$("historyBody");box.replaceChildren();for(const r of (room?.game?.results||[]).slice().reverse()){const n=node("div","bu-history-row");n.append(node("b",null,`რაუნდი ${r.round} · ${r.winner===null?"ყაიმი":who(r.winner)+" +"+r.points}`),node("p",null,`${reasons[r.reason]||"შედეგი"} · ${r.cardPoints[0]} : ${r.cardPoints[1]}`));r.captured.forEach((cards,s)=>{if(cards.length)n.append(cardsLane(who(s),cards));});box.append(n);}if(!box.children.length)box.append(node("p",null,"რაუნდი ჯერ არ დასრულებულა."));showDialog("historyDialog");});
 $("rankingBtn").addEventListener("click",()=>{socket.emit("bura:rankings");showDialog("rankingDialog");});
 socket.on("bura:rankings",({rows})=>{const box=$("rankingBody");box.replaceChildren();if(!rows.length)return box.append(node("p",null,"ამ კვირის შედეგები ჯერ არ არის."));const table=node("table","bu-ranking"),head=node("tr");["მოთამაშე","მოგება","წაგება","მონეტები"].forEach(t=>head.append(node("th",null,t)));table.append(head);for(const r of rows){const tr=node("tr");[r.username,r.wins,r.losses,(r.net>0?"+":"")+r.net].forEach(t=>tr.append(node("td",null,t)));table.append(tr);}box.append(table);});
 socket.on("connect",()=>{connected=true;const token=stored("localStorage","gaicani_auth_token");socket.emit(token?"auth:token":"auth:guest",token?{token}:{preferredUsername:stored("sessionStorage","gaicani_guest_username")||null});});
 let guestPlayer=false;
 socket.on("auth:authenticated",({username,isGuest})=>{myName=username;guestPlayer=!!isGuest;if(isGuest){try{sessionStorage.setItem("gaicani_guest_username",username);}catch{}}$("botBtn").disabled=false;$("loading").classList.add("hidden");$("createBtn").disabled=false;socket.emit("users:listOnline");socket.emit("bura:listPublicRooms");const id=room?.roomId||new URLSearchParams(location.search).get("room");if(id)socket.emit("bura:join",{roomId:id});});
 socket.on("auth:invalid",()=>{location.href="/";});
 socket.on("connect_error",()=>{$("loading").classList.add("hidden");toast("სერვერთან კავშირი ვერ ხერხდება. ხელახლა დაკავშირებას ვცდით…");});
 socket.on("disconnect",()=>{connected=false;busy=false;if(room?.game){paintHand();paintActions();}toast("კავშირი გაწყდა — დაბრუნებისთვის 40 წამია.");});
 socket.on("users:onlineList",({users})=>{online=users||[];paintInviteList();});socket.on("users:onlineChanged",()=>socket.emit("users:listOnline"));
 socket.on("bura:balance",({coins})=>{$("setupBalance").textContent=coins===null?"":coins+" 🪙";});
 socket.on("coins:changed",({coins})=>{$("setupBalance").textContent=coins+" 🪙";});
 socket.on("bura:room",data=>{
  const chatOnly=data.chatOnly&&room?.roomId===data.roomId&&room.version===data.version;
  const settled = room?.roomId === data.roomId && data.game?.result &&
   (!room.game?.result || room.game.roundNumber !== data.game.roundNumber);
  room=data;offset=(data.serverNow||Date.now())-Date.now();
  if(chatOnly){paintChat();return;}
  busy=false;selected=selected.filter(c=>data.game?.myHand.includes(c));history.replaceState(null,"","/bura.html?room="+encodeURIComponent(data.roomId));if(data.status==="lobby")paintLobby();else{screen("game");paintTable();if(settled)GaicaniCardSound.play("result");}paintChat();
 });
 socket.on("bura:error",({message,code})=>{busy=false;if(code==="ROOM_CLOSED")reset();toast(message);if(room?.game){paintHand();paintActions();}});
 socket.on("bura:publicRooms",rooms=>{rooms=rooms.filter(r=>!!r.guestTable===guestPlayer);const box=$("publicRooms");box.replaceChildren();for(const r of rooms){const row=node("div","bu-list-row"),b=node("button","bu-btn secondary","შემოერთება · 30");b.addEventListener("click",()=>socket.emit("bura:join",{roomId:r.roomId}));b.disabled=r.playerCount>=2;row.append(node("span","name",r.hostUsername+` · ${r.playerCount}/2`),b);box.append(row);}if(!rooms.length)box.append(node("div","bu-empty","ღია მაგიდა ჯერ არ არის."));});
 socket.on("bura:inviteSent",d=>{if(d.invited.length)toast("მოწვევა გაიგზავნა: "+d.invited.join(", "));if(d.cooldown.length)toast("უარის შემდეგ მოიცადე 1 წუთი: "+d.cooldown.join(", "));if(d.unavailable.length)toast("ახლა ვერ მოიწვევ: "+d.unavailable.join(", "));});
 socket.on("bura:inviteDeclined",({username})=>toast(username+"-მ მოწვევა უარყო."));
 socket.on("bura:invited",d=>{const bar=$("inviteBar");bar.replaceChildren();bar.dataset.room=d.roomId;bar.classList.remove("hidden");const yes=node("button","bu-btn","მიღება"),no=node("button","bu-btn secondary","უარი");yes.onclick=()=>{bar.classList.add("hidden");socket.emit("bura:join",{roomId:d.roomId});};no.onclick=()=>{bar.classList.add("hidden");socket.emit("bura:declineInvite",{roomId:d.roomId});};bar.append(node("span",null,d.fromUsername+" გიწვევს ბურაზე · მატჩის ფსონი 30 მონეტა"),yes,no);});
 socket.on("bura:inviteClosed",d=>{if($("inviteBar").dataset.room===d.roomId)$("inviteBar").classList.add("hidden");});
 socket.on("bura:kicked",()=>{reset();toast("მასპინძელმა მაგიდიდან მოგაშორა.");});socket.on("bura:left",reset);socket.on("bura:closed",()=>{reset();toast("მაგიდა დაიხურა.");});socket.on("bura:replaced",()=>{reset();toast("ბურა სხვა ჩანართში გახსენი — თამაში იქ გრძელდება.");});
})();
