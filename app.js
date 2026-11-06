(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ============================================================
  // NAV
  // ============================================================

  const nav = $("#nav");
  const toggle = $("#nav-toggle");
  const links = $("#nav-links");

  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const setMenu = (open) => {
    links.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  toggle.addEventListener("click", () => setMenu(!links.classList.contains("open")));
  $$("a", links).forEach((a) => a.addEventListener("click", () => setMenu(false)));

  $("#year").textContent = new Date().getFullYear();

  // ============================================================
  // REVEAL ON SCROLL
  // ============================================================

  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }
      }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    $$(".reveal").forEach((el, i) => {
      el.style.transitionDelay = `${(i % 4) * 70}ms`;
      io.observe(el);
    });
  } else {
    $$(".reveal").forEach((el) => el.classList.add("visible"));
  }

  // ============================================================
  // HERO PHONE LOOP
  // ============================================================

  const hero = $(".hero-visual");
  const heroItems = $$("[data-seq]", hero).sort((a, b) => a.dataset.seq - b.dataset.seq);
  const HERO_TIMES = [300, 1200, 2600, 4300, 5700];
  const HERO_LOOP = 9500;

  if (!reduceMotion) {
    hero.classList.add("playing");
    const play = () => {
      heroItems.forEach((el) => el.classList.remove("shown"));
      heroItems.forEach((el, i) => setTimeout(() => el.classList.add("shown"), HERO_TIMES[i]));
    };
    play();
    setInterval(play, HERO_LOOP);
  }

  // ============================================================
  // SEGMENTED SWITCHES (before/after, school/college)
  // ============================================================

  function setupSwitch(attr) {
    const buttons = $$(`[data-${attr}]`);
    if (!buttons.length) return;
    const switchEl = buttons[0].closest(".switch");

    buttons.forEach((btn, index) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => {
          b.classList.toggle("active", b === btn);
          b.setAttribute("aria-selected", String(b === btn));
        });
        switchEl.classList.toggle("right", index === 1);
        $$(`[data-${attr}-panel]`).forEach((panel) => {
          panel.classList.toggle("is-hidden", panel.dataset[`${attr}Panel`] !== btn.dataset[attr]);
        });
      });
    });
  }

  setupSwitch("compare");
  setupSwitch("portal");

  // ============================================================
  // WORKFLOW STEPS (auto-advance until the visitor clicks)
  // ============================================================

  const flow = $(".flow");
  const steps = $$(".flow-step");
  const panels = $$(".flow-panel");
  const STEP_MS = 5000;
  let stepIndex = 0;
  let stepTimer = null;
  let autoplay = !reduceMotion;

  flow.style.setProperty("--step-ms", `${STEP_MS}ms`);

  function showStep(i) {
    stepIndex = i;
    steps.forEach((s, n) => {
      s.classList.toggle("active", n === i);
      s.setAttribute("aria-selected", String(n === i));
      // Restart the progress bar animation.
      const bar = $(".fs-bar i", s);
      bar.style.animation = "none";
      void bar.offsetWidth;
      bar.style.animation = "";
    });
    panels.forEach((p, n) => p.classList.toggle("active", n === i));

    clearTimeout(stepTimer);
    if (autoplay) stepTimer = setTimeout(() => showStep((i + 1) % steps.length), STEP_MS);
  }

  steps.forEach((s, i) => s.addEventListener("click", () => {
    autoplay = false;
    flow.classList.add("paused");
    showStep(i);
  }));

  if (reduceMotion) flow.classList.add("paused");

  // Start the cycle only once the section is on screen.
  if ("IntersectionObserver" in window && autoplay) {
    const flowIo = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        showStep(stepIndex);
        flowIo.disconnect();
      }
    }, { threshold: 0.3 });
    flowIo.observe(flow);
  } else {
    showStep(0);
  }

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
      // A recording without captions has no pauses to show.
      const speaking = !call.lines.length || (line && t < end);
      return {
        height: speaking ? 35 + random() * 65 : 12 + random() * 8,
        who: line ? line.who : "ai",
      };
    });
  }

  // A language that is not ready: visible, but nothing to play.
  function lockedCallCard(call) {
    const card = document.createElement("article");
    card.className = "call is-locked";
    card.innerHTML = `
      <div class="call-top">
        <span>${call.kicker}</span>
        <em class="soon">Coming soon</em>
      </div>
      <h3>${call.title}</h3>
      <div class="call-agent">
        <span class="call-initial">${call.agent[0]}</span>
        <span><b>${call.agent}</b> · ${call.voiceLabel}</span>
      </div>
      <div class="call-player" aria-hidden="true">
        <span class="call-lock">
          <svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="10" rx="2"/></svg>
        </span>
        <div class="call-wave">
          ${waveBars(call).map((b) => `<i style="height:${b.height.toFixed(0)}%"></i>`).join("")}
        </div>
      </div>`;
    return card;
  }

  function callCard(call) {
    if (call.locked) return lockedCallCard(call);

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
          Outbound
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

    // Load the MP3 only when the visitor first plays or seeks.
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
      // Chrome ignores a seek before the file's length is known.
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

  const callsList = $("#calls-list");
  (window.SAMPLE_CALLS || []).forEach((call) => callsList.appendChild(callCard(call)));

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

  // Start with two absentees so the demo is one click away.
  absent.add(1);
  absent.add(3);
  renderRegister();
  updateHint();

  // ============================================================
  // CONTACT FORM → email app
  // ============================================================

  const form = $("#contact-form");
  const email = $("[data-contact-email]").getAttribute("href").replace("mailto:", "");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    let valid = true;

    $$("[required]", form).forEach((input) => {
      const ok = input.value.trim().length > 1;
      input.classList.toggle("invalid", !ok);
      valid = valid && ok;
    });

    if (!valid) {
      $("#form-note").textContent = "Please fill in your name, phone and institution.";
      return;
    }

    const data = new FormData(form);
    const subject = `Demo request — ${data.get("institution")}`;
    const body = [
      `Name: ${data.get("name")}`,
      `Phone: ${data.get("phone")}`,
      `Institution: ${data.get("institution")}`,
      `Students: ${data.get("size")}`,
    ].join("\n");

    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    $("#form-note").textContent = "Thanks! Your email app should open now.";
  });
})();
