'use strict';
const crypto=require('node:crypto');
const {residents,jobs,places}=require('./server-gaicanians-data');
const {createNavigation}=require('./server-gaicanians-nav');
const {createGaicanianAI}=require('./server-gaicanians-ai');
const DAY=1440000,MINUTE=60000,RETENTION=30*86400000;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const copy=o=>JSON.parse(JSON.stringify(o));
const moodEffects={joke:[.12,.15,-.05,'amusement'],work:[.12,.1,-.07,'pride'],friend:[.16,.1,-.1,'gratitude'],interrupt:[-.1,.15,.15,'annoyance'],gift:[.08,.1,-.03,'surprise'],blocked:[-.08,.05,.1,'frustration'],danger:[-.12,.4,.3,'fear'],goal:[.45,.4,-.2,'joy'],lonely:[-.1,-.1,.06,'loneliness'],rest:[.08,-.2,-.18,'calm'],disagree:[-.1,.15,.08,'resentment'],reconcile:[.15,-.05,-.1,'hope'],practice:[.08,.05,-.03,'curiosity'],trip:[-.04,.15,.04,'embarrassment']};
function createGaicanians({io,players,world,garage,roomName,registeredUsers=new Map(),saveAuthUsers=()=>{},getEvents=()=>[],read=()=>null,write=()=>{},now=Date.now,aiFactory=createGaicanianAI,enabled=true,onAIError=()=>{}}){
 const saved=read();if(saved&&saved.version!==1)throw Error('Unsupported Gaicanian save version');
 const state=saved||{version:1,salt:crypto.randomBytes(24).toString('hex'),at:now(),sequence:0,people:{},users:{},budget:{},news:[]};
 const nav=createNavigation(world),sessions=new Map(),rates=new Map(),pending=new Set(),seenEvents=new Set();let lastPush=0,lastSave=0,lastObserved=0,dirty=!saved,catchingUp=false;
 const dialogueQueue=[],background=new Set(),queuedByPlayer=new Map();let answering=false;
 const ai=aiFactory({ledger:state.budget,now,onReserve:()=>{dirty=true;save();}});
 const goals=Object.fromEntries(residents.map(c=>[c.goal.item,c.goal]));
 for(const def of residents)if(!state.people[def.id]){const home=places[def.home];state.people[def.id]={...copy(def),x:home.x,y:home.y,dir:'down',action:'idle',place:def.home,needs:{energy:.8,hunger:.2,social:.4,fun:.4},emotion:{valence:0,arousal:.3,stress:.1,attachment:0,satisfaction:.5,label:'calm',cause:'arrival',at:now()},money:12,skills:copy(def.skills),relationships:{},memories:[],beliefs:[],projects:[],confidence:.2,jobMinutes:0,path:[],decisionAt:0,lastSocial:0,lastReflection:0,lastBirthday:-1,lastGreeting:0,phase:0,goal:copy(def.goal)};dirty=true;}
 function remember(c,type,text,source='witnessed',extra={}){const item={id:'memory-'+(++state.sequence),type,text:String(text).slice(0,240),source,at:state.at,...extra};c.memories.push(item);if(c.memories.length>48){const index=c.memories.findIndex(m=>!['biography','milestone'].includes(m.type));c.memories.splice(index<0?0:index,1);}dirty=true;return item;}
 function feel(c,kind){const e=moodEffects[kind]||moodEffects.practice;c.emotion.valence=clamp(c.emotion.valence+e[0],-1,1);c.emotion.arousal=clamp(c.emotion.arousal+e[1]);c.emotion.stress=clamp(c.emotion.stress+e[2]);if(kind==='friend'||kind==='reconcile')c.emotion.attachment=clamp(c.emotion.attachment+.015);if(kind==='work'||kind==='practice')c.emotion.satisfaction=clamp(c.emotion.satisfaction+.01);c.emotion.label=e[3];c.emotion.cause=kind;c.emotion.at=state.at;dirty=true;}
 function fact(c,text,kind='event'){const f=remember(c,kind,text);for(const other of Object.values(state.people))if(other!==c&&Math.hypot(other.x-c.x,other.y-c.y)<150){other.beliefs.push({...f,source:'witnessed'});other.beliefs=other.beliefs.slice(-12);}return f;}
 function publicPerson(c){return {id:c.id,name:c.nickname,age:c.age,job:jobs[c.job].name,x:c.x,y:c.y,dir:c.dir,action:c.action,mood:c.emotion.label,color:c.color,hair:c.hair,accessory:c.accessory,place:places[c.place]?.name||'',goal:c.goal.name,bubble:c.bubble?.until>now()&&(!c.bubble.startAt||c.bubble.startAt<=now())?c.bubble:null,projects:c.projects.map(p=>({name:p.name,x:p.x,y:p.y})),fictionalAI:true};}
 const publicState=()=>({serverTime:now(),aiConfigured:ai.configured,aiProvider:ai.provider||'gemini',catchingUp:now()-state.at>60000,people:Object.values(state.people).map(publicPerson)});
 function broadcast(){io.to(roomName).emit('city:gaicanians:state',publicState());}
 function save(){if(!dirty)return;write(copy(state));dirty=false;lastSave=now();}
 function changeNeed(c,dt){const min=dt/MINUTE;c.needs.hunger=clamp(c.needs.hunger+min*.045);c.needs.energy=clamp(c.needs.energy-min*.035);c.needs.social=clamp(c.needs.social+min*.035);c.needs.fun=clamp(c.needs.fun+min*.03);const decay=Math.exp(-dt/240000);c.emotion.valence*=decay;c.emotion.arousal=.3+(c.emotion.arousal-.3)*decay;c.emotion.stress*=Math.exp(-dt/600000);if(state.at-c.emotion.at>240000)c.emotion.label=c.emotion.valence<-.15?'sadness':c.emotion.stress>.4?'anxiety':'calm';}
 function relationship(c,id){return c.relationships[id]||={familiarity:0,friendship:0,trust:.1,meetings:0,lastAt:0,conflict:0};}
 function destination(c,action){return action==='work'?jobs[c.job].site:action==='practice'?Object.values(jobs).find(j=>j.skill===c.goal.skill).site:action==='rest'?c.home:action==='eat'?'cafe':action==='dance'?'stage':'square';}
 function choose(c){
  const hour=Math.floor((state.at%DAY)/(DAY/24)),job=jobs[c.job],onShift=hour>=job.hours[0]&&hour<job.hours[1];
  const scores={rest:(1-c.needs.energy)*1.6,eat:c.needs.hunger*1.5+(c.money<3?-.5:0),social:c.needs.social*(.7+c.traits.extraversion*.6),dance:c.needs.fun*c.traits.openness,practice:.25+(c.projects.some(p=>p.id===c.goal.item)?0:.35)+c.needs.fun*.2,work:onShift?.65+c.traits.conscientiousness*.4+(c.money<8?.4:0):.08};
  scores.rest+=c.emotion.stress*.6;scores.social*=c.emotion.valence<-.3?.65:1;scores.social+=c.emotion.attachment*.1;
  if(c.activity==='social'&&c.phase>120000&&!Object.values(state.people).some(o=>o!==c&&Math.hypot(o.x-c.x,o.y-c.y)<90))scores.social*=.2;
  if(c.proposal&&c.proposal.until>state.at&&scores[c.proposal.action]!==undefined)scores[c.proposal.action]+=.25;
  const action=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0][0],place=destination(c,action);
  if(c.activity!==action||c.place!==place){c.activity=action;c.place=place;c.path=nav.route(c,places[place]);c.action=c.path.length?'walk':'idle';c.decisionAt=state.at+30000;c.phase=0;dirty=true;}
  else c.decisionAt=state.at+30000;
 }
 function walk(c,dt){
  let budget=55*dt/1000;const cars=garage?.list?.()||[];
  while(c.path.length&&budget>0){const target=c.path[0],distance=Math.hypot(target.x-c.x,target.y-c.y),step=Math.min(budget,distance);if(distance<.01){c.path.shift();continue;}
   const nx=c.x+(target.x-c.x)/distance*step,ny=c.y+(target.y-c.y)/distance*step;
   if(cars.some(v=>Math.hypot(v.x-nx,v.y-ny)<(v.radius||26)+13&&Math.hypot(v.x-c.x,v.y-c.y)>=Math.hypot(v.x-nx,v.y-ny))){c.action='wait';if(state.at-(c.blockedAt||0)>60000){feel(c,'danger');c.blockedAt=state.at;}return;}
   if(!nav.clear(c,{x:nx,y:ny})){c.path=nav.route(c,places[c.place]);feel(c,'blocked');return;}
   c.dir=Math.abs(nx-c.x)>Math.abs(ny-c.y)?nx<c.x?'left':'right':ny<c.y?'up':'down';c.x=nx;c.y=ny;budget-=step;if(step>=distance-.01)c.path.shift();
  }
  c.action=c.path.length?'walk':c.activity;dirty=true;
 }
 function work(c,dt){
  if(Math.hypot(c.x-places[c.place].x,c.y-places[c.place].y)>24)return;
  const min=dt/MINUTE;c.phase+=dt;
  if(c.activity==='rest'){c.needs.energy=clamp(c.needs.energy+min*.3);c.emotion.stress=clamp(c.emotion.stress-min*.1);c.action='sleep';}
  if(c.activity==='eat'){if(c.money>=2&&c.needs.hunger>.15){c.money-=2;c.needs.hunger=clamp(c.needs.hunger-.65);fact(c,'ღამის საცხობში პური იყიდა.');feel(c,'rest');}c.decisionAt=0;}
  if(c.activity==='work'){const job=jobs[c.job];c.jobMinutes+=min;c.skills[job.skill]+=min*.25;c.needs.energy=clamp(c.needs.energy-min*.025);c.action=c.job==='technician'?'repair':c.job==='gardener'?'water':'music';while(c.jobMinutes>=1){c.jobMinutes--;c.money+=job.wage;feel(c,'work');fact(c,'დაასრულა სამუშაო მონაკვეთი: '+job.name+'.');}}
  if(c.activity==='practice'){c.skills[c.goal.skill]+=min*.5;c.needs.fun=clamp(c.needs.fun-min*.2);c.action='practice';}
  if(c.activity==='dance'){c.needs.fun=clamp(c.needs.fun-min*.25);c.action='dance';}
  if(c.activity==='social'){c.action='look';if(c.needs.social>.85&&state.at-c.emotion.at>MINUTE)feel(c,'lonely');}
  if(c.money>=c.goal.cost&&(c.skills[c.goal.skill]||0)>=c.goal.required&&!c.projects.some(p=>p.id===c.goal.item)){
   c.money-=c.goal.cost;const home=places[c.home];c.projects.push({id:c.goal.item,name:c.goal.name,x:home.x+20,y:home.y,at:state.at});feel(c,'goal');fact(c,'შეიძინა '+c.goal.name+' საკუთარი შრომით.','milestone');c.emotion.satisfaction=clamp(c.emotion.satisfaction+.2);
   const next=Object.values(goals).filter(g=>!c.projects.some(p=>p.id===g.item)).sort((a,b)=>(c.skills[b.skill]||0)-(c.skills[a.skill]||0))[0];if(next){c.goal=copy(next);fact(c,'ახალი მიზანი აირჩია: '+next.name+'.','milestone');}
  }
  const best=Object.entries(c.skills).sort((a,b)=>b[1]-a[1])[0];if(c.projects.length&&best&&best[0]!==jobs[c.job].skill&&best[1]>c.skills[jobs[c.job].skill]+3){const next=Object.keys(jobs).find(j=>jobs[j].skill===best[0]);changeJob(c,next);}
 }
 function changeJob(c,jobId){if(!jobs[jobId]||c.job===jobId||c.money<4||(c.skills[jobs[jobId].skill]||0)<2||c.emotion.stress>.85)return false;c.job=jobId;c.path=[];c.decisionAt=0;fact(c,'ახალი სამუშაო აირჩია: '+jobs[jobId].name+'.','milestone');feel(c,'practice');return true;}
 function social(dt){
  const all=Object.values(state.people);for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
   const a=all[i],b=all[j];if(a.pauseUntil>state.at||b.pauseUntil>state.at||Math.hypot(a.x-b.x,a.y-b.y)>85||a.path.length||b.path.length||!['social','dance','rest'].includes(a.activity)||!['social','dance','rest'].includes(b.activity))continue;
   const ra=relationship(a,b.id),rb=relationship(b,a.id);if(state.at-Math.max(ra.lastAt,rb.lastAt)<30000)continue;
   ra.lastAt=rb.lastAt=state.at;ra.meetings++;rb.meetings++;
   const clash=Math.abs(a.traits.conscientiousness-b.traits.conscientiousness)>.4&&a.traits.agreeableness+b.traits.agreeableness<1.2;const disagree=clash?ra.meetings%3!==0:Math.abs(a.traits.agreeableness-b.traits.agreeableness)>.4&&ra.meetings%4===0;
   for(const [c,other,r]of [[a,b,ra],[b,a,rb]]){r.familiarity=clamp(r.familiarity+.06);r.friendship=clamp(r.friendship+(disagree?-.07:.045),-1,1);r.trust=clamp(r.trust+.015);r.conflict=disagree?r.conflict+1:Math.max(0,r.conflict-1);c.needs.social=clamp(c.needs.social-.25);c.confidence=clamp(c.confidence+.002);c.traits.extraversion=clamp(c.traits.extraversion+.0002);c.skills[jobs[other.job].skill]+=.03;feel(c,disagree?'disagree':r.conflict?'reconcile':'friend');remember(c,'social',other.nickname+' შეხვდა; '+(disagree?'მათი გემოვნება არ დაემთხვა.':'ერთად დაისვენეს.'));
    const share=other.memories.findLast(m=>!m.playerId&&m.source==='witnessed'&&['event','milestone'].includes(m.type));if(share&&!c.beliefs.some(f=>f.id===share.id)){c.beliefs.push({...share,source:'heard',from:other.id});c.beliefs=c.beliefs.slice(-12);}
   }
   if(!catchingUp&&players.size&&state.at-(a.lastSocial||0)>300000){a.lastSocial=state.at;b.lastSocial=state.at;autonomous([a,b],'social');}
   else if(!catchingUp&&state.at-(a.lastGreeting||0)>60000){a.lastGreeting=b.lastGreeting=state.at;a.bubble={text:disagree?'ჰმ… ამაზე ვერ შეგეთანხმები.':'გამარჯობა, '+b.nickname+'!',until:now()+5000,generated:false};}
  }
 }
 function facts(c){return [{id:'identity-'+c.id,text:c.biography,source:'biography'},{id:'state-'+c.id,text:jobs[c.job].name+'; '+(c.path.length?'მიდის: ':'ადგილზეა: ')+places[c.place].name+'; '+c.action+'; goal '+c.goal.name,source:'current'},...c.memories.filter(m=>!m.playerId).slice(-8),...c.beliefs.slice(-5)].map(m=>({id:m.id,text:m.text,source:m.source,from:m.from}));}
 function context(chars,mode,extra={}){return {mode,availableGoals:Object.values(goals).map(g=>({id:g.item,name:g.name,cost:g.cost,skill:g.skill,required:g.required})),language:extra.language||'ka',characters:chars.map(c=>({id:c.id,name:c.nickname,biography:c.biography,age:c.age,job:jobs[c.job].name,location:{x:c.x,y:c.y,destination:places[c.place].name,arrived:!c.path.length},action:c.action,needs:c.needs,emotion:c.emotion,traits:c.traits,style:c.style,values:c.values,goal:c.goal.name,skills:c.skills,facts:facts(c),relationships:Object.entries(c.relationships).map(([id,r])=>({id,familiarity:r.familiarity,friendship:r.friendship,trust:r.trust})).filter(r=>state.people[r.id])})),...extra};}
 function apply(c,result){const i=result.intention;if(goals[i.goalId]&&c.traits.openness>.5&&!c.projects.some(p=>p.id===i.goalId)&&c.goal.item!==i.goalId){c.goal=copy(goals[i.goalId]);c.decisionAt=0;fact(c,'ახალი მიზანი აირჩია: '+c.goal.name+'.','milestone');}if(i.action==='changeJob')changeJob(c,i.jobId);else if(['rest','eat','social','practice','dance','work'].includes(i.action))c.proposal={action:i.action,until:state.at+120000};if(result.reflection){c.lastReflectionText=result.reflection;remember(c,'reflection',result.reflection,'reflection');}dirty=true;}
 async function autonomous(chars,mode){
  const lock=chars.map(c=>c.id).sort().join(':');if(answering||dialogueQueue.length||pending.has(lock)||chars.some(c=>pending.has('character:'+c.id))||!ai.configured)return;pending.add(lock);for(const c of chars)pending.add('character:'+c.id);
  let generation;try{generation=ai.generate(context(chars,mode),{autonomous:true});background.add(generation);const result=await generation;apply(chars[0],result);for(let index=0;index<result.lines.length;index++){const line=result.lines[index],c=state.people[line.speakerId];if(c&&chars.includes(c)){delete c.bubbleOwner;c.bubble={text:line.text,startAt:now()+index*6500,until:now()+6000+index*6500,generated:true};remember(c,'social',line.text,'conversation');}}dirty=true;save();}catch{}finally{background.delete(generation);pending.delete(lock);for(const c of chars)pending.delete('character:'+c.id);dirty=true;}
 }
 function advance(to){
  let remaining=to-state.at;if(remaining<=0)return;const step=players.size&&!catchingUp?Math.min(1000,remaining):Math.min(60000,remaining);state.at+=step;
  for(const c of Object.values(state.people)){changeNeed(c,step);const day=Math.floor(state.at/DAY),[month,date]=c.birthday.split('-').map(Number);if(day%365===(month-1)*30+date&&c.lastBirthday!==day){c.lastBirthday=day;feel(c,'goal');fact(c,'დაბადების დღე აღნიშნა.','milestone');}if(c.tripUntil>state.at){c.action='trip';continue;}if(c.pauseUntil>state.at||dialogueQueue.some(job=>job.id===c.id)){c.action='look';continue;}if(state.at>=c.decisionAt&&!c.path.length)choose(c);if(c.path.length)walk(c,step);else work(c,step);if(c.animationUntil>now())c.action='wave';
   if(c.request&&state.at<c.request.until){const p=[...players.values()].find(p=>playerKey(p)===c.request.playerId),site=places[c.request.place];if(p&&!p.interiorId&&Math.hypot(p.x-site.x,p.y-site.y)<70&&Math.hypot(c.x-site.x,c.y-site.y)<70){remember(c,'social','სტუმარს სამუშაო კუთხე აჩვენა.');feel(c,'friend');c.request=null;}}else if(c.request)c.request=null;
   if(c.action==='walk'&&c.needs.energy<.12&&state.at-(c.lastTrip||0)>300000){c.lastTrip=state.at;c.tripUntil=state.at+1400;c.action='trip';feel(c,'trip');}
   if(!catchingUp&&players.size&&ai.configured&&state.at-c.lastReflection>DAY){c.lastReflection=state.at;autonomous([c],'reflection');}
  }
  social(step);dirty=true;
 }
 function purge(){for(const c of Object.values(state.people)){if(c.bubble&&c.bubble.until<=now()){delete c.bubble;delete c.bubbleOwner;}c.memories=c.memories.filter(m=>!m.playerId||now()-m.at<=RETENTION);for(const [id,r]of Object.entries(c.relationships))if(!state.people[id]&&now()-r.lastAt>RETENTION)delete c.relationships[id];for(const [id,at]of Object.entries(c.giftAt||{}))if(now()-at>86400000)delete c.giftAt[id];}for(const [id,rate]of rates)if(typeof rate==='object'&&now()-rate.at>86400000)rates.delete(id);for(const [id,user]of Object.entries(state.users))if(now()-(user.lastAt||0)>RETENTION){delete state.users[id];for(const c of Object.values(state.people)){delete c.relationships[id];c.memories=c.memories.filter(m=>m.playerId!==id);}}for(const [id,s]of sessions)if(now()-s.at>1800000)sessions.delete(id);}
 function tick(){if(!enabled)return;if(now()-lastObserved>=1000){lastObserved=now();for(const event of getEvents()){if(!event||typeof event.id!=='string'||seenEvents.has(event.id)||!Number.isFinite(event.x)||!Number.isFinite(event.y))continue;seenEvents.add(event.id);if(seenEvents.size>512)seenEvents.delete(seenEvents.values().next().value);for(const c of Object.values(state.people))if(Math.hypot(c.x-event.x,c.y-event.y)<180)remember(c,'event',String(event.text).slice(0,200),'witnessed');}}const target=now();catchingUp=target-state.at>60000;let count=0;while(state.at<target&&count++<120)advance(target);catchingUp=false;purge();if(players.size&&target-lastPush>=300){lastPush=target;broadcast();}if(dirty&&target-lastSave>=15000)save();}
 function playerKey(p){return crypto.createHmac('sha256',state.salt).update(String(p.userKey||p.id)).digest('hex').slice(0,32);}
 function preferences(p){const k=playerKey(p);return state.users[k]||{lastAt:now(),revision:0};}
 function privateState(p){const key=playerKey(p);return {...publicState(),relationships:Object.fromEntries(Object.values(state.people).map(c=>[c.id,c.relationships[key]||null]))};}
 function nearby(p,id){const c=state.people[id];if(!p||!c||p.interiorId||p.rideId||p.vehicleId||p.gameId||p.activityLocked||Math.hypot(p.x-c.x,p.y-c.y)>110||!nav.clear(p,c))return null;return c;}
 function forget(p){const key=playerKey(p),revision=(state.users[key]?.revision||0)+1;state.users[key]={lastAt:now(),revision};for(const c of Object.values(state.people)){if(c.bubbleOwner===key){delete c.bubble;delete c.bubbleOwner;}delete c.relationships[key];c.memories=c.memories.filter(m=>m.playerId!==key);if(c.request?.playerId===key)c.request=null;if(c.giftAt)delete c.giftAt[key];}for(const id of sessions.keys())if(id.startsWith(key+':'))sessions.delete(id);dirty=true;save();}
 function forgetAccounts(names){
  const keys=new Set([...names].map(userKey=>playerKey({userKey})));
  for(const key of keys)if(state.users[key]){delete state.users[key];dirty=true;}
  for(const c of Object.values(state.people)){
   if(keys.has(c.bubbleOwner)){delete c.bubble;delete c.bubbleOwner;dirty=true;}
   if(keys.has(c.request?.playerId)){c.request=null;dirty=true;}
   for(const key of Object.keys(c.relationships))if(keys.has(key)){delete c.relationships[key];dirty=true;}
   for(const key of Object.keys(c.giftAt||{}))if(keys.has(key)){delete c.giftAt[key];dirty=true;}
   const memories=c.memories.filter(m=>!keys.has(m.playerId));
   if(memories.length!==c.memories.length){c.memories=memories;dirty=true;}
  }
  for(const id of sessions.keys())if(keys.has(id.split(":")[0]))sessions.delete(id);
  save();
 }
 // Street speech is acknowledged immediately by the City handler. Keep accepted follow-ups
 // in order, and construct context only after the preceding answer has been remembered.
 async function drainDialogue(){
  if(answering)return;answering=true;
  try{while(dialogueQueue.length){
   const job=dialogueQueue[0];
   try{if(background.size)await Promise.allSettled([...background]);job.resolve(await answer(job));}
   catch{job.resolve({error:'პასუხი ვერ მივიღეთ. ცოტა ხანში ისევ დაელაპარაკე.'});}
   finally{dialogueQueue.shift();const count=queuedByPlayer.get(job.key)-1;if(count)queuedByPlayer.set(job.key,count);else queuedByPlayer.delete(job.key);}
  }}finally{answering=false;}
 }
 function talk(p,packet){
  const c=nearby(p,packet.id);if(!c)return Promise.resolve({error:'გაიცანელს ახლოს მიუახლოვდი.'});
  if(!ai.configured)return Promise.resolve({error:'ცოცხალი AI საუბარი ჯერ არ არის ჩართული.'});
  const text=typeof packet.text==='string'?packet.text.trim():'';if(!text||text.length>120)return Promise.resolve({error:'შეიყვანე 1–120 სიმბოლო.'});
  const key=playerKey(p),count=queuedByPlayer.get(key)||0;
  if(count>=6||dialogueQueue.length>=24)return Promise.resolve({error:'შენი შეტყობინებები რიგშია. პასუხებს დაელოდე და შემდეგ გააგრძელე.'});
  const revision=preferences(p).revision||0;
  return new Promise(resolve=>{queuedByPlayer.set(key,count+1);dialogueQueue.push({p,id:c.id,text,language:packet.language,key,revision,resolve});drainDialogue();});
 }
 async function answer({p,id,text,language,key,revision}){
  const c=nearby(p,id);if(players.get(p.id)!==p||!c||(preferences(p).revision||0)!==revision)return {error:'საუბარი დასრულდა ან მეხსიერება წაიშალა.'};
  const lock=key+':'+c.id,relation=c.relationships[key]||{familiarity:0,friendship:0,trust:0};
  const memory=c.memories.filter(m=>m.playerId===key&&m.type==='nearby').slice(-4),previous=sessions.get(lock)?.turns||[];
  pending.add(lock);pending.add('character:'+c.id);c.pauseUntil=now()+25000;c.action='look';
  try{
   const prompt=context([c],'nearby',{language:language==='en'?'en':'ka',player:{name:p.name||'ქალაქის სტუმარი',relationship:relation,remembered:memory.map(m=>m.text)},conversation:previous.slice(-8),message:text});
   prompt.characters[0].facts.push(...memory.map(m=>({id:m.id,text:m.text,source:'player-reported'})));
   const result=await ai.generate(prompt);
   if(players.get(p.id)!==p||!nearby(p,c.id)||(preferences(p).revision||0)!==revision)return {error:'საუბარი დასრულდა ან მეხსიერება წაიშალა.'};
   const line=result.lines.find(l=>l.speakerId===c.id);if(!line)return {error:'პასუხი ვერ მივიღეთ. სცადე მოგვიანებით.'};
   if(['hurtful','threatening'].includes(result.experience)){feel(c,result.experience==='threatening'?'danger':'interrupt');relationship(c,key).trust=clamp(relationship(c,key).trust-.02);}
   else if(['kind','supportive','humorous'].includes(result.experience)){feel(c,result.experience==='humorous'?'joke':'friend');relationship(c,key).trust=clamp(relationship(c,key).trust+.005);}
   const turns=[...previous,{role:'user',text},{role:'character',text:line.text}].slice(-8);sessions.set(lock,{at:now(),turns});
   remember(c,'nearby',text+' → '+line.text,'public-conversation',{playerId:key});const r=relationship(c,key);r.familiarity=clamp(r.familiarity+.02);r.lastAt=now();state.users[key]={...preferences(p),lastAt:now()};
   // A public street reply is shared once, on the same channel as player speech.
   c.bubble={text:line.text,until:now()+10000,generated:true};c.bubbleOwner=key;
   io.to(roomName).emit('city:message',{id:'gaicanian:'+c.id,name:c.nickname,text:line.text,gaicanianId:c.id,generated:true});
   apply(c,{...result,reflection:''});save();broadcast();return {ok:true,text:line.text,generated:true};
  }catch(e){onAIError(e.message);const errors={AI_AUTH:'გაიცანელების საუბრის გასაღები სერვერზე შესამოწმებელია.',AI_QUOTA:'გაიცანელების საუბრის დღიური ლიმიტი ამოიწურა. მოგვიანებით სცადე.',AI_LIMIT:'გაიცანელების საუბრის დღიური ლიმიტი ამოიწურა. მოგვიანებით სცადე.',AI_MODEL:'გაიცანელების საუბრის მოდელი სერვერზე შესამოწმებელია.',AI_REQUEST:'გაიცანელების საუბრის სერვერის გამართვა საჭიროა.'};return {error:errors[e.message]||'გაიცანელი ახლა ვერ გპასუხობს. ცოტა ხანში ისევ დაელაპარაკე.'};}finally{pending.delete(lock);pending.delete('character:'+c.id);dirty=true;save();}
 }
 async function hear(p,text){
  const candidates=Object.values(state.people).filter(c=>nearby(p,c.id)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
  if(!candidates.length)return {ignored:true};
  // An addressed resident answers; otherwise the closest listener answers, avoiding a chorus.
  const mentioned=candidates.filter(c=>String(text).toLocaleLowerCase().includes(c.nickname.toLocaleLowerCase())||String(text).toLowerCase().includes(c.id));
  const c=mentioned[0]||candidates[0];
  return talk(p,{id:c.id,text,language:/[\u10a0-\u10ff]/.test(text)?'ka':'en'});
 }
 function interact(p,packet){
  const c=nearby(p,packet.id);if(!c)return {error:'გაიცანელს ახლოს მიუახლოვდი.'};const prefs=preferences(p),key=playerKey(p);let message='';
  if(packet.action==='wave'){c.action='wave';c.animationUntil=now()+1500;feel(c,'friend');message=c.nickname+' ხელს გიქნევს!';}
  else if(packet.action==='dance'){if(c.needs.energy<.25||c.activity==='work')return {error:'ახლა ცეკვა არ სურს. მის გადაწყვეტილებას პატივი ეცი.'};c.proposal={action:'dance',until:state.at+120000};c.needs.fun=clamp(c.needs.fun-.1);message='საცეკვაო კუთხეში შემოგიერთდება.';}
  else if(packet.action==='directions')return {ok:true,message:'სამუშაო ადგილი: '+places[jobs[c.job].site].name,location:places[jobs[c.job].site]};
  else if(packet.action==='help'){c.request={type:'visit',playerId:key,place:jobs[c.job].site,until:now()+300000};c.proposal={action:'work',until:state.at+300000};c.decisionAt=0;message='ჩემს სამუშაო კუთხეს ეწვიე — თუ უსაფრთხოა, იქ შეგხვდები.';}
  else if(packet.action==='gift'){const u=registeredUsers.get(String(p.userKey||'').toLowerCase());if(now()-(c.giftAt?.[key]??-Infinity)<86400000)return {error:'დღეს საჩუქარი უკვე შესთავაზე.'};if(c.activity==='work'&&c.emotion.stress>.5)return {error:'ახლა საჩუქრის მიღება არ სურს.'};const count=u?.cityActivities?.inventory?.sticker;if(!Number.isSafeInteger(count)||count<1)return {error:'საჩუქრისთვის ბაზარში ნაყიდი სტიკერი გჭირდება.'};u.cityActivities.inventory.sticker--;saveAuthUsers();c.giftAt||={};c.giftAt[key]=now();feel(c,'gift');message='სტიკერი მიიღო — მადლობა! ეს მეგობრობას ავტომატურად არ ნიშნავს.';}
  else if(packet.action==='offerQuest'){if(c.needs.energy<.3||c.emotion.stress>.6)return {error:'დღეს დამატებით საქმეს ვერ აიღებს.'};c.proposal={action:'practice',until:state.at+120000};c.decisionAt=0;message='უნარების ვარჯიშს თავის სამუშაო კუთხეში შეეცდება.';}
  else if(packet.action==='friend'){const r=relationship(c,key);if(r.familiarity<.3||r.trust<.2)return {error:'ჯერ უკეთ გაიცანით ერთმანეთი.'};if(now()-(r.friendAt??-Infinity)<DAY)return {error:'ახლა ურთიერთობას დრო დაუთმე.'};r.friendAt=now();r.friendship=clamp(r.friendship+.01);message='მეგობრობის შეთავაზება მიიღო.';}
  else return {error:'ეს მოქმედება მიუწვდომელია.'};
  {state.users[key]={...prefs,lastAt:now()};const r=relationship(c,key);if(now()-r.lastAt>60000){r.familiarity=clamp(r.familiarity+.03);r.trust=clamp(r.trust+.01);r.lastAt=now();remember(c,'social',message,'witnessed',{playerId:key});}}
  dirty=true;save();broadcast();return {ok:true,message};
 }
 function attach(socket){
  const handle=(event,fn)=>socket.on('city:gaicanians:'+event,async(data,ack)=>{
   const p=players.get(socket.id);if(!p){if(typeof ack==='function')ack({error:'ჯერ ქალაქში შემოდი.'});return;}
   const key=socket.id+':'+event,at=now(),prior=rates.get(key)||0;if(at-prior<(event==='state'?500:800)){if(typeof ack==='function')ack({error:'ცოტა მოიცადე.'});return;}rates.set(key,at);
   try{const result=await fn(p,data&&typeof data==='object'?data:{});if(typeof ack==='function')ack(result);}catch{if(typeof ack==='function')ack({error:'მოთხოვნა ვერ შესრულდა.'});}
  });
  handle('state',p=>({ok:true,state:privateState(p)}));handle('inspect',(p,d)=>{const c=nearby(p,d.id);return c?{ok:true,character:{...publicPerson(c),biography:c.biography,household:c.household,birthday:c.birthday,values:c.values,traits:c.traits,needs:c.needs,skills:c.skills,emotion:c.emotion},state:privateState(p)}:{error:'გაიცანელს მიუახლოვდი.'};});handle('interact',interact);
  handle('privacy',(p,d)=>{if(d.forget===true)forget(p);return {ok:true,state:privateState(p)};});
 }
 // Bounded catch-up runs only simulation, never LLM calls. Long gaps are processed incrementally across ticks.
 catchingUp=true;const target=now();for(let i=0;state.at<target&&i<720;i++)advance(target);catchingUp=false;purge();save();
 return {attach,tick,save,state:publicState,privateState,debug:()=>state,talk,hear,interact,forget,forgetAccounts,remove:id=>{for(const k of rates.keys())if(k.startsWith(id+':'))rates.delete(k);},observe:(text,x,y)=>{for(const c of Object.values(state.people))if(Math.hypot(c.x-x,c.y-y)<180)remember(c,'event',String(text).slice(0,200),'witnessed');}};
}
module.exports={createGaicanians,DAY};
