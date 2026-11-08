/* City sound events. No downloads, speech API or model calls: all sounds are original synthesis. */
(() => {
 'use strict';
 const audio=window.GaicaniCityAudio,bridge=window.GaicaniCityGameBridge,socket=bridge.getSocket();
 const cooldowns=new Map(),bubbles=new Map();let baseline=false,previous=null,room=null,questState=null,life=null,stepDistance=0;
 function play(kind,options={},gap=100){
  if(document.hidden||!bridge.getSelf())return false;
  const key=options.key||kind,now=performance.now();if(now-(cooldowns.get(key)??-Infinity)<gap)return false;
  cooldowns.set(key,now);return audio.effect(kind,options);
 }
 function nearby(kind,point,options={},range=350){
  const p=bridge.getSelf();if(!p||p.interiorId||p.rideId||!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return;
  const distance=Math.hypot(p.x-point.x,p.y-point.y);if(distance>=range)return;
  play(kind,{...options,volume:(options.volume??1)*(1-distance/range),pan:Math.max(-.8,Math.min(.8,(point.x-p.x)/range))});
 }
 socket.on('city:gaicanians:state',state=>{
  if(!state?.people)return;
  for(const c of state.people){const b=c.bubble;if(!b||b.until<=state.serverTime)continue;const key=b.until+':'+b.text;
   if(bubbles.get(c.id)===key)continue;bubbles.set(c.id,key);
   if(baseline)nearby('chatter',c,{id:c.id,text:b.text,key:'voice:'+c.id},300);
  }baseline=true;
 });
 socket.on('city:message',d=>{if(d?.gaicanianId)return;const p=bridge.getSelf(),from=d?.id===p?.id?p:bridge.getPlayer(d?.id);if(from)nearby('message',from,{volume:.6});});
 for(const event of ['city:world:invited','city:game:inviteRequest','city:vehicle:invited'])socket.on(event,()=>play('invite'));
 socket.on('city:error',()=>play('error'));
 socket.on('city:world:shot',d=>{if(d?.shooterId!==bridge.getSelf()?.id)nearby('shot',d?.from);});
 socket.on('city:life:spark',d=>nearby(d?.kind==='concert'?'clap':'work',d));
 socket.on('city:life:state',s=>{if(!s?.event)return;if(life?.id===s.event.id&&!life.done&&s.event.done)nearby('success',s.event);if(life&&JSON.stringify(life.reactions)!==JSON.stringify(s.reactions)&&s.reactions?.length)play('pet',{volume:.5},1200);life={...s.event,reactions:s.reactions};});
 socket.on('city:quest:state',s=>{s=s?.state||s;if(!s?.quests)return;if(questState)for(const q of s.quests){const old=questState.find(o=>o.id===q.id);if(old&&!old.claimed&&q.claimed)play('coin');else if(old&&old.progress<q.goal&&q.progress>=q.goal)play('success');}questState=s.quests;});
 socket.on('city:world:room',r=>{
  if(r&&room?.id===r.id){if(room.phase!==r.phase&&r.phase==='playing')play('start');if(room.phase!==r.phase&&r.phase==='finished')play('success');if(r.zombie&&room.zombie){if(r.zombie.wave>room.zombie.wave)play('start');if(r.zombie.phase==='break'&&room.zombie.phase!=='break')play('success');}if(r.result?.rewards?.[bridge.getSelf()?.id]&&!room.result?.rewards?.[bridge.getSelf()?.id])play('coin');const p=bridge.getSelf(),before=room.players?.find(x=>x.id===p?.id),after=r.players?.find(x=>x.id===p?.id);if(before&&after){if(after.checkpoint>before.checkpoint)play('coin');if(after.hp<before.hp||(!before.out&&after.out))play('hit');}}
  room=r;
 });
 socket.on('city:game:started',()=>play('start'));socket.on('city:game:ended',()=>play('success'));
 socket.on('city:game:update',()=>play('click',{volume:.4},300));
 // Button feedback covers the City's menus, activities, shops, emotes and game controls.
 document.addEventListener('click',e=>{const b=e.target.closest?.('button');if(!b||b.disabled||b.closest('#cityAudioPanel')||b.id==='soundButton')return;play('click',{volume:.3},60);},true);
 const timer=setInterval(()=>{
  const p=bridge.getSelf();if(!p||!socket.connected||document.hidden){previous=null;return;}
  const now=Date.now();if(room?.phase==='countdown')play('countdown',{key:'countdown',volume:.6},950);
  if(previous&&previous.id===p.id){
   const distance=Math.hypot(p.x-previous.x,p.y-previous.y);
   if(p.vehicleId!==previous.vehicleId)play('door');
   if(p.interiorId!==previous.interiorId)play('door');
   if((p.jumpSerial||0)>previous.jumpSerial)play('jump');
   if(previous.jumpRemaining>0&&!(p.jumpRemaining>0)&&!p.vehicleId)play('land');
   if(!p.vehicleId&&!p.interiorId&&!p.rideId&&!(p.jumpRemaining>0)&&distance>.2&&distance<70){stepDistance+=distance;if(stepDistance>=(p.sprinting?30:38)){stepDistance=0;play('step',{volume:.65},130);}}
   if(p.vehicleId&&Math.abs(p.vehicleSpeed)>8)play('engine',{volume:.3+.5*Math.min(1,Math.abs(p.vehicleSpeed)/350)},180);
   const action=p.activityAnimation?.kind||p.activityAnimation?.type||p.activityAnimation;
   if(action&&action!==previous.activity){const kind=String(action);play(/fish|water/.test(kind)?'water':/photo|camera/.test(kind)?'camera':'work');}
  }
  previous={id:p.id,x:p.x,y:p.y,vehicleId:p.vehicleId,interiorId:p.interiorId,jumpSerial:p.jumpSerial||0,jumpRemaining:p.jumpRemaining||0,activity:p.activityAnimation?.kind||p.activityAnimation?.type||p.activityAnimation};
  for(const [key,at]of cooldowns)if(performance.now()-at>15000)cooldowns.delete(key);
 },100);
 socket.on('disconnect',()=>{previous=null;baseline=false;room=null;questState=null;life=null;bubbles.clear();cooldowns.clear();stepDistance=0;});
 window.addEventListener('pagehide',e=>{if(!e.persisted)clearInterval(timer);});
})();
