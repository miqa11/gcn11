"use strict";

(() => {
  const modes = {
    imposter: {
      title: "იმპოსტორი",
      description: "ყველას ერთი სიტყვა ერგება, იმპოსტორის გარდა. მინიშნებებით გამოარკვიეთ, ვინ დარჩა უსიტყვოდ.",
      rule: "იმპოსტორი სიტყვას ვერ ხედავს. სხვების მინიშნებებით ეცადოს, თავი არ გასცეს."
    },
    different: {
      title: "განსხვავებული სიტყვა",
      description: "ერთ მოთამაშეს ოდნავ განსხვავებული სიტყვა შეხვდება. გაარკვიეთ, ვისი მინიშნება განსხვავდება სხვებისგან.",
      rule: "ერთ მოთამაშეს მსგავსი, მაგრამ განსხვავებული სიტყვა ხვდება. ბარათზე როლი არ წერია და ყველა მოთამაშე თავის როლს მინიშნებებით არკვევს."
    },
    alias: {
      title: "ალიასი",
      description: "ახსენი ეკრანზე დაწერილი სიტყვა ისე, რომ მეწყვილემ ან შენმა გუნდმა გამოიცნოს."
    }
  };
  const requestedMode = new URLSearchParams(location.search).get("game");
  const mode = Object.prototype.hasOwnProperty.call(modes, requestedMode) ? requestedMode : "imposter";
  const game = modes[mode];
  const isAlias = mode === "alias";
  const $ = id => document.getElementById(id);
  const set = (id, value) => { $(id).textContent = value; };
  const screens = document.querySelectorAll(".party-table > section");
  const pick = count => Math.floor(Math.random() * count);

  let screen = "setup";
  let names = [];
  let deduction;
  let alias;
  let clock = 0;

  function shuffledDeck(items) {
    let remaining = [];
    let last;
    return () => {
      if (!remaining.length) {
        remaining = [...items];
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = pick(i + 1);
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
        const end = remaining.length - 1;
        if (remaining[end] === last) {
          [remaining[0], remaining[end]] = [remaining[end], remaining[0]];
        }
      }
      last = remaining.pop();
      return last;
    };
  }

  const nextPair = shuffledDeck(partyWordPairs);
  const nextWord = shuffledDeck(aliasWords);

  function show(id) {
    screen = id;
    for (const section of screens) section.hidden = section.id !== id;
    $("settings").hidden = id === "setup";
    if (id !== "private-card") {
      set("private-word", "");
      set("private-note", "");
      drawPartyArt($("private-art"), null);
    }
    if (id !== "ballot") $("vote-choices").replaceChildren();
    if (id !== "alias-play") {
      set("alias-word", "");
      drawPartyArt($("alias-art"), null);
    }
    if (id !== "deduction-result") $("revealed").replaceChildren();
    $(id).querySelector("h2")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function appendText(parent, tag, value) {
    const element = document.createElement(tag);
    element.textContent = value;
    parent.append(element);
    return element;
  }

  function displayRows(id, rows) {
    const list = $(id);
    list.replaceChildren();
    for (const [label, value] of rows) {
      appendText(list, "dt", label);
      appendText(list, "dd", value);
    }
  }

  const teamMode = () => isAlias && $("alias-mode").value === "teams";
  const nameLabel = index => `${teamMode() ? "გუნდი" : "მოთამაშე"} ${index + 1}`;
  const draftNames = { players: [], teams: [] };

  function renderSettings() {
    const teams = teamMode();
    set("names-label", teams ? "გუნდების სახელები · სურვილისამებრ" : "მოთამაშეების სახელები · სურვილისამებრ");
    $("team-setting").hidden = !teams;
    $("target-setting").hidden = !teams;
    const count = teams ? Number($("team-count").value) : isAlias ? 2 : Number($("player-count").value);
    const nameType = teams ? "teams" : "players";
    const container = $("names");
    const previous = draftNames[container.dataset.kind];
    container.querySelectorAll("input").forEach((input, index) => { previous[index] = input.value; });
    container.dataset.kind = nameType;
    container.replaceChildren();
    for (let i = 0; i < count; i++) {
      const label = appendText(container, "label", nameLabel(i));
      const input = document.createElement("input");
      input.maxLength = 24;
      input.autocomplete = "off";
      input.placeholder = teams ? "გუნდის სახელი" : "სახელი";
      input.value = draftNames[nameType][i] || "";
      label.append(input);
    }
    $("setup-error").hidden = true;
  }

  function startDeduction() {
    const pair = nextPair();
    const side = pick(2);
    deduction = {
      common: pair[side], odd: mode === "different" ? pair[1 - side] : "",
      oddPlayer: pick(names.length), starter: pick(names.length), index: 0,
      candidates: names.map((_, index) => index), votes: [], runoff: false
    };
    handoff(false);
  }

  function handoff(voting) {
    const { index, runoff } = deduction;
    set("handoff-progress", `${voting ? (runoff ? "განმეორებითი კენჭისყრა" : "ხმის მიცემა") : "ბარათების დარიგება"} · ${index + 1}/${names.length}`);
    set("handoff-title", names[index]);
    set("handoff-note", voting
      ? "გადააწოდეთ მოწყობილობა ამ მოთამაშეს. დანარჩენებმა ეკრანს მოარიდეთ თვალი."
      : "გადააწოდეთ მოწყობილობა ამ მოთამაშეს. ბარათი მხოლოდ მან უნდა ნახოს.");
    set("open-private", voting ? "ბიულეტენის გახსნა" : "ბარათის ნახვა");
    $("open-private").onclick = voting ? openBallot : openCard;
    show("handoff");
  }

  function openCard() {
    if (screen !== "handoff") return;
    const { index, oddPlayer, common, odd } = deduction;
    const word = index === oddPlayer ? odd : common;
    set("card-player", names[index]);
    set("private-word", word || "შენ ხარ იმპოსტორი");
    drawPartyArt($("private-art"), word ? partyWordArt.get(word) : "@imposter");
    set("private-note", word ? "დაიმახსოვრე სიტყვა და დამალე ბარათი." : "მოუსმინე სხვებს და ისეთი მინიშნება თქვი, რომ ვერ გამოგიცნონ.");
    show("private-card");
  }

  function passCard() {
    if (screen !== "private-card") return;
    deduction.index++;
    if (deduction.index < names.length) {
      handoff(false);
    } else {
      set("first-speaker", `პირველი მინიშნება · ${names[deduction.starter]}`);
      show("discussion");
    }
  }

  function beginVoting() {
    deduction.index = 0;
    deduction.votes = [];
    handoff(true);
  }

  function openBallot() {
    if (screen !== "handoff") return;
    const { index, candidates, runoff } = deduction;
    set("vote-label", runoff ? "განმეორებითი კენჭისყრა" : "საიდუმლო კენჭისყრა");
    set("vote-title", names[index]);
    const choices = $("vote-choices");
    choices.replaceChildren();
    for (const candidate of candidates) {
      if (candidate === index) continue;
      const button = appendText(choices, "button", names[candidate]);
      button.type = "button";
      button.className = "button secondary";
      button.onclick = () => vote(candidate);
    }
    show("ballot");
  }

  function vote(candidate) {
    if (screen !== "ballot") return;
    const round = deduction;
    round.votes.push(candidate);
    round.index++;
    if (round.index < names.length) {
      handoff(true);
      return;
    }
    const counts = names.map(() => 0);
    for (const choice of round.votes) counts[choice]++;
    const highest = Math.max(...counts);
    const leaders = round.candidates.filter(index => counts[index] === highest);
    if (leaders.length > 1 && !round.runoff) {
      round.runoff = true;
      round.candidates = leaders;
      beginVoting();
      return;
    }
    const groupWon = leaders[0] === round.oddPlayer;
    const outsider = mode === "imposter" ? "იმპოსტორი" : "განსხვავებული სიტყვის მფლობელი";
    set("result-title", leaders.length > 1 ? "ფრეა" : groupWon ? "ჯგუფმა გაიმარჯვა" : `გაიმარჯვა · ${names[round.oddPlayer]}`);
    set("result-note", leaders.length > 1 ? "განმეორებით კენჭისყრაშიც ხმები თანაბრად გაიყო." : `ყველაზე მეტი ხმა · ${names[leaders[0]]}`);
    displayRows("revealed", [[outsider, names[round.oddPlayer]], ["საერთო სიტყვა", round.common],
      ...(round.odd ? [["განსხვავებული სიტყვა", round.odd]] : [])]);
    show("deduction-result");
  }

  function startAlias() {
    alias = {
      teams: teamMode(), duration: Number($("duration").value), target: Number($("target").value),
      totals: names.map(() => 0), turn: 0, correct: 0, skipped: 0, best: 0, deadline: 0, winner: -1
    };
    readyAlias();
  }

  function activeSeat() {
    return alias.turn % names.length;
  }

  function aliasRows() {
    return alias.teams ? names.map((name, index) => [name, alias.totals[index]])
      : [["საუკეთესო რაუნდი", alias.best]];
  }

  function readyAlias() {
    set("alias-round", `რაუნდი ${Math.floor(alias.turn / (alias.teams ? names.length : 1)) + 1} · ${alias.duration} წამი`);
    set("alias-turn", names[activeSeat()]);
    set("alias-hint", alias.teams
      ? `გუნდიდან ერთმა მოთამაშემ დაიჭიროს მოწყობილობა და ახსნას სიტყვები. სამიზნე · ${alias.target} ქულა.`
      : `მოწყობილობა მიეცი ამხსნელს. გამოიცნობს ${names[1 - activeSeat()]}.`);
    displayRows("alias-scores", aliasRows());
    show("alias-ready");
  }

  function tickAlias() {
    if (screen !== "alias-play") return;
    const left = Math.ceil((alias.deadline - performance.now()) / 1000);
    if (left <= 0) {
      finishAliasTurn();
      return;
    }
    set("alias-time", `${left} წმ`);
    $("alias-time").toggleAttribute("data-low", left <= 10);
  }

  function showAliasWord() {
    const word = nextWord();
    set("alias-word", word);
    drawPartyArt($("alias-art"), partyWordArt.get(word));
  }

  function startAliasTurn() {
    if (screen !== "alias-ready") return;
    alias.correct = alias.skipped = 0;
    alias.deadline = performance.now() + alias.duration * 1000;
    set("alias-active-title", `ხსნის · ${names[activeSeat()]}`);
    set("alias-points", "0 ქულა");
    showAliasWord();
    show("alias-play");
    tickAlias();
    clock = setInterval(tickAlias, 100);
  }

  function answerAlias(correct) {
    if (screen !== "alias-play") return;
    if (performance.now() >= alias.deadline) {
      finishAliasTurn();
      return;
    }
    if (correct) alias.correct++;
    else alias.skipped++;
    set("alias-points", `${alias.correct} ქულა`);
    showAliasWord();
  }

  function finishAliasTurn() {
    clearInterval(clock);
    const seat = activeSeat();
    alias.best = Math.max(alias.best, alias.correct);
    alias.totals[seat] += alias.correct;
    alias.turn++;
    if (alias.teams && activeSeat() === 0) {
      const highest = Math.max(...alias.totals);
      if (highest >= alias.target && alias.totals.indexOf(highest) === alias.totals.lastIndexOf(highest)) {
        alias.winner = alias.totals.indexOf(highest);
      }
    }
    const finished = alias.winner !== -1;
    set("alias-result-label", finished ? "თამაშის შედეგი" : "დრო ამოიწურა");
    set("alias-result-title", finished ? `გაიმარჯვა · ${names[alias.winner]}` : `${alias.correct} ქულა`);
    set("alias-result-note", `გამოცნობილი · ${alias.correct} · გამოტოვებული · ${alias.skipped}`);
    displayRows("alias-result-scores", aliasRows());
    const nextTeam = alias.teams && activeSeat() !== 0;
    set("alias-next", finished ? "ახალი თამაში" : nextTeam ? "შემდეგი გუნდი" : "შემდეგი რაუნდი");
    show("alias-result");
  }

  document.documentElement.dataset.party = mode;
  document.title = `${game.title} · გაიცანი`;
  set("game-name", game.title);
  drawPartyArt($("game-icon"), mode === "imposter" ? "@imposter-mark" : "@" + mode);
  set("description", game.description);
  $("player-setting").hidden = isAlias;
  $("mode-setting").hidden = $("duration-setting").hidden = !isAlias;
  for (let count = 3; count <= 12; count++) $("player-count").add(new Option(count, count));
  $("player-count").value = "4";
  for (const rule of isAlias ? [
    "მოწყობილობას მხოლოდ ამხსნელი უყურებს. სიტყვა ახსენი ქართულად, თვითონ სიტყვა, მისი ნაწილი ან თარგმანი არ თქვა.",
    "თუ სიტყვას გამოიცნობენ, დააჭირე „გამოიცნეს“ და მიიღე 1 ქულა. გამოტოვება ქულას არ გაკლებს.",
    "წყვილში ყოველ რაუნდში შეცვალეთ ამხსნელი და ეცადეთ საუკეთესო შედეგის გაუმჯობესებას.",
    "გუნდებით თამაშისას ყველა გუნდმა თანაბარი რაოდენობის რაუნდი უნდა ითამაშოს. იმარჯვებს გუნდი, რომელსაც სამიზნე მიღწეული აქვს და ყველაზე მეტი ქულა აქვს. თანაბარი შედეგისას თამაში გრძელდება."
  ] : [
    "მოწყობილობა რიგრიგობით გადააწოდეთ ერთმანეთს. ყველამ მხოლოდ საკუთარი ბარათი ნახოს.",
    game.rule,
    "რიგრიგობით თქვით თითო მინიშნება სიტყვაზე ისე, რომ თავად სიტყვა არ თქვათ. შემდეგ ერთად განიხილეთ მინიშნებები.",
    "საიდუმლოდ მიეცით ხმა მოთამაშეს, რომელსაც განსხვავებულ ბარათს აბრალებთ. თუ ყველაზე მეტი ხმა მან მიიღო, ჯგუფმა მოიგო, სხვა შემთხვევაში კი გამარჯვება მას ეკუთვნის.",
    "თანაბარი ხმებისას ხელახლა უყარეთ კენჭი პირველ ადგილზე გასულ მოთამაშეებს. განმეორებითი თანაბრობა ფრეა."
  ]) appendText($("rule-list"), "li", rule);
  renderSettings();

  for (const id of ["player-count", "alias-mode", "team-count"]) $(id).onchange = renderSettings;
  $("setup-form").onsubmit = event => {
    event.preventDefault();
    names = [...$("names").querySelectorAll("input")].map((input, index) => input.value.trim() || nameLabel(index));
    if (new Set(names.map(name => name.toLowerCase())).size !== names.length) {
      set("setup-error", "ყველა სახელი განსხვავებული უნდა იყოს.");
      $("setup-error").hidden = false;
      return;
    }
    $("setup-error").hidden = true;
    $("rules").open = false;
    if (isAlias) startAlias();
    else startDeduction();
  };
  $("settings").onclick = () => {
    const finished = screen === "deduction-result" || (screen === "alias-result" && alias.winner !== -1);
    if (!finished && !window.confirm("მიმდინარე თამაში დასრულდება. გადავიდეთ პარამეტრებზე?")) return;
    clearInterval(clock);
    deduction = alias = null;
    show("setup");
  };
  $("pass-card").onclick = passCard;
  $("start-vote").onclick = beginVoting;
  $("next-deduction").onclick = startDeduction;
  $("alias-start").onclick = startAliasTurn;
  $("alias-correct").onclick = () => answerAlias(true);
  $("alias-skip").onclick = () => answerAlias(false);
  $("alias-next").onclick = () => {
    if (alias.winner !== -1) startAlias();
    else readyAlias();
  };
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tickAlias();
    else if (screen === "private-card" || screen === "ballot") handoff(screen === "ballot");
  });
})();
