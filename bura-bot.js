"use strict";
// This interface accepts ONLY the same redacted view a seated human receives.
const E=require("./bura-engine");
function choices(hand,n){const out=[];for(let bits=1;bits<1<<hand.length;bits++){const cards=hand.filter((_,j)=>bits&(1<<j));if(cards.length===n)out.push(cards);}return out;}
function choose(view){
 const v=view,h=v.myHand,s=v.mySeat;
 if(v.finished||v.phase==="done")return null;
 if(v.phase==="lead"&&v.canMalutka&&v.turnSeat!==s)return {action:"malutka"};
 if(v.turnSeat!==s)return null;
 const known=v.history.filter(t=>t.winner===s).reduce((sum,t)=>sum+E.handPoints(t.ledCards)+t.responseCards.reduce((n,c)=>n+(c?E.cardPoints(c):2),0),0);
 const trumps=h.filter(c=>E.cardSuit(c)===v.trump).length,strength=E.handPoints(h)+trumps*6;
 if(v.phase==="callAnswer")return {action:strength+known>=25?"accept":"concede"};
 if(v.phase==="collect")return {action:known>=31?"var":"continue"};
 if(v.phase==="lead"){
  if(known>=31)return {action:"var"};
  if(v.canCall&&strength>=34&&known>=10)return {action:"call"};
  const groups=[];for(let n=1;n<=v.maxLead;n++)groups.push(...choices(h,n).filter(c=>E.validateLead(c,h,v.maxLead).ok));
  groups.sort((a,b)=>(b.length*6+E.handPoints(b)-b.filter(c=>E.cardSuit(c)===v.trump).length*9)-(a.length*6+E.handPoints(a)-a.filter(c=>E.cardSuit(c)===v.trump).length*9));
  return groups.length?{action:"lead",cards:groups[0]}:null;
 }
 if(v.phase==="respond"){
  const all=choices(h,v.trick.ledCards.length).sort((a,b)=>E.handPoints(a)-E.handPoints(b));
  const cut=all.find(c=>E.canBeatAll(c,v.trick.ledCards,v.trump));return {action:cut?"cut":"discard",cards:cut||all[0]};
 }
 return null;
}
module.exports={choose};
