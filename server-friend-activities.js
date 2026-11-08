'use strict';
const {randomUUID}=require('node:crypto');
// Separate routing/state from random chat: never set or borrow socket.partner.
function createFriendActivities({io,registeredUsers,privRoomId,extractYouTubeId,generateMathQuestion,checkTTTWinner,getRPSWinner,now=Date.now}){
 const members=new Map(),rooms=new Map(),invites=new Map(),games=new Map(),music=new Map(),rates=new Map();
 const emit=(id,event,data)=>io.sockets.sockets.get(id)?.emit('friendActivity:'+event,data);
 function valid(id){const m=members.get(id),s=io.sockets.sockets.get(id);if(!m||!s?.connected||s._regUser?.usernameLower!==m.me)return null;const a=registeredUsers.get(m.me),b=registeredUsers.get(m.friend);return a&&!a.isGuest&&b&&!b.isGuest&&!(a.blockedUsers||[]).includes(m.friend)&&!(b.blockedUsers||[]).includes(m.me)&&(a.friends||[]).includes(m.friend)&&(b.friends||[]).includes(m.me)?m:null;}
 function paired(a,b){const x=valid(a),y=valid(b);return !!(x&&y&&x.room===y.room&&x.me===y.friend&&x.friend===y.me);}
 function peer(id){const m=valid(id);return m?[...(rooms.get(m.room)||[])].reverse().find(other=>other!==id&&paired(id,other)):null;}
 function presence(room){for(const id of rooms.get(room)||[]){const other=peer(id);emit(id,'presence',{connected:!!other,partnerId:other||null});}}
 function error(id,message){emit(id,'error',{message});}
 function clearGame(id,notify=false){const g=games.get(id);if(!g)return;for(const p of g.players){games.delete(p);if(notify&&p!==id)emit(p,'game:partnerLeft');}}
 function stopMusic(id){const s=music.get(id);if(!s)return;for(const p of s.players){music.delete(p);emit(p,'music:stop');}}
 function leave(id){const room=members.get(id)?.room;clearGame(id,true);stopMusic(id);members.delete(id);for(const [key,i]of invites)if(i.from===id||i.to===id)invites.delete(key);for(const key of rates.keys())if(key.startsWith(id+':'))rates.delete(key);if(room){const set=rooms.get(room);set?.delete(id);if(!set?.size)rooms.delete(room);presence(room);}}
 function limited(id,kind,ms){const key=id+':'+kind;if(now()-(rates.get(key)??-Infinity)<ms)return true;rates.set(key,now());return false;}
 function invite(id,kind,data,rematch=false){
  const target=rematch?data.toId:peer(id);if(!target||!paired(id,target)){error(id,'მეგობარმა ეს პირადი ჩატი უნდა გახსნას.');return;}if(limited(id,kind,1000))return;
  for(const [key,i]of invites)if(i.expires<=now())invites.delete(key);
  const item={from:id,to:target,expires:now()+30000,kind};
  if(kind==='game'){if(!['ttt','rps','math'].includes(data.gameType)||games.has(id)||games.has(target))return;item.gameType=data.gameType;}
  else {item.videoId=extractYouTubeId(data.url);if(!item.videoId){error(id,'არასწორი YouTube ბმული.');return;}}
  invites.set(target+':'+kind,item);emit(target,kind+':invite',kind==='game'?{gameType:item.gameType,fromId:id,isRematch:rematch}:{videoId:item.videoId,fromId:id,fromName:io.sockets.sockets.get(id)._regUser.username});
 }
 function respond(id,kind,data){
  const key=id+':'+kind,i=invites.get(key);if(!i||i.from!==data.toId||i.expires<=now()||!paired(id,i.from)||(kind==='game'&&i.gameType!==data.gameType)){error(id,'მოწვევა დასრულდა ან ჩატი შეიცვალა.');return;}invites.delete(key);
  if(data.accepted!==true){emit(i.from,kind+':declined');return;}
  if(kind==='music'){stopMusic(id);stopMusic(i.from);const session={players:[i.from,id],videoId:i.videoId};for(const p of session.players){music.set(p,session);emit(p,'music:start',{videoId:i.videoId,hostId:i.from,startAt:now()+3500});}return;}
  if(games.has(id)||games.has(i.from))return;
  const state=i.gameType==='ttt'?{board:Array(9).fill(null),currentTurnSocketId:i.from}:i.gameType==='rps'?{choices:{}}:{question:generateMathQuestion(),answered:false};
  const g={id:randomUUID(),type:i.gameType,players:[i.from,id],state};for(const p of g.players){games.set(p,g);const view=g.type==='math'?{question:{display:state.question.display},answered:false}:structuredClone(state);emit(p,'game:start',{gameId:g.id,gameType:g.type,role:p===i.from?'X':'O',opponentId:p===id?i.from:id,state:view});}
 }
 function move(id,data){
  const g=games.get(id);if(!g)return;const other=g.players.find(p=>p!==id);if(!paired(id,other)){clearGame(id,true);return;}if(limited(id,'move',40))return;
  const [a,b]=g.players;let update,finished=false;
  if(g.type==='ttt'){const n=data.index,s=g.state;if(!Number.isInteger(n)||n<0||n>8||s.currentTurnSocketId!==id||s.board[n])return;s.board[n]=id===a?'X':'O';const win=checkTTTWinner(s.board),draw=!win&&s.board.every(Boolean);if(!win&&!draw)s.currentTurnSocketId=other;update={board:s.board.slice(),currentTurnSocketId:s.currentTurnSocketId,winnerSocketId:win?id:undefined,winLine:win?.line,draw:draw||undefined};finished=!!(win||draw);}
  if(g.type==='rps'){if(!['rock','paper','scissors'].includes(data.choice)||g.state.choices[id])return;g.state.choices[id]=data.choice;emit(other,'game:update',{opponentChose:true});if(Object.keys(g.state.choices).length!==2)return;const result=getRPSWinner(g.state.choices[a],g.state.choices[b]);update={choices:{...g.state.choices},winnerSocketId:result==='draw'?null:result==='p1'?a:b,draw:result==='draw'};finished=true;}
  if(g.type==='math'){const answer=data.answer;if(typeof answer!=='number'||!Number.isSafeInteger(answer))return;if(answer!==g.state.question.answer){emit(id,'game:update',{wrong:true});return;}update={winnerSocketId:id,answer,question:g.state.question};finished=true;}
  for(const p of g.players)emit(p,'game:update',update);if(finished)clearGame(id);
 }
 function refresh(){for(const id of [...members.keys()])if(!valid(id)){emit(id,'presence',{connected:false,partnerId:null});leave(id);}}
 function attach(socket){
  socket.on('friendActivity:join',data=>{const friend=String(data?.friendUsername||'').trim().toLowerCase(),me=socket._regUser?.usernameLower;if(!me||socket._regUser.isGuest||friend===me)return;leave(socket.id);members.set(socket.id,{me,friend,room:privRoomId(me,friend)});if(!valid(socket.id)){members.delete(socket.id);error(socket.id,'ეს ფუნქცია დადასტურებულ მეგობართან არის ხელმისაწვდომი.');return;}const room=members.get(socket.id).room;if(!rooms.has(room))rooms.set(room,new Set());rooms.get(room).add(socket.id);presence(room);});
  const handlers={'game:request':d=>invite(socket.id,'game',d),'game:rematch':d=>{if(paired(socket.id,d.toId))invite(socket.id,'game',d,true);},'game:response':d=>respond(socket.id,'game',d),'game:move':d=>move(socket.id,d),'game:leave':()=>clearGame(socket.id,true),'music:request':d=>invite(socket.id,'music',d),'music:response':d=>respond(socket.id,'music',d),'music:stop':()=>stopMusic(socket.id),'music:control':d=>{const s=music.get(socket.id),other=s?.players.find(p=>p!==socket.id);if(!s||!paired(socket.id,other)){stopMusic(socket.id);return;}if(!['play','pause','seek'].includes(d.action)||!Number.isFinite(d.time)||d.time<0||d.time>86400||limited(socket.id,'musicControl',80))return;emit(other,'music:control',{action:d.action,time:d.time});}};
  for(const [event,handler]of Object.entries(handlers))socket.on('friendActivity:'+event,data=>handler(data&&typeof data==='object'?data:{}));
  socket.on('friend:block',refresh);socket.on('friend:remove',refresh);socket.on('friendActivity:leave',()=>leave(socket.id));socket.on('disconnect',()=>leave(socket.id));
 }
 return {attach,leave};
}
module.exports={createFriendActivities};
