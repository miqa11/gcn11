/* Compact City chrome and an overflow menu shared by desktop and touch layouts. */
(() => {
 'use strict';
 const world=document.querySelector('.city-world'),bar=document.getElementById('cityQuickActions');
 const more=document.createElement('button');more.type='button';more.id='cityMoreButton';more.textContent='⋯';more.title='მეტი';more.setAttribute('aria-label','ქალაქის დამატებითი მოქმედებები');more.setAttribute('aria-controls','cityMoreMenu');more.setAttribute('aria-expanded','false');more.setAttribute('aria-haspopup','true');
 const menu=document.createElement('nav');menu.id='cityMoreMenu';menu.className='city-more-menu';menu.hidden=true;menu.setAttribute('aria-label','ქალაქის დამატებითი მოქმედებები');
 for(const id of ['cityLifeBoard','gaicanianPanel','cityGuide']){const b=bar.querySelector('[aria-controls="'+id+'"]');if(b)menu.append(b);}
 bar.append(more);world.append(menu);
 const games=bar.querySelector('[aria-controls="worldPhone"]');if(games){games.setAttribute('aria-label','ქალაქის თამაშები');games.textContent='📱 თამაშები';}
 function position(){if(menu.hidden)return;const a=more.getBoundingClientRect(),r=world.getBoundingClientRect();menu.style.left=Math.max(6,Math.min(r.width-menu.offsetWidth-6,a.left-r.left))+'px';menu.style.top=Math.max(6,Math.min(r.height-menu.offsetHeight-6,a.bottom-r.top+5))+'px';}
 function close(focus=false){menu.hidden=true;more.setAttribute('aria-expanded','false');if(focus)more.focus();}
 more.onclick=()=>{if(!menu.hidden){close(true);return;}window.GaicaniCityGameBridge?.stop();menu.hidden=false;more.setAttribute('aria-expanded','true');position();menu.querySelector('button')?.focus();};
 // Close and focus the launcher before the existing modal handler remembers its return focus.
 menu.addEventListener('click',e=>{if(e.target.closest('button'))close(true);},true);
 document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target)&&e.target!==more)close();},true);
 menu.addEventListener('keydown',e=>{const buttons=[...menu.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(true);}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const at=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[at]?.focus();}});
 menu.addEventListener('focusout',()=>setTimeout(()=>{if(!menu.contains(document.activeElement)&&document.activeElement!==more)close();},0));
 bar.addEventListener('scroll',position,{passive:true});window.addEventListener('resize',()=>close(),{passive:true});
 // Mobile browser bars/keyboards and orientation changes can resize without a window resize.
 window.visualViewport?.addEventListener('resize',()=>{close();window.GaicaniCityGameBridge?.stop();},{passive:true});
})();
