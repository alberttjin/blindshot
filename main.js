(() => {
  const DURATION = 30_000;
  const R = 26; // must match --r in style.css
  const HUD_H = 70;
  const BEST_KEY = "blindshot.best";
  const CURSOR_SVG =
    '<svg viewBox="0 0 16 24" width="16" height="24"><path d="M1 1v19l5-5 3.5 7.5 3-1.4L9 13.7h7z" fill="#fff" stroke="#141414" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  const PING_HTML =
    "<b></b>" + [0, 90, 180, 270].map((a) => `<i style="--a:${a}deg"></i>`).join("");

  const $ = (id) => document.getElementById(id);
  const stage = $("stage");
  const target = $("target");
  const fx = $("fx");
  const ui = {
    intro: $("intro"),
    results: $("results"),
    count: $("count"),
    time: $("time"),
    score: $("score"),
    final: $("final"),
    acc: $("acc"),
    misses: $("misses"),
    avgmiss: $("avgmiss"),
    best: $("best"),
    bestIntro: $("best-intro"),
    rank: $("rank"),
    toast: $("toast"),
  };

  let state = "idle"; // idle | countdown | playing | done
  let hits = 0, misses = 0, missDist = 0;
  let endsAt = 0, raf = 0;
  let tx = 0, ty = 0;

  const loadBest = () => {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  };
  const saveBest = (n) => {
    try { localStorage.setItem(BEST_KEY, String(n)); } catch {}
  };

  const showBestIntro = () => {
    const b = loadBest();
    ui.bestIntro.textContent = b ? `your best: ${b}` : "";
  };

  function placeTarget() {
    const w = innerWidth, h = innerHeight;
    const pad = R + 20;
    const minX = pad, maxX = w - pad;
    const minY = HUD_H + R, maxY = h - pad;
    const minGap = Math.min(180, Math.min(w, h) / 3);
    let x, y;
    for (let i = 0; i < 30; i++) {
      x = minX + Math.random() * (maxX - minX);
      y = minY + Math.random() * (maxY - minY);
      if (Math.hypot(x - tx, y - ty) >= minGap) break;
    }
    tx = x; ty = y;
    target.style.left = `${x}px`;
    target.style.top = `${y}px`;
    // restart pop animation
    target.hidden = true;
    void target.offsetWidth;
    target.hidden = false;
  }

  function spawn(cls, x, y, html) {
    const el = document.createElement("div");
    el.className = cls;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (html) el.innerHTML = html;
    el.addEventListener("animationend", () => el.remove(), { once: true });
    fx.appendChild(el);
    return el;
  }

  function onHit() {
    hits++;
    ui.score.textContent = hits;
    spawn("hit", tx, ty);
    spawn("plus", tx, ty - R, "+1");
    placeTarget();
  }

  function onMiss(x, y) {
    misses++;
    const d = Math.hypot(x - tx, y - ty) - R;
    missDist += d;

    const len = Math.hypot(x - tx, y - ty);
    const tether = spawn("tether", tx, ty);
    tether.style.width = `${len}px`;
    tether.style.transform = `rotate(${Math.atan2(y - ty, x - tx)}rad)`;
    spawn("ghost-target", tx, ty);
    spawn("miss", x, y, `<span>${Math.round(d)}px</span>`);

    document.body.classList.remove("flash");
    void document.body.offsetWidth;
    document.body.classList.add("flash");

    placeTarget();
  }

  function tick() {
    const left = Math.max(0, endsAt - performance.now());
    ui.time.textContent = (left / 1000).toFixed(2);
    ui.time.classList.toggle("low", left < 5000);
    if (left <= 0) return finish();
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (state === "countdown" || state === "playing") return;
    state = "countdown";
    hits = 0; misses = 0; missDist = 0;
    tx = innerWidth / 2; ty = innerHeight / 2;
    ui.score.textContent = "0";
    ui.time.textContent = "30.00";
    ui.time.classList.remove("low");
    ui.intro.hidden = true;
    ui.results.hidden = true;
    ui.toast.hidden = true;
    fx.replaceChildren();
    document.body.classList.add("playing");

    let n = 3;
    ui.count.textContent = n;
    ui.count.hidden = false;
    const step = setInterval(() => {
      if (state !== "countdown") return clearInterval(step);
      n--;
      if (n > 0) {
        ui.count.textContent = n;
        return;
      }
      clearInterval(step);
      ui.count.hidden = true;
      state = "playing";
      endsAt = performance.now() + DURATION;
      placeTarget();
      raf = requestAnimationFrame(tick);
    }, 600);
  }

  function finish() {
    state = "done";
    cancelAnimationFrame(raf);
    target.hidden = true;
    ui.time.textContent = "0.00";

    const shots = hits + misses;
    const acc = shots ? Math.round((hits / shots) * 100) : 0;
    const best = Math.max(loadBest(), hits);
    const isNew = hits > 0 && hits === best && hits > loadBest();
    if (isNew) saveBest(hits);

    ui.final.textContent = hits;
    ui.acc.textContent = `${acc}%`;
    ui.misses.textContent = misses;
    ui.avgmiss.textContent = misses ? `${Math.round(missDist / misses)}px` : "—";
    ui.best.textContent = best;
    ui.rank.textContent = (isNew ? "new best · " : "") + rankFor(hits, shots);

    setTimeout(() => {
      document.body.classList.remove("playing");
      ui.results.hidden = false;
    }, 500);
  }

  function abort() {
    state = "idle";
    cancelAnimationFrame(raf);
    target.hidden = true;
    ui.count.hidden = true;
    fx.replaceChildren();
    document.body.classList.remove("playing");
    ui.results.hidden = true;
    ui.intro.hidden = false;
    showBestIntro();
  }

  function rankFor(score, shots) {
    if (shots === 0) return "did you fall asleep?";
    if (score <= 3) return "fully blindfolded";
    if (score <= 7) return "vibes-based aiming";
    if (score <= 11) return "getting warm";
    if (score <= 15) return "muscle memory online";
    if (score <= 19) return "locked in";
    if (score <= 24) return "radar brain";
    return "someone check this person's pc";
  }

  async function share() {
    const shots = hits + misses;
    const acc = shots ? Math.round((hits / shots) * 100) : 0;
    const url = location.href.split("#")[0];
    const text = `blindshot: ${hits} hits in 30s, ${acc}% accuracy, no cursor. beat that`;
    if (navigator.share && matchMedia("(hover: none)").matches) {
      try { await navigator.share({ text, url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(`${text} → ${url}`);
      ui.toast.textContent = "copied to clipboard";
    } catch {
      ui.toast.textContent = `${text} → ${url}`;
    }
    ui.toast.hidden = false;
  }

  stage.addEventListener("pointerdown", (e) => {
    if (state !== "playing" || e.button !== 0) return;
    e.preventDefault();
    const inside = Math.hypot(e.clientX - tx, e.clientY - ty) <= R;
    inside ? onHit() : onMiss(e.clientX, e.clientY);
    spawn(inside ? "ping is-hit" : "ping", e.clientX, e.clientY, PING_HTML);
    spawn("click-cursor", e.clientX, e.clientY, CURSOR_SVG);
  });

  stage.addEventListener("contextmenu", (e) => {
    if (state === "playing" || state === "countdown") e.preventDefault();
  });

  addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "Enter") {
      if (state === "idle" || state === "done") {
        e.preventDefault();
        start();
      }
    } else if (e.code === "Escape" && state !== "idle") {
      abort();
    }
  });

  addEventListener("resize", () => {
    if (state !== "playing") return;
    if (tx > innerWidth - R || ty > innerHeight - R) placeTarget();
  });

  $("start").addEventListener("click", start);
  $("again").addEventListener("click", start);
  $("share").addEventListener("click", share);

  showBestIntro();
})();
