(() => {
 'use strict';
 const bridge=window.GaicaniCityGameBridge,socket=bridge.getSocket(),root=document.querySelector('.city-world');
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 const button=(text,run)=>{const b=node('button',text);b.type='button';b.onclick=run;return b;};
 const launch=button('🍹 ბარი',open);launch.hidden=true;launch.setAttribute('aria-controls','cityBarPanel');document.getElementById('cityQuickActions').append(launch);
 const panel=node('section',null,'city-bar-panel');panel.id='cityBarPanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','ბარის სასმელები');root.append(panel);
 const offer=node('section',null,'city-bar-offer'),status=node('div',null,'city-bar-status');offer.hidden=status.hidden=true;offer.setAttribute('aria-live','polite');status.setAttribute('role','status');(root.querySelector('.city-hud-stack')||root).append(offer,status);
 let busy=false,currentOffer=null,until=0,level=0,session=0,view=0;
 function effect(d){until=Date.now()+Math.max(0,(d.until||0)-(d.serverTime||Date.now()));level=d.level||0;}
 function request(event,data,done){
  const version=session,currentView=view;const finish=(error,r)=>{if(version!==session||(event==='state'&&currentView!==view))return;if(error)r={error:'კავშირი შეფერხდა. გადაამოწმე მონეტები და ხელახლა სცადე.'};if(r?.effect)effect(r.effect);if(r?.error)bridge.toast(r.error);else if(r?.message)bridge.toast(r.message);done?.(r||{});};
  if(!socket.connected){finish(true);return;}socket.timeout(6000).emit('city:bar:'+event,data,finish);
 }
 function close(){view++;panel.hidden=true;launch.focus({preventScroll:true});}
 function open(){const currentView=++view;bridge.stop();panel.hidden=false;panel.replaceChildren(node('h3','ბარი · სასმელები'),button('×',close));request('state',{},r=>{
  if(panel.hidden||currentView!==view)return;if(r.error){close();return;}
  if(!r.bar){close();bridge.toast('ბართან ახლოს მიდი.');return;}
  panel.replaceChildren(node('h3','ბარი · სასმელები'),button('×',close));panel.children[1].setAttribute('aria-label','ბარის დახურვა');panel.children[1].className='city-bar-close';
  panel.append(node('p','აირჩიე სასმელი შენთვის ან ახლომდებარე მოთამაშისთვის. საჩუქარი მხოლოდ მისი მიღებისას შეიძინება. თრობა დროებით არხევს კამერას.'));
  const target=node('select');target.setAttribute('aria-label','ვისთვის ყიდულობ სასმელს');const own=node('option','ჩემთვის');own.value='';target.append(own);for(const p of r.people){const o=node('option',p.name);o.value=p.id;target.append(o);}panel.append(target);
  for(const d of r.drinks){const b=button(d.name+' · '+d.price+' მონეტა',()=>{if(busy)return;busy=true;for(const b of panel.querySelectorAll('.city-bar-buy'))b.disabled=true;request('order',{drinkId:d.id,targetId:target.value,requestId:crypto.randomUUID()},()=>{busy=false;for(const b of panel.querySelectorAll('.city-bar-buy'))b.disabled=false;});});b.className='city-bar-buy';b.disabled=busy;panel.append(b);}
  panel.append(button('წყალი · უფასო · გამოფხიზლება',()=>request('water',{})));panel.querySelector('select').focus({preventScroll:true});
 });}
 socket.on('city:bar:effect',effect);socket.on('city:bar:notice',d=>bridge.toast(d.message));
 socket.on('city:bar:offered',d=>{currentOffer=d;offer.hidden=false;offer.replaceChildren(node('span',d.name+' გთავაზობს: '+d.drink.name),button('მივიღო',()=>answer(true)),button('არა',()=>answer(false)));});
 function answer(accept){if(!currentOffer)return;const id=currentOffer.id;request('respond',{id,accept},()=>{offer.hidden=true;currentOffer=null;});}
 socket.on('city:bar:offerClosed',d=>{if(currentOffer?.id===d.id){offer.hidden=true;currentOffer=null;}});
 status.append(node('span'),button('გამოფხიზლება',()=>request('water',{})));
 const canvas=document.getElementById('cityCanvas');
 setInterval(()=>{
  const p=bridge.getSelf(),free=p&&!p.gameId&&!p.vehicleId&&!p.rideId&&!p.activityLocked;
  const garden=free&&!p.interiorId&&Math.hypot(p.x-500,p.y-2255)<145,b=window.GaicaniCityWorld.buildings.find(b=>b.id==='radio-bar'),radio=free&&!p.interiorId&&Math.hypot(p.x-(b.x+b.w*.72+9),p.y-(b.y+b.h+15))<145,casino=free&&p.interiorId==='neon-casino'&&Math.hypot(p.casinoX-845,p.casinoY-475)<145;
  launch.hidden=!(garden||radio||casino);const active=until>Date.now();status.hidden=!active;if(active)status.firstChild.textContent='🍷 თრობა · '+Math.ceil((until-Date.now())/1000)+' წმ';canvas.classList.toggle('city-tipsy',active&&!!free);canvas.style.setProperty('--city-tipsy',String(level));
  if(currentOffer?.expiresAt<Date.now()){offer.hidden=true;currentOffer=null;}
 },200);
 socket.on('disconnect',()=>{session++;view++;until=0;currentOffer=null;busy=false;panel.hidden=offer.hidden=status.hidden=true;canvas.classList.remove('city-tipsy');});
 document.addEventListener('keydown',e=>{if(panel.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}if(e.key==='Tab'){const list=[...panel.querySelectorAll('button:not(:disabled),select')],first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}},true);
 window.GaicaniCityBar={open,close,get blocksMovement(){return !panel.hidden;}};
})();
