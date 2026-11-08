'use strict';
function createCityInviteGuard({now=Date.now}={}){
 const declines=new Map(),pending=new Map();
 const key=p=>String(p?.userKey||p?.name||p?.id||'').trim().toLowerCase();
 const pair=(a,b)=>JSON.stringify([key(a),key(b)]);
 function prune(){const at=now();for(const [k,until]of declines)if(until<=at)declines.delete(k);for(const [id,i]of pending)if(i.until<=at)pending.delete(id);}
 function busy(p){prune();const k=key(p);return [...pending.values()].some(i=>i.from===k||i.to===k);}
 function check(from,to,kind){
  prune();const retryAt=declines.get(pair(from,to));if(retryAt>now())return {error:'მოთამაშემ მოწვევა უარყო. ხელახლა მოწვევამდე დაელოდე '+Math.ceil((retryAt-now())/1000)+' წმ.',retryAt,retryAfterMs:retryAt-now()};
  const a=key(from),b=key(to);
  if([...pending.values()].some(i=>i.from===b||i.to===b))return {error:'ამ მოთამაშეს უკვე აქვს მიმდინარე მოწვევა. დაელოდე მის დასრულებას.'};
  if([...pending.values()].some(i=>i.to===a||(i.from===a&&(kind!=='world'||i.kind!=='world'))))return {error:'ჯერ უპასუხე ან გააუქმე შენი მიმდინარე მოწვევა.'};
  return null;
 }
 function reserve(from,to,id,kind,until){pending.set(id,{from:key(from),to:key(to),kind,until});}
 function decline(from,to){prune();const until=now()+60000;declines.set(pair(from,to),until);return {retryAt:until,retryAfterMs:60000};}
 return {check,reserve,decline,busy,release:id=>pending.delete(id)};
}
module.exports={createCityInviteGuard};
