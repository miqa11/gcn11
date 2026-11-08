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
 let sequence=0,delayBar=0,dropRecords=false,recordsCalls=0;io.on('connection',s=>{
  const auth=()=>s.emit('auth:authenticated',{username:'მოთამაშე '+(++sequence),friends:[],pendingRequests:[]});
  s.on('auth:guest',auth);s.on('auth:token',auth);
  s.on('city:join',(_d,ack)=>{const p={id:s.id,userKey:s.id,name:'მოთამაშე '+sequence,x:500+players.size*70,y:2280,dir:'right',color:'#66d7a7',action:'idle'};players.set(s.id,p);users.set(s.id.toLowerCase(),{coins:1000});s.join('city');s.emit('city:joined',{self:view(p),players:[...players.values()].map(view),vehicles:garage.list(),garden:garden.publicState(),signals:[],notes:[]});ack?.({ok:true});});
  s.on('city:motion',(d,ack)=>{const p=players.get(s.id);if(p)ack?.(motion.process(p,d));});
  bar.attach(s);const getBar=s.listeners('city:bar:state')[0];s.removeAllListeners('city:bar:state');s.on('city:bar:state',(d,ack)=>{if(delayBar){const delay=delayBar;delayBar=0;setTimeout(()=>getBar(d,ack),delay);}else getBar(d,ack);});s.on('city:arcade:records',(_d,ack)=>{recordsCalls++;if(dropRecords){dropRecords=false;return;}ack({ownRecords:{pacman:{score:42}},leaderboards:{},players:[]});});s.on('city:arcade:record',(_d,ack)=>ack({records:{ownRecords:{}}}));engine.bind(s);s.on('disconnect',()=>{engine.remove(s.id);players.delete(s.id);});
 });
 const ticker=setInterval(()=>{engine.tick();bar.tick();garage.maintain();io.to('city').emit('city:snapshot',{players:[...players.values()].map(view),vehicles:garage.list(),garden:garden.publicState()});},100);
 app.use(express.static(repo));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CITY_QA_CHROME||undefined,headless:true,args:['--disable-gpu']});
 const desktop=await browser.newPage({viewport:{width:1440,height:1000}}),mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const observer=await browser.newPage({viewport:{width:1100,height:850}});
 const errors=[];for(const p of [desktop,mobile])p.on('pageerror',e=>errors.push(e.message));
 try {
  for(const page of [desktop,mobile,observer]){page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/city.html');await page.waitForFunction(()=>window.GaicaniCityGameBridge?.getSelf());await page.locator('#cityGuide').waitFor({state:'visible'});await page.getByRole('button',{name:'გზამკვლევის დახურვა',exact:true}).click();await page.evaluate(()=>{window.worldView=[];window.GaicaniCityGameBridge.getSocket().on('city:world:public',r=>window.worldView=r);});}


  await desktop.locator('#cityMoreButton').click();const before=await desktop.evaluate(()=>window.GaicaniCityGameBridge.getSelf().x);await desktop.keyboard.down('d');await desktop.waitForTimeout(350);await desktop.keyboard.up('d');const after=await desktop.evaluate(()=>window.GaicaniCityGameBridge.getSelf().x);if(Math.abs(after-before)>.1)throw Error('Moved behind More menu');await desktop.keyboard.press('Escape');
  await desktop.keyboard.down('a');await desktop.waitForTimeout(200);await desktop.keyboard.up('a');if(await desktop.evaluate(()=>window.GaicaniCityGameBridge.getSelf().x)>=before-2)throw Error('Movement did not resume');
  await desktop.waitForTimeout(300);const mutations=await desktop.evaluate(async()=>{let count=0;const observer=new MutationObserver(r=>count+=r.length);observer.observe(document.getElementById('cityStamina'),{attributes:true,subtree:true,childList:true});await new Promise(r=>setTimeout(r,800));observer.disconnect();return count;});if(mutations>2)throw Error('Idle stamina churn '+mutations);
  delayBar=700;await desktop.getByRole('button',{name:'🍹 ბარი',exact:true}).click();await desktop.locator('#cityBarPanel button').first().click();await desktop.waitForTimeout(200);await desktop.getByRole('button',{name:'🍹 ბარი',exact:true}).click();await desktop.locator('#cityBarPanel select').selectOption(await mobile.evaluate(()=>window.GaicaniCityGameBridge.getSelf().id));const selected=await desktop.locator('#cityBarPanel select').inputValue();await desktop.waitForTimeout(750);if(await desktop.locator('#cityBarPanel select').inputValue()!==selected)throw Error('Stale bar response reset recipient');await desktop.locator('.city-bar-close').click();
  dropRecords=true;await desktop.evaluate(()=>window.GaicaniArcadeUI.open());await desktop.waitForTimeout(100);const calls=recordsCalls;const oldId=await desktop.evaluate(()=>window.GaicaniCityGameBridge.getSelf().id),casinoPlayer=players.get(oldId);Object.assign(casinoPlayer,{interiorId:'neon-casino',casinoX:500,casinoY:500});io.to(oldId).emit('city:casino:joined',{self:{x:500,y:500,motion:motion.view(casinoPlayer)},players:[]});await desktop.locator('#interiorExit').waitFor({state:'visible'});await desktop.evaluate(()=>{const s=window.GaicaniCityGameBridge.getSocket();s.disconnect();s.connect();});await desktop.waitForFunction(id=>window.GaicaniCityGameBridge.getSocket().connected&&window.GaicaniCityGameBridge.getSelf()?.id!==id,oldId);await desktop.locator('#interiorExit').waitFor({state:'hidden'});await desktop.waitForTimeout(300);await desktop.evaluate(()=>window.GaicaniArcadeUI.open());await desktop.locator('.arcade-best').filter({hasText:'42'}).waitFor();if(recordsCalls<=calls)throw Error('Records stayed blocked after reconnect');await desktop.evaluate(()=>window.GaicaniArcadeUI.close());
  const mid=await mobile.evaluate(()=>window.GaicaniCityGameBridge.getSelf().id);
  await desktop.locator('[aria-controls=worldPhone]').click();await desktop.getByRole('button',{name:'🧟 ზომბების ათი ტალღა',exact:true}).click();await desktop.getByRole('button',{name:'ლობის შექმნა',exact:true}).click();await desktop.locator('.world-invite-list button').filter({hasText:players.get(mid).name}).click();await mobile.getByRole('button',{name:'მიღება',exact:true}).click();await desktop.getByRole('button',{name:'დაწყება · 2/6',exact:true}).click();await mobile.waitForTimeout(5500);
  const r=[...engine.rooms.values()][0];for(const e of r.zombie.enemies)Object.assign(e,{speed:0,path:[],routeAt:Infinity,x:1500,y:360});
  await mobile.evaluate(()=>window.hudButton=document.querySelector('.world-match-hud .world-hud-toggle'));await mobile.waitForTimeout(700);if(!await mobile.evaluate(()=>window.hudButton===document.querySelector('.world-match-hud .world-hud-toggle')))throw Error('HUD button replaced');
  const rect=await mobile.getByRole('button',{name:'📱 მატჩი',exact:true}).boundingBox();await mobile.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await mobile.mouse.down();await mobile.waitForTimeout(600);await mobile.mouse.up();await mobile.locator('.world-phone').waitFor({state:'visible'});await mobile.getByRole('button',{name:'✕',exact:true}).click();
  if(errors.length)throw Error(JSON.stringify(errors));console.log('PASS: More menu stops movement and permits fresh movement after close; idle stamina mutations='+mutations+'; stale bar state cannot reset selection; dropped arcade records recover after reconnect and stale casino scene clears; match controls remain the same DOM nodes and a 600ms press opens the match panel across multiple server updates. No browser errors.');
 } finally {await browser.close();clearInterval(ticker);await new Promise(r=>io.close(r));server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
