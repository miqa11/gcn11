'use strict';
const {randomUUID}=require('node:crypto');
const drinks=[{id:'beer',name:'ლუდი',price:50,strength:1},{id:'wine',name:'ღვინო',price:100,strength:2},{id:'cocktail',name:'კოქტეილი',price:150,strength:3}];
function barAt(p,world){
 if(!p||p.rideId||p.vehicleId||p.gameId||p.activityLocked)return null;
 if(p.interiorId==='neon-casino')return Math.hypot(p.casinoX-845,p.casinoY-475)<145?'casino':null;
 if(p.interiorId)return null;
 if(Math.hypot(p.x-500,p.y-2255)<145)return 'garden';
 const b=world.buildings.find(b=>b.id==='radio-bar');return b&&Math.hypot(p.x-(b.x+b.w*.72+9),p.y-(b.y+b.h+15))<145?'radio':null;
}
function createCityBar({io,players,world,registeredUsers,ensureCoins,spendableCoins,changeCoins,saveAuthUsers,now=Date.now}){
 const offers=new Map(),rates=new Map();
 function effect(p){return {until:p.drunkUntil||0,level:p.drunkLevel||0,serverTime:now()};}
 function drink(p,item){p.drunkLevel=Math.min(3,(p.drunkUntil>now()?p.drunkLevel||0:0)+item.strength);p.drunkUntil=now()+Math.min(90000,Math.max(0,(p.drunkUntil||0)-now())+30000);p.action='wine';p.actionUntil=now()+1500;io.to(p.id).emit('city:bar:effect',effect(p));}
 function state(p){const bar=barAt(p,world);return {ok:true,bar,drinks,effect:effect(p),people:bar?[...players.values()].filter(t=>t.id!==p.id&&barAt(t,world)===bar).map(t=>({id:t.id,name:t.name})):[]};}
 function charge(p,item,id){
  const key=String(p.userKey||'').toLowerCase(),user=registeredUsers.get(key);if(!user||user.isGuest)return {error:'სასმლის შესაძენად რეგისტრაცია გჭირდება.'};
  if(user.cityDrinkReceipts?.[id])return {error:'ეს შეკვეთა უკვე შესრულებულია.'};ensureCoins(user);if(spendableCoins(user,key)<item.price)return {error:'სასმლისთვის მონეტები არ გყოფნის.'};
  changeCoins(user,key,-item.price,{save:false});user.cityDrinkReceipts||={};user.cityDrinkReceipts[id]=now();user.cityDrinkReceipts=Object.fromEntries(Object.entries(user.cityDrinkReceipts).slice(-32));saveAuthUsers();io.to('user:'+key).emit('coins:changed',{coins:spendableCoins(user,key)});return {ok:true};
 }
 function order(p,data){
  const bar=barAt(p,world),item=drinks.find(d=>d.id===data.drinkId);if(!bar)return {error:'ბართან ახლოს მიდი.'};if(!item||typeof data.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(data.requestId))return {error:'სასმლის შეკვეთა არასწორია.'};
  if(data.targetId&&data.targetId!==p.id){
   const target=players.get(data.targetId);if(!target||barAt(target,world)!==bar)return {error:'მოთამაშე იმავე ბართან უნდა იყოს.'};
   const old=offers.get(target.id);if(old&&old.expiresAt>now())return {error:'მოთამაშეს უკვე აქვს სასმლის შეთავაზება.'};
   const user=registeredUsers.get(String(p.userKey||'').toLowerCase());if(!user||user.isGuest)return {error:'სასმლის შესაძენად რეგისტრაცია გჭირდება.'};ensureCoins(user);if(spendableCoins(user,String(p.userKey).toLowerCase())<item.price)return {error:'სასმლისთვის მონეტები არ გყოფნის.'};
   const offer={id:randomUUID(),from:p.id,name:p.name,targetId:target.id,drinkId:item.id,expiresAt:now()+45000};offers.set(target.id,offer);io.to(target.id).emit('city:bar:offered',{...offer,drink:item});return {ok:true,message:'შეთავაზება გაიგზავნა. მონეტები მხოლოდ მიღებისას ჩამოგეჭრება.'};
  }
  const paid=charge(p,item,data.requestId);if(paid.error)return paid;drink(p,item);return {ok:true,effect:effect(p),message:item.name+' დალიე.'};
 }
 function respond(p,data){
  const offer=offers.get(p.id);if(!offer||offer.id!==data.id)return {error:'შეთავაზება აღარ არის ხელმისაწვდომი.'};offers.delete(p.id);io.to(p.id).emit('city:bar:offerClosed',{id:offer.id});
  if(data.accept!==true)return {ok:true};const buyer=players.get(offer.from),bar=barAt(p,world);if(offer.expiresAt<=now()||!buyer||!bar||barAt(buyer,world)!==bar)return {error:'შეთავაზება დასრულდა ან ბარს მოშორდით.'};
  const item=drinks.find(d=>d.id===offer.drinkId),paid=charge(buyer,item,offer.id);if(paid.error)return paid;drink(p,item);io.to(buyer.id).emit('city:bar:notice',{message:p.name+'-მა სასმელი მიიღო.'});return {ok:true,effect:effect(p)};
 }
 function attach(socket){
  for(const [event,handler]of Object.entries({state,order,respond,water:p=>{p.drunkUntil=0;p.drunkLevel=0;io.to(p.id).emit('city:bar:effect',effect(p));return {ok:true,effect:effect(p)};}}))socket.on('city:bar:'+event,(data,ack)=>{
   const p=players.get(socket.id);if(!p){if(typeof ack==='function')ack({error:'ჯერ ქალაქში შემოდი.'});return;}const key=p.id+':'+event,delay=event==='order'?1000:150;if(now()-(rates.get(key)??-Infinity)<delay){if(typeof ack==='function')ack({error:'ცოტა მოიცადე.'});return;}rates.set(key,now());
   const result=handler(p,data&&typeof data==='object'?data:{});if(typeof ack==='function')ack(result);
  });
 }
 function tick(){for(const [id,o]of offers)if(o.expiresAt<=now()||!players.has(id)||!players.has(o.from)){offers.delete(id);io.to(id).emit('city:bar:offerClosed',{id:o.id});}}
 function remove(id){for(const key of rates.keys())if(key.startsWith(id+':'))rates.delete(key);for(const [target,o]of offers)if(target===id||o.from===id){offers.delete(target);io.to(target).emit('city:bar:offerClosed',{id:o.id});}}
 return {attach,tick,remove,state,order,respond};
}
module.exports={createCityBar,barAt,drinks};
