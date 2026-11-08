// Optional local browser QA; see docs/city-mobile-layout.md for Playwright setup.
const express=require('express'),http=require('node:http'),{Server}=require('socket.io');
const {chromium}=require('playwright'),path=require('node:path');
const repo=path.resolve(__dirname,'..');
const world=require(path.join(repo,'city-world')),vehicles=require(path.join(repo,'city-vehicles'));
const {createCityMotionController}=require(path.join(repo,'server-city-motion'));
const {createWorldGames}=require(path.join(repo,'city-world-games-engine'));
const {createCityGarden}=require(path.join(repo,'server-city-garden'));
(async()=>{
 const output=process.env.CITY_QA_OUTPUT||path.join(require('node:os').tmpdir(),'gaicani-city-bar-arcade');require('node:fs').mkdirSync(output,{recursive:true});
 const app=express(),server=http.createServer(app),io=new Server(server),players=new Map();
 const users=new Map();
 const award=require(path.join(repo,'server-city-zombie-rewards')).createZombieRewards({registeredUsers:users,io,saveAuthUsers(){},ensureCoins(){},changeCoins:(u,k,n)=>u.coins+=n,spendableCoins:u=>u.coins});
 const garage=vehicles.createGarage(world,{players}),motion=createCityMotionController(world,garage),garden=createCityGarden({world,players});
 const engine=createWorldGames({io,players,world,garage,roomName:'city',awardZombieVictory:award});
 const bar=require(path.join(repo,'server-city-bar')).createCityBar({io,players,world,registeredUsers:users,ensureCoins(){},spendableCoins:u=>u.coins,changeCoins:(u,k,n)=>u.coins+=n,saveAuthUsers(){}});
 const view=p=>({...p,motion:motion.view(p)});
 let sequence=0;io.on('connection',s=>{
  const auth=()=>s.emit('auth:authenticated',{username:'მოთამაშე '+(++sequence),friends:[],pendingRequests:[]});
  s.on('auth:guest',auth);s.on('auth:token',auth);
  s.on('city:join',(_d,ack)=>{const p={id:s.id,userKey:s.id,name:'მოთამაშე '+sequence,x:500,y:2280+players.size*10,dir:'right',color:'#66d7a7',action:'idle'};players.set(s.id,p);users.set(s.id.toLowerCase(),{coins:1000});s.join('city');s.emit('city:joined',{self:view(p),players:[...players.values()].map(view),vehicles:garage.list(),garden:garden.publicState(),signals:[],notes:[]});ack?.({ok:true});});
  s.on('city:motion',(d,ack)=>{const p=players.get(s.id);if(p)ack?.(motion.process(p,d));});
  bar.attach(s);s.on('city:arcade:records',(_d,ack)=>ack({ownRecords:{},leaderboards:{},players:[]}));s.on('city:arcade:record',(_d,ack)=>ack({records:{ownRecords:{}}}));engine.bind(s);s.on('disconnect',()=>{engine.remove(s.id);players.delete(s.id);});
 });
 const ticker=setInterval(()=>{engine.tick();bar.tick();garage.maintain();io.to('city').emit('city:snapshot',{players:[...players.values()].map(view),vehicles:garage.list(),garden:garden.publicState()});},100);
 app.use(express.static(repo));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CITY_QA_CHROME||undefined,headless:true,args:['--disable-gpu']});
 const desktop=await browser.newPage({viewport:{width:1440,height:1000}}),mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const observer=await browser.newPage({viewport:{width:1100,height:850}});
 const errors=[];for(const p of [desktop,mobile])p.on('pageerror',e=>errors.push(e.message));
 try {
  for(const page of [desktop,mobile,observer]){page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/city.html');await page.waitForFunction(()=>window.GaicaniCityGameBridge?.getSelf());await page.locator('#cityGuide').waitFor({state:'visible'});await page.getByRole('button',{name:'გზამკვლევის დახურვა',exact:true}).click();await page.evaluate(()=>{window.worldView=[];window.GaicaniCityGameBridge.getSocket().on('city:world:public',r=>window.worldView=r);});}

  const mid=await mobile.evaluate(()=>window.GaicaniCityGameBridge.getSelf().id),did=await desktop.evaluate(()=>window.GaicaniCityGameBridge.getSelf().id);
  await desktop.getByRole('button',{name:'🍹 ბარი',exact:true}).click();await desktop.locator('.city-bar-buy').first().click();await desktop.waitForFunction(()=>document.querySelector('#cityCanvas').classList.contains('city-tipsy'));if(users.get(did.toLowerCase()).coins!==950)throw Error('Self purchase did not charge 50');
  await desktop.waitForTimeout(1100);await desktop.locator('#cityBarPanel select').selectOption(mid);await desktop.locator('.city-bar-buy').nth(1).click();await mobile.locator('.city-bar-offer').getByRole('button',{name:'მივიღო',exact:true}).click();await mobile.waitForFunction(()=>document.querySelector('#cityCanvas').classList.contains('city-tipsy'));if(users.get(did.toLowerCase()).coins!==850||users.get(mid.toLowerCase()).coins!==1000)throw Error('Wrong gift payer');
  await mobile.emulateMedia({reducedMotion:'reduce'});if(await mobile.locator('#cityCanvas').evaluate(e=>getComputedStyle(e).animationName)!=='none')throw Error('Reduced motion ignored');await mobile.emulateMedia({reducedMotion:'no-preference'});
  await mobile.locator('.city-bar-status').getByRole('button',{name:'გამოფხიზლება',exact:true}).click();await mobile.waitForFunction(()=>!document.querySelector('#cityCanvas').classList.contains('city-tipsy'));await desktop.screenshot({path:path.join(output,'bar-desktop.png')});await desktop.locator('.city-bar-close').click();await desktop.locator('.city-bar-status').getByRole('button',{name:'გამოფხიზლება',exact:true}).click();
  for(const page of [desktop,mobile])await page.evaluate(()=>{const mount=window.GaicaniArcadeGames.mount;window.GaicaniArcadeGames.mount=(...args)=>window.qaRun=mount(...args);});
  for(const [w,h]of [[320,568],[390,844],[667,375],[844,390]]){
   await mobile.setViewportSize({width:w,height:h});await mobile.evaluate(()=>window.GaicaniArcadeUI.open());
   for(let game=0;game<4;game++){
    await mobile.locator('.arcade-game-card button').nth(game).click();await mobile.waitForTimeout(1100);
    await mobile.evaluate(()=>{for(const b of document.querySelectorAll('.arcade-run-controls button'))b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1}));if(window.qaRun.getScore()!==0)throw Error('Controls acted before Start');});
    const check=await mobile.evaluate(()=>{const c=document.getElementById('cityArcadeContent'),r=document.querySelector('.arcade-run-controls').getBoundingClientRect(),win=document.querySelector('.arcade-window').getBoundingClientRect(),canvas=document.querySelector('.arcade-run-canvas').getBoundingClientRect();return {started:window.qaRun.started,scroll:c.scrollTop,overflow:c.scrollHeight-c.clientHeight,controls:r.bottom<=win.bottom+1,canvas:canvas.height};});
    const overlap=await mobile.evaluate(()=>{const bs=[...document.querySelectorAll('.arcade-window button')].filter(b=>b.getClientRects().length&&!b.closest('[hidden]')).map(b=>({t:b.textContent,r:b.getBoundingClientRect()}));for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i],b=bs[j];if(Math.min(a.r.right,b.r.right)>Math.max(a.r.left,b.r.left)+1&&Math.min(a.r.bottom,b.r.bottom)>Math.max(a.r.top,b.r.top)+1)return [a.t,b.t];}return null;});if(overlap)throw Error('Arcade button overlap '+w+' '+JSON.stringify(overlap));
    if(check.started||check.scroll||check.overflow>2||!check.controls||check.canvas<60)throw Error('Arcade ready/fit '+w+' '+game+' '+JSON.stringify(check));
    await mobile.locator('.arcade-ready button').click();if(!await mobile.evaluate(()=>window.qaRun.started))throw Error('Start failed');
    if(game===2&&w===667)await mobile.screenshot({path:path.join(output,'arcade-landscape.png')});if(game===0&&w===390)await mobile.screenshot({path:path.join(output,'arcade-portrait.png')});
    await mobile.locator('.arcade-solo-head .arcade-back-button').click();
   }
   await mobile.evaluate(()=>window.GaicaniArcadeUI.close());
  }
  await desktop.evaluate(()=>window.GaicaniArcadeUI.open());await desktop.locator('.arcade-game-card button').nth(3).click();await desktop.locator('.arcade-ready button').click();await desktop.evaluate(()=>window.GaicaniArcadeUI.close());
  await mobile.setViewportSize({width:390,height:844});
  await desktop.locator('[aria-controls=worldPhone]').click();await desktop.getByRole('button',{name:'🧟 ზომბების ათი ტალღა',exact:true}).click();await desktop.getByRole('button',{name:'ლობის შექმნა',exact:true}).click();await desktop.locator('.world-invite-list button').filter({hasText:players.get(mid).name}).click();await mobile.getByRole('button',{name:'მიღება',exact:true}).click();await desktop.getByRole('button',{name:'დაწყება · 2/6',exact:true}).click();await desktop.waitForTimeout(5500);
  const r=[...engine.rooms.values()][0];r.zombie.enemies=[];engine.tick();const boss=r.zombie.enemies[0],host=players.get(did);Object.assign(boss,{x:host.x+85,y:host.y,speed:0,path:[],routeAt:Infinity,targetId:did});
  for(const page of [desktop,mobile,observer])await page.waitForFunction(()=>window.worldView.some(r=>r.zombie?.enemies.some(e=>e.kind==='boss')));
  await mobile.screenshot({path:path.join(output,'boss-mobile.png')});
  const aim=await desktop.evaluate(p=>{const b=window.GaicaniCityGameBridge,o=b.getAimPoint(0,0);return {x:p.x-o.x,y:p.y-o.y};},{x:boss.x,y:boss.y-23});await desktop.mouse.move(aim.x,aim.y);await desktop.mouse.down();await desktop.waitForFunction(()=>window.worldView.some(r=>r.zombie?.phase==='break'),{},{timeout:12000});await desktop.mouse.up();
  if(r.zombie.enemies.length||r.stats[did].kills!==1)throw Error('Boss not killed by real shots');r.zombie.nextAt=Date.now()-1;engine.tick();r.zombie.enemies=[];engine.tick();if(r.zombie.enemies[0].maxHp<=boss.maxHp)throw Error('Boss2 not stronger');
  if(errors.length)throw Error(JSON.stringify(errors));console.log('PASS: self and accepted gift debit correct account, camera effect/water; all four arcade games stay ready until Start and fit four portrait/landscape sizes without scrolling; desktop play; shared large boss visible on all three clients, killed by actual held shots, next boss stronger. No page errors.');
 } finally {await browser.close();clearInterval(ticker);await new Promise(r=>io.close(r));server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
