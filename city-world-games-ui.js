(() => {
  'use strict';
  const bridge=window.GaicaniCityGameBridge,socket=bridge.getSocket();
  const cooldowns=window.GaicaniCityInviteCooldowns;
  const obscures=()=>opened&&!panel.hasAttribute('data-city-minimized');
  const games={zombies:['🧟','ზომბების ათი ტალღა'],race:['🏁','ქუჩის რბოლა'],hide:['👀','დამალობანა'],battle:['🎯','იარაღის ბრძოლა'],tag:['🟠','დაჭერობანა']};
  const rules={zombies:'2–6 მოთამაშე · 10 ტალღა · ყოველი ტალღა უფრო ძლიერია. ჩვეულებრივი ზომბების შემდეგ დიდი, სწრაფი ბოსი გამოჩნდება — მის დამარცხებამდე ტალღა არ სრულდება. იარაღი ავტომატურად უმჯობესდება, ტალღებს შორის სიცოცხლე ივსება. ათივე ტალღა: 50 000 მონეტა თითო რეგისტრირებულ მონაწილეს. სტუმარს ჯილდო არ ერიცხება. ზომბები მხოლოდ მონაწილეებს ესხმიან თავს. გააჩერე მაუსი ან G უწყვეტი სროლისთვის. ტელეფონზე გააჩერე და გადაათრიე სროლის ღილაკი. ყოველ ტალღაზე ახალ იარაღს მიიღებ.',race:'გაიარე ყველა მონიშნული წერტილი რიგით. პირველი ფინიშზე იგებს. მანქანა ყველას ერთნაირი აქვს.',hide:'მაძებარი 20 წამს იცდის. დაიმალე ქალაქში. მის წრეში 2 წამი დარჩენისას იჭერები.',battle:'სამი მოხვედრა — გათიშვა; 3 წამში დაბრუნდები. 5 ქულა იგებს. დამიზნებისთვის მაუსი ან თითი გადაადგილე; უწყვეტი სროლისთვის გააჩერე მაუსი, G ან სროლის ღილაკი.',tag:'მდევრის წრეში უწყვეტად 2 წამი დარჩენისას აგებ. ბოლო გაქცეული იგებს. შეგიძლია სირბილი და ახტომა.'};
  let room=null,invitation=null,publicRooms=[],opened=false,lastRender=0,selectedGame='race',hudCompact=true;
  const compactHud=()=>hudCompact&&matchMedia('(max-width:700px), (any-pointer:coarse)').matches;
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const button=(text,run,cls='')=>{const b=node('button',cls,text);b.type='button';b.onclick=run;return b;};
  const root=document.querySelector('.city-world');
  const panel=node('section','world-phone');panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','ქალაქის თამაშების ტელეფონი');root.append(panel);
  const curtain=node('div','world-hide-curtain');curtain.hidden=true;curtain.setAttribute('aria-hidden','true');root.append(curtain);
  const hud=node('section','world-match-hud');hud.hidden=true;hud.setAttribute('aria-label','მატჩის მდგომარეობა');(document.querySelector('.city-hud-stack')||root).append(hud);
  const notice=node('section','world-game-invitation');notice.hidden=true;notice.setAttribute('role','dialog');notice.setAttribute('aria-label','ქალაქის თამაშის მოწვევა');root.append(notice);
  const phoneButton=button('📱 ქალაქის თამაშები',()=>{opened=!opened;if(opened){bridge.stop();request('sync');}render();});
  phoneButton.setAttribute('aria-controls','worldPhone');panel.id='worldPhone';document.getElementById('cityQuickActions').append(phoneButton);
  function request(event,data={},done){socket.emit('city:world:'+event,data,r=>{if(r?.error){if(data.targetId&&r.retryAfterMs)cooldowns.record(data.targetId,r.retryAfterMs);refreshCooldowns();bridge.toast(r.error);}else if(done)done(r);});}
  function refreshCooldowns(){panel.querySelectorAll('[data-invite-target]').forEach(b=>{const seconds=cooldowns.seconds(b.dataset.inviteTarget);b.disabled=b.dataset.inviteBlocked==='true'||seconds>0;b.textContent=b.dataset.inviteName+(seconds?' · '+seconds+' წმ':' · მოწვევა');});}
  function close(){opened=false;render();phoneButton.focus();}
  function leave(){if(room?.phase!=='lobby'&&room?.phase!=='finished'&&!confirm('დატოვებ მიმდინარე თამაშს?'))return;request('leave',{},()=>{room=null;close();});}
  function render() {
    panel.hidden=!opened;phoneButton.setAttribute('aria-expanded',String(opened));
    if(opened){
      panel.replaceChildren();const header=node('header');header.append(node('small','','გაიკანის ტელეფონი · საერთო ქალაქი'),button('✕',close));panel.append(header);
      panel.append(node('h2','',room?room.name:'ქალაქი შენი სათამაშო მოედანია'),node('p','world-muted','2–6 მოთამაშე · მოწვევით · ყველასთვის ხილული'));
      if(!room){
        const tabs=node('div','world-game-grid');
        for(const [game,[icon,name]]of Object.entries(games))tabs.append(button(icon+' '+name,()=>{selectedGame=game;render();},game===selectedGame?'chosen':''));
        panel.append(tabs,node('p','world-rules',rules[selectedGame]),button('ლობის შექმნა',()=>request('create',{game:selectedGame}), 'world-primary'));
      }else{
        panel.append(node('p','world-rules',room.rules));
        const list=node('ul','world-members');room.players.forEach(p=>list.append(node('li','',p.name+(p.id===room.hostId?' · მასპინძელი':''))));panel.append(list);
        if(room.phase==='lobby'){
          panel.append(node('p','',room.players.length+'/6 მოთამაშე'));
          if(room.hostId===bridge.getSelf()?.id){
            const pending=new Set(room.invitations.map(i=>i.targetId)),members=new Set(room.players.map(p=>p.id));
            const candidates=bridge.getPlayers().filter(p=>!members.has(p.id)&&!pending.has(p.id)&&!p.gameId&&!p.vehicleId&&!p.interiorId&&!p.rideId);
            panel.append(node('h3','','მოიწვიე ქალაქიდან'));
            if(!candidates.length)panel.append(node('p','world-muted','ახლა თავისუფალი მოთამაშე არ არის.'));
            const picks=node('div','world-invite-list');
            candidates.forEach(p=>{const b=button(p.name+' · მოწვევა',()=>request('invite',{targetId:p.id}));b.dataset.inviteTarget=p.id;b.dataset.inviteName=p.name;b.dataset.inviteBlocked=String(room.players.length+room.invitations.length>=6);b.disabled=b.dataset.inviteBlocked==='true'||cooldowns.seconds(p.id)>0;picks.append(b);});panel.append(picks);
            room.invitations.forEach(i=>panel.append(node('small','world-muted',i.name+' · ელოდება პასუხს')));
            const start=button('დაწყება · '+room.players.length+'/6',()=>request('start',{},close),'world-primary');start.disabled=room.players.length<2;panel.append(start);
          }else panel.append(node('p','','მასპინძლის დაწყებას ელოდები.'));
        }
        if(room.phase==='finished')renderResults(panel);
        panel.append(button(room.phase==='finished'?'ქალაქში დაბრუნება':'თამაშის დატოვება',leave,'world-leave'));
      }
    }
    renderHud();
  }
  function renderResults(container){
    container.append(node('strong','',room.result?.text||'მატჩი დასრულდა'));
    const winners=room.players.filter(p=>room.result?.winners.includes(p.id));
    const reward=room.result?.rewards?.[bridge.getSelf()?.id];if(reward)container.append(node('p','world-reward','🪙 შენს ანგარიშზე ჩაირიცხა '+new Intl.NumberFormat('ka-GE').format(reward)+' მონეტა!'));
    container.append(node('p','','🏆 '+(winners.map(p=>p.name).join(', ')||'გამარჯვებული არ არის')));
    for(const p of room.players)container.append(node('div','',p.name+' · '+(room.game==='race'?p.checkpoint+'/'+room.checkpoints.length:room.game==='zombies'?p.kills+' ზომბი':room.game==='battle'?p.score+' ქულა':p.out?'დაჭერილია':'დასრულებულია')));
  }
  const shooting=window.GaicaniCityShooting.mount({getContext:()=>({room,serverOffset,observedAt:publicRooms.find(r=>r.id===room?.id)?.zombie?.at,blocked:obscures()||(!notice.hidden&&!notice.hasAttribute('data-city-minimized'))})});

  let hudView=null,hudKey='',resultKey='';
  const setText=(element,value)=>{if(element.textContent!==value)element.textContent=value;};
  const hide=(element,value)=>{if(element.hidden!==value)element.hidden=value;};
  function renderHud(){
    hide(curtain,!(room?.game==='hide'&&room.seekerId===bridge.getSelf()?.id&&room.phase==='playing'&&Date.now()+serverOffset<room.startAt+20000));
    setText(curtain,'დამალვის დრო · '+Math.max(0,Math.ceil(((room?.startAt||0)+20000-Date.now()-serverOffset)/1000)));
    const hidden=obscures()||!room||room.phase==='lobby';if(hud.hidden!==hidden)hud.hidden=hidden;if(hidden)return;
    hud.dataset.compact=String(compactHud());
    const key=room.id+'|'+room.phase;
    if(key!==hudKey){
      hudKey=key;resultKey='';const min=hud.querySelector('.city-panel-minimize');
      const collapse=button('',()=>{hudCompact=!hudCompact;renderHud();},'world-hud-toggle');
      hudView={collapse,title:node('strong'),weapon:node('small','world-muted'),status:node('p'),help:node('small','world-muted'),results:node('section')};
      const action=room.phase==='finished'?button('დახურვა',()=>request('leave')):button('📱 მატჩი',()=>{opened=true;bridge.stop();render();});
      hud.replaceChildren(collapse,hudView.title,hudView.weapon,hudView.status,hudView.help,hudView.results,action);if(min)hud.append(min);
    }
    const collapse=hudView.collapse;setText(collapse,hudCompact?'⌄':'⌃');collapse.setAttribute('aria-label',hudCompact?'მატჩის დეტალების გაშლა':'მატჩის დეტალების შეკეცვა');collapse.setAttribute('aria-expanded',String(!hudCompact));
    setText(hudView.title,games[room.game][0]+' '+room.name);hide(hudView.weapon,room.game!=='zombies'||room.phase!=='playing');hide(hudView.status,room.phase==='finished');hide(hudView.help,!(['battle','zombies'].includes(room.game)&&room.phase==='playing'));hide(hudView.results,room.phase!=='finished');
    const me=room.players.find(p=>p.id===bridge.getSelf()?.id),at=Date.now()+serverOffset;
    if(room.phase==='finished'){const next=JSON.stringify([room.result,room.players.map(p=>[p.id,p.name,p.kills,p.score,p.checkpoint,p.out])]);if(next!==resultKey){resultKey=next;hudView.results.replaceChildren();renderResults(hudView.results);}return;}
    let text='';
    if(room.phase==='countdown')text='დაწყება: '+Math.max(0,Math.ceil((room.startAt-at)/1000));
    else {
      text='დარჩა '+Math.max(0,Math.ceil((room.endAt-at)/1000))+' წმ';
      if(room.game==='race')text+=' · წერტილი '+Math.min((me?.checkpoint||0)+1,room.checkpoints.length)+'/'+room.checkpoints.length;
      if(room.game==='zombies'){const z=room.zombie;text+=' · ტალღა '+z.wave+'/10 · ♥ '+(me?.hp||0)+'/100 · დარჩა '+z.enemies.length+' ზომბი';if(z.phase==='boss')text+=' · 👑 ბოსი';if(z.phase==='break')text+=' · შესვენება '+Math.max(0,Math.ceil((z.nextAt-at)/1000))+' წმ · იარაღი უმჯობესდება';if(me?.out)text+=' · დაელოდე ჯგუფს — შემდეგ ტალღაზე დაბრუნდები';if(compactHud())text='ტალღა '+z.wave+'/10 · ♥ '+(me?.hp||0)+' · 🧟 '+z.enemies.length+(z.phase==='break'?' · შესვენება '+Math.max(0,Math.ceil((z.nextAt-at)/1000))+' წმ':'')+(z.phase==='boss'?' · 👑 ბოსი':'')+(me?.out?' · დაელოდე ჯგუფს':'');setText(hudView.weapon,z.weapon.name+' · დონე '+z.weapon.level+' · ძალა '+z.weapon.damage);}
      if(room.game==='battle')text+=' · სიცოცხლე '+(me?.hp||0)+'/3 · ქულა '+(me?.score||0)+'/5'+(me?.respawnAt>at?' · დაბრუნება '+Math.ceil((me.respawnAt-at)/1000):'');
      if(room.game==='tag'||room.game==='hide'){
        text+=me?.id===room.seekerId?' · შენ ხარ მდევარი':me?.out?' · დაჭერილი ხარ — უყურე მატჩს':' · გაექეცი მდევარს';
        if(room.game==='hide'&&at<room.startAt+20000)text+=' · დამალვის დრო '+Math.ceil((room.startAt+20000-at)/1000);
        if(me?.hold>0&&!me.out)text+=' · დაჭერა '+Math.round(me.hold*100)+'%';
      }
    }
    setText(hudView.status,text);
    if(['battle','zombies'].includes(room.game)&&room.phase==='playing'){
      setText(hudView.help,'გააჩერე მაუსი ან G; ტელეფონზე სროლის ღილაკი გადაათრიე დასამიზნებლად.');
    }

  }
  function showInvitation(data){
    invitation=data;notice.hidden=false;notice.replaceChildren();
    notice.append(node('small','','📱 თამაშის მოწვევა'),node('h3','',data.fromName+' · '+data.name),node('p','',data.rules),node('small','','მოწვევა მოქმედებს 30 წამი.'));
    notice.append(button('მიღება',()=>request('respond',{id:data.id,accept:true},()=>{notice.hidden=true;invitation=null;}),'world-primary'),button('უარყოფა',()=>request('respond',{id:data.id,accept:false},()=>{notice.hidden=true;invitation=null;})));
  }
  let serverOffset=0;
  socket.on('city:world:room',data=>{const oldGun=room?.zombie?.weapon?.id;if(oldGun&&data?.zombie?.weapon?.id!==oldGun&&data?.phase==='playing')bridge.toast('🔫 ახალი იარაღი: '+data.zombie.weapon.name+' · ძალა '+data.zombie.weapon.damage);const previousPhase=room?.phase;const wasLobby=!room||room.phase==='lobby';room=data;if(data?.phase==='lobby')opened=true;if(wasLobby&&data?.phase==='countdown'){opened=false;bridge.stop();}if(previousPhase!==data?.phase||data?.phase==='lobby')render();else renderHud();});
  socket.on('city:world:public',data=>{publicRooms=data||[];});
  socket.on('city:world:clock',data=>{serverOffset=data.now-Date.now();});
  socket.on('city:world:invited',showInvitation);
  socket.on('city:world:declined',d=>{cooldowns.record(d.targetId,d.retryAfterMs);refreshCooldowns();bridge.toast(d.name+'-მა მოწვევა უარყო. ხელახლა მოწვევამდე მოიცადე ერთი წუთი.');});
  socket.on('city:game:inviteDeclined',d=>{cooldowns.record(d.targetId,d.retryAfterMs);refreshCooldowns();});
  setInterval(refreshCooldowns,1000);
  socket.on('city:world:inviteClosed',data=>{if(invitation?.id===data.id){notice.hidden=true;invitation=null;}});
  socket.on('city:world:shot',shooting.acceptShot);
  socket.on('city:joined',()=>request('sync'));
  socket.on('disconnect',()=>{room=null;opened=false;invitation=null;notice.hidden=true;publicRooms=[];render();});
  addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,button')||e.repeat)return;if(e.code==='KeyP'){e.preventDefault();opened=!opened;if(opened){bridge.stop();request('sync');}render();}if(e.key==='Escape'&&opened)close();});
  const zombiePositions=new Map();let previousDraw=0;
  function draw(ctx){
    const at=performance.now(),dt=Math.min(.1,Math.max(0,(at-previousDraw)/1000));previousDraw=at;const zombieIds=new Set();if(at-lastRender>250){lastRender=at;renderHud();}
    ctx.save();
    for(const r of publicRooms){
      if(r.phase==='finished')continue;
      if(r.game==='zombies'&&r.zombie){
        for(const raw of r.zombie.enemies){zombieIds.add(raw.id);let pos=zombiePositions.get(raw.id);if(!pos||Math.hypot(pos.x-raw.x,pos.y-raw.y)>160)pos={x:raw.x,y:raw.y};const blend=1-Math.exp(-dt*22);pos.x+=(raw.x-pos.x)*blend;pos.y+=(raw.y-pos.y)*blend;zombiePositions.set(raw.id,pos);const z={...raw,...pos};const boss=z.kind==='boss',heavy=boss||z.kind==='heavy',bob=Math.sin(at/140+z.x)*1.5;ctx.save();ctx.translate(z.x,z.y);if(boss)ctx.scale(1.8,1.8);ctx.fillStyle='#080a0b66';ctx.beginPath();ctx.ellipse(0,5,12,4,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=boss?'#d29986':heavy?'#a0b56c':'#80b9a0';ctx.fillRect(-8,-26+bob,16,15);ctx.fillStyle='#a7526b';ctx.fillRect(-9,-11,18,14);ctx.fillStyle='#494757';ctx.fillRect(-7,3,5,6);ctx.fillRect(2,3,5,6);ctx.fillStyle='#84b5a0';ctx.fillRect(-15,-12+bob,6,5);ctx.fillRect(9,-12-bob,6,5);ctx.fillStyle='#ffd6a6';ctx.fillRect(-5,-21+bob,3,3);ctx.fillRect(3,-21+bob,3,3);ctx.fillStyle='#222b32';ctx.fillRect(-3,-15+bob,7,2);ctx.fillStyle='#342c40';ctx.fillRect(-12,-34,24,3);ctx.fillStyle='#b8e482';ctx.fillRect(-12,-34,24*z.hp/z.maxHp,3);if(boss){ctx.fillStyle='#ffd878';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText('ბოსი',0,-39);}ctx.restore();}
      }
      if(r.game==='race'){
        const mine=r.players.find(p=>p.id===bridge.getSelf()?.id),next=mine?.checkpoint??-1;
        r.checkpoints.forEach((cp,i)=>{ctx.strokeStyle=i===next?'#ffdb6e':'#73ccea88';ctx.lineWidth=i===next?5:2;ctx.beginPath();ctx.arc(cp.x,cp.y,60,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#fff1bb';ctx.font='bold 15px system-ui';ctx.textAlign='center';ctx.fillText('🏁 '+(i+1),cp.x,cp.y-67);});
      }
      for(const p of r.players){
        if(!Number.isFinite(p.x))continue;
        if(r.game==='hide'&&p.id!==r.seekerId&&!p.out)continue;
        ctx.textAlign='center';ctx.font='bold 11px system-ui';ctx.fillStyle=p.out?'#aaa':'#9ef5ff';
        ctx.fillText(r.game==='zombies'?'🧟 '+p.kills+' · '+p.hp+'♥':r.game==='battle'?'🎯 '+p.score+' · '+'♥'.repeat(Math.max(0,p.hp)):p.id===r.seekerId?'მდევარი':r.game==='race'?'🏁 '+p.checkpoint+'/'+r.checkpoints.length:p.out?'დაჭერილია':'თამაშობს',p.x,p.y-44);
        if(p.id===r.seekerId){ctx.strokeStyle='#ffa45c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,r.radius,0,Math.PI*2);ctx.stroke();}
        if(p.hold>0&&!p.out){ctx.strokeStyle='#ff5577';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,23,-Math.PI/2,-Math.PI/2+Math.PI*2*p.hold);ctx.stroke();}
        if(['battle','zombies'].includes(r.game)&&p.hp>0){const a=p.id===bridge.getSelf()?.id?shooting.angle():Number.isFinite(p.aimAngle)?p.aimAngle:{right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2}[p.dir]||0;const gun=r.zombie?.weapon||r.weapon;const body=p.id===bridge.getSelf()?.id?bridge.getSelf():bridge.getPlayer(p.id);ctx.save();ctx.translate(body?.x??p.x,(body?.y??p.y)-8);ctx.rotate(a);window.GaicaniCityWeaponArt.draw(ctx,gun);ctx.restore();}
      }
    }
    for(const id of zombiePositions.keys())if(!zombieIds.has(id))zombiePositions.delete(id);
    shooting.draw(ctx);
    ctx.restore();
  }
  function hideOnMap(id){return !!(room?.game==='hide'&&room.phase!=='finished'&&room.seekerId===bridge.getSelf()?.id&&id!==room.seekerId&&room.players.some(p=>p.id===id&&!p.out));}
  function drawMini(ctx,width,height){
    if(room?.game!=='race'||room.phase==='finished')return;
    const me=room.players.find(p=>p.id===bridge.getSelf()?.id),cp=room.checkpoints[me?.checkpoint||0];if(!cp)return;
    ctx.strokeStyle='#ffdb6e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cp.x/window.GaicaniCityWorld.width*width,cp.y/window.GaicaniCityWorld.height*height,5,0,Math.PI*2);ctx.stroke();
  }
  window.GaicaniWorldGames={draw,drawMini,hideOnMap,get blocksMovement(){return obscures();}};
  setInterval(()=>{if(opened&&!room)render();},2000);
})();
