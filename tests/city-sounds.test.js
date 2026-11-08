'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('cute chatter is deterministic, character-specific and bounded for long or empty text',()=>{
 const {effectPlan}=require('../city-audio').model;
 const a=effectPlan('chatter',{id:'lumo',text:'გამარჯობა!'});assert.deepEqual(a,effectPlan('chatter',{id:'lumo',text:'გამარჯობა!'}));assert.notDeepEqual(a,effectPlan('chatter',{id:'nela',text:'გამარჯობა!'}));
 for(const text of ['', 'a'.repeat(10000)]){const p=effectPlan('chatter',{text});assert.ok(p.length>=4&&p.length<=14);assert.ok(p.at(-1).at+p.at(-1).duration<1.5);assert.ok(p.every(n=>Number.isFinite(n.frequency)&&n.frequency>0));}
});
test('effects obey unlock, global mute, effects toggle and background visibility',async()=>{
 let starts=0;const param=()=>({value:0,setValueAtTime(){},setTargetAtTime(){},exponentialRampToValueAtTime(){}}),node=()=>({connect(){},disconnect(){},gain:param(),frequency:param(),Q:param(),pan:param(),threshold:param(),ratio:param(),attack:param(),release:param()});
 class Context{constructor(){this.state='running';this.currentTime=0;this.sampleRate=100;this.destination={};}createGain(){return node();}createStereoPanner(){return node();}createBiquadFilter(){return node();}createDynamicsCompressor(){return node();}createBuffer(){return {getChannelData:()=>new Float32Array(100)};}createOscillator(){return {...node(),start(){starts++;},stop(){}};}close(){return Promise.resolve();}}
 const root={AudioContext:Context,localStorage:{getItem:()=>null,setItem(){}},document:{hidden:false,addEventListener(){},removeEventListener(){}},addEventListener(){},setInterval(){},clearInterval(){}};vm.runInNewContext(source('city-audio.js'),root);const audio=root.GaicaniCityAudio;
 assert.equal(audio.effect('chatter',{text:'Hello'}),false);await audio.unlock();assert.equal(audio.effect('message'),true);const count=starts;
 audio.setPreferences({muted:true});assert.equal(audio.effect('chatter'),false);audio.setPreferences({muted:false,effects:false});assert.equal(audio.effect('coin'),false);audio.setPreferences({effects:true});root.document.hidden=true;assert.equal(audio.effect('shot'),false);assert.equal(starts,count);
});
function harness(){
 let clock=1000,tick;const events={},calls=[],p={id:'me',x:100,y:100},document={hidden:false,addEventListener(){}},socket={connected:true,on:(e,fn)=>events[e]=fn};
 const root={GaicaniCityAudio:{effect:(kind,options)=>{calls.push({kind,options});return true;}},GaicaniCityGameBridge:{getSelf:()=>p,getSocket:()=>socket,getPlayer:()=>null},addEventListener(){}};
 vm.runInNewContext(source('city-sounds.js'),{window:root,document,performance:{now:()=>clock},Date,setInterval:fn=>{tick=fn;return 1;},clearInterval(){}});
 return {events,calls,p,document,advance:()=>{clock+=200;tick();}};
}
test('nearby chatter is spatial, deduplicated, and does not replay old bubbles on join',()=>{
 const h=harness(),packet=(text,until,x=120)=>({serverTime:1000,people:[{id:'nela',x,y:100,bubble:{text,until}}]});
 h.events['city:gaicanians:state'](packet('old',2000));assert.equal(h.calls.length,0);
 h.events['city:gaicanians:state'](packet('new',3000));h.events['city:gaicanians:state'](packet('new',3000));assert.equal(h.calls.length,1);assert.equal(h.calls[0].kind,'chatter');assert.ok(h.calls[0].options.volume<1);assert.ok(h.calls[0].options.pan>0);
 h.events['city:gaicanians:state'](packet('far',4000,2000));assert.equal(h.calls.length,1);
});
test('hidden pages and indoor listeners are silent; driving effects are bounded and disconnect resets state',()=>{
 const h=harness();h.document.hidden=true;h.events['city:error']();assert.equal(h.calls.length,0);h.document.hidden=false;h.advance();h.p.vehicleId='car';h.advance();assert.equal(h.calls.at(-1).kind,'door');
 h.p.vehicleSpeed=100;h.advance();assert.equal(h.calls.at(-1).kind,'engine');h.events.disconnect();h.advance();assert.equal(h.calls.filter(c=>c.kind==='door').length,1);
});
