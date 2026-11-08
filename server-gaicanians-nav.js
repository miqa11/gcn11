'use strict';
// Cached walkable grid with bounded grid search; routes are validated again while walking.
function createNavigation(world,size=24){
 const width=Math.ceil(world.width/size),height=Math.ceil(world.height/size),walk=new Uint8Array(width*height),cache=new Map();
 const point=i=>({x:(i%width)*size+size/2,y:Math.floor(i/width)*size+size/2});
 for(let i=0;i<walk.length;i++){const p=point(i);walk[i]=world.isWalkable(p.x,p.y,8)?1:0;}
 function clear(a,b){const n=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/4);for(let k=1;k<=n;k++)if(!world.isWalkable(a.x+(b.x-a.x)*k/n,a.y+(b.y-a.y)*k/n,8))return false;return true;}
 function cell(p){const x=Math.floor(p.x/size),y=Math.floor(p.y/size);for(let r=0;r<=4;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const nx=x+dx,ny=y+dy,i=ny*width+nx;if(nx>=0&&ny>=0&&nx<width&&ny<height&&walk[i]&&clear(p,point(i)))return i;}return -1;}
 function route(a,b){
  if(clear(a,b))return [{x:b.x,y:b.y}];const start=cell(a),end=cell(b);if(start<0||end<0)return [];
  const key=start+':'+end;if(cache.has(key)){const saved=cache.get(key);if(saved.length&&clear(a,saved[0])&&clear(saved[saved.length-1],b))return saved.map(p=>({...p})).concat({x:b.x,y:b.y});cache.delete(key);}
  const queue=[start],parents=new Int32Array(walk.length).fill(-1);parents[start]=start;
  for(let head=0;head<queue.length&&head<25000;head++){
   const i=queue[head];if(i===end)break;const x=i%width,y=Math.floor(i/width);
   for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*width+nx;if(nx<0||ny<0||nx>=width||ny>=height||!walk[j]||parents[j]>=0||!clear(point(i),point(j)))continue;parents[j]=i;queue.push(j);}
  }
  if(parents[end]<0)return [];const path=[];let i=end;while(i!==start){path.push(point(i));i=parents[i];}path.push(point(start));path.reverse();
  const simple=[];let from=a;for(let j=0;j<path.length;){let far=j;for(let k=j+1;k<Math.min(path.length,j+30)&&clear(from,path[k]);k++)far=k;simple.push(path[far]);from=path[far];j=far+1;}
  if(cache.size>100)cache.delete(cache.keys().next().value);cache.set(key,simple);return simple.map(p=>({...p})).concat({x:b.x,y:b.y});
 }
 return {route,clear};
}
module.exports={createNavigation};
