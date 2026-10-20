// Draws the shareable score card (1080x1350) onto a canvas.
// shots: [{ dx, dy, hit }] where dx/dy are the click's offset from the target center in px.
window.drawScoreCard = function drawScoreCard({ hits, misses, acc, avg, rank, seconds, radius, shots }) {
  const W = 1080, H = 1350, P = 80;
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  const bg = v("--bg"), ink = v("--ink"), muted = v("--muted"), line = v("--line"), hot = v("--hot");
  const mono = v("--mono"), sans = v("--sans");

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  const spaced = (px) => { if ("letterSpacing" in g) g.letterSpacing = px; };

  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = line;
  g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x <= W; x += 90) { g.moveTo(x, 0); g.lineTo(x, H); }
  for (let y = 0; y <= H; y += 90) { g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();

  g.textBaseline = "alphabetic";
  g.fillStyle = ink;
  g.font = `700 36px ${mono}`;
  g.fillText("blindshot", P, 120);
  g.fillStyle = muted;
  g.font = `400 26px ${mono}`;
  g.textAlign = "right";
  g.fillText(`${seconds}s / no cursor`, W - P, 120);
  g.textAlign = "left";

  g.fillStyle = hot;
  g.font = `600 30px ${mono}`;
  spaced("3px");
  g.fillText(rank.toUpperCase(), P, 240);
  spaced("0px");

  g.fillStyle = ink;
  g.font = `800 360px ${sans}`;
  spaced("-18px");
  g.fillText(String(hits), P - 12, 560);
  const scoreW = g.measureText(String(hits)).width;
  spaced("0px");
  g.fillStyle = muted;
  g.font = `500 36px ${mono}`;
  g.fillText("hits", P + scoreW + 10, 560);

  g.fillStyle = ink;
  g.fillRect(P, 610, W - P * 2, 4);
  const stats = [["accuracy", `${acc}%`], ["avg off", `${avg}px`], ["misses", String(misses)]];
  const colW = (W - P * 2) / stats.length;
  stats.forEach(([label, value], i) => {
    const x = P + colW * i;
    g.fillStyle = muted;
    g.font = `400 24px ${mono}`;
    spaced("2px");
    g.fillText(label.toUpperCase(), x, 664);
    spaced("0px");
    g.fillStyle = ink;
    g.font = `700 64px ${sans}`;
    g.fillText(value, x, 744);
  });

  // Grouping chart: every click plotted relative to the target it was aimed at.
  const cx = W / 2, cy = 1010, cr = 190;
  g.fillStyle = muted;
  g.font = `400 24px ${mono}`;
  spaced("2px");
  g.fillText("YOUR GROUPING", P, 830);
  spaced("0px");

  g.strokeStyle = line;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - cr - 30, cy); g.lineTo(cx + cr + 30, cy);
  g.moveTo(cx, cy - cr - 30); g.lineTo(cx, cy + cr + 30);
  g.stroke();
  g.strokeStyle = muted;
  g.setLineDash([8, 8]);
  g.beginPath();
  g.arc(cx, cy, cr, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);

  const far = Math.max(radius * 3, ...shots.map((s) => Math.hypot(s.dx, s.dy)));
  const k = cr / (far * 1.08);
  const tr = Math.max(radius * k, 10);
  [[1, hot], [20 / 34, bg], [12 / 34, hot], [4 / 34, bg]].forEach(([f, color]) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(cx, cy, tr * f, 0, Math.PI * 2);
    g.fill();
  });

  g.lineCap = "round";
  for (const s of shots) {
    const x = cx + s.dx * k, y = cy + s.dy * k;
    if (s.hit) {
      g.fillStyle = ink;
      g.strokeStyle = bg;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else {
      g.strokeStyle = ink;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(x - 9, y - 9); g.lineTo(x + 9, y + 9);
      g.moveTo(x + 9, y - 9); g.lineTo(x - 9, y + 9);
      g.stroke();
    }
  }
  if (!shots.length) {
    g.fillStyle = muted;
    g.font = `400 26px ${mono}`;
    g.textAlign = "center";
    g.fillText("no shots fired", cx, cy + cr + 60);
    g.textAlign = "left";
  }

  g.fillStyle = ink;
  g.font = `600 32px ${mono}`;
  g.fillText("can you beat it?", P, 1275);
  const site = "blindshot.gg";
  g.font = `700 32px ${mono}`;
  const sw = g.measureText(site).width;
  g.fillRect(W - P - sw - 32, 1236, sw + 32, 54);
  g.fillStyle = bg;
  g.fillText(site, W - P - sw - 16, 1275);

  return c;
};
