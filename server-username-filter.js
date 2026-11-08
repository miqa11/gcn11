"use strict";

const separator = "[\\s._-]*";
const phrases = [
  "didi maq", "didi mak", "didi maqvs", "didi makvs",
  "დიდი მაქ", "დიდი მაკ", "დიდი მაქვს", "დიდი მააქ",
  "didi yle", "didi qle", "დიდი ყლე", "დიდი სირი",
  "grdzeli maq", "grdzeli makvs", "გრძელი მაქ", "გრძელი მაქვს",
  "sex chat", "seksi chat", "სექს ჩატი", "სექსი ჩატი", "სექს ჩეთი",
  "sex minda", "seksi minda", "სექსი მინდა", "სექსს ვეძებ",
  "send nudes", "nude pics", "nude photos", "nudes pls",
  "შიშველი ფოტო", "შიშველი ფოტოები", "გამომიგზავნე ნუდები",
  "porn", "porno", "პორნო", "პორნოგრაფია",
  "fuck me", "fuck you", "motherfucker", "go fuck yourself",
  "gogoebis mtyneli", "ვტყნავ გოგოებს", "ვწოვ მუტელს ძუძუებს",
  "გოგომტრაკშიშემიდოკიტ", "big biceps bigger dick", "hard fucker",
  "hard fuckerr", "hurd fucker", "free use slut", "fuck buddy", "fuckkbuddyy",
  "ვეძებ სექს პარტნიორს", "სექსი პლაჟზე", "სექსი პლიაჟზე", "tryna fuck",
  "მსხვილი მაქვს", "მსხვილი მაქ", "msxvili maqvs", "msxvili makvs"
];
const phrasePattern = new RegExp(
  "(?<![\\p{L}])(?:" + phrases.map(phrase => phrase.split(" ").join(separator)).join("|") + ")(?![\\p{L}])",
  "u"
);
const unitPattern = /(?<![\p{L}])(?:c[\s._-]*m+|ს[\s._-]*მ+)(?![\p{L}])/u;

function matchesBlockedUsername(username) {
  const name = username.normalize("NFKC").toLowerCase();
  return unitPattern.test(name) || phrasePattern.test(name);
}

module.exports = { matchesBlockedUsername };
