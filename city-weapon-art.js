/* Pixel weapons face right; the caller supplies the character's position and aim rotation. */
(function(root){
 'use strict';
 function draw(ctx,weapon){
  const id=weapon?.id||'duel-carbine',dark='#202437',steel='#b2c3d1',wood='#bd7950';
  const box=(x,y,w,h,color)=>{ctx.fillStyle=dark;ctx.fillRect(x-1,y-1,w+2,h+2);ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  const mag=(x,y,color=dark)=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+5,y);ctx.lineTo(x+7,y+7);ctx.lineTo(x+4,y+10);ctx.lineTo(x,y+8);ctx.closePath();ctx.fill();};
  const grip=(x=10)=>box(x,1,4,6,'#5c5365');
  ctx.save();ctx.imageSmoothingEnabled=false;
  switch(id){
   case 'pistol':
    grip();box(7,-4,12,4,'#9faac4');box(18,-3,3,2,steel);break;
   case 'beretta':
    grip(11);box(7,-5,16,4,'#e0e5ef');box(11,-6,6,1,steel);box(20,-3,5,2,steel);break;
   case 'uzi':
    box(3,-2,6,2,'#8995a6');box(8,-6,13,6,'#6b8190');box(13,0,4,10,'#c0cbd1');box(21,-4,5,3,steel);box(10,-9,3,2,steel);break;
   case 'mp5':
    box(1,-4,7,3,'#516985');grip();box(8,-5,14,5,'#859fb2');box(21,-4,7,3,'#48566b');box(27,-3,4,2,steel);mag(17,1,'#b0baca');box(11,-8,4,2,'#59718a');break;
   case 'aks74u':
    box(0,-4,8,2,'#b6c0cc');grip();box(8,-5,12,5,'#778777');box(20,-4,7,4,wood);box(27,-3,3,2,steel);mag(17,1,wood);break;
   case 'ak47':
    box(-1,-4,9,5,wood);grip();box(8,-5,14,5,'#626d76');box(22,-5,8,4,wood);box(30,-3,6,2,steel);box(29,-7,2,3,steel);mag(18,1,'#d49a59');break;
   case 'm4':
    box(-2,-5,8,5,'#6e8e9c');box(5,-3,4,2,steel);grip();box(9,-5,13,5,'#7d9ca7');box(22,-5,9,4,'#425a68');box(31,-3,6,2,steel);box(14,-9,7,2,steel);box(17,1,5,8,'#758b91');break;
   case 'scar':
    box(-2,-5,10,6,'#cfa26b');grip();box(8,-6,21,6,'#e6bd7d');box(14,-10,7,3,'#59798b');box(29,-4,8,3,steel);box(19,1,6,7,'#b88e5d');box(26,-4,2,2,dark);break;
   case 'pkm':
    box(-3,-4,11,5,wood);grip();box(8,-6,17,6,'#859e75');box(25,-4,17,3,steel);box(14,1,11,8,'#79964e');box(12,-9,8,2,steel);box(32,-2,2,9,steel);box(36,-2,2,7,steel);break;
   case 'minigun':
    grip(8);box(3,-7,17,11,'#97a9ba');box(7,4,10,6,'#d0a44d');box(10,-11,8,3,steel);
    for(const y of [-6,-2,2])box(20,y,22,2,y===-2?'#e5d1a4':'#8b99aa');box(26,-7,3,12,'#c4a669');box(37,-7,3,12,'#c4a669');break;
   default:
    box(1,-4,7,4,'#796d9e');grip();box(8,-5,15,5,'#b6c4e1');box(23,-3,8,2,steel);box(17,1,5,6,'#796d9e');break;
  }
  // A small supporting hand makes the held silhouette read clearly against the street.
  box(9,3,3,3,'#e9bc91');ctx.restore();
 }
 root.GaicaniCityWeaponArt={draw};
})(window);
