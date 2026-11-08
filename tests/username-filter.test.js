"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { matchesBlockedUsername } = require("../server-username-filter");

test("username-only terms match Georgian and Latin spellings, separators and numbers", () => {
  for (const name of ["CM", "20c.m", "სმ", "25_ს-მ", "DIDI_MAQ", "didimaqvs1",
    "დიდი მაქ", "დიდი.მაქვს", "18cm didi maq", "send_nudes", "სექსი-მინდა"]) {
    assert.equal(matchesBlockedUsername(name), true, name);
  }
  for (const name of ["acme", "SandroCM", "დიდი გიორგი", "მაქვსმეგობარი", "სმენა", "CMartin", "Luka20"]) {
    assert.equal(matchesBlockedUsername(name), false, name);
  }
});

test("explicit usernames from moderation review match without blocking ambiguous labels", () => {
  for (const name of ["gogoebis mtyneli", "ვტყნავ გოგოებს", "ვწოვ მუტელს ძუძუებს",
    "გოგომტრაკშიშემიდოკიტ", "BigBicepsBiggerDick", "HARD FUCKERR 24", "free use slut",
    "fuckkbuddyy", "ვეძებ სექს პარტნიორს", "სექსი პლაჟზე", "sex minda", "tryna fuck",
    "boy 17 cm", "17 სმ", "17 სმ მსხვილი მაქვს", "thick 20cmm", "vato19cmm.",
    "msxvili maqvs 17", "დიდი მაქ საკმაოდ"]) {
    assert.equal(matchesBlockedUsername(name), true, name);
  }
  for (const name of ["ნიკა69", "bisexual", "acme", "სმენა"]) {
    assert.equal(matchesBlockedUsername(name), false, name);
  }
});
