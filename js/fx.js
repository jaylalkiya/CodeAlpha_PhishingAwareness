/* PhishGuard - visual effects: boot sequence, matrix rain, decrypt headings,
   staggered reveals, scan sweep, cursor glow, toasts. All of it switches off
   for users who ask their OS for reduced motion. */
const FX = (function () {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF<>/{}[]$#%&*+=";
  const SCRAMBLE = "!<>-_\\/[]{}=+*^?#01ABCDEF$%";

  // ------------------------------------------------------------ matrix rain

  function rain() {
    const canvas = document.getElementById("rain");
    if (!canvas || reduce) return;
    const ctx = canvas.getContext("2d");
    const size = 16;
    let cols = 0, drops = [], speed = [], w = 0, h = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / size);
      drops = Array.from({ length: cols }, () => Math.random() * -h / size);
      speed = Array.from({ length: cols }, () => 0.35 + Math.random() * 0.65);
      ctx.fillStyle = "#020403";
      ctx.fillRect(0, 0, w, h);
    }
    resize();
    window.addEventListener("resize", resize);

    let last = 0;
    function frame(t) {
      requestAnimationFrame(frame);
      if (document.hidden || t - last < 45) return;      // ~22 fps is plenty
      last = t;
      ctx.fillStyle = "rgba(2, 4, 3, 0.11)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${size}px "JetBrains Mono", Consolas, monospace`;
      for (let i = 0; i < cols; i++) {
        const y = drops[i] * size;
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        ctx.fillStyle = Math.random() > 0.975 ? "#d9ffe8" : "rgba(0, 255, 136, 0.55)";
        ctx.fillText(ch, i * size, y);
        drops[i] += speed[i];
        if (y > h && Math.random() > 0.975) drops[i] = Math.random() * -20;
      }
    }
    requestAnimationFrame(frame);

    // gentle parallax with the mouse
    window.addEventListener("mousemove", e => {
      const dx = (e.clientX / window.innerWidth - 0.5) * -14;
      const dy = (e.clientY / window.innerHeight - 0.5) * -14;
      canvas.style.transform = `translate(${dx}px, ${dy}px)`;
    }, { passive: true });
  }

  // ------------------------------------------------------------ cursor glow

  function cursorGlow() {
    if (reduce) return;
    const root = document.documentElement;
    let raf = 0, x = 0, y = 0;
    window.addEventListener("mousemove", e => {
      x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(() => {
        root.style.setProperty("--mx", x + "px");
        root.style.setProperty("--my", y + "px");
        raf = 0;
      });
    }, { passive: true });
  }

  // ------------------------------------------------------------ decrypt text

  const running = new WeakMap();
  function scramble(el, duration = 700) {
    if (!el || reduce || el.children.length) return;
    const target = el.dataset.plain || (el.dataset.plain = el.textContent);
    cancelAnimationFrame(running.get(el));
    const start = performance.now();
    function step(now) {
      const p = Math.min(1, (now - start) / duration);
      const reveal = Math.floor(p * target.length);
      let out = target.slice(0, reveal);
      for (let i = reveal; i < target.length; i++) {
        out += target[i] === " " ? " " : SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
      }
      el.textContent = out;
      if (p < 1) running.set(el, requestAnimationFrame(step));
      else el.textContent = target;
    }
    running.set(el, requestAnimationFrame(step));
  }

  // ------------------------------------------------------------ typewriter

  function type(el, speed = 14) {
    if (!el) return;
    const full = el.dataset.full || (el.dataset.full = el.textContent.trim());
    if (reduce) { el.textContent = full; el.classList.add("done"); return; }
    el.classList.add("typed");
    el.classList.remove("done");
    el.textContent = "";
    let i = 0;
    clearInterval(el._typer);
    el._typer = setInterval(() => {
      i += 2;
      el.textContent = full.slice(0, i);
      if (i >= full.length) { clearInterval(el._typer); el.classList.add("done"); }
    }, speed);
  }

  // ------------------------------------------------------------ staggered reveal

  const observer = "IntersectionObserver" in window
    ? new IntersectionObserver(entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("in"); observer.unobserve(e.target); }
      }), { threshold: 0.08 })
    : null;

  function reveal(page) {
    if (reduce || !observer) return;
    const items = page.querySelectorAll(".card, .mini, .stat, .case, .url-row, .url-anatomy, .callout, .legend");
    items.forEach((el, i) => {
      el.classList.remove("in");
      el.classList.add("rv");
      el.style.setProperty("--d", `${Math.min(i % 8, 7) * 70}ms`);
      observer.observe(el);
    });
  }

  // ------------------------------------------------------------ scan sweep

  function sweep() {
    const s = document.getElementById("scan");
    if (!s || reduce) return;
    s.classList.remove("go");
    void s.offsetWidth;            // restart the animation
    s.classList.add("go");
  }

  // ------------------------------------------------------------ prompt

  const COMMANDS = {
    home: "./phishguard --start", m1: "./train --module 01 --topic phishing",
    m2: "./train --module 02 --scan email.eml", m3: "./train --module 03 --inspect urls",
    m4: "./train --module 04 --topic social-engineering", m5: "cat incidents.log",
    m6: "./train --module 06 --harden", m7: "./phish-or-legit --play", m8: "./exam --final",
  };
  function prompt(id) {
    const cmd = document.getElementById("cmd");
    if (!cmd) return;
    cmd.dataset.full = COMMANDS[id] || "";
    cmd.textContent = cmd.dataset.full;
    if (!reduce) type(cmd, 22);
  }

  // ------------------------------------------------------------ toasts

  function toast(msg) {
    const box = document.getElementById("toasts");
    if (!box) return;
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    box.append(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, 2600);
  }

  // ------------------------------------------------------------ boot sequence

  const BOOT_LINES = [
    ["[  0.000] PhishGuard kernel 2.6 booting...", ""],
    ["[  0.112] loading module: email_forensics.ko", "ok"],
    ["[  0.231] loading module: url_inspector.ko", "ok"],
    ["[  0.304] loading module: social_engineering_db", "ok"],
    ["[  0.417] mounting /incidents (6 real-world cases)", "ok"],
    ["[  0.520] WARNING: 3.4 billion phishing emails sent daily", "warn"],
    ["[  0.611] WARNING: humans are the #1 attack surface", "warn"],
    ["[  0.700] starting trainee session...", ""],
  ];
  function boot(done) {
    const box = document.getElementById("boot");
    let seen = false;
    try { seen = sessionStorage.getItem("pg-booted") === "1"; } catch (e) { /* ignore */ }
    if (!box || reduce || seen) { if (box) box.remove(); done(); return; }
    try { sessionStorage.setItem("pg-booted", "1"); } catch (e) { /* ignore */ }

    const pre = box.querySelector("pre");
    let finished = false, i = 0;
    function finish() {
      if (finished) return;
      finished = true;
      box.classList.add("hide");
      setTimeout(() => box.remove(), 650);
      done();
    }
    function next() {
      if (finished) return;
      if (i < BOOT_LINES.length) {
        const [text, cls] = BOOT_LINES[i++];
        const line = document.createElement("div");
        line.className = cls;
        line.textContent = text + (cls === "ok" ? "  [ OK ]" : "");
        pre.append(line);
        setTimeout(next, 150 + Math.random() * 110);
      } else {
        const g = document.createElement("div");
        g.className = "granted";
        g.textContent = "ACCESS GRANTED";
        box.append(g);
        setTimeout(finish, 900);
      }
    }
    box.addEventListener("click", finish);
    window.addEventListener("keydown", finish, { once: true });
    next();
  }

  // ------------------------------------------------------------ page change

  function pageChanged(id) {
    const page = document.getElementById(id);
    if (!page) return;
    sweep();
    prompt(id);
    page.querySelectorAll("h1, h2").forEach(h => scramble(h));
    reveal(page);
    if (id === "home") type(page.querySelector(".lead"), 10);
  }

  function init() {
    rain();
    cursorGlow();
  }

  return { init, boot, pageChanged, scramble, toast, reduce };
})();
