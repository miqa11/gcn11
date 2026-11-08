'use strict';
// Opt-in live check. Requires the selected real server-side provider key and makes three API calls.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {selectAIConfig}=require('../server-gaicanians-ai');
const {createGaicanians}=require('../server-gaicanians'),world=require('../city-world');
async function main(){
 const config=selectAIConfig();if(!['gemini','groq'].includes(config.provider)||!config.apiKey?.trim()){console.error('Set GAICANIAN_PROVIDER and its server secret (GROQ_API_KEY or GEMINI_API_KEY), then run this script again. No live checks were performed.');process.exitCode=2;return;}
 const file=path.resolve('work/gaicanians-live-check/state.json');fs.mkdirSync(path.dirname(file),{recursive:true});let clock=Date.now();
 const p={id:'live-check',userKey:'gaicanian-live-check',name:'Test visitor',x:1850,y:1195},players=new Map([[p.id,p]]);
 const options={world,players,garage:{list:()=>[]},io:{to:()=>({emit(){}})},now:()=>clock,roomName:'test',read:()=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null,write:value=>{fs.writeFileSync(file+'.tmp',JSON.stringify(value));fs.renameSync(file+'.tmp',file);}};
 let engine=createGaicanians(options);const c=engine.debug().people.lumo;Object.assign(p,{x:c.x,y:c.y});
 const first=await engine.hear(p,'Lumo, I collect cobalt buttons. Tell me about your job, then ask me a question.');assert.ok(first.ok,first.error);assert.equal(first.generated,true);engine.save();
 clock+=9000;engine=createGaicanians(options);Object.assign(p,{x:engine.debug().people.lumo.x,y:engine.debug().people.lumo.y});
 const second=await engine.hear(p,'Lumo, what colour are the buttons I told you I collect?');assert.ok(second.ok,second.error);assert.match(second.text,/cobalt|blue/i);
 clock+=9000;const third=await engine.hear(p,'ლუმო, რა გინდა მომავალში გააკეთო და სად აპირებ წასვლას?');assert.ok(third.ok,third.error);assert.match(third.text,/[\u10d0-\u10ff]/);
 console.log(JSON.stringify({liveAI:true,provider:config.provider,model:config.model,multiTurn:true,restartMemory:true,georgian:true,transcript:[first.text,second.text,third.text]},null,2));engine.forget(p);engine.save();
}
main().catch(error=>{console.error('Live acceptance check failed:',error.message);process.exitCode=1;});
