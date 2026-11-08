/* Original code-native pixel species; all citizens use their authoritative position. */
(function(root){
 'use strict';
 function draw(ctx,c,at){
  const moving=c.action==='walk',work=['water','repair','music','practice'].includes(c.action),phase=Math.sin(at/140+c.id.length),trip=c.action==='trip';
  ctx.save();ctx.translate(Math.round(c.x),Math.round(c.y));if(trip)ctx.rotate(.35);ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#08091588';ctx.beginPath();ctx.ellipse(0,5,9,3,0,0,Math.PI*2);ctx.fill();
  const bob=moving?Math.abs(phase)*-1:c.action==='dance'?Math.sin(at/150)*2:0;ctx.translate(0,bob);
  ctx.fillStyle='#f6cc4d';ctx.fillRect(-6,-16,12,15);ctx.fillRect(-8,-13,16,9);ctx.fillRect(-5,-18,10,3);
  ctx.fillStyle='#ffe78d';ctx.fillRect(-5,-16,10,5);ctx.fillRect(-7,-12,2,7);
  ctx.fillStyle=c.color;ctx.fillRect(-6,-5,12,6);ctx.fillRect(-5,0,4,3);ctx.fillRect(1,0,4,3);
  ctx.fillStyle='#db9c3d';ctx.fillRect(-5,3+(moving?phase:0),4,3);ctx.fillRect(1,3-(moving?phase:0),4,3);
  const idle=!moving&&!work&&c.action!=='sleep',stretch=idle&&Math.floor(at/1000+c.id.length)%19===0,scratch=idle&&c.mood==='curiosity'&&Math.floor(at/1000)%7<2;const hand=c.action==='wave'||stretch?-6:scratch?-4:work?-3:0;ctx.fillStyle='#f6d65b';ctx.fillRect(-10,-7+(moving?phase*2:hand),3,4);ctx.fillRect(7,-7+(work?Math.sin(at/180)*3:c.action==='wave'?-7:0),3,4);
  const blink=Math.floor((at+c.id.length*149)/170)%30===0||c.action==='sleep';
  ctx.fillStyle='#fff9de';ctx.fillRect(-5,-13,4,5);ctx.fillRect(1,-13,4,5);ctx.fillStyle='#3e354b';
  if(blink){ctx.fillRect(-5,-10,4,1);ctx.fillRect(1,-10,4,1);}else{const gaze=c.dir==='left'?-1:c.dir==='right'?1:0;ctx.fillRect(-4+gaze,-12,2,3);ctx.fillRect(2+gaze,-12,2,3);ctx.fillStyle='#fff';ctx.fillRect(-4+gaze,-12,1,1);ctx.fillRect(2+gaze,-12,1,1);}
  ctx.fillStyle='#e4a26a';ctx.fillRect(-7,-8,2,2);ctx.fillRect(5,-8,2,2);ctx.fillStyle='#70513e';ctx.fillRect(-1,-6,2,1);
  ctx.fillStyle='#685046';if(c.hair==='tuft'){ctx.fillRect(-2,-21,3,4);ctx.fillRect(0,-22,2,3);}if(c.hair==='curl'){ctx.fillRect(-6,-19,5,3);ctx.fillRect(-7,-17,2,3);}if(c.hair==='bob'){ctx.fillRect(-7,-18,14,3);ctx.fillRect(-8,-16,2,5);ctx.fillRect(6,-16,2,5);}
  if(c.accessory==='goggles'){ctx.strokeStyle='#4798b8';ctx.lineWidth=1;ctx.strokeRect(-6,-14,12,6);}if(c.accessory==='cap'){ctx.fillStyle='#559478';ctx.fillRect(-6,-20,11,4);ctx.fillRect(-9,-17,15,2);}if(c.accessory==='bow'){ctx.fillStyle='#ed80bb';ctx.fillRect(3,-21,3,4);ctx.fillRect(7,-21,3,4);ctx.fillRect(6,-19,2,2);}
  if(c.action==='repair'||c.action==='practice'){ctx.fillStyle='#abc7df';ctx.fillRect(9,-7,2,8);ctx.fillRect(7,-9,6,3);}if(c.action==='water'){ctx.fillStyle='#75c9b6';ctx.fillRect(8,-7,6,5);ctx.fillStyle='#94ddec';ctx.fillRect(15,-3,2,2);}if(c.action==='music'||c.action==='dance'){ctx.fillStyle='#f9cf76';ctx.font='9px system-ui';ctx.fillText('♪',10,-18-Math.sin(at/200)*3);}if(c.action==='sleep'){ctx.fillStyle='#cbbee7';ctx.font='8px system-ui';ctx.fillText('ზ',8,-18-Math.sin(at/500)*2);}
  if(['annoyance','frustration','resentment'].includes(c.mood)){ctx.fillStyle='#66503d';ctx.fillRect(-5,-15,4,1);ctx.fillRect(1,-15,4,1);}if(c.mood==='fear'){ctx.strokeStyle='#f3ae86';ctx.strokeRect(-10,-20,20,25);}
  ctx.restore();
  ctx.save();ctx.textAlign='center';ctx.font='700 8px system-ui';ctx.fillStyle='#ffe7a0';ctx.fillText(c.name+' · AI',c.x,c.y-27);
  if(c.bubble){
   ctx.font='11px system-ui';const lines=[];let line='';
   for(const word of c.bubble.text.split(/\s+/)){const candidate=line?line+' '+word:word;if(line&&ctx.measureText(candidate).width>220){lines.push(line);line=word;}else line=candidate;}if(line)lines.push(line);
   const width=Math.min(240,Math.max(80,...lines.map(t=>ctx.measureText(t).width+16))),height=lines.length*15+12,top=c.y-36-height;
   ctx.fillStyle='#242038ee';ctx.fillRect(c.x-width/2,top,width,height);ctx.fillStyle='#fff3d8';lines.forEach((text,i)=>ctx.fillText(text,c.x,top+15+i*15,width-12));
  }
  for(const p of c.projects){ctx.fillStyle='#e5bd63';ctx.fillRect(p.x-7,p.y-10,14,10);ctx.fillStyle=c.color;ctx.fillRect(p.x-5,p.y-15,10,5);ctx.fillStyle='#f9e3af';ctx.font='8px system-ui';ctx.fillText(p.name,p.x,p.y-20);}
  ctx.restore();
 }
 root.GaicanianArt={draw};
})(window);
