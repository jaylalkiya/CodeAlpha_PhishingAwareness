/* PhishGuard - interactive phishing awareness module. No dependencies. */
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // ------------------------------------------------------------ progress

  const MODULES = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"];
  const STORE = "phishguard-progress-v1";
  let progress = { done: [] };
  try { progress = JSON.parse(localStorage.getItem(STORE)) || progress; } catch (e) { /* private mode */ }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch (e) { /* ignore */ }
  }

  function complete(id) {
    if (!progress.done.includes(id)) {
      progress.done.push(id);
      save();
    }
    renderProgress();
  }

  function renderProgress() {
    const n = MODULES.filter(m => progress.done.includes(m)).length;
    $("#progressFill").style.width = `${(n / MODULES.length) * 100}%`;
    $("#progressText").textContent = `${n} / ${MODULES.length}`;
    $$("[data-nav]").forEach(a =>
      a.classList.toggle("done", progress.done.includes(a.dataset.nav)));
  }

  // ------------------------------------------------------------ routing

  function route() {
    const id = (location.hash || "#home").slice(1);
    const page = document.getElementById(id) && document.getElementById(id).classList.contains("page")
      ? id : "home";
    $$(".page").forEach(p => p.classList.toggle("active", p.id === page));
    $$("[data-nav]").forEach(a => a.classList.toggle("current", a.dataset.nav === page));
    $("#sidebar").classList.remove("open");
    // Sections share ids with the hash, so the browser also jumps to them; undo that.
    const top = () => window.scrollTo({ top: 0, behavior: "instant" });
    top();
    setTimeout(top, 0);
    // Reading modules count as done once opened; 7 and 8 need finishing.
    if (["m1", "m4", "m5", "m6"].includes(page)) complete(page);
  }

  $("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  window.addEventListener("hashchange", route);
  window.addEventListener("load", () => window.scrollTo({ top: 0, behavior: "instant" }));

  // ------------------------------------------------------------ module 1

  PHISH_TYPES.forEach(t => {
    const card = el("div", "card type");
    card.append(el("span", "type-icon", t.icon), el("h4", "", t.name), el("p", "", t.text));
    $("#typesGrid").append(card);
  });

  // ------------------------------------------------------------ module 2

  const found = new Set();
  function revealFlag(id) {
    if (found.has(id)) return;
    found.add(id);
    $$(`[data-flag="${id}"]`).forEach(n => n.classList.add("found"));
    const item = el("div", "flag-item");
    item.append(el("b", "", `🚩 ${EMAIL_FLAGS[id].title}`), el("p", "", EMAIL_FLAGS[id].text));
    $("#flagList").prepend(item);
    $("#flagCount").textContent = found.size;
    if (found.size === Object.keys(EMAIL_FLAGS).length) {
      complete("m2");
      const win = el("div", "callout good", "Great job! You found every red flag. Most real phishing emails show several of these at once.");
      $("#flagList").prepend(win);
    }
  }
  $$("[data-flag]").forEach(n => {
    n.tabIndex = 0;
    n.addEventListener("click", () => revealFlag(n.dataset.flag));
    n.addEventListener("keydown", e => { if (e.key === "Enter") revealFlag(n.dataset.flag); });
  });
  $("#revealFlags").addEventListener("click", () =>
    Object.keys(EMAIL_FLAGS).forEach(revealFlag));

  // ------------------------------------------------------------ module 3: lab

  let urlScore = 0, urlAnswered = 0;
  $("#urlTotal").textContent = URL_CHALLENGES.length;
  URL_CHALLENGES.forEach(c => {
    const row = el("div", "url-row");
    const code = el("code", "url-text", c.url);
    const btns = el("div", "url-btns");
    const safe = el("button", "btn small", "✔ Safe");
    const sus = el("button", "btn small", "✖ Suspicious");
    const why = el("p", "url-why");
    btns.append(safe, sus);
    row.append(code, btns, why);
    const answer = guessSafe => {
      if (row.classList.contains("answered")) return;
      row.classList.add("answered");
      const right = guessSafe === c.safe;
      row.classList.add(right ? "right" : "wrong");
      (guessSafe ? safe : sus).classList.add("picked");
      why.textContent = `${right ? "Correct" : "Not quite"}: this link is ${c.safe ? "SAFE" : "SUSPICIOUS"}. ${c.why}`;
      urlAnswered++;
      if (right) urlScore++;
      $("#urlScore").textContent = urlScore;
      if (urlAnswered === URL_CHALLENGES.length) complete("m3");
    };
    safe.addEventListener("click", () => answer(true));
    sus.addEventListener("click", () => answer(false));
    $("#urlLab").append(row);
  });

  // ------------------------------------------------------------ module 3: inspector

  const MULTI_TLDS = ["co.in", "org.in", "net.in", "gov.in", "ac.in", "co.uk", "org.uk",
    "ac.uk", "com.au", "co.jp", "com.br", "co.nz", "com.sg"];
  const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly",
    "rb.gy", "ow.ly", "shorturl.at", "tiny.cc"];
  const RISKY_TLDS = ["xyz", "top", "tk", "ml", "ga", "cf", "gq", "zip", "mov", "click",
    "rest", "buzz", "country", "work", "support", "help"];
  const BAIT_WORDS = ["login", "signin", "secure", "verify", "account", "update", "kyc",
    "support", "wallet", "password", "confirm", "banking", "auth", "billing"];

  function registeredDomain(host) {
    const labels = host.split(".");
    if (labels.length <= 2) return host;
    const lastTwo = labels.slice(-2).join(".");
    return MULTI_TLDS.includes(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
  }

  function inspect(raw) {
    raw = raw.trim();
    if (!raw) return null;
    let url;
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`);
    } catch (e) {
      return { error: "That doesn't look like a valid URL." };
    }
    const host = url.hostname.toLowerCase();
    const isIP = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
    const domain = isIP ? host : registeredDomain(host);
    const sub = isIP ? "" : host.slice(0, Math.max(0, host.length - domain.length - 1));
    const tld = domain.split(".").pop();
    const warn = [];

    if (url.protocol === "http:") warn.push("Uses plain HTTP, so the connection isn't even encrypted.");
    if (isIP) warn.push("Uses a raw IP address instead of a domain name.");
    if (url.username || raw.split("//").pop().split("/")[0].includes("@"))
      warn.push("Contains '@' before the host. The browser ignores everything before it.");
    if (host.includes("xn--"))
      warn.push("Contains punycode (xn--), which can hide look-alike letters from other alphabets.");
    if (SHORTENERS.includes(domain))
      warn.push("It's a link shortener, which hides the real destination.");
    if (/[a-z][01][a-z]|[01][a-z]{2}/.test(domain.split(".")[0]))
      warn.push("Digits mixed into the name (0 for o, 1 for l) suggest typosquatting.");
    if (/\.(com|net|org|in|co)\b/.test(sub))
      warn.push(`The subdomain "${sub}" looks like another website's domain, a common trick to borrow a brand's name.`);
    if (sub.split(".").filter(Boolean).length >= 3)
      warn.push("Unusually many subdomain levels.");
    if ((domain.split(".")[0].match(/-/g) || []).length >= 2)
      warn.push("Several hyphens in the domain name.");
    if (RISKY_TLDS.includes(tld))
      warn.push(`The .${tld} ending is cheap and often abused by phishing sites (not always malicious).`);
    const bait = BAIT_WORDS.filter(w => host.includes(w));
    if (bait.length) warn.push(`Security-sounding words in the hostname (${bait.join(", ")}) are meant to reassure you.`);
    if (raw.length > 90) warn.push("Very long URL, which can push the real domain out of view.");

    return { url, host, domain, sub, warn };
  }

  function showInspection() {
    const out = $("#urlResult");
    out.replaceChildren();
    const r = inspect($("#urlInput").value);
    if (!r) return;
    if (r.error) { out.append(el("p", "bad", r.error)); return; }
    const line = el("div", "url-anatomy small-anatomy");
    line.append(el("span", "u-scheme", r.url.protocol + "//"));
    if (r.sub) line.append(el("span", "u-sub", r.sub + "."));
    line.append(el("span", "u-domain", r.domain));
    line.append(el("span", "u-path", r.url.pathname + r.url.search));
    out.append(line);
    const p = el("p");
    p.append("Real domain: ", el("b", "", r.domain));
    out.append(p);
    const verdict = r.warn.length >= 2 ? ["bad", "⚠ Likely phishing. Don't open it."]
      : r.warn.length === 1 ? ["meh", "⚠ Be careful. Check that this is really the site you expect."]
      : ["good", "No obvious red flags. Still make sure this is the exact domain you expected."];
    out.append(el("p", `verdict ${verdict[0]}`, verdict[1]));
    if (r.warn.length) {
      const ul = el("ul", "checks warn-list");
      r.warn.forEach(w => ul.append(el("li", "", w)));
      out.append(ul);
    }
    out.append(el("p", "muted small", "Heuristic check only. It can't prove a site is safe."));
  }
  $("#urlCheck").addEventListener("click", showInspection);
  $("#urlInput").addEventListener("keydown", e => { if (e.key === "Enter") showInspection(); });

  // ------------------------------------------------------------ module 4

  TACTICS.forEach(t => {
    const card = el("button", "card tactic");
    card.type = "button";
    card.append(el("h4", "", t.name), el("p", "", t.text), el("p", "tactic-eg", t.eg));
    card.addEventListener("click", () => card.classList.toggle("open"));
    $("#tacticsGrid").append(card);
  });

  // ------------------------------------------------------------ module 5

  CASES.forEach(c => {
    const card = el("article", "case");
    const head = el("div", "case-head");
    head.append(el("span", "case-year", c.year), el("h3", "", c.title));
    card.append(head, el("p", "", c.how));
    const lesson = el("p", "case-lesson");
    lesson.append(el("b", "", "Lesson: "), c.lesson);
    card.append(lesson);
    $("#caseList").append(card);
  });

  // ------------------------------------------------------------ module 6

  PRACTICES.forEach(([title, text], i) => {
    const card = el("div", "card practice");
    card.append(el("span", "practice-n", String(i + 1).padStart(2, "0")),
      el("h4", "", title), el("p", "", text));
    $("#practiceGrid").append(card);
  });
  IF_CLICKED.forEach(s => $("#ifClicked").append(el("li", "", s)));

  // ------------------------------------------------------------ module 7: game

  let gi = 0, gscore = 0;
  function renderGame() {
    const box = $("#game");
    box.replaceChildren();
    if (gi >= GAME_EMAILS.length) {
      const done = el("div", "card result");
      done.append(el("h3", "", `You scored ${gscore} / ${GAME_EMAILS.length}`),
        el("p", "", gscore === GAME_EMAILS.length ? "Perfect! Attackers will have a hard time with you."
          : gscore >= 6 ? "Good work. Review the ones you missed, because attackers only need one mistake."
          : "Keep practising. Revisit modules 2 and 3, then try again."));
      const again = el("button", "btn", "Play again");
      again.addEventListener("click", () => { gi = 0; gscore = 0; renderGame(); });
      const next = el("a", "btn primary", "Take the final quiz →");
      next.href = "#m8";
      const actions = el("div", "hero-actions");
      actions.append(again, next);
      done.append(actions);
      box.append(done);
      complete("m7");
      return;
    }
    const m = GAME_EMAILS[gi];
    box.append(el("p", "muted", `Email ${gi + 1} of ${GAME_EMAILS.length} · Score ${gscore}`));
    const mail = el("div", "mail");
    const head = el("div", "mail-head");
    head.append(el("div", "mail-subject", m.subject));
    const meta = el("div", "mail-meta");
    meta.append(el("span", "avatar", m.from.trim()[0]), el("div", "", m.from));
    head.append(meta);
    const body = el("div", "mail-body");
    m.body.split("\n\n").forEach(par => body.append(el("p", "pre", par)));
    const status = el("div", "status-bar", "Hover over or tap the link to see where it goes");
    if (m.link) {
      const [text, dest] = m.link;
      const isFile = dest.startsWith("attachment");
      const link = el(isFile ? "div" : "span", isFile ? "attach" : "fake-btn", isFile ? `📎 ${text}` : text);
      link.tabIndex = 0;
      const show = () => { status.textContent = dest; status.classList.add("on"); };
      link.addEventListener("mouseenter", show);
      link.addEventListener("focus", show);
      link.addEventListener("click", show);
      body.append(link);
    }
    mail.append(head, body);
    if (m.link) mail.append(status);
    box.append(mail);

    const choice = el("div", "choice");
    const phish = el("button", "btn danger", "🎣 Phish");
    const legit = el("button", "btn ok", "✔ Legit");
    choice.append(phish, legit);
    box.append(choice);
    const answer = guessPhish => {
      phish.disabled = legit.disabled = true;
      const right = guessPhish === m.phish;
      if (right) gscore++;
      const fb = el("div", `callout ${right ? "good" : "bad"}`);
      fb.append(el("b", "", `${right ? "Correct!" : "Not quite."} This one is ${m.phish ? "PHISHING" : "LEGIT"}. `), m.why);
      const next = el("button", "btn primary", gi === GAME_EMAILS.length - 1 ? "See results" : "Next email →");
      next.addEventListener("click", () => { gi++; renderGame(); });
      box.append(fb, next);
      if (m.link) { status.textContent = m.link[1]; status.classList.add("on"); }
    };
    phish.addEventListener("click", () => answer(true));
    legit.addEventListener("click", () => answer(false));
  }
  renderGame();

  // ------------------------------------------------------------ module 8: quiz

  let qi = 0, qscore = 0;
  const PASS = 0.8;
  function renderQuiz() {
    const box = $("#quiz");
    box.replaceChildren();
    $("#certificate").hidden = true;
    if (qi >= QUIZ.length) return renderQuizResult(box);
    const q = QUIZ[qi];
    box.append(el("p", "muted", `Question ${qi + 1} of ${QUIZ.length} · Score ${qscore}`));
    const bar = el("div", "progress-track quiz-track");
    const fill = el("div", "progress-fill");
    fill.style.width = `${(qi / QUIZ.length) * 100}%`;
    bar.append(fill);
    box.append(bar, el("h3", "question", q.q));
    const opts = el("div", "options");
    q.options.forEach((text, i) => {
      const b = el("button", "option", text);
      b.addEventListener("click", () => {
        $$(".option", opts).forEach((o, j) => {
          o.disabled = true;
          if (j === q.answer) o.classList.add("correct");
        });
        if (i === q.answer) qscore++; else b.classList.add("incorrect");
        const fb = el("div", `callout ${i === q.answer ? "good" : "bad"}`);
        fb.append(el("b", "", i === q.answer ? "Correct. " : "Incorrect. "), q.why);
        const next = el("button", "btn primary", qi === QUIZ.length - 1 ? "See my result" : "Next question →");
        next.addEventListener("click", () => { qi++; renderQuiz(); });
        box.append(fb, next);
      });
      opts.append(b);
    });
    box.append(opts);
  }

  function renderQuizResult(box) {
    const pct = Math.round((qscore / QUIZ.length) * 100);
    const passed = qscore / QUIZ.length >= PASS;
    const card = el("div", `card result ${passed ? "pass" : "fail"}`);
    card.append(el("div", "big-score", `${pct}%`),
      el("h3", "", passed ? "You passed! 🎉" : "Not quite there yet"),
      el("p", "", `You answered ${qscore} of ${QUIZ.length} correctly. ` +
        (passed ? "Enter your name to generate your certificate."
          : "You need 80% to pass. Review the modules and try again.")));
    const actions = el("div", "hero-actions");
    if (passed) {
      complete("m8");
      const input = el("input", "name-input");
      input.placeholder = "Your full name";
      input.maxLength = 60;
      const make = el("button", "btn primary", "Get certificate");
      make.addEventListener("click", () => {
        if (input.value.trim()) renderCertificate(input.value.trim(), pct);
        else input.focus();
      });
      input.addEventListener("keydown", e => { if (e.key === "Enter") make.click(); });
      actions.append(input, make);
    }
    const retry = el("button", "btn", "Retake quiz");
    retry.addEventListener("click", () => { qi = 0; qscore = 0; renderQuiz(); });
    actions.append(retry);
    card.append(actions);
    box.append(card);
  }

  function renderCertificate(name, pct) {
    const wrap = $("#certificate");
    wrap.replaceChildren();
    const cert = el("div", "certificate");
    const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    cert.append(
      el("div", "cert-shield", "⛨"),
      el("p", "cert-top", "Certificate of Completion"),
      el("p", "cert-small", "This certifies that"),
      el("h2", "cert-name", name),
      el("p", "cert-small", "has successfully completed"),
      el("h3", "cert-course", "PhishGuard: Phishing Awareness Training"),
      el("p", "cert-small", `with a final quiz score of ${pct}% · ${date}`),
      el("p", "cert-foot", "Modules: phishing types · email red flags · fake websites & URLs · social engineering · real-world attacks · best practices"));
    const print = el("button", "btn primary no-print", "🖨 Print / Save as PDF");
    print.addEventListener("click", () => window.print());
    wrap.append(cert, print);
    wrap.hidden = false;
    wrap.scrollIntoView({ behavior: "smooth" });
  }
  renderQuiz();

  // ------------------------------------------------------------ start

  renderProgress();
  route();
})();
