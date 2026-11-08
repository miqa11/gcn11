(() => {
 'use strict';
 window.addEventListener('gc:private-socket',({detail:{socket,friendName}})=>{
  let connected=false;const listeners=new Map();
  const local=(event,data)=>{for(const fn of listeners.get(event)||[])fn(data);};
  const adapter={get id(){return socket.id;},get connected(){return socket.connected;},on(event,fn){if(event.startsWith('partner')||event==='youWereBlocked'||event==='queuePosition'){if(!listeners.has(event))listeners.set(event,[]);listeners.get(event).push(fn);if(connected&&event==='partnerFound')fn({});}else socket.on(/^(game|music):/.test(event)?'friendActivity:'+event:event,fn);return adapter;},emit(event,...args){socket.emit(/^(game|music):/.test(event)?'friendActivity:'+event:event,...args);return adapter;}};
  window.socket=adapter;window.partnerConnected=false;window.addEventListener('pagehide',()=>socket.emit('friendActivity:leave'));window.addEventListener('pageshow',e=>{if(e.persisted&&socket.connected)socket.emit('friendActivity:join',{friendUsername:friendName});});
  socket.on('friendActivity:presence',d=>{const next=!!d.connected;connected=next;window.partnerConnected=next;document.getElementById('fcActivityStatus').textContent=next?'ერთად თამაში და მუსიკა ხელმისაწვდომია':'მეგობარმა ეს ჩატი უნდა გახსნას';document.getElementById('gameBtn').disabled=document.getElementById('musicBtn').disabled=!next;local(next?'partnerFound':'partnerDisconnected',d);});
  socket.on('friendActivity:error',d=>{const p=document.createElement('div');p.className='system-message';p.textContent=d.message;document.getElementById('fc-messages').append(p);});
  socket.on('auth:authenticated',()=>socket.emit('friendActivity:join',{friendUsername:friendName}));
  socket.on('disconnect',()=>{connected=false;window.partnerConnected=false;local('partnerDisconnected');document.getElementById('gameBtn').disabled=document.getElementById('musicBtn').disabled=true;});
  document.getElementById('gameBtn').addEventListener('click',()=>{if(connected)window._toggleGameMenu?.();});
 });
})();
