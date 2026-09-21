(() => {
  "use strict";

  /* =====================================================
     Configuration
  ===================================================== */
  const COLS = 10;
  const ROWS = 20;

  const POWER_CHANCE = 0.5; // probabilité d'apparition d'un pouvoir après chaque pièce posée
  const MAX_POWERS = 3; // nombre max de pouvoirs présents en même temps
  const MIN_POWER_ROW = 3; // un pouvoir n'apparaît jamais dans les 3 lignes du haut

  const POWER_TYPES = ["bomb", "row", "col"];

  const SHAPES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    O: [
      [1, 1],
      [1, 1],
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  };

  const COLORS = {
    I: "#22d3ee",
    O: "#facc15",
    T: "#a855f7",
    S: "#4ade80",
    Z: "#f43f5e",
    J: "#3b82f6",
    L: "#fb923c",
  };

  const LINE_POINTS = [0, 100, 300, 500, 800];
  const KICKS = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [-1, -1],
    [1, -1],
    [-2, 0],
    [2, 0],
  ];

  const THEME_KEY = "tetris-powers-theme";
  const BEST_KEY = "tetris-powers-best";

  /* =====================================================
     DOM
  ===================================================== */
  const $ = (sel) => document.querySelector(sel);

  const boardCv = $("#board");
  const bctx = boardCv.getContext("2d");
  const nextCv = $("#next");
  const nctx = nextCv.getContext("2d");

  const ui = {
    score: $("#score"),
    level: $("#level"),
    lines: $("#lines"),
    best: $("#best"),
    overlay: $("#overlay"),
    title: $("#overlay-title"),
    text: $("#overlay-text"),
    btn: $("#overlay-btn"),
  };

  /* =====================================================
     État
  ===================================================== */
  let grid, powers;
  let bag = [];
  let queue = [];
  let piece = null;
  let score = 0,
    lines = 0,
    level = 1,
    best = 0;
  let state = "playing"; // 'playing' | 'paused' | 'over'
  let dropAcc = 0;
  let lastTime = performance.now();
  let fx = [];
  let cell = 30;
  let colors = {};

  /* =====================================================
     Utilitaires
  ===================================================== */
  const emptyMatrix = () =>
    Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function nextType() {
    if (!bag.length) bag = shuffle(Object.keys(SHAPES));
    return bag.pop();
  }

  function bounds(m) {
    let minR = 99,
      maxR = -1,
      minC = 99,
      maxC = -1;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }
    return { minR, maxR, minC, maxC };
  }

  function rotCW(m) {
    const n = m.length;
    const o = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) o[c][n - 1 - r] = m[r][c];
    return o;
  }

  function rotCCW(m) {
    const n = m.length;
    const o = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) o[n - 1 - c][r] = m[r][c];
    return o;
  }

  function collides(m, x, y) {
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const nx = x + c;
        const ny = y + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && grid[ny][nx]) return true;
      }
    }
    return false;
  }

  const fmt = (n) => n.toLocaleString("fr-FR");

  /* =====================================================
     Partie
  ===================================================== */
  function newGame() {
    grid = emptyMatrix();
    powers = emptyMatrix();
    bag = [];
    queue = [nextType(), nextType(), nextType()];
    score = 0;
    lines = 0;
    level = 1;
    fx = [];
    dropAcc = 0;
    state = "playing";
    hideOverlay();
    spawn();
    updateHud();
  }

  function spawn() {
    const type = queue.shift();
    queue.push(nextType());
    const m = SHAPES[type].map((row) => row.slice());
    const b = bounds(m);
    piece = {
      type,
      m,
      x: Math.floor((COLS - m[0].length) / 2),
      y: -b.minR,
    };
    drawNext();
    if (collides(piece.m, piece.x, piece.y)) gameOver();
  }

  function gameOver() {
    state = "over";
    if (score > best) {
      best = score;
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch (_) {
        /* ignore */
      }
    }
    updateHud();
    showOverlay("Partie terminée", `Score : ${fmt(score)}`, "Rejouer");
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      showOverlay("Pause", "Appuie sur P pour reprendre", "Reprendre");
    } else if (state === "paused") {
      state = "playing";
      hideOverlay();
      lastTime = performance.now();
    }
  }

  const gravityInterval = () => Math.max(90, 800 - (level - 1) * 65);

  /* =====================================================
     Actions
  ===================================================== */
  function move(dx) {
    if (!piece) return;
    if (!collides(piece.m, piece.x + dx, piece.y)) piece.x += dx;
  }

  function rotate(dir) {
    if (!piece) return;
    const r = dir > 0 ? rotCW(piece.m) : rotCCW(piece.m);
    for (const [kx, ky] of KICKS) {
      if (!collides(r, piece.x + kx, piece.y + ky)) {
        piece.m = r;
        piece.x += kx;
        piece.y += ky;
        return;
      }
    }
  }

  function softDrop() {
    if (!piece) return;
    if (!collides(piece.m, piece.x, piece.y + 1)) {
      piece.y++;
      score += 1;
      dropAcc = 0;
      updateHud();
    } else {
      lockPiece();
    }
  }

  function hardDrop() {
    if (!piece) return;
    let dist = 0;
    while (!collides(piece.m, piece.x, piece.y + 1)) {
      piece.y++;
      dist++;
    }
    score += dist * 2;
    lockPiece();
  }

  function ghostY() {
    let gy = piece.y;
    while (!collides(piece.m, piece.x, gy + 1)) gy++;
    return gy;
  }

  /* =====================================================
     Verrouillage, pouvoirs, lignes
  ===================================================== */
  function lockPiece() {
    const placed = [];
    let lockOut = false;

    for (let r = 0; r < piece.m.length; r++) {
      for (let c = 0; c < piece.m[r].length; c++) {
        if (!piece.m[r][c]) continue;
        const gy = piece.y + r;
        const gx = piece.x + c;
        if (gy < 0) {
          lockOut = true;
          continue;
        }
        grid[gy][gx] = piece.type;
        placed.push([gy, gx]);
      }
    }

    if (lockOut) {
      piece = null;
      gameOver();
      return;
    }

    // 1) Pouvoirs déclenchés par la pièce posée
    const triggered = [];
    for (const [r, c] of placed) {
      const p = powers[r][c];
      if (p) {
        triggered.push({ type: p, r, c });
        powers[r][c] = null;
      }
    }
    if (triggered.length) applyPowers(triggered);

    validatePowers();

    // 2) Lignes complètes
    clearLines();
    validatePowers();

    // 3) Nouveau pouvoir éventuel, puis pièce suivante
    maybeSpawnPower();
    dropAcc = 0;
    updateHud();
    spawn();
  }

  function applyPowers(triggered) {
    const kill = new Set();
    const add = (r, c) => {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) kill.add(r * COLS + c);
    };

    for (const t of triggered) {
      if (t.type === "bomb") {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) add(t.r + dr, t.c + dc);
        fx.push({ kind: "bomb", r: t.r, c: t.c, t: 0, d: 500 });
      } else if (t.type === "row") {
        for (let c = 0; c < COLS; c++) add(t.r, c);
        fx.push({ kind: "row", r: t.r, t: 0, d: 450 });
      } else if (t.type === "col") {
        for (let r = 0; r < ROWS; r++) add(r, t.c);
        fx.push({ kind: "col", c: t.c, t: 0, d: 450 });
      }
    }

    let destroyed = 0;
    kill.forEach((k) => {
      const r = Math.floor(k / COLS);
      const c = k % COLS;
      if (grid[r][c]) {
        grid[r][c] = null;
        destroyed++;
        fx.push({ kind: "cell", r, c, t: 0, d: 450 });
      }
      powers[r][c] = null; // un pouvoir pris dans la zone est détruit aussi
    });

    score += destroyed * 10 * level;
  }

  function clearLines() {
    const full = [];
    for (let r = 0; r < ROWS; r++) {
      if (grid[r].every(Boolean)) full.push(r);
    }
    if (!full.length) return;

    for (const r of full) fx.push({ kind: "row", r, t: 0, d: 300 });

    grid = grid.filter((_, r) => !full.includes(r));
    powers = powers.filter((_, r) => !full.includes(r));
    while (grid.length < ROWS) {
      grid.unshift(Array(COLS).fill(null));
      powers.unshift(Array(COLS).fill(null));
    }

    score += LINE_POINTS[Math.min(full.length, 4)] * level;
    lines += full.length;
    level = Math.floor(lines / 10) + 1;
  }

  // Un pouvoir doit toujours reposer sur une case pleine et être dans une case vide
  function validatePowers() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!powers[r][c]) continue;
        if (grid[r][c] || r + 1 >= ROWS || !grid[r + 1][c]) powers[r][c] = null;
      }
    }
  }

  function countPowers() {
    let n = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) if (powers[r][c]) n++;
    return n;
  }

  // Apparition : case vide juste au-dessus du sommet d'une colonne (donc atteignable
  // et avec une case pleine dessous), pour que la pièce suivante puisse l'utiliser.
  function maybeSpawnPower() {
    if (countPowers() >= MAX_POWERS) return;
    if (Math.random() > POWER_CHANCE) return;

    const candidates = [];
    for (let c = 0; c < COLS; c++) {
      let top = -1;
      for (let r = 0; r < ROWS; r++) {
        if (grid[r][c]) {
          top = r;
          break;
        }
      }
      if (top === -1) continue;
      const r = top - 1;
      if (r < MIN_POWER_ROW) continue;
      if (grid[r][c] || powers[r][c]) continue;
      candidates.push([r, c]);
    }
    if (!candidates.length) return;

    const [r, c] = candidates[Math.floor(Math.random() * candidates.length)];
    powers[r][c] = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
  }

  /* =====================================================
     Rendu
  ===================================================== */
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    colors = {
      empty: cs.getPropertyValue("--cell-empty").trim(),
      power: cs.getPropertyValue("--power").trim(),
      fx: cs.getPropertyValue("--fx").trim(),
    };
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;

    const w = Math.max(1, Math.round(boardCv.clientWidth * dpr));
    cell = w / COLS;
    boardCv.width = w;
    boardCv.height = Math.round(cell * ROWS);

    nextCv.width = Math.max(1, Math.round(nextCv.clientWidth * dpr));
    nextCv.height = Math.round((nextCv.width * 9) / 4);
    drawNext();
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCell(ctx, x, y, s, color, alpha = 1) {
    const p = s * 0.05;
    const w = s - p * 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    rr(ctx, x + p, y + p, w, w, s * 0.2);
    ctx.fill();

    const g = ctx.createLinearGradient(x, y, x, y + s);
    g.addColorStop(0, "rgba(255,255,255,.35)");
    g.addColorStop(0.5, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(0,0,0,.18)");
    ctx.fillStyle = g;
    rr(ctx, x + p, y + p, w, w, s * 0.2);
    ctx.fill();
    ctx.restore();
  }

  function drawPower(ctx, x, y, s, type, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time / 220);
    const cx = x + s / 2;
    const cy = y + s / 2;

    ctx.save();
    ctx.strokeStyle = colors.power;
    ctx.fillStyle = colors.power;
    ctx.lineCap = "round";

    // fond teinté + contour pulsé
    ctx.globalAlpha = 0.16;
    rr(ctx, x + s * 0.05, y + s * 0.05, s * 0.9, s * 0.9, s * 0.2);
    ctx.fill();
    ctx.globalAlpha = 0.45 + 0.4 * pulse;
    ctx.lineWidth = Math.max(1.5, s * 0.06);
    ctx.stroke();

    // symbole
    ctx.globalAlpha = 1;
    ctx.shadowColor = colors.power;
    ctx.shadowBlur = s * (0.2 + 0.35 * pulse);

    if (type === "bomb") {
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.23, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === "row") {
      ctx.lineWidth = s * 0.14;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.14, cy);
      ctx.lineTo(x + s * 0.86, cy);
      ctx.stroke();
    } else if (type === "col") {
      ctx.lineWidth = s * 0.14;
      ctx.beginPath();
      ctx.moveTo(cx, y + s * 0.14);
      ctx.lineTo(cx, y + s * 0.86);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBoard(time) {
    const s = cell;
    const ctx = bctx;
    ctx.clearRect(0, 0, boardCv.width, boardCv.height);

    // cases vides
    ctx.fillStyle = colors.empty;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        rr(
          ctx,
          c * s + s * 0.08,
          r * s + s * 0.08,
          s * 0.84,
          s * 0.84,
          s * 0.18,
        );
        ctx.fill();
      }
    }

    // blocs posés
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = grid[r][c];
        if (t) drawCell(ctx, c * s, r * s, s, COLORS[t]);
      }
    }

    // pouvoirs
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = powers[r][c];
        if (p) drawPower(ctx, c * s, r * s, s, p, time);
      }
    }

    // fantôme + pièce courante
    if (piece && state !== "over") {
      const gy = ghostY();
      const color = COLORS[piece.type];
      if (gy !== piece.y) {
        for (let r = 0; r < piece.m.length; r++) {
          for (let c = 0; c < piece.m[r].length; c++) {
            if (!piece.m[r][c]) continue;
            const y = gy + r;
            if (y < 0) continue;
            const x = piece.x + c;
            ctx.save();
            ctx.globalAlpha = 0.14;
            ctx.fillStyle = color;
            rr(
              ctx,
              x * s + s * 0.06,
              y * s + s * 0.06,
              s * 0.88,
              s * 0.88,
              s * 0.2,
            );
            ctx.fill();
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1.5, s * 0.06);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      for (let r = 0; r < piece.m.length; r++) {
        for (let c = 0; c < piece.m[r].length; c++) {
          if (!piece.m[r][c]) continue;
          const y = piece.y + r;
          if (y < 0) continue;
          drawCell(ctx, (piece.x + c) * s, y * s, s, color);
        }
      }
    }

    drawFx();
  }

  function drawFx() {
    const s = cell;
    const ctx = bctx;
    for (const f of fx) {
      const p = f.t / f.d;
      const a = 1 - p;
      ctx.save();
      ctx.fillStyle = colors.fx;
      ctx.strokeStyle = colors.fx;

      if (f.kind === "cell") {
        ctx.globalAlpha = a * 0.85;
        rr(
          ctx,
          f.c * s + s * 0.06,
          f.r * s + s * 0.06,
          s * 0.88,
          s * 0.88,
          s * 0.2,
        );
        ctx.fill();
      } else if (f.kind === "row") {
        ctx.globalAlpha = a * 0.55;
        ctx.fillRect(0, f.r * s, COLS * s, s);
      } else if (f.kind === "col") {
        ctx.globalAlpha = a * 0.55;
        ctx.fillRect(f.c * s, 0, s, ROWS * s);
      } else if (f.kind === "bomb") {
        ctx.globalAlpha = a;
        ctx.lineWidth = Math.max(1, s * 0.14 * a);
        ctx.beginPath();
        ctx.arc(
          (f.c + 0.5) * s,
          (f.r + 0.5) * s,
          s * (0.4 + p * 1.8),
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawNext() {
    if (!queue.length) return;
    const w = nextCv.width;
    const h = nextCv.height;
    nctx.clearRect(0, 0, w, h);

    const ps = w / 5;
    const slotH = h / 3;

    queue.slice(0, 3).forEach((type, i) => {
      const m = SHAPES[type];
      const b = bounds(m);
      const pw = (b.maxC - b.minC + 1) * ps;
      const ph = (b.maxR - b.minR + 1) * ps;
      const ox = (w - pw) / 2;
      const oy = i * slotH + (slotH - ph) / 2;
      const alpha = i === 0 ? 1 : 0.7;
      for (let r = b.minR; r <= b.maxR; r++) {
        for (let c = b.minC; c <= b.maxC; c++) {
          if (m[r][c])
            drawCell(
              nctx,
              ox + (c - b.minC) * ps,
              oy + (r - b.minR) * ps,
              ps,
              COLORS[type],
              alpha,
            );
        }
      }
    });
  }

  function updateHud() {
    ui.score.textContent = fmt(score);
    ui.level.textContent = String(level);
    ui.lines.textContent = String(lines);
    ui.best.textContent = fmt(Math.max(best, score));
  }

  function showOverlay(title, text, btn) {
    ui.title.textContent = title;
    ui.text.textContent = text;
    ui.btn.textContent = btn;
    ui.overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    ui.overlay.classList.add("hidden");
  }

  /* =====================================================
     Boucle
  ===================================================== */
  function frame(now) {
    const dt = Math.min(now - lastTime, 100);
    lastTime = now;

    if (state === "playing" && piece) {
      dropAcc += dt;
      const interval = gravityInterval();
      while (dropAcc >= interval && state === "playing" && piece) {
        dropAcc -= interval;
        if (!collides(piece.m, piece.x, piece.y + 1)) {
          piece.y++;
        } else {
          lockPiece();
          break;
        }
      }
    }

    if (fx.length) {
      for (const f of fx) f.t += dt;
      fx = fx.filter((f) => f.t < f.d);
    }

    drawBoard(now);
    requestAnimationFrame(frame);
  }

  /* =====================================================
     Entrées
  ===================================================== */
  function run(action) {
    if (state !== "playing") return;
    switch (action) {
      case "left":
        move(-1);
        break;
      case "right":
        move(1);
        break;
      case "down":
        softDrop();
        break;
      case "rotate":
        rotate(1);
        break;
      case "rotate-ccw":
        rotate(-1);
        break;
      case "drop":
        hardDrop();
        break;
    }
  }

  const KEY_ACTIONS = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowDown: "down",
    ArrowUp: "rotate",
    x: "rotate",
    X: "rotate",
    z: "rotate-ccw",
    Z: "rotate-ccw",
    w: "rotate-ccw",
    W: "rotate-ccw",
    " ": "drop",
    Spacebar: "drop",
  };

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === "p" || e.key === "P" || e.key === "Escape") {
      e.preventDefault();
      if (state !== "over" && !e.repeat) togglePause();
      return;
    }

    if (state === "over") {
      if (e.key === "Enter" || e.key === "r" || e.key === "R") {
        e.preventDefault();
        newGame();
      }
      return;
    }

    if (state === "paused" && e.key === "Enter") {
      e.preventDefault();
      togglePause();
      return;
    }

    const action = KEY_ACTIONS[e.key];
    if (!action) return;
    e.preventDefault();

    const repeatable =
      action === "left" || action === "right" || action === "down";
    if (e.repeat && !repeatable) return;
    run(action);
  });

  // Commandes tactiles
  document.querySelectorAll("[data-action]").forEach((btn) => {
    const action = btn.dataset.action;
    const repeatable =
      action === "left" || action === "right" || action === "down";
    let delay = null;
    let timer = null;
    const stop = () => {
      clearTimeout(delay);
      clearInterval(timer);
    };

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      run(action);
      if (repeatable) {
        stop();
        delay = setTimeout(() => {
          timer = setInterval(() => run(action), 70);
        }, 220);
      }
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
      btn.addEventListener(ev, stop),
    );
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  });

  ui.btn.addEventListener("click", () => {
    ui.btn.blur();
    if (state === "paused") togglePause();
    else newGame();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") togglePause();
  });

  /* =====================================================
     Thème (auto / clair / sombre)
  ===================================================== */
  const themeButtons = document.querySelectorAll("[data-theme-value]");

  function applyTheme(mode, persist) {
    document.documentElement.dataset.theme = mode;
    themeButtons.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.themeValue === mode)),
    );
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, mode);
      } catch (_) {
        /* ignore */
      }
    }
    readColors();
  }

  themeButtons.forEach((b) => {
    b.addEventListener("click", () => {
      applyTheme(b.dataset.themeValue, true);
      b.blur();
    });
  });

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", readColors);

  /* =====================================================
     Démarrage
  ===================================================== */
  let savedTheme = "auto";
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "auto" || t === "light" || t === "dark") savedTheme = t;
    best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0;
  } catch (_) {
    /* ignore */
  }

  applyTheme(savedTheme, false);

  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(boardCv);
    new ResizeObserver(resize).observe(nextCv);
  }
  window.addEventListener("resize", resize);

  newGame();
  resize();
  lastTime = performance.now();
  requestAnimationFrame(frame);
})();
