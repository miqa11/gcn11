/* Classical backgammon geometry and forced-dice rules, shared with the client. */
(function(root,factory){if(typeof module==="object"&&module.exports)module.exports=factory();else root.NardiRules=factory();})(typeof window!=="undefined"?window:globalThis,function(){
 "use strict";
 const sign=s=>s===0?1:-1,other=s=>1-s;
 function initial(){const board=Array(24).fill(0);for(const [p,n] of [[23,2],[12,5],[7,3],[5,5]]){board[p]=n;board[23-p]=-n;}return {board,bar:[0,0],off:[0,0]};}
 function clone(p){return {board:p.board.slice(),bar:p.bar.slice(),off:p.off.slice()};}
 const distance=(seat,point)=>seat===0?point+1:24-point;
 function allHome(p,s){return !p.bar[s]&&p.board.every((n,i)=>n*sign(s)<=0||distance(s,i)<=6);}
 function singleMoves(p,s,die){
  if(!Number.isInteger(die)||die<1||die>6)return [];
  const own=sign(s),out=[];
  function add(from,to){if(to>=0&&to<24&&p.board[to]*own>=-1)out.push({from,to,die});}
  if(p.bar[s]){add("bar",s===0?24-die:die-1);return out;}
  const home=allHome(p,s);
  for(let i=0;i<24;i++)if(p.board[i]*own>0){const to=i-own*die;if(to>=0&&to<24)add(i,to);else if(home){const d=distance(s,i);if(d===die||(die>d&&!p.board.some((n,j)=>n*own>0&&distance(s,j)>d)))out.push({from:i,to:"off",die});}}
  return out;
 }
 function apply(p,s,m){const q=clone(p),own=sign(s);if(m.from==="bar")q.bar[s]--;else q.board[m.from]-=own;if(m.to==="off")q.off[s]++;else{if(q.board[m.to]===-own){q.board[m.to]=0;q.bar[other(s)]++;}q.board[m.to]+=own;}return q;}
 function removeDie(dice,die){const d=dice.slice(),i=d.indexOf(die);if(i>=0)d.splice(i,1);return d;}
 function legalMoves(p,s,dice){
  const memo=new Map();
  function best(pos,left){if(!left.length)return 0;const key=pos.board.join(",")+"/"+pos.bar+"/"+pos.off+"/"+left.slice().sort().join("");if(memo.has(key))return memo.get(key);let max=0;
   for(const die of new Set(left))for(const m of singleMoves(pos,s,die)){max=Math.max(max,1+best(apply(pos,s,m),removeDie(left,die)));if(max===left.length){memo.set(key,max);return max;}}
   memo.set(key,max);return max;
  }
  const count=best(p,dice);if(!count)return [];
  let moves=[];for(const die of new Set(dice))for(const m of singleMoves(p,s,die))if(1+best(apply(p,s,m),removeDie(dice,die))===count)moves.push(m);
  if(count===1){const high=Math.max(...moves.map(m=>m.die));moves=moves.filter(m=>m.die===high);}
  return moves;
 }
 function pips(p,s){return p.bar[s]*25+p.board.reduce((n,c,i)=>n+(c*sign(s)>0?Math.abs(c)*distance(s,i):0),0);}
 function multiplier(p,winner){const loser=other(winner);if(p.off[loser])return 1;if(p.bar[loser]||p.board.some((n,i)=>n*sign(loser)>0&&distance(winner,i)<=6))return 3;return 2;}
 return {initial,clone,sign,other,distance,allHome,singleMoves,apply,removeDie,legalMoves,pips,multiplier};
});
