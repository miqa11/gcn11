'use strict';
function createZombieRewards({registeredUsers,saveAuthUsers,ensureCoins,changeCoins,spendableCoins,io,now=Date.now}){
 return (matchId,participants)=>{
  const paid={},accounts=new Set();let dirty=false;
  for(const p of participants){const key=String(p?.userKey||'').toLowerCase(),user=registeredUsers.get(key);if(!user||user.isGuest||accounts.has(key))continue;accounts.add(key);
   if(user.cityZombieRewards&&Object.hasOwn(user.cityZombieRewards,matchId))continue;
   ensureCoins(user);changeCoins(user,key,50000,{save:false});user.cityZombieRewards||={};user.cityZombieRewards[matchId]={at:now(),reward:50000};
   const entries=Object.entries(user.cityZombieRewards);if(entries.length>50)user.cityZombieRewards=Object.fromEntries(entries.slice(-50));paid[p.id]=50000;dirty=true;
  }
  if(dirty)saveAuthUsers();
  for(const p of participants)if(paid[p.id]){const key=String(p.userKey).toLowerCase(),user=registeredUsers.get(key);io.to('user:'+key).emit('coins:changed',{coins:spendableCoins(user,key)});}
  return paid;
 };
}
module.exports={createZombieRewards};
