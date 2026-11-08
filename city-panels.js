/* Minimize gameplay windows without accepting/declining invitations or leaving matches. */
(() => {
 'use strict';
 const world=document.querySelector('.city-world'),dock=document.createElement('nav');dock.className='city-panel-dock';dock.setAttribute('aria-label','ჩაკეცილი ფანჯრები');(world.querySelector('.city-bottom-hud')||world).append(dock);
 const definitions=[['#playerCard','მოთამაშე'],['#cityDialog','საუბარი'],['#cityGamePhone','თამაში'],['#cityGameInvite','მოწვევა'],['#cityArcadePanel','არკადა'],['#cityCasinoPanel','კაზინო'],['#worldPhone','თამაშების ტელეფონი'],['.world-game-invitation','ლობის მოწვევა'],['.world-match-hud','მატჩი'],['.city-life-hud','ქალაქის ამბები']];
 const entries=new Map();
 function restore(p){p.removeAttribute('data-city-minimized');if(p.dataset.previousModal==='true')p.setAttribute('aria-modal','true');const entry=entries.get(p);entry?.restore.remove();entry?.min.focus();}
 function mount(){
  for(const [selector,label]of definitions){const p=world.querySelector(selector);if(!p)continue;let entry=entries.get(p);
   if(!entry){const min=document.createElement('button');min.type='button';min.className='city-panel-minimize';min.textContent='−';min.title='ჩაკეცვა · თამაში და დრო არ ჩერდება';min.setAttribute('aria-label',label+' — ჩაკეცვა');const restoreButton=document.createElement('button');restoreButton.type='button';restoreButton.textContent='↗ '+label;restoreButton.setAttribute('aria-label',label+' — გაშლა');restoreButton.onclick=()=>restore(p);min.onclick=()=>{p.dataset.cityMinimized='true';if(p.getAttribute('aria-modal')==='true'){p.dataset.previousModal='true';p.setAttribute('aria-modal','false');}dock.append(restoreButton);restoreButton.focus();window.GaicaniCityGameBridge?.stop();};entry={min,restore:restoreButton};entries.set(p,entry);}
   if(p.hidden){if(p.hasAttribute('data-city-minimized')){p.removeAttribute('data-city-minimized');if(p.dataset.previousModal==='true')p.setAttribute('aria-modal','true');}entry.restore.remove();}
   if(!p.contains(entry.min)){const header=p.querySelector('.city-game-header,.casino-header,.arcade-header,header,.player-card-heading,.city-game-invite-card')||p;header.append(entry.min);}
  }
 }
 const selectors=definitions.map(([selector])=>selector).join(',');let scheduled=false;
 function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;mount();});}
 mount();new MutationObserver(records=>{
  for(const record of records){
   if(record.type==='attributes'){if(record.target.matches(selectors)){schedule();return;}continue;}
   for(const added of record.addedNodes)if(added.nodeType===1&&(added.matches(selectors)||added.querySelector(selectors))){schedule();return;}
   const panel=record.target.closest?.(selectors),entry=entries.get(panel);if(entry&&!panel.contains(entry.min)){schedule();return;}
  }
 }).observe(world,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
 document.addEventListener('click',e=>{const button=e.target.closest('button'),target=button?.getAttribute('aria-controls');if(!target)return;const p=document.getElementById(target);if(p?.hasAttribute('data-city-minimized')){e.preventDefault();e.stopImmediatePropagation();restore(p);}},true);
 // Keep the screenshot's player card to one short action row; secondary actions stay discoverable.
 const card=document.getElementById('playerCard'),actions=card.querySelector('.player-actions'),extras=document.createElement('div');extras.className='player-card-extras';extras.id='playerCardExtras';extras.hidden=true;
 for(const child of [...actions.children])if(!['playerSayButton','playerGameButton'].includes(child.id))extras.append(child);
 const say=document.getElementById('playerSayButton');say.textContent='🗨 საუბარი';say.setAttribute('aria-label','ქალაქში საუბარი');
 const more=document.createElement('button');more.type='button';more.textContent='⋯';more.setAttribute('aria-label','მეტი მოქმედება');more.setAttribute('aria-controls','playerCardExtras');more.setAttribute('aria-expanded','false');more.onclick=()=>{extras.hidden=!extras.hidden;more.setAttribute('aria-expanded',String(!extras.hidden));};actions.append(more,extras);
})();
