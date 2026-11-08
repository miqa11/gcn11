"use strict";
const crypto=require("node:crypto"),E=require("./nardi-engine");
const secureRandom=()=>(crypto.randomInt(1,7)-.5)/6;
const die=rng=>1+Math.floor(rng()*6);
function createGame(options={}){return {target:[1,3,5,7].includes(options.target)?options.target:5,score:[0,0],roundNumber:0,round:null,finished:false,winner:null,crawfordUsed:false,timeouts:[0,0],results:[]};}
function startRound(g,_starter,rng=secureRandom){
 if(g.finished)return false;let a,b,attempts=0;do{a=die(rng);b=die(rng);if(++attempts>100)throw Error("Invalid opening dice source");}while(a===b);
 const position=E.initial(),crawford=g.target>1&&!g.crawfordUsed&&g.score.some(n=>n===g.target-1);if(crawford)g.crawfordUsed=true;
 g.roundNumber++;g.round={position,turnStart:E.clone(position),turnSeat:a>b?0:1,turnId:1,phase:"move",dice:[a,b],remaining:[a,b],moves:[],opening:[a,b],cube:1,cubeOwner:null,pendingDouble:null,crawford,lastTurn:null,result:null};return true;
}
function finishRound(g,winner,reason,mult=1){
 const r=g.round;if(!r||r.phase==="done")return;
 const points=r.cube*mult;g.score[winner]+=points;r.phase="done";r.pendingDouble=null;
 r.result={round:g.roundNumber,winner,reason,points,multiplier:mult,cube:r.cube,score:g.score.slice()};g.results.push({...r.result});if(g.results.length>50)g.results.shift();
 if(g.score[winner]>=g.target){g.finished=true;g.winner=winner;}return r.result;
}
function canDouble(g,s){const r=g.round;return !!r&&!g.finished&&g.target>1&&r.phase==="preRoll"&&r.turnSeat===s&&!r.crawford&&(r.cubeOwner===null||r.cubeOwner===s)&&r.cube<g.target-g.score[s];}
function finishTurn(g){const r=g.round,s=r.turnSeat;r.lastTurn={seat:s,dice:r.dice.slice(),moves:r.moves.map(m=>({...m})),passed:!r.moves.length};if(r.position.off[s]===15)return finishRound(g,s,"bearoff",E.multiplier(r.position,s));r.turnSeat=1-s;r.turnId++;r.phase="preRoll";r.dice=[];r.remaining=[];r.moves=[];r.turnStart=E.clone(r.position);}
function fail(error){return {ok:false,error};}
function act(g,s,action,data={},rng=secureRandom){
 const r=g.round;if(!r||g.finished||r.phase==="done")return fail("ხელი არ მიმდინარეობს.");if(s!==r.turnSeat)return fail("ახლა შენი სვლა არ არის.");
 if(action==="roll"){
  if(r.phase!=="preRoll")return fail("კამათელი უკვე გაგორებულია.");
  const a=die(rng),b=die(rng);r.dice=[a,b];r.remaining=a===b?[a,a,a,a]:[a,b];r.turnStart=E.clone(r.position);r.moves=[];r.phase="move";
  if(!E.legalMoves(r.position,s,r.remaining).length)finishTurn(g);
 }else if(action==="move"){
  if(r.phase!=="move")return fail("ჯერ კამათელი გააგორე.");
  const m=E.legalMoves(r.position,s,r.remaining).find(m=>m.from===data.from&&m.to===data.to&&m.die===data.die);if(!m)return fail("ეს გადაადგილება წესებს არ შეესაბამება — გამოიყენე მონიშნული სვლები.");
  r.position=E.apply(r.position,s,m);r.remaining=E.removeDie(r.remaining,m.die);r.moves.push({...m});
 }else if(action==="undo"){
  if(r.phase!=="move"||!r.moves.length)return fail("დასაბრუნებელი სვლა არ არის.");
  r.moves.pop();r.position=E.clone(r.turnStart);r.remaining=r.dice[0]===r.dice[1]?[...r.dice,...r.dice]:r.dice.slice();for(const m of r.moves){r.position=E.apply(r.position,s,m);r.remaining=E.removeDie(r.remaining,m.die);}
 }else if(action==="finish"){
  if(r.phase!=="move"||E.legalMoves(r.position,s,r.remaining).length)return fail("ჯერ გამოიყენე შესაძლებელი სვლები.");finishTurn(g);
 }else if(action==="double"){
  if(!canDouble(g,s))return fail("გადავება ახლა ვერ ითქმის.");r.pendingDouble={bySeat:s,value:r.cube*2};r.turnSeat=1-s;r.phase="cubeAnswer";
 }else if(action==="take"||action==="drop"){
  if(r.phase!=="cubeAnswer"||!r.pendingDouble)return fail("კუბი პასუხს არ ელოდება.");const offer=r.pendingDouble;
  if(action==="drop")finishRound(g,offer.bySeat,"drop");else{r.cube=offer.value;r.cubeOwner=s;r.turnSeat=offer.bySeat;r.pendingDouble=null;r.phase="preRoll";}
 }else return fail("უცნობი მოქმედება.");
 if(r.turnSeat!==s||r.phase==="done")g.timeouts[s]=0;return {ok:true};
}
function forfeitMatch(g,s,reason="leave"){if(g.finished)return;const winner=1-s;if(g.round?.phase!=="done")finishRound(g,winner,reason);g.finished=true;g.winner=winner;g.forfeitReason=reason;}
function timeout(g,s){if(!g.round||g.finished||g.round.phase==="done"||g.round.turnSeat!==s)return;g.timeouts[s]++;if(g.timeouts[s]>=2)return forfeitMatch(g,s,"timeouts");finishRound(g,1-s,g.round.phase==="cubeAnswer"?"timeoutDrop":"timeout");}
function viewForSeat(g,s){
 const r=g.round;if(!r)return null;const mine=s===r.turnSeat&&!g.finished,legal=mine&&r.phase==="move"?E.legalMoves(r.position,s,r.remaining):[];
 return {target:g.target,score:g.score.slice(),roundNumber:g.roundNumber,finished:g.finished,winner:g.winner,forfeitReason:g.forfeitReason||null,mySeat:s,position:E.clone(r.position),turnSeat:r.turnSeat,turnId:r.turnId,phase:r.phase,dice:r.dice.slice(),remaining:r.remaining.slice(),moves:r.moves.map(m=>({...m})),opening:r.opening.slice(),cube:r.cube,cubeOwner:r.cubeOwner,pendingDouble:r.pendingDouble?{...r.pendingDouble}:null,crawford:r.crawford,canDouble:canDouble(g,s),legalMoves:legal,canFinish:mine&&r.phase==="move"&&!legal.length,canUndo:mine&&r.phase==="move"&&r.moves.length>0,pips:[E.pips(r.position,0),E.pips(r.position,1)],lastTurn:r.lastTurn?{...r.lastTurn,dice:r.lastTurn.dice.slice(),moves:r.lastTurn.moves.map(m=>({...m}))}:null,result:r.result?{...r.result,score:r.result.score.slice()}:null,results:g.results.map(r=>({...r,score:r.score.slice()}))};
}
module.exports={createGame,startRound,act,timeout,forfeitMatch,finishRound,viewForSeat,canDouble};
