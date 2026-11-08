(() => {
 'use strict';
 const bridge=window.GaicaniCityGameBridge,socket=bridge.getSocket();
 let snapshot=null,opened=false,pending=false,lastFocus=null,request=0;
 const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const button=(text,run,cls='')=>{const b=node('button',cls,text);b.type='button';b.onclick=run;return b;};
 const amount=n=>new Intl.NumberFormat('ka-GE').format(n);
 const launcher=button('📜 მისიები',open);launcher.setAttribute('aria-controls','cityQuestBoard');launcher.setAttribute('aria-expanded','false');
 document.getElementById('cityQuickActions').append(launcher);
 const overlay=node('section','city-quests-overlay');overlay.id='cityQuestBoard';overlay.hidden=true;
 const panel=node('div','city-quests-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','cityQuestsTitle');overlay.append(panel);document.querySelector('.city-world').append(overlay);
 function accept(state){
  if(!state)return;
  if(snapshot)for(const q of state.quests){const old=snapshot.quests.find(x=>x.id===q.id);if(state.registered&&old&&old.progress<q.goal&&q.progress>=q.goal&&!q.claimed)bridge.toast('📜 '+q.title+' — ჯილდო მზადაა!');}
  snapshot=state;launcher.textContent='📜 მისიები'+(state.quests.some(q=>state.registered&&q.progress>=q.goal&&!q.claimed)?' ●':'');
  if(opened)render();
 }
 function load(){if(!socket.connected)return;socket.emit('city:quest:state',{},r=>{if(r?.state)accept(r.state);});}
 function open(){if(opened)return;window.GaicaniCityActivitiesUI?.close();lastFocus=document.activeElement;opened=true;overlay.hidden=false;launcher.setAttribute('aria-expanded','true');bridge.stop();render();load();panel.querySelector('[data-close]').focus();}
 function close(){opened=false;overlay.hidden=true;launcher.setAttribute('aria-expanded','false');(lastFocus?.isConnected?lastFocus:launcher).focus();}
 function claim(id){
  if(pending)return;pending=true;render();const serial=++request;
  const timer=setTimeout(()=>{if(serial!==request)return;pending=false;bridge.toast('პასუხი იგვიანებს. გადაამოწმე ჯილდოს მდგომარეობა.');load();if(opened)render();},5000);
  socket.emit('city:quest:claim',{questId:id},r=>{
   if(serial!==request)return;clearTimeout(timer);pending=false;if(r?.state)accept(r.state);
   if(r?.error){bridge.toast(r.error);window.GaicaniCityAudio?.effect('error');}else if(r?.reward){bridge.toast('🪙 მიიღე '+amount(r.reward)+' მონეტა!');window.GaicaniCityAudio?.effect('coin');}
   else if(r?.alreadyClaimed)bridge.toast('ეს ჯილდო უკვე მიღებულია.');
   if(opened)render();window.GaicaniCityActivitiesUI?.requestState();
  });
 }
 function track(q){window.GaicaniCityActivitiesUI.command('track',{activityId:q.activity}).then(r=>{if(r?.ok){close();bridge.toast('📍 '+q.location.label+' — მიჰყევი ნიშნულს რუკაზე.');}});}
 function render(){
  const focus=document.activeElement?.dataset.questAction;panel.replaceChildren();
  const header=node('header','city-quests-header'),title=node('div');title.append(node('small','','თბილისი 1999 · დავალებების დაფა'));
  const heading=node('h2','','ქალაქს შენი დახმარება სჭირდება');heading.id='cityQuestsTitle';title.append(heading);const dismiss=button('×',close);dismiss.dataset.close='';dismiss.setAttribute('aria-label','მისიების დახურვა');header.append(title,dismiss);panel.append(header);
  panel.append(node('p','city-quests-intro','ექვსი დავალება · სულ 50 000 საიტის მონეტა. თითოეული ჯილდო ანგარიშზე ერთხელ გაიცემა. შენახული მიღწევებიც ითვლება.'));
  if(!socket.connected)panel.append(node('p','city-quests-note','კავშირი გაწყდა. გასაგრძელებლად ხელახლა დაუკავშირდი ქალაქს.'));
  if(!snapshot){panel.append(node('p','','დავალებები იტვირთება…'));return;}
  if(!snapshot.registered){const note=node('p','city-quests-note','მონეტების მისაღებად დარეგისტრირდი და შედი ანგარიშში. '),link=node('a','','შესვლა / რეგისტრაცია');link.href='/';note.append(link);panel.append(note);}
  const summary=node('div','city-quests-summary');summary.append(node('strong','','მიღებულია '+amount(snapshot.claimedReward)+' / '+amount(snapshot.totalReward)),node('span','',snapshot.registered?'ბალანსი: '+amount(snapshot.coins)+' მონეტა':'სტუმარი'));panel.append(summary);
  const grid=node('div','city-quests-grid');
  for(const q of snapshot.quests){
   const card=node('article','city-quest-card'+(q.claimed?' is-claimed':''));card.dataset.questId=q.id;
   card.append(node('small','city-quest-reward','🪙 '+amount(q.reward)+' მონეტა'),node('h3','',q.icon+' '+q.title),node('p','',q.description));
   const progress=node('progress');progress.max=q.goal;progress.value=q.progress;progress.setAttribute('aria-label',q.title+' · შესრულებულია '+q.progress+' / '+q.goal);card.append(progress,node('span','city-quest-progress',q.progress+' / '+q.goal+(q.claimed?' · ჯილდო მიღებულია':q.progress>=q.goal?' · შესრულებულია':'')));
   card.append(node('small','city-quest-place','📍 '+q.location.label));
   const actions=node('div','city-quest-actions'),reward=button(q.claimed?'✓ მიღებულია':pending?'მოიცადე…':'ჯილდოს მიღება',()=>claim(q.id),'quest-claim');reward.disabled=q.claimed||q.progress<q.goal||!snapshot.registered||pending||!socket.connected;reward.dataset.questAction=q.id+'-claim';
   actions.append(reward);
   if(!q.claimed&&q.progress<q.goal){const marker=button('მონიშვნა რუკაზე',()=>track(q));marker.dataset.questAction=q.id+'-track';marker.disabled=!socket.connected;actions.append(marker);}
   card.append(actions);grid.append(card);
  }
  panel.append(grid,node('p','city-quests-note','ეს ერთჯერადი მისიების ჯილდოებია — აქტივობების ჩვეულებრივ დღიურ ლიმიტში არ შედის.'));
  if(focus)panel.querySelector('[data-quest-action="'+CSS.escape(focus)+'"]')?.focus({preventScroll:true});
 }
 overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
 document.addEventListener('keydown',e=>{
  if(!opened)return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}
  if(e.key==='Tab'){const items=[...panel.querySelectorAll('button:not(:disabled),a[href]')];const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 });
 socket.on('city:quest:state',accept);socket.on('city:joined',load);
 socket.on('coins:changed',()=>{if(opened)load();});
 socket.on('disconnect',()=>{pending=false;request++;snapshot=null;launcher.textContent='📜 მისიები';if(opened)render();});
 window.GaicaniCityQuests={get blocksMovement(){return opened;}};
 if(bridge.getSelf())load();
})();
