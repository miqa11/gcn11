'use strict';
const data=require('./city-life-data');
function createCityLife({io,players,world,roomName,now=Date.now}){
 let current=null,lastBroadcast=0,sequence=0;
 const limits=new Map(),petTimes=new Map(),reactions=new Map(),feed=[];
 const emit=(event,value)=>io.to(roomName).emit(event,value);
 const free=p=>p&&!p.interiorId&&!p.rideId&&!p.gameId&&!p.vehicleId&&!p.gardenSeatId&&!p.gardenDance&&!p.activityLocked;
 function ensure(){
  const bucket=Math.floor(now()/data.duration);
  if(current?.bucket===bucket)return;
  const def=data.events[((bucket%data.events.length)+data.events.length)%data.events.length];
  current={...def,bucket,id:'street-'+bucket,endsAt:(bucket+1)*data.duration,progress:0,done:false,removed:new Set(),contributors:new Map()};
  feed.unshift({id:++sequence,text:def.title+' — '+def.label,at:now()});feed.length=Math.min(feed.length,6);
 }
 function visible(){ensure();return {serverTime:now(),event:{id:current.id,kind:current.kind,title:current.title,description:current.description,label:current.label,x:current.x,y:current.y,icon:current.icon,endsAt:current.endsAt,progress:current.progress,goal:current.goal,done:current.done,
  litter:current.kind==='cleanup'?data.litter.filter(p=>!current.removed.has(p.id)):[],contributors:[...current.contributors.values()].slice(0,12)},feed:[...feed],reactions:[...reactions.values()].filter(r=>r.until>now())};}
 function push(){emit('city:life:state',visible());}
 function clearPath(p,target){const distance=Math.hypot(p.x-target.x,p.y-target.y),steps=Math.ceil(distance/6);for(let i=1;i<steps;i++)if(!world.isWalkable(p.x+(target.x-p.x)*i/steps,p.y+(target.y-p.y)*i/steps,2))return false;return true;}
 function act(p,packet){
  ensure();if(!p||players.get(p.id)!==p)return {error:'ჯერ შემოდი ქალაქში.'};
  if(!free(p))return {error:'ჯერ ქუჩაში ფეხით დაბრუნდი და მიმდინარე ქმედება დაასრულე.'};
  if(packet?.eventId!==current.id||current.done)return {error:'ღონისძიება დასრულდა. ნახე ქალაქის ახალი ამბები.',state:visible()};
  if(current.kind==='cleanup'){
   const item=data.litter.find(i=>i.id===packet.targetId);
   if(!item||current.removed.has(item.id))return {error:'ეს ადგილი უკვე დასუფთავებულია.',state:visible()};
   if(Math.hypot(p.x-item.x,p.y-item.y)>65||!clearPath(p,item))return {error:'ჯერ ნარჩენთან ახლოს მიდი.'};
   current.removed.add(item.id);
  }else{
   if(Math.hypot(p.x-current.x,p.y-current.y)>100||!clearPath(p,current))return {error:'მიდი თამართან და ახლოდან დაუკარი ტაში.'};
   if(!data.beat(now()))return {error:'დაელოდე მაჩვენებლის განათებას და რიტმს აჰყევი.'};
   const prior=current.contributors.get(p.userKey||p.id);if(prior&&now()-prior.lastAt<1000)return {error:'შემდეგ რიტმს დაელოდე.'};
  }
  const key=p.userKey||p.id,old=current.contributors.get(key);
  current.contributors.set(key,{name:p.name,count:(old?.count||0)+1,lastAt:now()});current.progress++;
  emit('city:life:spark',{x:p.x,y:p.y,kind:current.kind,at:now()});
  if(current.progress>=current.goal){current.done=true;feed.unshift({id:++sequence,text:current.title+' — საერთო მიზანი შესრულებულია! მონაწილე: '+current.contributors.size,at:now()});feed.length=Math.min(feed.length,6);}
  push();return {ok:true,state:visible()};
 }
 function pet(p,id){
  if(!p||players.get(p.id)!==p)return {error:'ჯერ შემოდი ქალაქში.'};
  const animal=world.animals.find(a=>a.id===id);if(!animal||!free(p))return {error:'ცხოველთან ქუჩაში ფეხით მიდი.'};
  const at=data.animalAt(animal,now());
  if(Math.hypot(p.x-at.x,p.y-at.y)>75||!clearPath(p,at))return {error:'ცხოველთან უფრო ახლოს მიდი.'};
  const key=p.userKey||p.id;if(now()-(petTimes.get(key)??-Infinity)<5000)return {error:'ცხოველს ცოტა დასვენება აცადე.'};
  petTimes.set(key,now());reactions.set(id,{animalId:id,name:p.name,until:now()+4500});
  push();return {ok:true,message:animal.kind==='cat'?'ფისო კმაყოფილად კრუტუნებს ♥':'ძაღლი კუდს აქიცინებს ♥'};
 }
 function tick(){ensure();for(const [id,r]of reactions)if(r.until<=now())reactions.delete(id);for(const [id,at]of petTimes)if(now()-at>60000)petTimes.delete(id);if(players.size&&now()-lastBroadcast>=1000){lastBroadcast=now();push();}}
 function attach(socket){
  const handle=(name,fn)=>socket.on('city:life:'+name,(packet,ack)=>{
   const p=players.get(socket.id);if(!p){if(typeof ack==='function')ack({error:'ჯერ შემოდი ქალაქში.'});return;}
   const at=now(),lim=limits.get(socket.id)||{at,count:0};if(at-lim.at>=1000){lim.at=at;lim.count=0;}limits.set(socket.id,lim);
   if(++lim.count>8){if(typeof ack==='function')ack({error:'ცოტა მოიცადე.'});return;}
   const result=fn(p,packet&&typeof packet==='object'?packet:{});if(typeof ack==='function')ack(result);
  });
  handle('sync',()=>({ok:true,state:visible()}));handle('act',act);handle('pet',(p,d)=>pet(p,d.animalId));
 }
 return {attach,tick,state:visible,act,pet,remove:id=>limits.delete(id)};
}
module.exports={createCityLife};
