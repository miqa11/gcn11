'use strict';
const jobs={
 technician:{name:'არკადის ტექნიკოსი',skill:'repair',wage:5,site:'arcade',hours:[8,16]},
 gardener:{name:'მებაღე',skill:'gardening',wage:4,site:'garden',hours:[6,14]},
 musician:{name:'ქუჩის მუსიკოსი',skill:'music',wage:4,site:'stage',hours:[14,22]}
};
const places={
 arcade:{name:'არკადის შესასვლელი',x:1979,y:1130},garden:{name:'ნეონის ბაღის ჭიშკარი',x:1400,y:1740},
 stage:{name:'მუსიკოსების კუთხე',x:448,y:760},cafe:{name:'ღამის საცხობი',x:690,y:1195},
 square:{name:'ეზოს შეხვედრის ადგილი',x:1080,y:1740},homeLumo:{name:'ლუმოს ეზო',x:1850,y:1195},homeMiko:{name:'მიკოს ეზო',x:760,y:1740},homeNela:{name:'ნელას ეზო',x:525,y:760}
};
const residents=[
 {id:'lumo',name:'ლუმო ჭანჭიკა',nickname:'ლუმო',age:28,birthday:'04-12',home:'homeLumo',job:'technician',favorite:'square',color:'#70c9ef',accessory:'goggles',hair:'tuft',
  biography:'ძველ არკადასთან გაიზარდა. მამა მექანიკოსი იყო, დედა ღამის საცხობში მუშაობდა. მცირე სახელოსნოში სწავლობდა შეკეთებას; პირველი რადიო ვერ აამუშავა, მაგრამ შემდეგ საკუთარი პეიჯერი ააწყო. ხმაურიან შეკრებებში მორცხვია და ტექნიკაზე საუბრისას თამამდება.',
  household:'ცალკე პატარა ეზოში ცხოვრობს; ნელას ბიძაშვილია.',values:['სიზუსტე','დაპირების შესრულება'],fear:'საჯაროდ შეცდომის დაშვება',secret:'პირველი გაფუჭებული რადიო ჯერაც სახლში აქვს.',goal:{item:'workshop',name:'საკუთარი სახელოსნო',cost:120,skill:'repair',required:18},
  traits:{openness:.8,conscientiousness:.9,extraversion:.25,agreeableness:.65,sensitivity:.7},skills:{repair:3,music:0,gardening:0},
  preference:{friend:'miko',hobby:'practice'},style:'მოკლე, ფრთხილი, ტექნიკური შედარებებით; ახლობლებთან თბილი.'},
 {id:'miko',name:'მიკო ფოთოლა',nickname:'მიკო',age:43,birthday:'09-03',home:'homeMiko',job:'gardener',favorite:'garden',color:'#7fc28d',accessory:'cap',hair:'curl',
  biography:'ბაღის სამხრეთის ეზოში ბებიასთან გაიზარდა. ბებიამ თესლების შენახვა ასწავლა. ადრე გზავნილებს არიგებდა და ერთხელ მცენარე სიცხეში დაავიწყდა; მას შემდეგ გამძლე ნერგებზე ზრუნვას სწავლობს. ხმაურიანი ხუმრობების უკან მარტოობის შიში იმალება.',
  household:'მარტო ცხოვრობს და მეზობლებისთვის ნერგებს ზრდის.',values:['ურთიერთდახმარება','ცოცხალზე ზრუნვა'],fear:'მეგობრების დაკარგვა',secret:'ძველი ბებიის წერილებს იშვიათად აჩვენებს სხვებს.',goal:{item:'greenhouse',name:'სათემო სათბური',cost:90,skill:'gardening',required:15},
  traits:{openness:.65,conscientiousness:.7,extraversion:.8,agreeableness:.9,sensitivity:.4},skills:{repair:0,music:1,gardening:4},
  preference:{friend:'lumo',hobby:'social'},style:'ენერგიული, კეთილი, მცენარეებზე ხუმრობით; წყენას იუმორით ფარავს.'},
 {id:'nela',name:'ნელა ჟღერაძე',nickname:'ნელა',age:35,birthday:'12-08',home:'homeNela',job:'musician',favorite:'stage',color:'#d48faf',accessory:'bow',hair:'bob',
  biography:'მდინარისპირა ოჯახში გაიზარდა; ძველი მუსიკის გამყიდველს ეხმარებოდა. პირველი გამოსვლა წვიმამ ჩაშალა. ახლა ქუჩის მუსიკოსია, ახალ რიტმებს წერს და ხანდახან ჯიუტად იცავს თავის აზრს. ლუმოს გამხნევება უყვარს, მაგრამ მის მუდმივ სიფრთხილეს ეჩხუბება.',
  household:'პატარა ეზოში ცხოვრობს; ლუმოს ბიძაშვილია.',values:['შემოქმედება','პირადი თავისუფლება'],fear:'საკუთარი ხმის დაკარგვა',secret:'პირველი სიმღერა ოჯახისთვის დაწერა და ტექსტს ჯერ არ აქვეყნებს.',goal:{item:'synth',name:'საკუთარი სინთეზატორი',cost:110,skill:'music',required:16},
  traits:{openness:.95,conscientiousness:.45,extraversion:.65,agreeableness:.4,sensitivity:.65},skills:{repair:0,music:4,gardening:0},
  preference:{friend:'miko',hobby:'dance'},style:'ირონიული, მუსიკალური, დამოუკიდებელი; არ ეთანხმება ყველაფერს.'}
];
module.exports={jobs,places,residents};
