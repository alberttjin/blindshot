(() => {
  const DURATION = 15_000;
  const R = 34; // must match --r in style.css
  const HUD_H = 70;
  const BEST_KEY = "blindshot.best15";
  const CURSOR_SVG =
    '<svg viewBox="0 0 16 24" width="16" height="24"><path d="M1 1v19l5-5 3.5 7.5 3-1.4L9 13.7h7z" fill="#fff" stroke="#141414" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  const PING_HTML =
    "<b></b>" + [0, 90, 180, 270].map((a) => `<i style="--a:${a}deg"></i>`).join("");

  const noMouse = !matchMedia("(any-pointer: fine)").matches;
  document.body.classList.toggle("no-mouse", noMouse);

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
    totalDist: $("totaldist"),
    avgDist: $("avgdist"),
    best: $("best"),
    bestIntro: $("best-intro"),
    rank: $("rank"),
  };

  let state = "idle"; // idle | countdown | playing | done
  let hits = 0, misses = 0, totalDist = 0;
  let shotLog = [];
  let cardBlob = null, cardUrl = "";
  let endsAt = 0, raf = 0;
  let tx = 0, ty = 0;

  const loadBest = () => {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  };
  const saveBest = (n) => {
    try { localStorage.setItem(BEST_KEY, String(n)); } catch {}
  };

  const track = (name, params) => {
    if (typeof gtag === "function") gtag("event", name, params);
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

  function onMiss(x, y, d) {
    misses++;

    const tether = spawn("tether", tx, ty);
    tether.style.width = `${d}px`;
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
    if (noMouse || state === "countdown" || state === "playing") return;
    state = "countdown";
    hits = 0; misses = 0; totalDist = 0;
    shotLog = [];
    cardBlob = null;
    closeSheet();
    tx = innerWidth / 2; ty = innerHeight / 2;
    ui.score.textContent = "0";
    ui.time.textContent = (DURATION / 1000).toFixed(2);
    ui.time.classList.remove("low");
    ui.intro.hidden = true;
    ui.results.hidden = true;
    fx.replaceChildren();

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
      document.body.classList.add("playing");
      lockPointer();
      track("game_start");
      endsAt = performance.now() + DURATION;
      placeTarget();
      raf = requestAnimationFrame(tick);
    }, 600);
  }

  function finish() {
    state = "done";
    unlockPointer();
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
    ui.totalDist.textContent = shots ? `${Math.round(totalDist).toLocaleString()}px` : "—";
    ui.avgDist.textContent = shots ? `${Math.round(totalDist / shots)}px` : "—";
    ui.best.textContent = best;
    const rank = rankFor(hits, shots);
    ui.rank.textContent = (isNew ? "new best · " : "") + rank;

    const card = window.drawScoreCard({
      hits,
      misses,
      acc,
      avg: shots ? Math.round(totalDist / shots) : 0,
      rank,
      seconds: DURATION / 1000,
      radius: R,
      shots: shotLog,
    });
    card.toBlob((blob) => {
      cardBlob = blob;
      if (cardUrl) URL.revokeObjectURL(cardUrl);
      cardUrl = URL.createObjectURL(blob);
      sheet.img.src = cardUrl;
      sheet.download.href = cardUrl;
    }, "image/png");

    track("game_end", {
      score: hits,
      misses,
      accuracy: acc,
      avg_off: shots ? Math.round(totalDist / shots) : 0,
      new_best: isNew,
    });

    setTimeout(() => {
      document.body.classList.remove("playing");
      ui.results.hidden = false;
    }, 500);
  }

  function abort() {
    state = "idle";
    unlockPointer();
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
    if (score <= 1) return "fully blindfolded";
    if (score <= 3) return "vibes-based aiming";
    if (score <= 5) return "getting warm";
    if (score <= 7) return "muscle memory online";
    if (score <= 9) return "locked in";
    if (score <= 12) return "radar brain";
    return "someone check this person's pc";
  }

  const sheet = {
    el: $("sheet"),
    img: $("card-img"),
    download: $("dl-img"),
    toast: $("sheet-toast"),
  };

  function shareText() {
    const shots = hits + misses;
    const acc = shots ? Math.round((hits / shots) * 100) : 0;
    const avg = shots ? Math.round(totalDist / shots) : 0;
    return `blindshot: ${hits} hits in ${DURATION / 1000}s, ${acc}% accuracy, ${avg}px avg off, no cursor. beat that`;
  }
  const shareUrl = () => location.href.split("#")[0];

  function sheetToast(msg) {
    sheet.toast.textContent = msg;
    sheet.toast.hidden = false;
  }

  function openSheet() {
    sheet.toast.hidden = true;
    sheet.el.hidden = false;
    $("copy-img").focus();
  }

  function closeSheet() {
    sheet.el.hidden = true;
  }

  async function share() {
    if (!cardBlob) return;
    track("share", { score: hits, method: "open" });
    const file = new File([cardBlob], "blindshot.png", { type: "image/png" });
    if (matchMedia("(hover: none)").matches && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `${shareText()} ${shareUrl()}` });
        track("share", { score: hits, method: "native" });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }
    openSheet();
  }

  async function copyImage() {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": cardBlob })]);
      sheetToast("image copied. paste it anywhere");
      track("share", { score: hits, method: "copy_image" });
    } catch {
      sheetToast("can't copy images in this browser. use Download instead");
    }
  }

  async function copyLink() {
    const text = `${shareText()} → ${shareUrl()}`;
    try {
      await navigator.clipboard.writeText(text);
      sheetToast("link copied");
      track("share", { score: hits, method: "copy_link" });
    } catch {
      sheetToast(text);
    }
  }

  // Pointer lock hides the cursor at the OS level, so screen recorders can't draw it.
  // While locked, clientX/Y stop updating and we track the position from movement deltas.
  let mx = innerWidth / 2, my = innerHeight / 2;
  let locked = false;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function lockPointer() {
    try {
      stage.requestPointerLock?.()?.catch?.(() => {});
    } catch {}
  }

  function unlockPointer() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  document.addEventListener("pointerlockchange", () => {
    locked = document.pointerLockElement === stage;
    if (!locked && state === "playing") abort();
  });

  addEventListener("pointermove", (e) => {
    if (locked) {
      mx = clamp(mx + e.movementX, 0, innerWidth - 1);
      my = clamp(my + e.movementY, 0, innerHeight - 1);
    } else {
      mx = e.clientX;
      my = e.clientY;
    }
  });

  stage.addEventListener("pointerdown", (e) => {
    if (state !== "playing" || e.button !== 0 || e.pointerType === "touch") return;
    e.preventDefault();
    const x = locked ? mx : e.clientX;
    const y = locked ? my : e.clientY;
    const d = Math.hypot(x - tx, y - ty);
    const inside = d <= R;
    totalDist += d;
    shotLog.push({ dx: x - tx, dy: y - ty, hit: inside });
    inside ? onHit() : onMiss(x, y, d);
    spawn(inside ? "ping is-hit" : "ping", x, y, PING_HTML);
    spawn("click-cursor", x, y, CURSOR_SVG);
  });

  stage.addEventListener("contextmenu", (e) => {
    if (state === "playing" || state === "countdown") e.preventDefault();
  });

  addEventListener("keydown", (e) => {
    if (!sheet.el.hidden) {
      if (e.code === "Escape") closeSheet();
      return;
    }
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
  $("send-link").addEventListener("click", async (e) => {
    const url = "https://blindshot.gg";
    track("send_link");
    try {
      if (navigator.share) return await navigator.share({ title: "blindshot", url });
      await navigator.clipboard.writeText(url);
      e.target.textContent = "Link copied";
    } catch {}
  });
  $("copy-img").addEventListener("click", copyImage);
  $("copy-link").addEventListener("click", copyLink);
  $("close-sheet").addEventListener("click", closeSheet);
  sheet.download.addEventListener("click", () => track("share", { score: hits, method: "download" }));
  sheet.el.addEventListener("click", (e) => {
    if (e.target === sheet.el) closeSheet();
  });

  showBestIntro();
})();
