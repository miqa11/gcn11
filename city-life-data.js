/* Shared street-life schedule and animal motion. Cosmetic objects never become walls. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.GaicaniCityLifeData=value;})(typeof window==='undefined'?globalThis:window,()=>{
 const duration=240000,beatMs=1200;
 const events=[
  {kind:'cleanup',title:'ერთად მოვუაროთ ქალაქს',description:'აიღე მონიშნული ნარჩენები. ყველა მოთამაშე ერთ საერთო მიზანს ავსებს.',label:'ჩრდილოეთის ქუჩა',x:745,y:360,goal:12,icon:'♻'},
  {kind:'concert',title:'თამარის ქუჩის კონცერტი',description:'მიდი მუსიკოსთან და დაუკარი ტაში განათებულ რიტმზე. ქალაქის ტაში ერთ საერთო მიზანს ავსებს.',label:'თამარის მუსიკალური კუთხე',x:448,y:760,goal:12,icon:'♫'}
 ];
 const litter=Array.from({length:12},(_,i)=>({id:'litter-'+i,x:620+(i%6)*50,y:i<6?335:385}));
 function animalAt(a,at){const phase=a.phase||0;return {...a,x:a.x+Math.sin(at/1650+phase)*(a.roamX||0),y:a.y+Math.cos(at/1380+phase)*(a.roamY||0),dir:Math.cos(at/1650+phase)<0?-1:1};}
 function beat(at){return Math.abs((at%beatMs)-beatMs/2)<=250;}
 return {duration,beatMs,events,litter,animalAt,beat};
});
