'use strict';
const {createNavigation}=require('./server-gaicanians-nav');
const combat=require('./city-combat');
function difficulty(wave,count){return {count:4+wave*2+count,hp:35+wave*18,speed:48+wave*7,damage:7+wave*2};}
function bossDifficulty(wave,count){const d=difficulty(wave,count);return {hp:Math.round(d.hp*(4+wave*.25)*(1+.35*(count-2))),speed:d.speed*1.2+wave*2,damage:Math.round(d.damage*1.6+wave)};}
const weapon=combat.zombieWeapon;
function createZombieMatch({room:r,players,world,garage,now=Date.now,onFinish,onShot}){
 const history=[],nav=createNavigation(world),z={wave:0,phase:'break',nextAt:r.startAt,enemies:[],serial:0,lastAt:now()};r.zombie=z;
 for(const id of r.ids)Object.assign(r.stats[id],{hp:100,out:false,kills:0});
 function snapshot(){const at=now();history.push({at,positions:new Map(z.enemies.map(e=>[e.id,{x:e.x,y:e.y}]))});while(history.length>8||history[0]?.at<at-500)history.shift();return {at,wave:z.wave,totalWaves:10,phase:z.phase,nextAt:z.nextAt,weapon:weapon(Math.max(1,z.phase==='break'?Math.min(10,z.wave+1):z.wave)),enemies:z.enemies.map(e=>({id:e.id,x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,kind:e.kind}))};}
 function spawn(){
  history.length=0;z.wave++;z.phase='wave';const d=difficulty(z.wave,r.ids.length);z.enemies=[];
  // Spawn only on real walkable ground, outside an immediate melee radius.
  const team=r.ids.map(id=>players.get(id)).filter(Boolean);
  for(let i=0;i<d.count;i++){
   const target=team[i%team.length];let at=null;
   for(let j=0;j<32;j++){const angle=(i*2.399+j*.7),radius=180+(j%4)*30,p={x:target.x+Math.cos(angle)*radius,y:target.y+Math.sin(angle)*radius};
    if(world.isWalkable(p.x,p.y,10)&&nav.route(p,target).length&&team.every(t=>Math.hypot(t.x-p.x,t.y-p.y)>110)&&!garage.list().some(v=>Math.hypot(v.x-p.x,v.y-p.y)<50)){at=p;break;}}
   if(!at)at={x:540+(i%12)*70,y:360};
   const heavy=z.wave>=4&&i%5===0,hp=Math.round(d.hp*(heavy?1.7:1));z.enemies.push({id:r.id+'-z'+(++z.serial),...at,hp,maxHp:hp,kind:heavy?'heavy':'walker',speed:d.speed*(heavy?.8:1),damage:d.damage+(heavy?5:0),path:[],routeAt:0,attackAt:0});
  }
 }
 function spawnBoss(){
  const d=bossDifficulty(z.wave,r.ids.length),target=players.get(r.ids.find(id=>r.stats[id].hp>0));let at=null;
  for(let j=0;j<64;j++){const a=j*2.399,p={x:target.x+Math.cos(a)*(180+j%4*25),y:target.y+Math.sin(a)*(180+j%4*25)};if(world.isWalkable(p.x,p.y,10)&&nav.route(p,target).length){at=p;break;}}
  if(!at)at={x:target.x,y:target.y+32};
  if(!world.isWalkable(at.x,at.y,8))at={x:target.x,y:target.y};
  z.phase='boss';z.enemies=[{id:r.id+'-boss'+z.wave,...at,...d,maxHp:d.hp,kind:'boss',path:[],routeAt:0,attackAt:now()+1000}];history.length=0;
 }
 function clear(a,b,radius=2){const count=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/5);for(let i=1;i<=count;i++)if(!world.isWalkable(a.x+(b.x-a.x)*i/count,a.y+(b.y-a.y)*i/count,radius))return false;return true;}
 function tick(){
  const at=now(),dt=Math.max(0,Math.min(200,at-z.lastAt));z.lastAt=at;
  if(r.phase!=='playing')return;
  if(z.phase==='break'){if(at>=z.nextAt)spawn();return;}
  const live=r.ids.filter(id=>players.has(id)&&r.stats[id].hp>0&&!r.stats[id].out);
  if(!live.length){z.enemies=[];onFinish([], 'ჯგუფი დამარცხდა. ჯილდოსთვის ათივე ტალღა უნდა დაასრულოთ.');return;}
  for(const e of z.enemies){
   const target=live.map(id=>players.get(id)).sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y))[0];
   if(at>=e.routeAt||e.targetId!==target.id){e.targetId=target.id;e.path=nav.route(e,target);e.routeAt=at+1500;}
   let budget=e.speed*dt/1000;
   while(e.path.length&&budget>0){const point=e.path[0],distance=Math.hypot(point.x-e.x,point.y-e.y),step=Math.min(distance,budget);if(distance<1){e.path.shift();continue;}const next={x:e.x+(point.x-e.x)/distance*step,y:e.y+(point.y-e.y)/distance*step};if(!clear(e,next,8)){e.path=[];e.routeAt=0;break;}e.x=next.x;e.y=next.y;budget-=step;if(step>=distance)e.path.shift();}
   const stat=r.stats[target.id];if(stat.hp>0&&Math.hypot(e.x-target.x,e.y-target.y)<(e.kind==='boss'?40:27)&&at>=e.attackAt&&clear(e,target)){
    e.attackAt=at+(e.kind==='boss'?800:1000);stat.hp=Math.max(0,stat.hp-e.damage);if(!stat.hp){stat.out=true;target.worldFrozen=true;target.inputX=target.inputY=0;}
   }
  }
  if(!z.enemies.length){
   if(z.phase==='wave'){spawnBoss();return;}
   if(z.wave===10){onFinish([...r.ids],'ათი ტალღა დასრულდა! თითო რეგისტრირებულ მონაწილეს 50 000 მონეტა.',true);return;}
   z.phase='break';z.nextAt=at+10000;
   for(const id of r.ids){const p=players.get(id),s=r.stats[id];s.hp=100;s.out=false;if(p)p.worldFrozen=false;}
  }
 }
 function shoot(id,data){
  const p=players.get(id),s=r.stats[id],at=now(),gun=weapon(Math.max(1,z.wave));
  if(r.phase!=='playing'||at>=r.endAt||!['wave','boss'].includes(z.phase)||!p||!s||s.out||s.hp<=0)return {error:'სროლა ახლა შეუძლებელია.'};
  if(!Number.isFinite(data.angle)||Math.abs(data.angle)>Math.PI*2)return {error:'დამიზნება არასწორია.'};
  if(at-(s.lastShot??-Infinity)<gun.cooldown)return {error:'გადატენვა…',code:'COOLDOWN',retryAfterMs:gun.cooldown-(at-s.lastShot)};s.lastShot=at;s.aimAngle=data.angle;
  // Reconcile against a recently published frame, never a client-supplied target or damage value.
  const frame=Number.isFinite(data.observedAt)&&at-data.observedAt>=0&&at-data.observedAt<=300?history.findLast(f=>f.at===data.observedAt):null;
  const origin={...combat.muzzle(p),ground:p},targets=z.enemies.map(e=>{const pos=frame?.positions.get(e.id)||e,boss=e.kind==='boss';return {id:e.id,x:pos.x,y:pos.y-(boss?23:14),radius:boss?31:e.kind==='heavy'?23:20,ground:e};}),shot=combat.raycast(world,origin,data.angle,gun.range,targets),hit=z.enemies.find(e=>e.id===shot.hit?.id);
  if(hit){hit.hp=Math.max(0,hit.hp-gun.damage);if(!hit.hp){s.kills++;z.enemies=z.enemies.filter(e=>e!==hit);}}
  onShot({roomId:r.id,from:{x:origin.x,y:origin.y},to:shot.to,...combat.shotMeta(data,id,gun),hit:!!hit});
  return {ok:true,hit:!!hit,killed:!!hit&&!hit.hp};
 }
 return {tick,shoot,snapshot,clear:()=>{z.enemies=[];z.phase='finished';}};
}
module.exports={createZombieMatch,difficulty,bossDifficulty,weapon};
