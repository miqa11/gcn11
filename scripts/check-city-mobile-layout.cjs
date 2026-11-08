// Optional browser regression: see docs/city-mobile-layout.md for setup.
const express=require('express'),http=require('node:http'),{Server}=require('socket.io');
const {chromium}=require('playwright'),path=require('node:path');
const repo=path.resolve(__dirname,'..');
const world=require(path.join(repo,'city-world')),vehicles=require(path.join(repo,'city-vehicles'));
const {createCityMotionController}=require(path.join(repo,'server-city-motion'));
const {createWorldGames}=require(path.join(repo,'city-world-games-engine'));
const {createCityGarden}=require(path.join(repo,'server-city-garden'));
(async()=>{
 const output=process.env.CITY_QA_OUTPUT||path.join(require('node:os').tmpdir(),'gaicani-city-mobile-layout');require('node:fs').mkdirSync(output,{recursive:true});
 const app=express(),server=http.createServer(app),io=new Server(server),players=new Map();
 const users=new Map();
 const award=require(path.join(repo,'server-city-zombie-rewards')).createZombieRewards({registeredUsers:users,io,saveAuthUsers(){},ensureCoins(){},changeCoins:(u,k,n)=>u.coins+=n,spendableCoins:u=>u.coins});
 const garage=vehicles.createGarage(world,{players}),motion=createCityMotionController(world,garage),garden=createCityGarden({world,players});
 const engine=createWorldGames({io,players,world,garage,roomName:'city',awardZombieVictory:award});
 const view=p=>({...p,motion:motion.view(p)});
 let sequence=0,testGarden=false;io.on('connection',s=>{
  const auth=()=>s.emit('auth:authenticated',{username:'მოთამაშე '+(++sequence),friends:[],pendingRequests:[]});
  s.on('auth:guest',auth);s.on('auth:token',auth);
  s.on('city:join',(_d,ack)=>{const p={id:s.id,userKey:s.id,name:'მოთამაშე '+sequence,x:testGarden?1380:garage.list()[0].x+40,y:testGarden?2600:garage.list()[0].y+players.size*12,dir:'right',color:'#66d7a7',action:'idle'};players.set(s.id,p);users.set(s.id.toLowerCase(),{coins:100});s.join('city');s.emit('city:joined',{self:view(p),players:[...players.values()].map(view),vehicles:garage.list(),garden:garden.publicState(),signals:[],notes:[]});ack?.({ok:true});});
  s.on('city:motion',(d,ack)=>{const p=players.get(s.id);if(p)ack?.(motion.process(p,d));});
  s.on('city:vehicle:enter',(d,ack)=>{const p=players.get(s.id),result=garage.enter(p,d.vehicleId,d.seatId);s.emit('city:snapshot',{players:[...players.values()].map(view),vehicles:garage.list()});ack?.({...result,self:view(p),vehicles:garage.list()});});
  s.on('city:vehicle:exit',(_d,ack)=>{const p=players.get(s.id),result=garage.release(p);ack?.({...result,self:view(p),vehicles:garage.list()});});engine.bind(s);s.on('disconnect',()=>{engine.remove(s.id);players.delete(s.id);});
 });
 const ticker=setInterval(()=>{engine.tick();garage.maintain();io.to('city').emit('city:snapshot',{players:[...players.values()].map(view),vehicles:garage.list(),garden:garden.publicState()});},100);
 app.use(express.static(repo));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CITY_QA_CHROME||undefined,headless:true,args:['--disable-gpu']});
 const desktop=await browser.newPage({viewport:{width:1440,height:1000}}),mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const observer=await browser.newPage({viewport:{width:1100,height:850}});
 const errors=[];for(const p of [desktop,mobile])p.on('pageerror',e=>errors.push(e.message));
 try {
  for(const page of [desktop,mobile,observer]){page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/city.html');await page.waitForFunction(()=>window.GaicaniCityGameBridge?.getSelf());await page.locator('#cityGuide').waitFor({state:'visible'});await page.getByRole('button',{name:'გზამკვლევის დახურვა',exact:true}).click();await page.evaluate(()=>{window.worldView=[];window.GaicaniCityGameBridge.getSocket().on('city:world:public',r=>window.worldView=r);});}

  async function check(label){
   await mobile.waitForTimeout(150);
   const failures=await mobile.evaluate(()=>{
    const items=[];for(const e of document.querySelectorAll('button,select,#touchPad,#cityStamina')){
     if(!e.getClientRects().length||e.closest('[hidden],[data-city-minimized=true]'))continue;
     let r=e.getBoundingClientRect(),x1=r.left,y1=r.top,x2=r.right,y2=r.bottom;
     for(let p=e.parentElement;p;p=p.parentElement){const st=getComputedStyle(p),b=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(st.overflowX)){x1=Math.max(x1,b.left);x2=Math.min(x2,b.right);}if(/auto|scroll|hidden|clip/.test(st.overflowY)){y1=Math.max(y1,b.top);y2=Math.min(y2,b.bottom);}}
     if(x2-x1<2||y2-y1<2)continue;items.push({id:e.id||e.getAttribute('aria-label')||e.textContent.slice(0,25),x1,y1,x2,y2});
    }
    const bad=[];for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j];if(Math.min(a.x2,b.x2)-Math.max(a.x1,b.x1)>1&&Math.min(a.y2,b.y2)-Math.max(a.y1,b.y1)>1)bad.push([a.id,b.id]);}
    if(document.documentElement.scrollWidth>innerWidth)bad.push(['viewport','overflow']);return bad;
   });if(failures.length)throw Error(label+' '+JSON.stringify(failures));
  }
  for(const [w,h]of [[320,568],[360,640],[390,844],[412,915],[568,320],[667,375],[844,390],[932,430],[768,1024]]){
   await mobile.setViewportSize({width:w,height:h});await check(w+'x'+h+' near car');
   await mobile.locator('#carMore').click();await check(w+'x'+h+' expanded car');
   await mobile.locator('#carMore').click();
   await mobile.evaluate(()=>{document.querySelector('#playerCard').hidden=false;});await mobile.locator('#playerCard .city-panel-minimize').click();await check(w+'x'+h+' minimized panel');
   await mobile.getByRole('button',{name:'მოთამაშე — გაშლა',exact:true}).click();await mobile.locator('#playerCardClose').click();
   if(w===390||w===667){await mobile.waitForTimeout(200);await mobile.locator('#carMore').click();await check('screenshot expanded car');await mobile.screenshot({path:path.join(output,'nonoverlap-car-'+w+'.png')});await mobile.locator('#carMore').click();}
  }
  await mobile.setViewportSize({width:390,height:844});await mobile.locator('#vehicleButton').click();await mobile.waitForFunction(()=>window.GaicaniCityGameBridge.getSelf().vehicleId);await mobile.locator('#carMore').click();await check('inside car expanded');await mobile.locator('#carMore').click();await mobile.locator('#vehicleButton').click();
  testGarden=true;await mobile.reload();await mobile.locator('#cityGuide').waitFor({state:'visible'});await mobile.getByRole('button',{name:'გზამკვლევის დახურვა',exact:true}).click();await mobile.locator('#gardenControls').waitFor({state:'visible'});
  for(const [w,h]of [[320,568],[390,844],[568,320],[667,375]]){await mobile.setViewportSize({width:w,height:h});await check(w+' garden');await mobile.locator('#gardenExpand').click();await check(w+' garden expanded');await mobile.locator('#gardenExpand').click();}
  testGarden=false;await mobile.reload();await mobile.locator('#cityGuide').waitFor({state:'visible'});await mobile.getByRole('button',{name:'გზამკვლევის დახურვა',exact:true}).click();await mobile.locator('#vehicleButton').waitFor({state:'visible'});
  await desktop.locator('[aria-controls=worldPhone]').click();await desktop.getByRole('button',{name:'🧟 ზომბების ათი ტალღა',exact:true}).click();await desktop.getByRole('button',{name:'ლობის შექმნა',exact:true}).click();const mobileName=await mobile.evaluate(()=>window.GaicaniCityGameBridge.getSelf().name);await desktop.locator('.world-invite-list button').filter({hasText:mobileName}).click();await mobile.getByRole('button',{name:'მიღება',exact:true}).click();await desktop.getByRole('button',{name:'დაწყება · 2/6',exact:true}).click();await mobile.waitForTimeout(5500);
  const r=[...engine.rooms.values()][0];for(const e of r.zombie.enemies)Object.assign(e,{speed:0,path:[],routeAt:Infinity,x:1500,y:360});
  for(const [w,h]of [[320,568],[390,844],[568,320],[667,375],[844,390]]){await mobile.setViewportSize({width:w,height:h});await check(w+' zombie');await mobile.getByRole('button',{name:'მატჩის დეტალების გაშლა',exact:true}).click();await check(w+' zombie expanded');await mobile.getByRole('button',{name:'მატჩის დეტალების შეკეცვა',exact:true}).click();}
  await mobile.screenshot({path:path.join(output,'nonoverlap-zombies-landscape.png')});
  if(errors.length)throw Error(JSON.stringify(errors));console.log('PASS: pairwise visible control collision checks across nine portrait/landscape phone/tablet sizes, car proximity/expanded options, minimized windows, actual vehicle entry/exit, expanded garden controls, and zombie compact/expanded HUD with fire controls. No page errors or overflow.');
 } finally {await browser.close();clearInterval(ticker);await new Promise(r=>io.close(r));server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
