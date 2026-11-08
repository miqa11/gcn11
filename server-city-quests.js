'use strict';
const quests=require('./city-quests-data');
const activities=require('./city-activities-data').activities;

function createCityQuests({players,registeredUsers,io,saveAuthUsers,ensureCoins,spendableCoins,changeCoins,now=Date.now}) {
 const limits=new Map();
 const key=p=>String(p?.userKey||'').toLowerCase();
 const userFor=p=>{const u=p&&registeredUsers.get(key(p));return u&&!u.isGuest?u:null;};
 const count=n=>Number.isSafeInteger(n)&&n>0?n:0;
 function progress(user,q){
  const a=user?.cityActivities||{},claims=a.claims||{},collection=a.collection||{},records=a.records||{};
  let value=0;
  if(q.activity==='fishing'||q.activity==='bugs'){
   const prefix=q.activity==='fishing'?'fish-':'bug-';
   value=Object.entries(collection).filter(([id])=>id.startsWith(prefix)).reduce((sum,[,item])=>sum+count(item?.count),0);
  }
  if(q.activity==='delivery')value=count(records.deliveries);
  if(q.activity==='photography')value=Object.keys(claims).filter(id=>id.startsWith('photo:')&&claims[id]).length;
  if(q.activity==='treasure')value=Object.keys(claims).filter(id=>/^treasure:[0-2]$/.test(id)&&claims[id]).length;
  if(q.activity==='parkour')value=Number.isFinite(records.parkour)&&records.parkour>0?1:0;
  return Math.min(q.goal,value);
 }
 function state(p){
  const user=userFor(p),claims=user?.cityQuestClaims||{};
  return {registered:!!user,coins:user?spendableCoins(user,key(p)):null,totalReward:quests.reduce((n,q)=>n+q.reward,0),
   claimedReward:quests.reduce((n,q)=>n+(Object.hasOwn(claims,q.id)?q.reward:0),0),
   quests:quests.map(q=>({...q,progress:progress(user,q),claimed:Object.hasOwn(claims,q.id),location:activities.find(a=>a.id===q.activity)?.location}))};
 }
 function push(p){if(p)io.to(p.id).emit('city:quest:state',state(p));}
 function claim(p,id){
  if(!p||players.get(p.id)!==p)return {error:'ჯერ შემოდი ქალაქში.'};
  const user=userFor(p);if(!user)return {error:'ჯილდოს მისაღებად დარეგისტრირდი და შედი ანგარიშში.',state:state(p)};
  const q=quests.find(q=>q.id===id);if(!q)return {error:'ეს დავალება არ არსებობს.',state:state(p)};
  if(user.cityQuestClaims&&Object.hasOwn(user.cityQuestClaims,id))return {ok:true,alreadyClaimed:true,reward:0,state:state(p)};
  if(progress(user,q)<q.goal)return {error:'ჯერ შეასრულე დავალება.',state:state(p)};
  ensureCoins(user);
  // Claims and the balance live in the same saved account snapshot. There is no await between checking and recording a claim.
  changeCoins(user,key(p),q.reward,{save:false});
  if(!user.cityQuestClaims||typeof user.cityQuestClaims!=='object'||Array.isArray(user.cityQuestClaims))user.cityQuestClaims={};
  user.cityQuestClaims[id]={at:now(),reward:q.reward};saveAuthUsers();
  io.to('user:'+key(p)).emit('coins:changed',{coins:spendableCoins(user,key(p))});push(p);
  return {ok:true,reward:q.reward,state:state(p)};
 }
 function attach(socket){
  const handle=(event,run)=>socket.on('city:quest:'+event,(data,ack)=>{
   const p=players.get(socket.id);if(!p){if(typeof ack==='function')ack({error:'ჯერ შემოდი ქალაქში.'});return;}
   const at=now(),limit=limits.get(p.id)||{at,count:0};if(at-limit.at>=1000){limit.at=at;limit.count=0;}limits.set(p.id,limit);
   if(++limit.count>8){if(typeof ack==='function')ack({error:'ცოტა მოიცადე.'});return;}
   const result=run(p,data);if(typeof ack==='function')ack(result);
  });
  handle('state',p=>({ok:true,state:state(p)}));handle('claim',(p,data)=>claim(p,data?.questId));
 }
 return {attach,state,push,claim,remove:id=>limits.delete(id)};
}
module.exports={createCityQuests};
