"use strict";
const E=require("./nardi-engine");
function evaluate(p,s){
 const own=E.sign(s);let value=(p.off[s]-p.off[1-s])*110+(E.pips(p,1-s)-E.pips(p,s))*1.2+(p.bar[1-s]-p.bar[s])*26;
 for(let i=0;i<24;i++){const n=p.board[i]*own;if(n>=2)value+=E.distance(s,i)<=6?12:6;if(n===1)value-=E.distance(s,i)>6?11:4;}
 return value;
}
// Only public board state and already-rolled dice are supplied. No future RNG access.
function choose(v){
 if(v.finished||v.phase==="done"||v.turnSeat!==v.mySeat)return null;const s=v.mySeat;
 if(v.phase==="cubeAnswer")return {action:evaluate(v.position,s)<-230?"drop":"take"};
 if(v.phase==="preRoll"){if(v.canDouble&&evaluate(v.position,s)>180)return {action:"double"};return {action:"roll"};}
 if(v.phase==="move"){
  if(v.canFinish)return {action:"finish"};
  let best=null,value=-Infinity;for(const m of v.legalMoves){const q=E.apply(v.position,s,m),score=evaluate(q,s);if(score>value){value=score;best=m;}}
  return best?{action:"move",...best}:null;
 }
 return null;
}
module.exports={choose};
