/* Shared, pure rules for the two-player, twenty-card Georgian game. */
(function(root,factory){if(typeof module==="object"&&module.exports)module.exports=factory();else root.BuraRules=factory();})(typeof window!=="undefined"?window:globalThis,function(){
 "use strict";
 const SUITS=["s","h","d","c"],RANK_ORDER=["J","Q","K","T","A"],CARD_POINTS={A:11,T:10,K:4,Q:3,J:2};
 const CALL_SEQUENCE=["davi","se","chari","fanji","shashi"];
 const CALLS=Object.fromEntries(CALL_SEQUENCE.map((k,i)=>[k,{order:i+1,multiplier:i+2,label:["დავი","სე","ჩარი","ფანჯი","შაში"][i]}]));
 const cardSuit=c=>c.slice(-1),cardRank=c=>c.slice(0,-1),cardPoints=c=>CARD_POINTS[cardRank(c)]||0;
 const handPoints=cards=>cards.reduce((n,c)=>n+cardPoints(c),0);
 function buildDeck(){return SUITS.flatMap(s=>RANK_ORDER.map(r=>r+s));}
 function shuffleDeck(deck,rng=Math.random){const d=deck.slice();for(let i=d.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[d[i],d[j]]=[d[j],d[i]];}return d;}
 function beats(a,b,trump){return cardSuit(a)===cardSuit(b)?RANK_ORDER.indexOf(cardRank(a))>RANK_ORDER.indexOf(cardRank(b)):cardSuit(a)===trump;}
 function matchCut(played,led,trump){
  if(played.length!==led.length)return null;
  const used=new Set(),matched=[];
  function search(i){
   if(i===led.length)return true;
   for(let j=0;j<played.length;j++)if(!used.has(j)&&beats(played[j],led[i],trump)){
    used.add(j);matched.push(played[j]);
    if(search(i+1))return true;
    used.delete(j);matched.pop();
   }
   return false;
  }
  return search(0)?matched:null;
 }
 const canBeatAll=(played,led,trump)=>matchCut(played,led,trump)!==null;
 function held(cards,hand,n){return Array.isArray(cards)&&cards.length===n&&new Set(cards).size===n&&cards.every(c=>typeof c==="string"&&hand.includes(c));}
 function validateLead(cards,hand,max=3){return {ok:Array.isArray(cards)&&cards.length>=1&&cards.length<=max&&held(cards,hand,cards.length)&&cards.every(c=>cardSuit(c)===cardSuit(cards[0])),error:"აირჩიე 1–3 ერთი ფერის კარტი, რომელიც ხელში გაქვს."};}
 function validateResponse(cards,hand,n){return {ok:held(cards,hand,n),error:`აირჩიე ზუსტად ${n} კარტი, რომელიც ხელში გაქვს.`};}
 function isMalutka(hand,trump){return hand.length===3&&cardSuit(hand[0])!==trump&&hand.every(c=>cardSuit(c)===cardSuit(hand[0]));}
 const callMultiplier=c=>CALLS[c]?.multiplier||1;
 const nextCall=c=>CALL_SEQUENCE[CALL_SEQUENCE.indexOf(c)+1]||null;
 return {SUITS,RANK_ORDER,CARD_POINTS,CALLS,CALL_SEQUENCE,TOTAL_POINTS:120,WIN_POINTS:31,cardSuit,cardRank,cardPoints,handPoints,buildDeck,shuffleDeck,beats,matchCut,canBeatAll,validateLead,validateResponse,isMalutka,callMultiplier,nextCall};
});
