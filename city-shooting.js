/* Stable hold-to-fire controls, separate from frequently rebuilt match HUD nodes. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GaicaniCityShooting=api;})(typeof window==='undefined'?globalThis:window,root=>{
 function createTrigger({now,getReady,getGun,onShot}){
  const held=new Set(),pending=new Map();let next=0,serial=0;
  function tick(){const at=now();for(const [id,time]of pending)if(at-time>1500)pending.delete(id);if(!getReady()){held.clear();return;}if(!held.size||at<next||pending.size>=4)return;const id='shot-'+(++serial);next=at+getGun().cooldown+12;pending.set(id,at);onShot(id,result=>{pending.delete(id);if(result?.code==='COOLDOWN')next=Math.max(next,now()+Math.max(0,result.retryAfterMs||0)+15);});}
  return {press(source){if(!getReady())return;held.add(source);tick();},release:source=>held.delete(source),stop:()=>held.clear(),tick,stats:()=>({held:held.size,pending:pending.size,next})};
 }
 function mount({getContext}){
  const bridge=root.GaicaniCityGameBridge,socket=bridge.getSocket(),combat=root.GaicaniCityCombat,canvas=document.getElementById('cityCanvas');
  const pad=document.createElement('button');pad.type='button';pad.className='city-fire-control';pad.textContent='◎';pad.setAttribute('aria-label','სროლა — გააჩერე; გადაათრიე დასამიზნებლად');pad.title='სროლა · გააჩერე G ან მაუსი; ტელეფონზე გააჩერე და გადაათრიე';pad.hidden=true;document.querySelector('.city-world').append(pad);
  let aim=null,pointer=null,padStart=null,lastHit=0,lastShot=0,tracers=[];
  const now=()=>performance.now(),context=()=>getContext(),gun=()=>context().room?.zombie?.weapon||context().room?.weapon||combat.battleWeapon;
  function active(){const c=context();return socket.connected&&c.room?.phase==='playing'&&['battle','zombies'].includes(c.room.game);}
  function blocked(){if(context().blocked||document.hidden)return true;return [...document.querySelectorAll('[role="dialog"],#playerCard,#cityMoreMenu')].some(p=>p.getClientRects().length&&!p.hasAttribute('data-city-minimized'));}
  function ready(){if(!active()||blocked())return false;const c=context(),p=bridge.getSelf(),me=c.room.players.find(t=>t.id===p?.id);return !!me&&me.hp>0&&!me.out&&!(me.respawnAt>Date.now()+c.serverOffset)&&c.room.zombie?.phase!=='break';}
  function angle(){const p=bridge.getSelf();if(!p)return 0;if(aim?.kind==='angle')return aim.angle;if(aim){const world=bridge.getAimPoint(aim.x,aim.y),from=combat.muzzle(p);return Math.atan2(world.y-from.y,world.x-from.x);}return {right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2}[p.dir]||0;}
  const trigger=createTrigger({now,getReady:ready,getGun:gun,onShot:(requestId,done)=>{
   const p=bridge.getSelf(),a=angle(),from=combat.muzzle(p),shot=combat.raycast(root.GaicaniCityWorld,from,a,gun().range,[]);lastShot=now();
   tracers.push({requestId,shooterId:p.id,from,to:shot.to,until:now()+130,predicted:true});root.GaicaniCityAudio?.effect('shot',{volume:.65});
   socket.emit('city:world:shoot',{angle:a,requestId,observedAt:context().observedAt},result=>{done(result);if(result?.hit){lastHit=now();root.GaicaniCityAudio?.effect('hit',{volume:.45});}if(result?.error&&result.code!=='COOLDOWN'){tracers=tracers.filter(t=>t.requestId!==requestId);trigger.stop();}});
  }});
  function stop(){trigger.stop();pointer=null;padStart=null;}
  function aimAt(e){aim={kind:'screen',x:e.clientX,y:e.clientY};}
  canvas.addEventListener('pointermove',e=>{if(!active())return;if(e.pointerType==='mouse'||pointer===e.pointerId)aimAt(e);});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0||!ready())return;e.preventDefault();e.stopImmediatePropagation();pointer=e.pointerId;aimAt(e);try{canvas.setPointerCapture(e.pointerId);}catch{}trigger.press('pointer');},true);
  pad.addEventListener('pointerdown',e=>{if(e.button!==0||!ready())return;e.preventDefault();pointer=e.pointerId;padStart={x:e.clientX,y:e.clientY};try{pad.setPointerCapture(e.pointerId);}catch{}trigger.press('pointer');});
  pad.addEventListener('pointermove',e=>{if(pointer!==e.pointerId||!padStart)return;const dx=e.clientX-padStart.x,dy=e.clientY-padStart.y;if(Math.hypot(dx,dy)>8)aim={kind:'angle',angle:Math.atan2(dy,dx)};});
  function release(e){if(e.pointerId===pointer){trigger.release('pointer');pointer=null;padStart=null;}}
  for(const event of ['pointerup','pointercancel','lostpointercapture']){root.addEventListener(event,release);pad.addEventListener(event,release);canvas.addEventListener(event,release);}
  pad.onclick=e=>{e.preventDefault();if(e.detail===0){trigger.press('keyboard-click');trigger.release('keyboard-click');}};
  document.addEventListener('keydown',e=>{if(e.code!=='KeyG'||e.target.closest('input,textarea,select,[contenteditable=true]')||!ready())return;e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)trigger.press('key');},true);
  document.addEventListener('keyup',e=>{if(e.code==='KeyG')trigger.release('key');},true);
  document.addEventListener('pointerdown',e=>{if(e.target!==canvas&&e.target!==pad&&!e.target.closest('.touch-controls'))stop();},true);
  root.addEventListener('blur',stop);root.addEventListener('resize',stop);document.addEventListener('visibilitychange',stop);socket.on('disconnect',()=>{stop();aim=null;tracers=[];});
  const timer=setInterval(()=>{trigger.tick();pad.hidden=!active()||blocked();if(!pad.hidden){pad.disabled=!ready();pad.setAttribute('aria-pressed',String(trigger.stats().held>0));}},25);
  root.addEventListener('pagehide',e=>{stop();if(!e.persisted)clearInterval(timer);});
  function acceptShot(d){const match=tracers.find(t=>t.requestId===d.requestId&&t.shooterId===d.shooterId);if(match)Object.assign(match,d,{until:now()+100,predicted:false});else tracers.push({...d,until:now()+120});tracers=tracers.slice(-80);}
  function draw(ctx){const at=now();tracers=tracers.filter(t=>t.until>at);ctx.save();for(const t of tracers){ctx.globalAlpha=Math.min(1,(t.until-at)/80);ctx.strokeStyle=t.predicted?'#e8faff':'#ffe59a';ctx.lineWidth=t.predicted?1.5:2;ctx.beginPath();ctx.moveTo(t.from.x,t.from.y);ctx.lineTo(t.to.x,t.to.y);ctx.stroke();}ctx.globalAlpha=1;
   if(ready()){const from=combat.muzzle(bridge.getSelf()),a=angle(),point=aim?.kind==='screen'?bridge.getAimPoint(aim.x,aim.y):null,distance=point?Math.min(gun().range,Math.hypot(point.x-from.x,point.y-from.y)):120,to={x:from.x+Math.cos(a)*distance,y:from.y+Math.sin(a)*distance};ctx.strokeStyle=at-lastHit<180?'#ff938d':'#8bfff0';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(to.x,to.y,6,0,Math.PI*2);ctx.moveTo(to.x-10,to.y);ctx.lineTo(to.x-4,to.y);ctx.moveTo(to.x+4,to.y);ctx.lineTo(to.x+10,to.y);ctx.stroke();if(at-lastShot<70){ctx.fillStyle='#fff1b2';ctx.beginPath();ctx.arc(from.x+Math.cos(a)*26,from.y+Math.sin(a)*26,4,0,Math.PI*2);ctx.fill();}}
   ctx.restore();
  }
  return {draw,acceptShot,angle,stop,fire(){trigger.press('single');trigger.release('single');},stats:trigger.stats};
 }
 return {createTrigger,mount};
});
