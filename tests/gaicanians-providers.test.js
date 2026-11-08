'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGaicanianAI,selectAIConfig}=require('../server-gaicanians-ai');
const context={mode:'nearby',language:'ka',characters:[{id:'lumo',facts:[{id:'identity-lumo'}]}],message:'გამარჯობა!'};
const reply={experience:'neutral',lines:[{speakerId:'lumo',text:'გამარჯობა! როგორ ხარ?',factIds:['identity-lumo']}],intention:{action:'none',jobId:'none',goalId:'none'},reflection:''};
const config={provider:'groq',apiKey:'groq-test-key',model:'openai/gpt-oss-120b'};
const response=content=>({ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}]})});
test('Groq selection takes precedence over an old Gemini key and explicit selection never substitutes keys',()=>{
 const env={GROQ_API_KEY:'groq-key',GEMINI_API_KEY:'old-gemini-key'};
 assert.equal(selectAIConfig(env).provider,'groq');assert.equal(selectAIConfig(env).apiKey,'groq-key');assert.equal(selectAIConfig(env).model,'openai/gpt-oss-120b');
 assert.equal(selectAIConfig({...env,GAICANIAN_PROVIDER:'gemini'}).apiKey,'old-gemini-key');
 assert.equal(selectAIConfig({GAICANIAN_PROVIDER:'groq',GEMINI_API_KEY:'old-key'}).apiKey,undefined);
});
test('Groq request uses a fixed endpoint, bearer auth, strict schema, no tools and parses Georgian replies',async()=>{
 let request;const ai=createGaicanianAI({config:{...config,apiKey:' groq-test-key '},fetchImpl:async(url,options)=>{request={url,options};return response(reply);}});
 assert.deepEqual(await ai.generate(context),reply);assert.equal(request.url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(request.options.headers.Authorization,'Bearer groq-test-key');assert.ok(!request.url.includes('key'));
 const body=JSON.parse(request.options.body);assert.equal(body.model,config.model);assert.equal(body.response_format.json_schema.strict,true);assert.equal(body.tools,undefined);assert.equal(body.reasoning_effort,'low');assert.equal(JSON.parse(body.messages[1].content).language,'ka');
 const check=s=>{if(s.type==='object'){assert.equal(s.additionalProperties,false);assert.deepEqual(s.required,Object.keys(s.properties));Object.values(s.properties).forEach(check);}if(s.items)check(s.items);};check(body.response_format.json_schema.schema);
 assert.ok(request.options.signal instanceof AbortSignal);assert.equal(ai.provider,'groq');
});
test('Groq daily budgets persist across provider restarts',async()=>{
 const ledger={};let calls=0;const opts={config,ledger,dailyLimit:1,now:()=>100000,fetchImpl:async()=>{calls++;return response(reply);}};
 await createGaicanianAI(opts).generate(context);await assert.rejects(()=>createGaicanianAI(opts).generate(context),{message:'AI_LIMIT'});assert.equal(calls,1);
});
test('Groq quota failure backs off without calling Gemini or another model',async()=>{
 const urls=[];const ai=createGaicanianAI({config,now:()=>100000,fetchImpl:async url=>{urls.push(url);return {ok:false,status:429};}});
 await assert.rejects(()=>ai.generate(context),{message:'AI_QUOTA'});await assert.rejects(()=>ai.generate(context),{message:'AI_QUOTA'});assert.deepEqual(urls,['https://api.groq.com/openai/v1/chat/completions']);
});
test('Groq rejects invented facts and incomplete or refused generations',async()=>{
 const responses=[response({...reply,lines:[{...reply.lines[0],factIds:['invented']}]}),{ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'length',message:{content:JSON.stringify(reply)}}]})},{ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{refusal:'refused',content:JSON.stringify(reply)}}]})}];
 for(const value of responses){const ai=createGaicanianAI({config,fetchImpl:async()=>value});await assert.rejects(()=>ai.generate(context),{message:'AI_OUTPUT'});}
});
test('missing Groq key or an unknown provider makes no external call',async()=>{
 for(const c of [{provider:'groq',apiKey:'',model:config.model},{provider:'unknown',apiKey:'x',model:config.model}]){
  let called=false;const ai=createGaicanianAI({config:c,fetchImpl:async()=>{called=true;}});assert.equal(ai.configured,false);await assert.rejects(()=>ai.generate(context),{message:'AI_NOT_CONFIGURED'});assert.equal(called,false);
 }
});
