(() => {
  "use strict";

  const reasons = {
    pattern: "ემთხვევა სახელების ფილტრს",
    explicit: "აშკარად სექსუალური სახელი",
    insult: "შეურაცხმყოფელი სახელი",
    impersonation: "ადმინისტრაციის სახელით თავის გასაღება"
  };
  const actions = {
    name: "სახელის შეცვლის მოთხოვნა",
    ip: "IP მისამართის 24 საათით დაბლოკვა",
    dismiss: "შემოთავაზების გამოტოვება"
  };
  const errors = {
    stale: "სია შეიცვალა. გადაამოწმე სახელები და სცადე ხელახლა.",
    approval_required: "დადასტურების დრო გავიდა. სცადე ხელახლა.",
    ip_unavailable: "ამ სახელზე IP ბლოკი მიუწვდომელია. მისამართი შეიძლება შეიცვალა, გაზიარებულია ან უკვე დაბლოკილია.",
    scan_recent: "შემოწმება ახლახან დაიწყო. ცოტა ხანში სცადე.",
    ai_unavailable: "Groq-ის გასაღები სერვერზე არ არის გამართული.",
    save_failed: "ცვლილება ვერ შეინახა."
  };
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  };

  window.mountSupportModeration = ({ getToken, socket }) => {
    const panel = document.getElementById("supportModeration");
    const $ = id => document.getElementById(id);
    let state, busy = false, requestId = 0;
    const selected = new Set();

    async function request(path = "", payload) {
      const token = getToken();
      if (!token) throw Error("გთხოვ, თავიდან შედი Support-ის ანგარიშზე.");
      const response = await fetch("/api/support/moderation" + path, {
        method: payload === undefined ? "GET" : "POST",
        headers: { Authorization: "Bearer " + token, ...(payload === undefined ? {} : { "Content-Type": "application/json" }) },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000)
      });
      const result = await response.json();
      if (result.error || !response.ok) throw Error(errors[result.error] || "მოთხოვნა ვერ შესრულდა.");
      return result;
    }

    function render() {
      if (!state) return;
      const visibleIds = new Set(state.rows.map(row => row.id));
      for (const id of selected) if (!visibleIds.has(id)) selected.delete(id);
      $("moderationCount").textContent = state.pending;
      $("moderationScanStatus").textContent = state.scanning ? "შემოწმება მიმდინარეობს…" :
        state.lastScan ? "ბოლო შემოწმება · " + new Date(state.lastScan).toLocaleString("ka-GE", { timeZone: "Asia/Tbilisi" }) :
        "პირველი შემოწმება ჯერ არ ჩატარებულა.";
      const ai = $("moderationAI");
      ai.textContent = state.aiEnabled ? "Groq-ის გამორთვა" : "Groq-ის ჩართვა";
      ai.disabled = busy || (!state.aiAvailable && !state.aiEnabled);
      $("moderationAIStatus").textContent = !state.aiAvailable ? "სერვერზე Groq-ის გასაღები მიუწვდომელია." :
        state.aiIssue ? "Groq დროებით მიუწვდომელია. ადგილობრივი ფილტრი მუშაობს." :
        state.aiEnabled ? "Groq ჩართულია." : "Groq გამორთულია.";
      $("moderationScan").disabled = busy || state.scanning;
      $("moderationPrevious").disabled = busy || !state.page;
      $("moderationNext").disabled = busy || state.page + 1 >= state.pages;
      $("moderationPage").textContent = (state.page + 1) + " / " + state.pages;
      const list = $("moderationList");
      list.replaceChildren();
      for (const row of state.rows) {
        const item = node("div", "", "sai-conv");
        const label = node("label", "", "moderation-target");
        const checkbox = node("input", "");
        checkbox.type = "checkbox";
        checkbox.checked = selected.has(row.id);
        checkbox.disabled = busy;
        checkbox.onchange = () => {
          if (checkbox.checked && selected.size >= 20) {
            checkbox.checked = false;
            $("moderationMessage").textContent = "ერთ დადასტურებაში მაქსიმუმ 20 სახელი აირჩიე.";
            return;
          }
          if (checkbox.checked) selected.add(row.id);
          else selected.delete(row.id);
          updateActions();
        };
        label.append(checkbox, node("b", row.username));
        item.append(label, node("p", (reasons[row.reason] || "გადასამოწმებელი სახელი") +
          " · " + (row.source === "ai" ? "Groq" : "ადგილობრივი ფილტრი"), "sai-note"));
        list.append(item);
      }
      if (!state.rows.length) list.append(node("p", "შესამოწმებელი სახელები არ არის.", "empty-state"));
      const history = $("moderationHistory");
      history.replaceChildren(...state.history.map(row => node("li", row.username + " · " + (actions[row.action] || ""))));
      $("moderationHistoryPanel").hidden = !state.history.length;
      updateActions();
    }

    function updateActions() {
      $("moderationName").disabled = busy || !selected.size;
      $("moderationDismiss").disabled = busy || !selected.size;
      $("moderationIp").disabled = busy || selected.size !== 1;
      $("moderationSelection").textContent = "არჩეულია " + selected.size;
    }

    async function refresh(page = state?.page || 0) {
      const id = ++requestId;
      try {
        const next = await request("?page=" + page);
        if (id !== requestId) return;
        state = next;
        panel.hidden = false;
        render();
      } catch {
        if (id === requestId && state) $("moderationMessage").textContent = "სია ვერ განახლდა.";
      }
    }

    async function run(task) {
      if (busy) return;
      busy = true;
      $("moderationMessage").textContent = "";
      render();
      try { await task(); }
      catch (error) { $("moderationMessage").textContent = error.message; }
      finally {
        busy = false;
        render();
        refresh();
      }
    }

    function approve(action) {
      run(async () => {
        const preview = await request("/prepare", { action, ids: [...selected] });
        const consequences = action === "name" ? "\nარჩეულ მომხმარებლებს სახელის შეცვლა დასჭირდებათ." :
          action === "ip" ? "\nმისამართი: " + preview.ip + "\nბლოკი იმოქმედებს ამ მისამართიდან შემოსულ ყველა ადამიანზე." : "";
        if (!window.confirm(actions[action] + "\n\n" + preview.usernames.join("\n") + consequences)) return;
        const result = await request("/approve", { token: preview.token });
        selected.clear();
        $("moderationMessage").textContent = "დადასტურებულია · " + result.count +
          (result.saved ? "" : " · გადაწყვეტილების ისტორია ვერ შეინახა.");
      });
    }

    $("moderationName").onclick = () => approve("name");
    $("moderationIp").onclick = () => approve("ip");
    $("moderationDismiss").onclick = () => approve("dismiss");
    $("moderationPrevious").onclick = () => { selected.clear(); refresh(state.page - 1); };
    $("moderationNext").onclick = () => { selected.clear(); refresh(state.page + 1); };
    $("moderationScan").onclick = () => run(() => request("/scan", {}));
    $("moderationAI").onclick = () => run(async () => {
      const enabled = !state.aiEnabled;
      if (enabled && !window.confirm("ჩაირთოს Groq? პერიოდული შემოწმებისთვის Groq-ში გაიგზავნება მხოლოდ მომხმარებლების სახელები.")) return;
      await request("/ai", { enabled });
    });
    panel.addEventListener("toggle", () => { if (panel.open) refresh(); });
    socket.on("moderationAssistant:update", () => refresh());
    socket.on("connect", () => refresh());
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
    refresh().then(() => {
      if (!panel.hidden && new URLSearchParams(location.search).get("moderation") === "1") {
        panel.open = true;
        panel.scrollIntoView({ block: "start" });
      }
    });
  };
})();
