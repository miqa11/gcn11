/* Shared visual countdowns. Server-side invitation checks remain authoritative. */
(() => {
 const until=new Map();
 window.GaicaniCityInviteCooldowns={
  record(id,ms){if(id&&Number.isFinite(ms)&&ms>0)until.set(id,Date.now()+ms);},
  seconds(id){const left=Math.ceil(((until.get(id)||0)-Date.now())/1000);if(left<=0)until.delete(id);return Math.max(0,left);}
 };
})();
