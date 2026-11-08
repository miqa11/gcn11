/* Shared weapon descriptions and geometry; damage and targets are chosen only by the server. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GaicaniCityCombat=api;})(typeof window==='undefined'?globalThis:window,()=>{
 const guns=[
  ['pistol','პისტოლეტი',25,520,420,'pistol'],['beretta','ბერეტა',32,460,440,'pistol'],['uzi','უზი',38,360,460,'smg'],['mp5','მპ-5',46,300,480,'smg'],['aks74u','აკს-74უ',58,240,500,'rifle'],['ak47','აკ-47',72,200,520,'rifle'],['m4','მ4',90,170,540,'rifle'],['scar','სკარი',112,145,560,'rifle'],['pkm','პკმ',140,120,580,'heavy'],['minigun','მინიგანი',175,100,600,'heavy']
 ];
 function zombieWeapon(wave){const level=Math.max(1,Math.min(10,Number.isFinite(wave)?Math.floor(wave):1)),[id,name,damage,cooldown,range,kind]=guns[level-1];return {id,name,damage,cooldown,range,kind,level};}
 const battleWeapon={id:'duel-carbine',name:'დუელის კარაბინი',damage:1,cooldown:280,range:480,kind:'rifle',level:1};
 const muzzle=p=>({x:p.x,y:p.y-8});
 function clear(world,a,b){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));for(let i=1;i<=n;i++)if(!world.isWalkable(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n,2))return false;return true;}
 function raycast(world,origin,angle,range,targets){
  const dx=Math.cos(angle),dy=Math.sin(angle);let distance=range,hit=null;
  for(let d=0;d<=range;d+=3)if(!world.isWalkable(origin.x+dx*d,origin.y+dy*d,2)){distance=d;break;}
  const wallDistance=distance;distance=range;
  for(const target of targets){const x=target.x-origin.x,y=target.y-origin.y,along=x*dx+y*dy,r=target.radius||18,across2=x*x+y*y-along*along;if(across2>r*r)continue;const half=Math.sqrt(Math.max(0,r*r-across2));if(along+half<0)continue;const entry=Math.max(0,along-half);if(entry<distance&&(target.ground||entry<wallDistance)&&clear(world,origin.ground||origin,target.ground||target)){distance=entry;hit=target;}}
  if(!hit)distance=wallDistance;
  return {hit,to:{x:origin.x+dx*distance,y:origin.y+dy*distance}};
 }
 function shotMeta(data,shooterId,gun){return {shooterId,requestId:typeof data.requestId==='string'&&data.requestId.length<=48?data.requestId:null,weaponId:gun.id};}
 return {zombieWeapon,battleWeapon,muzzle,raycast,shotMeta};
});
