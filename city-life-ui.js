(() => {
 'use strict';
 const bridge=window.GaicaniCityGameBridge,socket=bridge.getSocket(),world=window.GaicaniCityWorld,data=window.GaicaniCityLifeData;
 let snapshot=null,offset=0,opened=false,following=false,pending=false,lastFocus=null,sparks=[],celebrateUntil=0;
 const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const button=(text,run)=>{const b=node('button','',text);b.type='button';b.onclick=run;return b;};
 const root=document.querySelector('.city-world'),launcher=button('♫ ქალაქის ამბები',open);
 launcher.setAttribute('aria-controls','cityLifeBoard');launcher.setAttribute('aria-expanded','false');document.getElementById('cityQuickActions').append(launcher);
 const overlay=node('section','city-life-overlay');overlay.id='cityLifeBoard';overlay.hidden=true;
 const panel=node('div','city-life-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','cityLifeTitle');overlay.append(panel);root.append(overlay);
 const hud=node('section','city-life-hud');hud.hidden=true;hud.setAttribute('aria-label','ქუჩის მიმდინარე ღონისძიება');
 const title=node('strong'),details=node('p'),meter=node('progress'),action=button('მონაწილეობა',contribute),dismiss=button('×',()=>{following=false;update();});dismiss.setAttribute('aria-label','ღონისძიების მინიშნების დახურვა');
 hud.append(title,dismiss,details,meter,action);(document.querySelector('.city-hud-stack')||root).append(hud);
 const mini=document.getElementById('miniMap'),mapLayer=node('canvas','city-life-map-layer');mapLayer.width=mini.width;mapLayer.height=mini.height;mapLayer.setAttribute('aria-hidden','true');mini.parentElement.append(mapLayer);const mapCtx=mapLayer.getContext('2d');
 const petButton=button('♥ მოფერება',pet);petButton.hidden=true;document.getElementById('cityQuickActions').append(petButton);
 function time(){return Date.now()+offset;}
 function free(){const p=bridge.getSelf();return p&&!p.vehicleId&&!p.interiorId&&!p.rideId&&!p.gameId&&!p.gardenSeatId&&!p.gardenDance;}
 function request(event,packet={},done){
  if(!socket.connected){bridge.toast('ჯერ ქალაქს დაუკავშირდი.');done?.({error:true});return;}
  socket.emit('city:life:'+event,packet,r=>{if(r?.state)accept(r.state);if(r?.error)bridge.toast(r.error);done?.(r);});
 }
 function accept(value){
  if(!value?.event)return;
  offset=value.serverTime-Date.now();
  if(snapshot?.event.id===value.event.id&&!snapshot.event.done&&value.event.done){celebrateUntil=performance.now()+6000;bridge.toast('✨ ქალაქის საერთო მიზანი შესრულებულია!');}
  const changed=JSON.stringify([snapshot?.event.id,snapshot?.event.progress,snapshot?.event.contributors,snapshot?.feed])!==JSON.stringify([value.event.id,value.event.progress,value.event.contributors,value.feed]);
  snapshot=value;if(opened&&changed)render();update();
 }
 function open(){if(opened)return;lastFocus=document.activeElement;opened=true;overlay.hidden=false;launcher.setAttribute('aria-expanded','true');bridge.stop();render();request('sync');panel.querySelector('[data-close]').focus();}
 function close(){opened=false;overlay.hidden=true;launcher.setAttribute('aria-expanded','false');(lastFocus?.offsetParent!==null?lastFocus:launcher)?.focus();update();}
 function render(){
  const focus=document.activeElement?.dataset.lifeAction,scroll=panel.scrollTop;panel.replaceChildren();const header=node('header'),heading=node('h2','','რა ხდება ქალაქში?');heading.id='cityLifeTitle';const dismiss=button('×',close);dismiss.dataset.close='';dismiss.dataset.lifeAction='close';dismiss.setAttribute('aria-label','ქალაქის ამბების დახურვა');header.append(heading,dismiss);panel.append(node('small','','თბილისი 1999 · ცოცხალი ქუჩები'),header);
  if(!snapshot){panel.append(node('p','',socket.connected?'ქალაქის ამბები იტვირთება…':'კავშირი გაწყდა — ქალაქში დაბრუნებისას ამბებიც განახლდება.'));return;}
  const e=snapshot.event;panel.append(node('strong','life-event-name',e.icon+' '+e.title),node('p','',e.description),node('p','life-muted','📍 '+e.label+' · ღონისძიება ყოველ 4 წუთში იცვლება.'));
  const progress=node('progress');progress.max=e.goal;progress.value=e.progress;progress.setAttribute('aria-label','საერთო მიზანი');panel.append(progress,node('p','',e.progress+' / '+e.goal+(e.done?' · შესრულებულია!':' · საერთო პროგრესი')));
  const follow=button(e.done?'შესრულებულია':'რუკაზე მონიშვნა',()=>{following=true;close();});follow.dataset.lifeAction='follow';follow.disabled=e.done;panel.append(follow);
  panel.append(node('h3','','ქალაქის მოკლე ამბები'));const feed=node('ul');snapshot.feed.forEach(item=>feed.append(node('li','',item.text)));panel.append(feed);
  if(e.contributors.length){panel.append(node('h3','','ვინ დაეხმარა ქალაქს'));const list=node('ul');e.contributors.forEach(p=>list.append(node('li','',p.name+' · '+p.count)));panel.append(list);}
  panel.append(node('p','life-muted','ქუჩაში კატებსა და ძაღლებს მიუახლოვდი — მოფერების ღილაკი ახლოს გამოჩნდება. ღონისძიებაში მონაწილეობის მისაღებად ფეხით უნდა იყო.'));
  panel.scrollTop=scroll;
  if(focus)panel.querySelector('[data-life-action="'+CSS.escape(focus)+'"]')?.focus({preventScroll:true});
 }
 function nearestItem(){const self=bridge.getSelf(),e=snapshot?.event;if(!self||e?.kind!=='cleanup')return null;return [...e.litter].sort((a,b)=>Math.hypot(a.x-self.x,a.y-self.y)-Math.hypot(b.x-self.x,b.y-self.y))[0]||null;}
 function nearestPet(){const p=bridge.getSelf();if(!p||!free())return null;return world.animals.map(a=>data.animalAt(a,time())).filter(a=>Math.hypot(a.x-p.x,a.y-p.y)<=75).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]||null;}
 function contribute(){
  if(pending||!snapshot)return;pending=true;update();const e=snapshot.event,target=nearestItem(),serial=e.id;
  const timer=setTimeout(()=>{pending=false;update();},4000);
  request('act',{eventId:serial,targetId:target?.id},()=>{clearTimeout(timer);pending=false;update();});
 }
 function pet(){const animal=nearestPet();if(!animal)return;request('pet',{animalId:animal.id},r=>{if(r?.ok)bridge.toast(r.message);});}
 function update(){
  mapLayer.style.left=mini.offsetLeft+'px';mapLayer.style.top=mini.offsetTop+'px';mapLayer.style.width=mini.clientWidth+'px';mapLayer.style.height=mini.clientHeight+'px';mapCtx.clearRect(0,0,mapLayer.width,mapLayer.height);drawMini(mapCtx,mapLayer.width,mapLayer.height);
  const animal=nearestPet();petButton.hidden=!animal;petButton.textContent=animal?(animal.kind==='cat'?'🐈 ფისოს მოფერება':'🐕 ძაღლის მოფერება'):'♥ მოფერება';
  const e=snapshot?.event,p=bridge.getSelf();hud.hidden=!following||!e||opened;
  if(hud.hidden)return;
  title.textContent=e.icon+' '+e.title;meter.max=e.goal;meter.value=e.progress;meter.setAttribute('aria-label','საერთო მიზანი');
  const target=e.kind==='cleanup'?nearestItem():e,distance=p&&target?Math.hypot(p.x-target.x,p.y-target.y):Infinity;
  const near=distance<=(e.kind==='cleanup'?65:100),seconds=Math.max(0,Math.ceil((e.endsAt-time())/1000));
  details.textContent=e.progress+'/'+e.goal+' · '+(e.done?'მიზანი შესრულებულია!':near?'შენ ადგილზე ხარ':Math.round(distance)+' ნაბიჯი ნიშნულამდე')+' · '+seconds+' წმ';
  action.disabled=pending||!socket.connected||!free()||!near||e.done;
  action.textContent=e.done?'✓ შესრულებულია':e.kind==='cleanup'?'♻ ნარჩენის აღება':data.beat(time())?'👏 ახლა — ტაში!':'♫ დაელოდე რიტმს';action.classList.toggle('on-beat',e.kind==='concert'&&data.beat(time()));
 }
 function drawGround(ctx){
  const e=snapshot?.event;if(!e)return;ctx.save();ctx.textAlign='center';ctx.font='bold 12px system-ui';ctx.strokeStyle=e.done?'#85e6a0':'#ffc978';ctx.fillStyle='#fff0bc';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(e.x,e.y,32+Math.sin(time()/500)*3,0,Math.PI*2);ctx.stroke();ctx.fillText(e.icon+' '+e.progress+'/'+e.goal,e.x,e.y-40);
  if(e.kind==='cleanup')for(const item of e.litter){ctx.fillStyle='#95e2cb';ctx.fillRect(item.x-5,item.y-4,9,7);ctx.fillStyle='#ead5a5';ctx.fillRect(item.x+2,item.y-6,4,3);if(following){ctx.strokeStyle='#ffe697';ctx.beginPath();ctx.arc(item.x,item.y,12,0,Math.PI*2);ctx.stroke();}}
  ctx.restore();
 }
 function drawReactions(ctx){
  const at=performance.now(),e=snapshot?.event;ctx.save();ctx.textAlign='center';ctx.font='bold 15px system-ui';ctx.fillStyle='#ff8bc9';
  for(const r of snapshot?.reactions||[]){if(r.until<=time())continue;const base=world.animals.find(a=>a.id===r.animalId);if(!base)continue;const a=data.animalAt(base,time());ctx.fillText('♥',a.x,a.y-22-Math.sin(time()/180)*3);}
  if(e?.kind==='concert'&&!e.done){ctx.fillStyle='#f9d181';for(let i=0;i<3;i++)ctx.fillText(i%2?'♪':'♫',e.x-20+i*18,e.y-30-((time()/35+i*15)%45));}
  sparks=sparks.filter(s=>s.until>at);for(const s of sparks){const phase=1-(s.until-at)/1000;ctx.globalAlpha=1-phase;ctx.fillStyle='#8df1cb';ctx.fillText(s.kind==='concert'?'👏':'✦',s.x,s.y-18-phase*24);}ctx.globalAlpha=1;
  if(e&&celebrateUntil>at){for(let i=0;i<12;i++){const angle=i*Math.PI/6,rad=35+(6000-celebrateUntil+at)%1200/15;ctx.fillStyle=i%2?'#a4f5dd':'#ffd1ec';ctx.fillRect(e.x+Math.cos(angle)*rad,e.y+Math.sin(angle)*rad,4,4);}}
  ctx.restore();
 }
 function drawMini(ctx,w,h){const e=snapshot?.event;if(!e||e.done)return;const target=following&&e.kind==='cleanup'?nearestItem()||e:e;ctx.save();ctx.strokeStyle=following?'#fff49e':'#bd99ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(target.x/world.width*w,target.y/world.height*h,following?5:3,0,Math.PI*2);ctx.stroke();ctx.restore();}
 document.addEventListener('keydown',e=>{if(opened&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyE','KeyF','Space'].includes(e.code))e.stopImmediatePropagation();},true);
 overlay.addEventListener('click',e=>{if(e.target===overlay)close();});document.addEventListener('keydown',e=>{if(!opened)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}if(e.key==='Tab'){const list=[...panel.querySelectorAll('button:not(:disabled)')],first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 socket.on('city:life:state',accept);socket.on('city:life:spark',s=>{sparks.push({...s,until:performance.now()+1000});sparks=sparks.slice(-30);});socket.on('city:joined',()=>request('sync'));
 socket.on('disconnect',()=>{snapshot=null;sparks=[];pending=false;following=false;update();if(opened)render();});
 window.GaicaniCityLife={now:time,drawGround,drawReactions,drawMini,get blocksMovement(){return opened;}};
 setInterval(update,100);if(bridge.getSelf())request('sync');
})();
