/* One-time City campaign; progress comes from completed, server-validated activities. */
(function(root,factory){const quests=factory();if(typeof module==='object'&&module.exports)module.exports=quests;if(root)root.GaicaniCityQuestsData=quests;})(typeof window==='undefined'?globalThis:window,()=>[
 {id:'river-angler',activity:'fishing',title:'მტკვრის მეთევზე',description:'დაიჭირე 5 თევზი მტკვრის სანაპიროზე.',goal:5,reward:7500,icon:'🎣',category:'აღმოჩენა'},
 {id:'garden-naturalist',activity:'bugs',title:'ბაღის მკვლევარი',description:'დაიჭირე 5 მწერი და შეავსე შენი კოლექცია.',goal:5,reward:7500,icon:'🦋',category:'აღმოჩენა'},
 {id:'city-courier',activity:'delivery',title:'სანდო კურიერი',description:'წარმატებით ჩააბარე 3 გზავნილი ქალაქში.',goal:3,reward:10000,icon:'📦',category:'სამუშაოები'},
 {id:'night-photographer',activity:'photography',title:'ნეონის ფოტოგრაფი',description:'გადაუღე ფოტო 3 განსხვავებულ ობიექტს ან თანახმა მოქალაქეს.',goal:3,reward:10000,icon:'📷',category:'აღმოჩენა'},
 {id:'rooftop-runner',activity:'parkour',title:'ეზოს ჩემპიონი',description:'დაასრულე პარკურის მარშრუტი ყველა რგოლში ახტომით.',goal:1,reward:7500,icon:'⚡',category:'თამაშები'},
 {id:'treasure-hunter',activity:'treasure',title:'ქალაქის საიდუმლო',description:'ამოხსენი მინიშნებები და გახსენი ერთი განძი.',goal:1,reward:7500,icon:'🗝',category:'აღმოჩენა'}
]);
