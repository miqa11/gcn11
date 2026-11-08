'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const world=require('../city-world'),vehicles=require('../city-vehicles'),prediction=require('../city-prediction');
const {createCityMotionController}=require('../server-city-motion');
const predictorLine=fs.readFileSync(path.join(__dirname,'../city.js'),'utf8').split('\n').find(line=>line.startsWith('const predictor='));
// Use the real browser wiring, not a test-created replacement for its obstacle list.
function browserPredictor(map,garage,players,driver){
 const sandbox={window:{GaicaniCityPrediction:prediction},W:map,fleet:new Map(garage.list().map(v=>[v.id,v])),remote:new Map([...players].filter(([id])=>id!==driver.id))};
 vm.runInNewContext(predictorLine+'\nglobalThis.result=predictor;',sandbox);return sandbox.result;
}
function drivePast(map,extraPlayer){
 let time=100000;const p={id:'driver',name:'Driver',x:980,y:780,dir:'right'},players=new Map([[p.id,p]]);if(extraPlayer)players.set(extraPlayer.id,extraPlayer);
 const garage=vehicles.createGarage(map,{players,now:()=>time});assert.ok(garage.enter(p,'night-taxi').ok);
 const motion=createCityMotionController(map,garage),client=browserPredictor(map,garage,players,p);client.accept(motion.view(p,time));
 for(let i=0;i<30;i++){
  time+=50;const predicted={...client.predict({x:1,y:0},50)},packet=client.drain(),actual=motion.process(p,packet,time);
  assert.ok(Math.abs(predicted.x-actual.x)<1e-8,'browser and server disagree on the obstacle');assert.ok(Math.abs(predicted.y-actual.y)<1e-8);client.accept(actual);
 }
 return {p,garage};
}
test('cars pass the real street taxi-driver NPC without client/server stopping or correction',()=>{
 const npc=world.npcs.find(n=>n.id==='dato');assert.equal(npc.y,780);
 const {p}=drivePast(world);assert.ok(p.x>npc.x+60,'car stopped at the stationary NPC');
});
test('garden NPCs also cannot become solid road barriers',()=>{
 const map={...world,npcs:[],garden:{...world.garden,npcs:[{id:'garden-visitor',x:1025,y:780}]}};
 assert.ok(drivePast(map).p.x>1085);
});
test('real players, other cars and buildings still stop vehicles',()=>{
 const pedestrian={id:'real-player',x:1025,y:780};const {p,garage}=drivePast(world,pedestrian);
 assert.ok(p.x<1000,'car crossed a real player');const taxi=garage.find('night-taxi'),building=world.buildings[0],other=garage.find('lada-2106');
 assert.equal(garage.canMove(taxi,building.x+building.w/2,building.y+building.h/2,0),false);
 assert.equal(garage.canMove(taxi,other.x,other.y,0),false);
});
test('ambient NPCs do not block temporary race-car spawning',()=>{
 const map={...world,npcs:[{id:'street-visitor',x:620,y:360}]},racers=[{id:'a',x:2200,y:1620},{id:'b',x:2280,y:1620}],players=new Map(racers.map(p=>[p.id,p]));
 const garage=vehicles.createGarage(map,{players});assert.ok(garage.spawnRaceCars('test-race',racers).origins);assert.equal(garage.list().filter(v=>v.worldGameId==='test-race').length,2);
});
