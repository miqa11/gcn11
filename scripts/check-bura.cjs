// Real Bura server module and page scripts; local test accounts and controlled hands only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),express=require('express'),{Server}=require('socket.io'),{chromium}=require('playwright');
const repo=path.resolve(__dirname,'..'),G=require(path.join(repo,'bura-game'));
const output=process.env.BURA_QA_OUTPUT||path.join(require('node:os').tmpdir(),'gaicani-bura');
const names=['ნიკოლოზი','მარიამი','გიორგი'];
(async()=>{
 fs.mkdirSync(output,{recursive:true});const app=express(),server=http.createServer(app),io=new Server(server),users=new Map(names.map((username,i)=>[username,{username,coins:1000,avatar:`avatar${i+1}.png`}]));
 app.use(express.json());app.post('/api/auth/verify',(q,r)=>r.json({success:true,username:q.body.token,friends:[],coins:1000,avatar:'avatar1.png'}));app.use('/api',(_q,r)=>r.json({success:true,coins:1000,friends:[],pendingRequests:[],profiles:[],messages:[],avatars:{}}));
 let seed=123;const rng=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
 const bura=require(path.join(repo,'server-bura')).createBura({io,registeredUsers:users,spendableCoins:u=>u.coins,changeCoins:(u,_lc,n)=>{u.coins+=n;},saveAuthUsers:()=>{},isVisiblyOnline:lc=>[...io.sockets.sockets.values()].some(s=>s._regUser?.usernameLower===lc),rng,botMs:8000,roundMs:15000});
 io.on('connection',s=>{const auth=d=>{const name=typeof d==='string'?d:d?.token;if(!users.has(name))return;s._regUser={usernameLower:name,username:name};s.join('user:'+name);s.emit('auth:authenticated',{username:name,friends:[],pendingRequests:[],avatar:users.get(name).avatar,isGuest:false});io.emit('users:onlineChanged');};s.on('auth:token',auth);s.on('auth:login',auth);s.on('users:listOnline',()=>s.emit('users:onlineList',{users:[...users.values()].filter(u=>[...io.sockets.sockets.values()].some(sk=>sk._regUser?.usernameLower===u.username))}));bura.attach(s);});
 require(path.join(repo,'server-assets')).mountAssets(app,{root:repo});app.use(express.static(repo));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:process.env.CITY_QA_CHROME||undefined,headless:true}),errors=[];
 async function client(name,pageName){const ctx=await browser.newContext({viewport:{width:1280,height:850},hasTouch:true});await ctx.addInitScript(name=>{localStorage.setItem('gaicani_auth_token',name);localStorage.setItem('gaicani_auth_user',name);},name);const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(`${base}/${pageName}`);return p;}
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 function push(r){r.version++;for(const p of r.players)if(p.socketId)io.sockets.sockets.get(p.socketId)?.emit('bura:room',bura.viewForPlayer(r,p));}
 function fixture(r,phase='lead',seat=0){G.startRound(r.game,seat,rng);const g=r.game,round=g.round;g.score=[3,4];g.finished=false;g.winner=null;round.phase=phase;round.result=null;round.trump='s';round.trumpCard='Qs';round.hands=[['Ah','Kh','Th'],['As','Ts','Ks']];round.currentCall=null;round.lastRaiser=null;round.pendingCall=null;round.turnSeat=seat;round.crawford=false;round.captured=[[],[]];round.history=[];round.trick=phase==='respond'?{leaderSeat:1-seat,ledCards:['Qh','Jh','Td']}:null;r.deadline=Date.now()+30000;r.version++;push(r);}
 async function bounds(p,selectors,label){const r=await p.evaluate(selectors=>{const boxes=selectors.flatMap(selector=>[...document.querySelectorAll(selector)].filter(e=>e.getClientRects().length&&!e.hidden&&getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return {selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));return {boxes,w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollWidth};},selectors);for(const b of r.boxes)assert(b.x>=-1&&b.y>=-1&&b.right<=r.w+1&&b.bottom<=r.h+1,label+' '+JSON.stringify(b));assert(r.scroll<=r.w,label+' page overflow');}
 try{
  const a=await client(names[0],'bura.html'),b=await client(names[1],'dashboard.html#games');await a.locator('#loading').waitFor({state:'hidden'});await b.locator('a[href="/bura.html"]').waitFor();
  await a.click('#createBtn');await a.locator('#lobbyScreen.active').waitFor();await a.locator('#inviteList label').filter({hasText:names[1]}).locator('input').check();await a.click('#sendInvites');await b.locator('#dgInviteBar.show .bu-invite-accept').waitFor();await b.click('#dgInviteBar .bu-invite-accept');await b.locator('#lobbyScreen.active').waitFor();const r=[...bura.rooms.values()][0];assert.equal(r.pending.size,0);assert.equal(users.get(names[0]).coins,1000);
  await b.locator('#lobbyScreen.active').waitFor();await a.click('#readyBtn');assert.equal(users.get(names[0]).coins,1000);await b.click('#readyBtn');await a.locator('#gameScreen.active').waitFor();assert.equal(users.get(names[0]).coins,970);assert.equal(users.get(names[1]).coins,970);
  fixture(r);await pause(250);await a.screenshot({path:path.join(output,'bura-desktop.png')});
  assert.deepEqual(await a.locator('#score .bu-score-player').allTextContents(),[names[0]+'3',names[1]+'4']);
  assert.deepEqual(await b.locator('#score .bu-score-player').allTextContents(),[names[1]+'4',names[0]+'3']);
  assert.equal(await a.locator('#score .bu-score-vs').textContent(),'vs');
  assert.equal(await a.locator('.bu-score-caption').textContent(),'თამაში ჯამში 11-მდე.');
  r.game.round.deck=['Jc','Qd','Qs'];
  await a.locator('[data-card="Ah"]').click();await a.click('#leadBtn');await pause(250);assert.equal(r.game.round.phase,'respond');await b.locator('[data-card="Ts"]').click();await b.click('#cutBtn');await a.locator('#trickArea .bu-trick-pair').waitFor();
  assert.equal(await a.locator('#trickArea .bu-card-el').count(),2);
  await b.locator('#trickArea .bu-trick-pair').waitFor();
  assert(await b.locator('#leadBtn').isHidden());
  assert.equal(await b.locator('#myHand [data-card]').count(),2);
  await b.getByRole('button',{name:'გაგრძელება',exact:true}).click();
  await b.locator('[data-card="Ks"]').click();await b.click('#leadBtn');
  await pause(2150);
  assert.equal(r.game.round.phase,'respond');
  assert.equal(await a.locator('#trickArea .bu-card-el').count(),1);
  fixture(r);r.game.round.hands[1]=['Qd','Jc','Ac'];push(r);await pause(200);
  for(const c of ['Ah','Kh','Th'])await a.locator(`[data-card="${c}"]`).click();
  await a.click('#leadBtn');await pause(200);
  for(const c of ['Qd','Jc','Ac'])await b.locator(`[data-card="${c}"]`).click();
  await b.click('#discardBtn');
  for(const [seat,page] of [a,b].entries()){
   await page.locator('#trickArea .bu-trick-pair > .bu-back').first().waitFor();
   await page.waitForFunction(()=>[...document.querySelectorAll('#trickArea [data-table-card]')].every(card=>!card.getAnimations().length));
   assert.deepEqual(G.viewForSeat(r.game,seat).history[0].responseCards,[null,null,null]);
   assert.equal(await page.locator('#trickArea .bu-trick-pair').count(),3);
   assert.equal(await page.locator('#trickArea .bu-card-el').count(),3);
   const lead=await page.locator('.bu-trick-pair > .bu-card-el').first().boundingBox(),back=await page.locator('.bu-trick-pair > .bu-back').first().boundingBox();
   assert(back.x>lead.x&&back.x<lead.x+lead.width&&back.y>lead.y&&back.y<lead.y+lead.height);
  }
  await b.screenshot({path:path.join(output,'bura-discard.png')});
  await pause(1250);
  push(r); // A repeated room update must not extend the completed trick's display.
  await Promise.all([a,b].map(page=>page.locator('#trickArea .bu-table-cards').first().waitFor({state:'detached',timeout:1100})));
  assert.equal(r.game.round.phase,'collect');
  assert(await a.getByRole('button',{name:'გაგრძელება',exact:true}).isVisible());
  await b.reload();await b.locator('#gameScreen.active').waitFor();
  assert.equal(await b.locator('#trickArea .bu-table-cards').count(),0);
  fixture(r,'lead',1);
  await a.setViewportSize({width:568,height:320});
  for(const c of ['Ah','Kh','Th'])await a.locator(`[data-card="${c}"]`).click();
  await a.click('#leadBtn');await b.locator('#discardBtn:visible').waitFor();assert.deepEqual(r.game.round.trick.ledCards,['Ah','Kh','Th']);
  await b.click('#callBtn');await a.locator('#acceptBtn:visible').waitFor();await a.click('#acceptBtn');
  await b.locator('#discardBtn:visible').waitFor();assert.equal(r.game.round.phase,'respond');
  fixture(r);await pause(200);await a.click('#callBtn');await b.locator('#acceptBtn:visible').waitFor();await b.click('#raiseBtn');await a.locator('#acceptBtn:visible').waitFor();await a.click('#acceptBtn');await pause(200);assert.equal(r.game.round.currentCall,'se');
  await a.locator('[data-dialog="chatDialog"]').last().click();await a.fill('#chatInput','წარმატებები!');await a.locator('#chatForm button').click();await b.locator('[data-dialog="chatDialog"]').last().click();await b.getByText('წარმატებები!',{exact:true}).waitFor();await a.locator('#chatDialog [data-close]').click();await b.locator('#chatDialog [data-close]').click();
  for(const [w,h] of [[844,390],[667,375],[568,320],[390,844],[320,568]]){
   await a.setViewportSize({width:w,height:h});fixture(r);await pause(300);
   for(const c of ['Ah','Kh','Th'])await a.locator(`[data-card="${c}"]`).click();await bounds(a,['#myHand .bu-card-el','[data-action]','#opponent','#score'],`lead ${w}x${h}`);await a.screenshot({path:path.join(output,`bura-${w}x${h}.png`)});
   fixture(r,'respond',0);await pause(250);for(const c of ['Ah','Kh','Th'])await a.locator(`[data-card="${c}"]`).click();await bounds(a,['#cutBtn','#discardBtn','#trickArea .bu-card-el'],'response');
   fixture(r);await pause(200);await a.click('#callBtn');await b.locator('#acceptBtn:visible').waitFor();await b.click('#raiseBtn');await a.locator('#acceptBtn:visible').waitFor();await bounds(a,['#acceptBtn','#concedeBtn','#raiseBtn'],'bid response');
   fixture(r);r.game.round.crawford=true;push(r);await pause(200);assert(await a.locator('#callBtn').isHidden());
   await a.locator('[data-dialog="rulesDialog"]').last().click();await bounds(a,['#rulesDialog [data-close]'],'rules dialog close');await a.locator('#rulesDialog [data-close]').click();
  }
  await a.setViewportSize({width:844,height:390});fixture(r);r.game.round.captured[0]=['As','Ts','Ac'];push(r);await pause(200);await a.click('#varBtn');await a.locator('#roundResult:not(.hidden)').waitFor();await a.click('#historyBtn');await a.locator('#historyBody .bu-history-row').waitFor();await a.screenshot({path:path.join(output,'bura-history-landscape.png')});await a.locator('#historyDialog [data-close]').click();
  for(const [page,label] of [[a,'შენ'],[b,names[0]]]){
   assert.equal(await page.locator('#roundResult h3').textContent(),names[0]+' +1');
   const reveal=page.locator('#trickArea .bu-var-reveal');
   await reveal.getByText(label+' · „ვარ!“ · 32 ქულა',{exact:true}).waitFor();
   assert.equal(await reveal.locator('.bu-card-el').count(),3);
  }
  await a.setViewportSize({width:320,height:568});await b.setViewportSize({width:568,height:320});
  fixture(r,'lead',1);r.game.round.captured[1]=['Jd','Qd'];push(r);await b.click('#varBtn');
  await a.locator('#trickArea').getByText(names[1]+' · „ვარ!“ · 5 ქულა',{exact:true}).waitFor();
  assert.equal(await a.locator('#trickArea .bu-var-reveal .bu-card-el').count(),2);
  assert.equal(r.game.round.result.winner,0);
  fixture(r,'lead',1);r.game.round.captured[1]=require('../bura-engine').buildDeck().slice(0,18);push(r);await b.click('#varBtn');
  for(const [page,label] of [[a,names[1]],[b,'შენ']]){
   const reveal=page.locator('#trickArea .bu-var-reveal');
   await reveal.getByText(label+' · „ვარ!“ · 99 ქულა',{exact:true}).waitFor();
   assert.equal(await reveal.locator('.bu-card-el').count(),18);
   await page.waitForFunction(()=>[...document.querySelectorAll('.bu-var-reveal [data-table-card]')].every(card=>!card.getAnimations().length));
   const size=await reveal.evaluate(el=>({scroll:el.scrollHeight,height:el.clientHeight,width:el.clientWidth}));
   assert(size.scroll<=size.height+1,label+' '+JSON.stringify(size));
   await bounds(page,['#trickArea .bu-var-reveal'],'Var reveal');
   await page.screenshot({path:path.join(output,'bura-var-'+label+'.png')});
  }
  fixture(r,'respond',1);await b.locator('#trickArea .bu-table-cards').waitFor();
  a.once('dialog',d=>d.accept());await a.click('#gameBack');await b.locator('#againBtn:not(.hidden)').waitFor();assert.equal(await b.locator('#trickArea .bu-table-cards').count(),0);assert.equal(users.get(names[0]).coins,970);assert.equal(users.get(names[1]).coins,1028);assert.equal(bura.rankings()[0].username,names[1]);
  await a.locator('#setupScreen.active').waitFor();await a.click('#rankingBtn');await a.locator('#rankingBody table').waitFor();await a.locator('#rankingDialog [data-close]').click();
  await a.click('#botBtn');await a.locator('#gameScreen.active').waitFor();const bot=[...bura.rooms.values()].find(r=>r.bot);assert(bot);assert.equal(users.get(names[0]).coins,970);await a.evaluate(()=>localStorage.setItem('gaicani_site_theme','midnight'));
  const before=bot.players[0].socketId;await a.reload();await a.locator('#gameScreen.active').waitFor();assert.equal(await a.locator('html').getAttribute('data-gc-theme'),null);assert.notEqual(bot.players[0].socketId,before);assert.equal(users.get(names[0]).coins,970);
  assert.deepEqual(errors,[]);console.log('PASS: dashboard invitation/acceptance, two-player readiness and escrow, lead/cut, face-down discard for both seats, timed trick clearing and reconnect, counteroffers, chat, Var/results, forfeit/settlement/rankings, free bot reconnect and chat theme isolation; desktop and five phone sizes. '+output);
 }finally{bura.close();await browser.close();await new Promise(r=>io.close(r));server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
