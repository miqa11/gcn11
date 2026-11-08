/* A free device preference, independent of paid profile rings and shared wallpapers. */
(() => {
 'use strict';
 const key='gaicani_site_theme',root=document.documentElement;
 function get(){try{return localStorage.getItem(key)==='midnight'?'midnight':'default';}catch{return root.dataset.gcTheme==='midnight'?'midnight':'default';}}
 function paint(id){root.dataset.gcTheme=id;for(const select of document.querySelectorAll('[data-site-theme]'))select.value=id;const meta=document.querySelector('meta[name="theme-color"]');if(meta){meta.dataset.originalThemeColor??=meta.content;meta.content=id==='midnight'?'#080b11':meta.dataset.originalThemeColor;}}
 function set(value){const id=value==='midnight'?'midnight':'default';try{localStorage.setItem(key,id);}catch{}paint(id);window.dispatchEvent(new CustomEvent('gc:theme',{detail:{id}}));}
 paint(get());
 function bind(){paint(get());for(const select of document.querySelectorAll('[data-site-theme]'))select.addEventListener('change',()=>set(select.value));}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null){paint(get());window.dispatchEvent(new CustomEvent('gc:theme',{detail:{id:get()}}));}});
 window.GaicaniSiteTheme={get,set};
})();
