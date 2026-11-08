'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('device theme persists, resets, synchronizes selectors and tolerates unavailable storage',()=>{
 const store=new Map(),events=[],listeners={},select={value:'',addEventListener:(e,f)=>listeners.change=f},meta={content:'#130f26',dataset:{}},root={dataset:{}};
 const document={documentElement:root,readyState:'complete',querySelectorAll:()=>[select],querySelector:()=>meta};
 const window={addEventListener:(e,f)=>listeners[e]=f,dispatchEvent:e=>events.push(e)};let blocked=false;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../site-theme.js'),'utf8'),{window,document,CustomEvent,localStorage:{getItem:k=>{if(blocked)throw Error();return store.get(k);},setItem:(k,v)=>{if(blocked)throw Error();store.set(k,v);}}});
 assert.equal(root.dataset.gcTheme,'default');window.GaicaniSiteTheme.set('midnight');assert.equal(root.dataset.gcTheme,'midnight');assert.equal(select.value,'midnight');assert.equal(meta.content,'#080b11');assert.equal(store.get('gaicani_site_theme'),'midnight');window.GaicaniSiteTheme.set('default');assert.equal(meta.content,'#130f26');store.set('gaicani_site_theme','midnight');listeners.storage({key:'gaicani_site_theme'});assert.equal(select.value,'midnight');blocked=true;assert.doesNotThrow(()=>window.GaicaniSiteTheme.set('default'));assert.equal(root.dataset.gcTheme,'default');assert.ok(events.length>=3);
});
test('only random chat and private chat load the dark theme',()=>{
 let serve;const app={get(){},use(fn){serve=fn;}};require('../server-assets').mountAssets(app,{root:path.join(__dirname,'..')});
 for(const [url,hasTheme] of [['/',true],['/index.html',true],['/friend-chat.html',true],['/dashboard.html',false],['/city.html',false],['/bura.html',false],['/nardi.html',false],['/local-party.html',false],['/privacy.html',false]]){
  let html;const res={setHeader(){},type(){return this;},send(value){html=value;}};
  serve({method:'GET',path:url},res,()=>assert.fail('Page was not served'));
  assert.equal((html.match(/src="\/site-theme\.js/g)||[]).length,Number(hasTheme),url);
  assert.equal(html.includes('/site-theme.css'),hasTheme,url);
 }
});
