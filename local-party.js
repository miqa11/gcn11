"use strict";

(() => {
  const modes = {
    imposter: {
      title: "იმპოსტორი",
      description: "იმპოსტორები სიტყვას ვერ ხედავენ. გამოიცანით, ვის შეხვდა საიდუმლო როლი.",
      rule: "იმპოსტორი სიტყვას ვერ ხედავს. სხვების მინიშნებებით ეცადოს, თავი არ გასცეს."
    },
    different: {
      title: "განსხვავებული სიტყვა",
      description: "ზოგ მოთამაშეს ოდნავ განსხვავებული სიტყვა შეხვდება. გამოიცანით, ვის შეხვდა ის.",
      rule: "არჩეულ მოთამაშეებს მსგავსი, მაგრამ განსხვავებული სიტყვა ხვდებათ. ბარათზე როლი არ წერია და ყველა მოთამაშე თავის როლს მინიშნებებით არკვევს."
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
    if (!isAlias) {
      const selector = $("outsider-count");
      const chosen = Number(selector.value) || 1;
      const max = Math.floor((count - 1) / 2);
      selector.replaceChildren();
      for (let n = 1; n <= max; n++) selector.add(new Option(n, n));
      selector.value = String(Math.min(chosen, max));
    }
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
    set("result-note", "");
    const pair = nextPair();
    const side = pick(2);
    const count = Number($("outsider-count").value);
    const seats = names.map((_, index) => index);
    for (let i = 0; i < count; i++) {
      const j = i + pick(seats.length - i);
      [seats[i], seats[j]] = [seats[j], seats[i]];
    }
    deduction = {
      common: pair[side], odd: mode === "different" ? pair[1 - side] : "",
      outsiders: new Set(seats.slice(0, count)), starter: pick(names.length), index: 0,
      duration: $("deduction-minutes").valueAsNumber * 60000, deadline: 0
    };
    handoff();
  }

  function handoff() {
    const { index } = deduction;
    set("handoff-progress", "ბარათების დარიგება · " + (index + 1) + "/" + names.length);
    set("handoff-title", names[index]);
    set("handoff-note", "გადააწოდეთ მოწყობილობა ამ მოთამაშეს. ბარათი მხოლოდ მან უნდა ნახოს.");
    set("open-private", "ბარათის ნახვა");
    $("open-private").onclick = openCard;
    show("handoff");
  }

  function openCard() {
    if (screen !== "handoff") return;
    const { index, outsiders, common, odd } = deduction;
    const word = outsiders.has(index) ? odd : common;
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
      handoff();
    } else {
      set("first-speaker", `პირველი მინიშნება · ${names[deduction.starter]}`);
      deduction.deadline = Date.now() + deduction.duration;
      show("discussion");
      tickDeduction();
      clock = setInterval(tickDeduction, 200);
    }
  }

  function tickDeduction() {
    if (screen !== "discussion") return;
    const seconds = Math.max(0, Math.ceil((deduction.deadline - Date.now()) / 1000));
    if (!seconds) {
      clearInterval(clock);
      show("deduction-expired");
      return;
    }
    const time = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
    if ($("deduction-time").textContent !== time) set("deduction-time", time);
    $("deduction-time").toggleAttribute("data-low", seconds <= 10);
  }

  function revealDeduction() {
    if (screen !== "deduction-expired") return;
    const { outsiders, common, odd } = deduction;
    set("result-title", mode === "different" ? "განსხვავებული სიტყვის მფლობელები" : outsiders.size === 1 ? "იმპოსტორი" : "იმპოსტორები");
    set("result-note", names.filter((_, index) => outsiders.has(index)).join(", "));
    show("deduction-result");
    displayRows("revealed", [["საერთო სიტყვა", common], ...(odd ? [["განსხვავებული სიტყვა", odd]] : [])]);
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
  $("deduction-duration-setting").hidden = $("outsider-setting").hidden = isAlias;
  $("deduction-minutes").disabled = isAlias;
  set("outsider-label", mode === "different" ? "რამდენ მოთამაშეს შეხვდება განსხვავებული სიტყვა" : "იმპოსტორების რაოდენობა");
  set("reveal-outsiders", mode === "different" ? "განსხვავებული ბარათების გამხელა" : "იმპოსტორების გამხელა");
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
    "რიგრიგობით თქვით თითო მინიშნება სიტყვაზე ისე, რომ თავად სიტყვა არ თქვათ. შემდეგ ერთად განიხილეთ მინიშნებები."
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
    const finished = screen === "deduction-result" || screen === "deduction-expired" || (screen === "alias-result" && alias.winner !== -1);
    if (!finished && !window.confirm("მიმდინარე თამაში დასრულდება. გადავიდეთ პარამეტრებზე?")) return;
    clearInterval(clock);
    deduction = alias = null;
    show("setup");
  };
  $("pass-card").onclick = passCard;
  $("reveal-outsiders").onclick = revealDeduction;
  $("next-deduction").onclick = startDeduction;
  $("alias-start").onclick = startAliasTurn;
  $("alias-correct").onclick = () => answerAlias(true);
  $("alias-skip").onclick = () => answerAlias(false);
  $("alias-next").onclick = () => {
    if (alias.winner !== -1) startAlias();
    else readyAlias();
  };
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      tickAlias();
      tickDeduction();
    } else if (screen === "private-card") handoff();
  });
})();
