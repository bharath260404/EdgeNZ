(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // Runs `fn` once, the first time `el` scrolls into view.
  function whenSeen(el, fn, threshold = 0.3) {
    if (!el) return;
    if (!("IntersectionObserver" in window)) return fn();
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        io.disconnect();
        fn();
      }
    }, { threshold });
    io.observe(el);
  }

  // ============================================================
  // OPENING: the curtain lifts after about a second, and the page's
  // own entrance plays as it does.
  // ============================================================

  const html = document.documentElement;
  const intro = $("#intro");
  const introOn = Boolean(intro) && html.classList.contains("intro-on");
  const introDelay = introOn ? Math.max(0, 950 - performance.now()) : 0;
  const afterIntro = (fn) => (introOn ? setTimeout(fn, introDelay + 200) : fn());

  if (introOn) {
    setTimeout(() => {
      intro.classList.add("out");
      html.classList.remove("intro-on");
      setTimeout(() => intro.remove(), 800);
    }, introDelay);
  } else if (intro) {
    intro.remove();
  }

  // ============================================================
  // NAV, PROGRESS, YEAR
  // ============================================================

  const nav = $("#nav");
  const toggle = $("#nav-toggle");
  const links = $("#nav-links");
  const progress = $("#progress");

  const onScroll = () => {
    nav.classList.toggle("scrolled", window.scrollY > 8);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const setMenu = (open) => {
    links.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  toggle.addEventListener("click", () => setMenu(!links.classList.contains("open")));
  $$("a", links).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

  $("#year").textContent = new Date().getFullYear();

  // ============================================================
  // REVEAL ON SCROLL, POINTER LIGHT ON CARDS
  // ============================================================

  if ("IntersectionObserver" in window && !reduceMotion) afterIntro(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    $$(".reveal").forEach((el) => {
      const siblings = $$(":scope > .reveal", el.parentElement);
      el.style.transitionDelay = `${Math.max(0, siblings.indexOf(el)) % 4 * 80}ms`;
      io.observe(el);
    });
  });
  else {
    $$(".reveal").forEach((el) => el.classList.add("visible"));
  }

  if (finePointer) {
    $$(".spot").forEach((card) => card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--x", `${e.clientX - r.left}px`);
      card.style.setProperty("--y", `${e.clientY - r.top}px`);
    }));
  }

  // The feature strip loops: a second copy follows the first.
  const marquee = $(".marquee-track");
  if (marquee && !reduceMotion) {
    $$(":scope > span", marquee).forEach((item) => {
      const copy = item.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      marquee.appendChild(copy);
    });
  }

  // ============================================================
  // HERO: numbers count up, bars grow, toasts take turns
  // ============================================================

  const stage = $("#hero-stage");

  function countUp(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = Number(el.dataset.decimals || 0);
    if (reduceMotion) {
      el.textContent = target.toFixed(decimals);
      return;
    }
    const start = performance.now();
    const ms = 1400;
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  afterIntro(() => whenSeen(stage, () => {
    stage.classList.add("is-live");
    $$("[data-count]", stage).forEach(countUp);
  }, 0.2));

  const toasts = $$(".toast", stage);
  let toastAt = 0;
  if (toasts.length) {
    toasts[0].classList.add("is-on");
    if (!reduceMotion) {
      setInterval(() => {
        toasts[toastAt].classList.remove("is-on");
        toastAt = (toastAt + 1) % toasts.length;
        toasts[toastAt].classList.add("is-on");
      }, 3200);
    }
  }

  // A gentle tilt that follows the pointer, on computers only.
  const windowEl = $(".window", stage);
  if (finePointer && !reduceMotion && windowEl) {
    stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      windowEl.style.transform = `rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg)`;
    });
    stage.addEventListener("pointerleave", () => (windowEl.style.transform = ""));
  }

  // ============================================================
  // PLATFORM TOUR
  // ============================================================

  const tour = $("#tour");
  const tabs = $$(".tour-tab", tour);
  const panels = $$(".tour-panel", tour);
  const TAB_MS = 8000;
  let tabTimer = null;
  let tabAuto = !reduceMotion;
  let current = 0;
  tour.style.setProperty("--tab-ms", `${TAB_MS}ms`);

  const onShow = {};

  function showTab(index, focus = false) {
    current = index;
    tabs.forEach((tab, n) => {
      const on = n === index;
      tab.classList.toggle("is-on", on);
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      const bar = $(".tab-bar", tab);
      bar.style.display = "none";
      void bar.offsetWidth;
      bar.style.display = "";
    });
    panels.forEach((panel, n) => (panel.hidden = n !== index));
    if (focus) tabs[index].focus();
    if (window.innerWidth <= 1100) {
      tabs[index].scrollIntoView({ block: "nearest", inline: "center", behavior: reduceMotion ? "auto" : "smooth" });
    }
    onShow[tabs[index].dataset.tab]?.();

    clearTimeout(tabTimer);
    if (tabAuto) tabTimer = setTimeout(() => showTab((index + 1) % tabs.length), TAB_MS);
  }

  function stopAuto() {
    tabAuto = false;
    clearTimeout(tabTimer);
    tour.classList.add("is-paused");
  }

  tabs.forEach((tab, n) => {
    tab.addEventListener("click", () => {
      stopAuto();
      showTab(n);
    });
    tab.addEventListener("keydown", (e) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      stopAuto();
      showTab((n + step + tabs.length) % tabs.length, true);
    });
  });
  // Someone using a panel shouldn't have it whisked away.
  $(".tour-stage", tour).addEventListener("pointerdown", stopAuto);
  $(".tour-stage", tour).addEventListener("focusin", stopAuto);
  if (reduceMotion) tour.classList.add("is-paused");

  // --- Attendance -------------------------------------------------------
  const ROLL = [
    ["01", "Aarav Sharma", "Day scholar"],
    ["02", "Diya Reddy", "Hostel"],
    ["03", "Kabir Khan", "Day scholar"],
    ["04", "Ananya Iyer", "Day scholar"],
    ["05", "Rohan Das", "Hostel"],
  ];
  const attList = $("#att-list");
  const attSave = $("#att-save");
  const away = new Set([1]);

  function drawAttendance() {
    attList.innerHTML = "";
    ROLL.forEach(([roll, name, note], i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <button type="button" aria-pressed="${away.has(i)}">
          <span class="roll">${roll}</span>
          <span class="nm">${name}<small>${note}</small></span>
          <span class="st">${away.has(i) ? "Absent" : "Present"}</span>
        </button>`;
      $("button", li).addEventListener("click", () => {
        away.has(i) ? away.delete(i) : away.add(i);
        attSave.classList.remove("is-saved");
        attSave.textContent = "Save attendance";
        drawAttendance();
      });
      attList.appendChild(li);
    });
    $("#att-present").textContent = ROLL.length - away.size;
    $("#att-absent").textContent = away.size;
  }
  attSave.addEventListener("click", () => {
    attSave.classList.add("is-saved");
    attSave.textContent = "Saved ✓";
  });
  drawAttendance();

  // --- Tests with AI ----------------------------------------------------
  const typing = $("#ai-typing");
  const questions = $$("#ai-questions .q");
  const picked = $("#ai-picked");
  const addBtn = $("#ai-add");
  let aiTimers = [];

  const countPicked = () => {
    const n = questions.filter((q) => $("input", q).checked).length;
    picked.textContent = `${n} question${n === 1 ? "" : "s"} ticked`;
    addBtn.disabled = n === 0;
  };
  questions.forEach((q) => $("input", q).addEventListener("change", countPicked));
  addBtn.addEventListener("click", () => {
    const n = questions.filter((q) => $("input", q).checked).length;
    addBtn.textContent = `Added ${n} ✓`;
  });

  onShow.tests = () => {
    aiTimers.forEach(clearTimeout);
    aiTimers = [];
    addBtn.textContent = "Add to test";
    if (reduceMotion) {
      typing.hidden = true;
      questions.forEach((q) => q.classList.add("is-in"));
      return;
    }
    typing.hidden = false;
    questions.forEach((q) => q.classList.remove("is-in"));
    aiTimers.push(setTimeout(() => (typing.hidden = true), 1300));
    questions.forEach((q, i) => aiTimers.push(setTimeout(() => q.classList.add("is-in"), 1400 + i * 350)));
  };
  countPicked();

  // --- Marks & results ----------------------------------------------------
  const MAX = 25;
  const PASS = 9;
  const MARKS = [
    { name: "Varshini G.", m: [23, 20, 24] },
    { name: "Venkatesh R.", m: [18, 21, 17] },
    { name: "Ramya S.", m: [8, 15, 12] },
    { name: "Pranav A.", m: [22, 24, 25] },
  ];
  const marksBody = $("#marks-table tbody");
  const pubBtn = $("#marks-publish");
  const pubChip = $("#marks-pub");

  function drawMarks() {
    marksBody.innerHTML = "";
    MARKS.forEach((row, r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.name}</td>
        ${row.m.map((v, c) => `<td><input inputmode="numeric" maxlength="2" value="${v}" aria-label="${row.name}, subject ${c + 1}" data-r="${r}" data-c="${c}"></td>`).join("")}
        <td class="total"></td><td class="pct"></td><td class="rk"></td>`;
      marksBody.appendChild(tr);
    });
    $$("input", marksBody).forEach((input) => {
      input.addEventListener("input", () => {
        const value = input.value.replace(/\D/g, "").slice(0, 2);
        input.value = value;
        MARKS[input.dataset.r].m[input.dataset.c] = value === "" ? 0 : Math.min(MAX, Number(value));
        if (Number(value) > MAX) input.value = String(MAX);
        computeMarks(true);
      });
      input.addEventListener("focus", () => input.select());
    });
    computeMarks(false);
  }

  function computeMarks(flash) {
    const totals = MARKS.map((row) => row.m.reduce((a, b) => a + b, 0));
    const order = [...totals].sort((a, b) => b - a);
    $$("tr", marksBody).forEach((tr, r) => {
      const row = MARKS[r];
      const failed = row.m.some((v) => v < PASS);
      $$("input", tr).forEach((input, c) => input.classList.toggle("is-fail", row.m[c] < PASS));
      const total = $(".total", tr);
      const pct = $(".pct", tr);
      const rank = $(".rk", tr);
      const before = total.textContent;
      total.innerHTML = `${totals[r]}<small style="color:var(--muted);font-size:11px">/75</small>`;
      pct.textContent = `${Math.round((totals[r] * 1000) / 75) / 10}%`;
      pct.className = `pct${failed ? " fail" : ""}`;
      const place = order.indexOf(totals[r]) + 1;
      rank.innerHTML = failed ? `<span class="fail">Fail</span>` : `<span class="rank${place === 1 ? " r1" : ""}">${place}</span>`;
      if (flash && before && before !== total.textContent) {
        [total, pct, rank].forEach((cell) => {
          cell.classList.remove("flash");
          void cell.offsetWidth;
          cell.classList.add("flash");
        });
      }
    });
  }

  pubBtn.addEventListener("click", () => {
    const on = pubChip.textContent !== "Published";
    pubChip.textContent = on ? "Published" : "Not published";
    pubChip.classList.toggle("ok", on);
    pubBtn.textContent = on ? "Unpublish" : "Publish results";
  });
  drawMarks();

  // --- Notices ------------------------------------------------------------
  const seenCount = $("#seen-count");
  const seenBar = $("#seen-bar");
  let seenTimer = null;
  onShow.notices = () => {
    clearInterval(seenTimer);
    const target = 46;
    if (reduceMotion) {
      seenCount.textContent = target;
      seenBar.style.width = `${(target / 60) * 100}%`;
      return;
    }
    let n = 0;
    seenCount.textContent = "0";
    seenBar.style.width = "0%";
    seenTimer = setInterval(() => {
      n += 1;
      seenCount.textContent = n;
      seenBar.style.width = `${(n / 60) * 100}%`;
      if (n >= target) clearInterval(seenTimer);
    }, 55);
  };

  // --- Reports ------------------------------------------------------------
  const repBars = $("#rep-bars");
  onShow.reports = () => {
    repBars.classList.remove("is-on");
    void repBars.offsetWidth;
    requestAnimationFrame(() => repBars.classList.add("is-on"));
  };

  // Start the tour once it is on screen.
  whenSeen(tour, () => showTab(0), 0.25);

  // ============================================================
  // STUDENT APPS SWITCH
  // ============================================================

  const appButtons = $$("[data-app]");
  const appSwitch = appButtons[0]?.closest(".switch");
  appButtons.forEach((btn, index) => btn.addEventListener("click", () => {
    appButtons.forEach((b) => {
      b.classList.toggle("is-on", b === btn);
      b.setAttribute("aria-selected", String(b === btn));
    });
    appSwitch.classList.toggle("right", index === 1);
    $$("[data-app-panel]").forEach((panel) => (panel.hidden = panel.dataset.appPanel !== btn.dataset.app));
  }));

  // ============================================================
  // EARLY WARNINGS: note what was done
  // ============================================================

  $$("[data-watch-note]").forEach((btn) => btn.addEventListener("click", () => {
    const note = document.createElement("p");
    note.className = "w-note";
    note.textContent = `✓ ${btn.dataset.watchNote}`;
    btn.replaceWith(note);
  }));

  // ============================================================
  // PARENTS' APP: leave and report card
  // ============================================================

  const pButtons = $$("[data-pview]");
  const pSwitch = pButtons[0]?.closest(".switch");
  pButtons.forEach((btn, index) => btn.addEventListener("click", () => {
    pButtons.forEach((b) => {
      b.classList.toggle("is-on", b === btn);
      b.setAttribute("aria-selected", String(b === btn));
    });
    pSwitch?.classList.toggle("right", index === 1);
    $$("[data-pview-panel]").forEach((panel) => (panel.hidden = panel.dataset.pviewPanel !== btn.dataset.pview));
  }));

  const leaveAsk = $("#lv-ask");
  const leaveState = $("#lv-state");
  let leaveTimer = null;
  leaveAsk?.addEventListener("click", () => {
    if (leaveAsk.dataset.done) {
      // Again: back to the start.
      delete leaveAsk.dataset.done;
      leaveAsk.textContent = "Ask for 2 days";
      leaveState.hidden = true;
      return;
    }
    leaveAsk.disabled = true;
    leaveState.hidden = false;
    leaveState.className = "lv-state wait";
    leaveState.textContent = "Waiting for the school…";
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      leaveState.className = "lv-state ok";
      leaveState.textContent = "✓ Approved by the class teacher";
      leaveAsk.disabled = false;
      leaveAsk.dataset.done = "1";
      leaveAsk.textContent = "Try again";
    }, reduceMotion ? 300 : 1600);
  });

  // ============================================================
  // AI CARDS: the conversation plays when it comes into view
  // ============================================================

  $$("[data-chat]").forEach((chat) => whenSeen(chat, () => chat.classList.add("is-on"), 0.5));

  // ============================================================
  // SAMPLE CALLS (audio and captions come from calls.js)
  // ============================================================

  const BARS = 44;
  let currentAudio = null;

  const clock = (seconds) => {
    const s = Math.max(0, Math.round(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  const speakerName = (call, line) => (line.who === "ai" ? call.agent : "Parent");
  const lineAt = (call, t) => [...call.lines].reverse().find((l) => l.start <= t);

  // Bars follow the script: tall while someone speaks, low in the pauses.
  function waveBars(call) {
    let seed = [...call.id].reduce((n, c) => n + c.charCodeAt(0), 0);
    const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

    return Array.from({ length: BARS }, (_, n) => {
      const t = ((n + 0.5) / BARS) * call.duration;
      const line = lineAt(call, t);
      const next = line && call.lines[call.lines.indexOf(line) + 1];
      const end = (next ? next.start : call.duration) - 0.5;
      const speaking = !call.lines.length || (line && t < end);
      return { height: speaking ? 35 + random() * 65 : 12 + random() * 8, who: line ? line.who : "ai" };
    });
  }

  function callCard(call) {
    const card = document.createElement("article");
    card.className = "call";
    card.innerHTML = `
      <div class="call-top">
        <span>${call.kicker}</span>
        <span class="call-time">${clock(call.duration)}</span>
      </div>
      <h3>${call.title}</h3>
      <div class="call-agent">
        <span class="call-initial">${call.agent[0]}</span>
        <span><b>${call.agent}</b> · ${call.voiceLabel}</span>
        <span class="call-badge">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2 4.6 1V20A17 17 0 0 1 3 4h4l1 4.6z"/><path d="M15 3h6v6M21 3l-6.5 6.5"/></svg>
          Sample
        </span>
      </div>
      <div class="call-player">
        <button class="call-play" type="button" aria-label="Play sample call: ${call.title}">
          <svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
          <svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>
        </button>
        <div class="call-wave" role="slider" tabindex="0" aria-label="Position in call"
             aria-valuemin="0" aria-valuemax="${Math.round(call.duration)}" aria-valuenow="0" aria-valuetext="0:00">
          ${waveBars(call).map((b) => `<i class="${b.who}" style="height:${b.height.toFixed(0)}%"></i>`).join("")}
        </div>
      </div>
      <div class="call-caption" aria-live="polite"></div>
      ${call.lines.length ? `
      <details class="call-transcript">
        <summary>${call.transcriptLabel}</summary>
        <ol>${call.lines.map((l) => `
          <li class="${l.who}"><b>${speakerName(call, l)}:</b> ${l.text}${l.en ? `<small>${l.en}</small>` : ""}</li>`).join("")}
        </ol>
      </details>` : ""}`;

    const audio = new Audio();
    audio.preload = "none";
    const playBtn = $(".call-play", card);
    const wave = $(".call-wave", card);
    const bars = $$("i", wave);
    const time = $(".call-time", card);
    const caption = $(".call-caption", card);
    let shownLine = null;

    function showOutcome() {
      shownLine = null;
      caption.innerHTML = call.outcome
        ? `<span class="cap-idle">Outcome: <b>${call.outcome}</b></span>`
        : `<span class="cap-idle">Press play to listen.</span>`;
      caption.hidden = !call.outcome && !call.lines.length;
    }

    function render() {
      const t = audio.currentTime;
      const played = (t / call.duration) * BARS;
      bars.forEach((bar, n) => bar.classList.toggle("on", n < played));
      time.textContent = t > 0 ? clock(t) : clock(call.duration);
      wave.setAttribute("aria-valuenow", String(Math.round(t)));
      wave.setAttribute("aria-valuetext", clock(t));

      const line = t > 0 && lineAt(call, t + 0.05);
      if (line && line !== shownLine) {
        shownLine = line;
        caption.innerHTML = `
          <span class="cap-who ${line.who}">${speakerName(call, line)}</span>
          <span class="cap-text">${line.text}${line.en ? `<small>${line.en}</small>` : ""}</span>`;
      }
    }

    function load() {
      if (audio.src) return;
      audio.preload = "auto";
      audio.src = call.src;
    }

    function play() {
      load();
      if (currentAudio && currentAudio !== audio) currentAudio.pause();
      currentAudio = audio;
      audio.play().catch(() => card.classList.remove("playing", "loading"));
    }

    function seek(seconds) {
      const to = Math.min(Math.max(seconds, 0), call.duration - 0.1);
      load();
      if (audio.readyState >= 1) {
        audio.currentTime = to;
        render();
      } else {
        audio.addEventListener("loadedmetadata", () => {
          audio.currentTime = to;
          render();
        }, { once: true });
      }
    }

    playBtn.addEventListener("click", () => (audio.paused ? play() : audio.pause()));
    wave.addEventListener("click", (event) => {
      const rect = wave.getBoundingClientRect();
      seek(((event.clientX - rect.left) / rect.width) * call.duration);
      play();
    });
    wave.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 5, ArrowLeft: -5 }[event.key];
      if (step) {
        event.preventDefault();
        seek(audio.currentTime + step);
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        audio.paused ? play() : audio.pause();
      }
    });

    audio.addEventListener("play", () => {
      card.classList.add("playing");
      playBtn.setAttribute("aria-label", `Pause sample call: ${call.title}`);
    });
    audio.addEventListener("pause", () => {
      card.classList.remove("playing", "loading");
      playBtn.setAttribute("aria-label", `Play sample call: ${call.title}`);
    });
    audio.addEventListener("waiting", () => card.classList.add("loading"));
    audio.addEventListener("playing", () => card.classList.remove("loading"));
    audio.addEventListener("timeupdate", render);
    audio.addEventListener("ended", () => {
      audio.currentTime = 0;
      render();
      showOutcome();
    });

    showOutcome();
    return card;
  }

  // Only languages that are ready get a player; the rest are listed as coming.
  const callsList = $("#calls-list");
  (window.SAMPLE_CALLS || []).filter((call) => !call.locked).forEach((call) => callsList.appendChild(callCard(call)));

  // ============================================================
  // LIVE DEMO
  // ============================================================

  const STUDENTS = [
    { name: "Aarav Sharma", parent: "Mr. Sharma", lang: "Hindi",
      quote: "He has a dental appointment. He'll come tomorrow.", reason: "Dental appointment · back tomorrow" },
    { name: "Diya Reddy", parent: "Mrs. Reddy", lang: "Telugu",
      quote: "She has a fever. She'll be back on Monday.", reason: "Fever · returns Monday" },
    { name: "Kabir Khan", parent: "Mr. Khan", lang: "English",
      quote: "We're at a family wedding until Thursday.", reason: "Family wedding · back Friday" },
    { name: "Ananya Iyer", parent: "Mrs. Iyer", lang: "Tamil", missesFirstCall: true,
      quote: "Sorry, I missed your call. She has a cold, back tomorrow.", reason: "Cold · back tomorrow" },
    { name: "Rohan Das", parent: "Mr. Das", lang: "Bengali",
      quote: "Our car broke down on the way. He'll be there tomorrow.", reason: "Transport issue · back tomorrow" },
    { name: "Meera Nair", parent: "Mrs. Nair", lang: "Malayalam",
      quote: "We're travelling home for a festival this week.", reason: "Festival travel · back next week" },
  ];

  const register = $("#demo-register");
  const casesEl = $("#demo-cases");
  const saveBtn = $("#demo-save");
  const resetBtn = $("#demo-reset");
  const hint = $("#demo-hint");
  const statAbsent = $("#stat-absent");
  const statDone = $("#stat-done");

  const absent = new Set();
  let timers = [];
  let saved = false;
  let doneCount = 0;

  const initials = (name) => name.split(" ").map((p) => p[0]).join("");
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function renderRegister() {
    register.innerHTML = "";
    STUDENTS.forEach((s, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(absent.has(i)));
      btn.disabled = saved;
      btn.innerHTML = `
        <span class="who">
          <span class="avatar">${initials(s.name)}</span>
          <span><b>${s.name}</b><small>${s.parent} · ${s.lang}</small></span>
        </span>
        <span class="toggle-st">${absent.has(i) ? "Absent" : "Present"}</span>`;
      btn.addEventListener("click", () => {
        absent.has(i) ? absent.delete(i) : absent.add(i);
        renderRegister();
        updateHint();
      });
      li.appendChild(btn);
      register.appendChild(li);
    });
  }

  function updateHint() {
    if (saved) return;
    hint.textContent = absent.size
      ? `${absent.size} absent · ${STUDENTS.length - absent.size} present. Press save.`
      : "Tip: tap a name to mark them absent.";
    saveBtn.disabled = absent.size === 0;
  }

  const LABELS = ["WhatsApp", "Delivered", "AI call", "Reason"];

  function caseMarkup(s) {
    return `
      <div class="case-top">
        <span class="who">
          <span class="avatar">${initials(s.name)}</span>
          <span><b>${s.name}</b><small>${s.parent} · ${s.lang}</small></span>
        </span>
        <span class="case-status live">Queued</span>
      </div>
      <div class="track">${LABELS.map(() => "<span></span>").join("")}</div>
      <div class="track-labels">${LABELS.map((l) => `<span>${l}</span>`).join("")}</div>`;
  }

  function setStatus(el, text, kind = "live", filled = 0) {
    const status = $(".case-status", el);
    status.textContent = text;
    status.className = `case-status ${kind}`;
    $$(".track span", el).forEach((bar, n) => bar.classList.toggle("on", n < filled));
  }

  function recordReason(el, s) {
    setStatus(el, "Reason recorded", "done", 4);
    $(".case-result", el)?.remove();
    const result = document.createElement("div");
    result.className = "case-result";
    result.innerHTML = `
      <q>${s.quote}</q>
      <small>Recorded: <b>${s.reason}</b>${s.lang !== "English" ? ` · translated from ${s.lang}` : ""}</small>`;
    el.appendChild(result);
    doneCount += 1;
    statDone.textContent = doneCount;
  }

  function placeCall(el, s, offset, isRetry) {
    later(() => setStatus(el, `Calling in ${s.lang}…`, "live", 3), offset);
    later(() => {
      if (s.missesFirstCall && !isRetry) {
        setStatus(el, "No answer", "warn", 3);
        const result = document.createElement("div");
        result.className = "case-result";
        result.innerHTML = `<small>Parent didn't pick up. Flagged for staff.</small>`;
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "btn btn-primary btn-sm";
        retry.textContent = "Retry call";
        retry.addEventListener("click", () => {
          result.remove();
          placeCall(el, s, 0, true);
        });
        result.appendChild(retry);
        el.appendChild(result);
      } else {
        recordReason(el, s);
      }
    }, offset + 2600);
  }

  function runFollowUp(index, order) {
    const s = STUDENTS[index];
    const el = document.createElement("li");
    el.className = "case";
    el.innerHTML = caseMarkup(s);
    casesEl.appendChild(el);

    const start = order * 900;
    later(() => setStatus(el, "WhatsApp sent", "live", 1), start + 700);
    later(() => setStatus(el, "Read ✓✓", "live", 2), start + 1600);
    placeCall(el, s, start + 2500, false);
  }

  saveBtn.addEventListener("click", () => {
    if (!absent.size || saved) return;
    saved = true;
    renderRegister();
    saveBtn.disabled = true;
    hint.textContent = "Saved. This preview shows how follow-ups will work.";
    casesEl.innerHTML = "";
    statAbsent.textContent = absent.size;
    [...absent].sort((a, b) => a - b).forEach((index, order) => runFollowUp(index, order));
  });

  resetBtn.addEventListener("click", () => {
    timers.forEach(clearTimeout);
    timers = [];
    absent.clear();
    saved = false;
    doneCount = 0;
    statAbsent.textContent = "0";
    statDone.textContent = "0";
    casesEl.innerHTML = `<li class="demo-empty">No absences yet. Mark someone absent and save.</li>`;
    renderRegister();
    updateHint();
  });

  // Two absentees to start with, so the demo is one click away.
  absent.add(1);
  absent.add(3);
  renderRegister();
  updateHint();

  // ============================================================
  // CONTACT FORM → saved by Callroll (with WhatsApp / email as backup)
  // ============================================================

  const form = $("#contact-form");
  const done = $("#form-done");
  const note = $("#form-note");
  const button = $("button[type=submit]", form);
  const email = $("[data-contact-email]").getAttribute("href").replace("mailto:", "");
  const whatsapp = "919391795567";
  const openedAt = Date.now();
  const firstNote = note.innerHTML;

  const phoneOk = (value) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 10) return /^[6-9]/.test(digits);
    return digits.length >= 11 && digits.length <= 15;
  };
  const emailOk = (value) => !value || /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(value);

  const summary = (data) =>
    [
      `Demo request: ${data.institution}`,
      `Name: ${data.name} (${data.role})`,
      `Phone: ${data.phone}`,
      data.email && `Email: ${data.email}`,
      data.city && `City: ${data.city}`,
      `Students: ${data.size}`,
      data.message && `Note: ${data.message}`,
    ]
      .filter(Boolean)
      .join("\n");

  // If sending fails, offer WhatsApp and email with everything filled in.
  const showBackup = (data) => {
    const text = summary(data);
    note.classList.add("is-error");
    note.textContent = "Couldn't send just now. Please send it by ";
    const wa = document.createElement("a");
    wa.href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;
    wa.target = "_blank";
    wa.rel = "noopener noreferrer";
    wa.textContent = "WhatsApp";
    const mail = document.createElement("a");
    mail.href = `mailto:${email}?subject=${encodeURIComponent(`Demo request — ${data.institution}`)}&body=${encodeURIComponent(text)}`;
    mail.textContent = "email";
    note.append(wa, " or ", mail, " instead. Your details are already filled in.");
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.sending) return;

    const data = Object.fromEntries(new FormData(form).entries());
    for (const key of Object.keys(data)) data[key] = String(data[key]).trim();
    const problems = {
      name: data.name.length < 2,
      phone: !phoneOk(data.phone),
      institution: data.institution.length < 2,
      email: !emailOk(data.email),
    };
    for (const [key, bad] of Object.entries(problems)) form.elements[key].classList.toggle("invalid", bad);
    if (Object.values(problems).some(Boolean)) {
      note.classList.add("is-error");
      note.textContent = problems.phone && data.phone
        ? "Please check the phone number."
        : problems.email
          ? "Please check the email address, or leave it empty."
          : "Please fill in your name, phone and school or college.";
      return;
    }

    form.dataset.sending = "1";
    button.disabled = true;
    button.textContent = "Sending…";
    note.classList.remove("is-error");
    note.textContent = "Sending your request…";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${form.dataset.api}/public/demo-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
        body: JSON.stringify({ ...data, page: location.pathname, elapsed_ms: Date.now() - openedAt }),
      });
      if (response.ok) {
        $("[data-done-name]", done).textContent = data.name.split(" ")[0];
        $("[data-done-phone]", done).textContent = data.phone;
        form.hidden = true;
        done.hidden = false;
        form.reset();
        note.innerHTML = firstNote;
      } else if (response.status === 400 || response.status === 422) {
        const reply = await response.json().catch(() => ({}));
        note.classList.add("is-error");
        note.textContent = typeof reply.detail === "string" ? reply.detail : "Please check your details and try again.";
      } else {
        showBackup(data);
      }
    } catch {
      showBackup(data);
    } finally {
      clearTimeout(timer);
      delete form.dataset.sending;
      button.disabled = false;
      button.textContent = "Request a demo";
    }
  });

  // Typing again puts the usual note back after a problem.
  form.addEventListener("input", (event) => {
    event.target.classList.remove("invalid");
    if (note.classList.contains("is-error") && !form.dataset.sending) {
      note.classList.remove("is-error");
      note.innerHTML = firstNote;
    }
  });

  $("#form-again").addEventListener("click", () => {
    done.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });
})();
