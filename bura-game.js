"use strict";
const E=require("./bura-engine");
const other=s=>1-s;
const TRICK_DISPLAY_MS=2000;
function createGame(){return {target:11,score:[0,0],roundNumber:0,round:null,finished:false,winner:null,crawfordUsed:false,timeouts:[0,0],results:[]};}
function finishRound(g,winner,reason,mult=1){
 const r=g.round;if(!r||r.phase==="done")return;
 const points=winner===null?0:E.callMultiplier(r.currentCall)*mult;
 if(winner!==null)g.score[winner]+=points;
 r.phase="done";r.pendingCall=null;
 const result={round:g.roundNumber,winner,reason,points,cardPoints:r.captured.map(E.handPoints),captured:r.captured.map(a=>a.slice()),score:g.score.slice(),price:E.callMultiplier(r.currentCall),winningHand:(reason==="bura"||reason==="royal")?r.hands[winner].slice():[]};
 if(reason==="var")result.declarerSeat=r.turnSeat;
 g.results.push(result);if(g.results.length>50)g.results.shift();r.result=result;
 if(winner!==null&&g.score[winner]>=g.target){g.finished=true;g.winner=winner;}
 return result;
}
function special(g){
 const r=g.round;
 for(let s=0;s<2;s++)if(r.hands[s].length===3&&r.hands[s].every(c=>E.cardRank(c)==="A")&&r.hands[s].includes("A"+r.trump))return finishRound(g,s,"royal",2);
 for(let s=0;s<2;s++)if(r.hands[s].length===3&&r.hands[s].every(c=>E.cardSuit(c)===r.trump))return finishRound(g,s,"bura");
}
function startRound(g,starter,rng=Math.random){
 if(g.finished)return false;
 const previous=g.round?.result;
 if(starter===undefined)starter=previous?(previous.winner===null?other(g.round.starter):other(previous.winner)):Math.floor(rng()*2);
 const deck=E.shuffleDeck(E.buildDeck(),rng),hands=[[],[]];
 for(let i=0;i<3;i++)for(let s=0;s<2;s++)hands[s].push(deck.shift());
 const trumpCard=deck.shift();deck.push(trumpCard);
 const crawford=!g.crawfordUsed&&g.score.some(n=>n===10);if(crawford)g.crawfordUsed=true;
 g.roundNumber++;g.round={hands,deck,trumpCard,trump:E.cardSuit(trumpCard),starter,turnSeat:starter,leaderSeat:starter,phase:"lead",trick:null,history:[],captured:[[],[]],currentCall:null,lastRaiser:null,pendingCall:null,crawford,result:null};
 special(g);return true;
}
function resolveTrick(g,cards,cut,completedAt){
 const r=g.round,t=r.trick,winner=cut?other(t.leaderSeat):t.leaderSeat;
 const entry={leaderSeat:t.leaderSeat,ledCards:t.ledCards.slice(),responseSeat:other(t.leaderSeat),responseCards:cards.slice(),hidden:!cut,winner,completedAt};
 r.history.push(entry);r.captured[winner].push(...t.ledCards,...cards);r.trick=null;
 r.turnSeat=winner;r.leaderSeat=winner;r.phase="collect";
 if(!r.deck.length&&r.hands.every(h=>!h.length)){const p=r.captured.map(E.handPoints);finishRound(g,p[0]===p[1]?null:p[0]>p[1]?0:1,"count");}
}
function refill(g){
 const r=g.round,winner=r.turnSeat;
 while(r.deck.length&&r.hands.some(h=>h.length<3))for(const s of [winner,other(winner)])if(r.hands[s].length<3&&r.deck.length)r.hands[s].push(r.deck.shift());
 r.phase="lead";
 special(g);
}
function canMalutka(r,seat){return r.phase==="lead"&&E.isMalutka(r.hands[seat],r.trump)&&r.hands[other(seat)].length>=3;}
function canCall(r,seat){return r.turnSeat===seat&&(r.phase==="lead"||r.phase==="respond")&&!r.crawford&&r.lastRaiser!==seat&&!!E.nextCall(r.currentCall);}
function fail(error){return {ok:false,error};}
function act(g,seat,action,data={},now=Date.now){
 const r=g.round;
 if(g.finished||!r||r.phase==="done"||![0,1].includes(seat))return fail("რაუნდი არ მიმდინარეობს.");
 if(action==="malutka"){
  if(!canMalutka(r,seat))return fail("მალიუტკა ახლა ვერ ითამაშება.");
  data={cards:r.hands[seat].slice()};action="lead";
 }
 const interrupts=action==="lead"&&data.cards?.length===3&&canMalutka(r,seat);
 if(seat!==r.turnSeat&&!interrupts)return fail("ახლა შენი სვლა არ არის.");
 if(action==="lead"){
  if(r.phase!=="lead")return fail("ახლა ჩამოსვლის დრო არ არის.");
  const valid=E.validateLead(data.cards,r.hands[seat],Math.min(3,r.hands[other(seat)].length));if(!valid.ok)return valid;
  const cards=data.cards.slice();r.hands[seat]=r.hands[seat].filter(c=>!cards.includes(c));r.trick={leaderSeat:seat,ledCards:cards};r.leaderSeat=seat;r.turnSeat=other(seat);r.phase="respond";
 }else if(action==="cut"||action==="discard"){
  if(r.phase!=="respond")return fail("ახლა პასუხის დრო არ არის.");
  const valid=E.validateResponse(data.cards,r.hands[seat],r.trick.ledCards.length);if(!valid.ok)return valid;
  const cards=action==="cut"?E.matchCut(data.cards,r.trick.ledCards,r.trump):data.cards.slice();
  if(!cards)return fail("მოჭრისთვის თითოეულ კარტს ცალკე უნდა მოუჭრა.");
  r.hands[seat]=r.hands[seat].filter(c=>!cards.includes(c));resolveTrick(g,cards,action==="cut",now());
 }else if(action==="continue"){
  if(r.phase!=="collect")return fail("კარტების შევსების დრო ჯერ არ არის.");
  refill(g);
 }else if(action==="var"){
  if(r.phase!=="lead"&&r.phase!=="collect")return fail("„ვარ!“ თქვი შენს სვლაზე, ჩამოსვლამდე.");
  finishRound(g,E.handPoints(r.captured[seat])>=31?seat:other(seat),"var");
 }else if(action==="call"){
  if(!canCall(r,seat))return fail("დავი ახლა ვერ ითქმის.");
  r.pendingCall={call:E.nextCall(r.currentCall),bySeat:seat,resumeSeat:seat,resumePhase:r.phase,baseCall:r.currentCall};r.phase="callAnswer";r.turnSeat=other(seat);
 }else if(action==="accept"||action==="concede"||action==="raise"){
  if(r.phase!=="callAnswer"||!r.pendingCall)return fail("გამოძახება პასუხს არ ელოდება.");
  const pc=r.pendingCall;
  if(action==="concede"){r.currentCall=pc.baseCall;finishRound(g,pc.bySeat,"concede");}
  else if(action==="accept"){r.currentCall=pc.call;r.lastRaiser=pc.bySeat;r.turnSeat=pc.resumeSeat;r.pendingCall=null;r.phase=pc.resumePhase;}
  else{
   const next=E.nextCall(pc.call);if(!next)return fail("შაშიზე მაღლა ვერ ახვალ.");
   r.currentCall=pc.call;r.lastRaiser=pc.bySeat;r.pendingCall={...pc,call:next,bySeat:seat,baseCall:pc.call};r.turnSeat=other(seat);
  }
 }else return fail("უცნობი მოქმედება.");
 g.timeouts[seat]=0;return {ok:true};
}
function timeout(g,seat){
 if(!g.round||g.round.phase==="done"||g.finished||g.round.turnSeat!==seat)return;
 g.timeouts[seat]++;
 if(g.timeouts[seat]>=2)return forfeitMatch(g,seat,"timeouts");
 if(g.round.pendingCall){g.round.currentCall=g.round.pendingCall.baseCall;finishRound(g,other(seat),"timeoutConcede");}
 else finishRound(g,other(seat),"timeout");
}
function forfeitMatch(g,seat,reason="leave"){
 if(g.finished)return;
 const winner=other(seat);if(g.round?.phase!=="done")finishRound(g,winner,reason);
 g.finished=true;g.winner=winner;g.forfeitReason=reason;
}
function viewForSeat(g,seat){
 const r=g.round;if(!r)return null;
 const history=r.history.map(t=>({...t,ledCards:t.ledCards.slice(),responseCards:t.hidden?t.responseCards.map(()=>null):t.responseCards.slice()}));
 return {target:11,score:g.score.slice(),roundNumber:g.roundNumber,finished:g.finished,winner:g.winner,forfeitReason:g.forfeitReason||null,mySeat:seat,myHand:r.hands[seat].slice(),handCounts:r.hands.map(h=>h.length),deckLeft:r.deck.length,trump:r.trump,trumpCard:r.trumpCard,turnSeat:r.turnSeat,phase:r.phase,leaderSeat:r.leaderSeat,maxLead:Math.min(3,...r.hands.map(h=>h.length)),trick:r.trick?{leaderSeat:r.trick.leaderSeat,ledCards:r.trick.ledCards.slice()}:null,history,currentCall:r.currentCall,pendingCall:r.pendingCall?{...r.pendingCall}:null,crawford:r.crawford,canCall:canCall(r,seat),canMalutka:canMalutka(r,seat),result:r.result,results:g.results.slice()};
}
module.exports={createGame,startRound,act,timeout,forfeitMatch,finishRound,viewForSeat,special,TRICK_DISPLAY_MS};
