// 🇳🇬 NAIJA CRUSH — JUICED EDITION
// Self-contained: sound, particles, shake, banners and animations
// are all created from JS (no extra CSS/HTML needed beyond your
// existing #board, #gameShell and HUD elements).

(() => {
  "use strict";

  const SIZE = 8;

  const foods = [
    { emoji: "🍉", name: "Watermelon" },
    { emoji: "🍗", name: "Chicken" },
    { emoji: "🍌", name: "Plantain" },
    { emoji: "🌶️", name: "Pepper" },
    { emoji: "🥤", name: "Zobo" },
    { emoji: "🍩", name: "Puff-puff" }
  ];

  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const calm =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ==========================================================
     🔊 SOUND + SCREEN EFFECTS
     ========================================================== */

  const FX = (() => {
    let ctx = null;
    let master = null;
    let enabled = true;

    // C-major pentatonic: every note sounds "sweet" together.
    const NOTES = [
      523.25, 587.33, 659.25, 783.99, 880.0,
      1046.5, 1174.66, 1318.51, 1567.98, 1760.0
    ];

    function getCtx() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;

      if (!ctx) {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.9;

        const comp = ctx.createDynamicsCompressor();
        master.connect(comp);
        comp.connect(ctx.destination);
      }

      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      return ctx;
    }

    // Browsers (especially iOS Safari) keep audio locked until a
    // real tap. Calling this inside tap handlers unlocks it.
    function unlock() {
      const c = getCtx();
      if (!c) return;

      try {
        const buffer = c.createBuffer(1, 1, 22050);
        const src = c.createBufferSource();
        src.buffer = buffer;
        src.connect(c.destination);
        src.start(0);
      } catch (e) {
        /* ignore */
      }
    }

    function tone(freq, dur, type = "sine", vol = 0.1, endFreq = null, delay = 0) {
      if (!enabled) return;
      const c = getCtx();
      if (!c) return;

      const t = c.currentTime + delay;
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);

      if (endFreq) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(20, endFreq),
          t + dur
        );
      }

      // Short attack avoids clicks; exponential tail sounds natural.
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(gain);
      gain.connect(master);

      osc.start(t);
      osc.stop(t + dur + 0.03);
    }

    function noise(dur, vol = 0.2, freq = 800, opts = {}) {
      if (!enabled) return;
      const c = getCtx();
      if (!c) return;

      const { type = "lowpass", endFreq = null, delay = 0 } = opts;
      const t = c.currentTime + delay;

      const length = Math.floor(c.sampleRate * dur);
      const buffer = c.createBuffer(1, length, c.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const src = c.createBufferSource();
      const filter = c.createBiquadFilter();
      const gain = c.createGain();

      src.buffer = buffer;
      filter.type = type;
      filter.frequency.setValueAtTime(freq, t);

      if (endFreq) {
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(20, endFreq),
          t + dur
        );
      }

      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      src.start(t);
      src.stop(t + dur + 0.03);
    }

    // A soft bell: fundamental + two quiet harmonics.
    function chime(noteIndex, vol = 0.12, delay = 0) {
      const f = NOTES[Math.min(Math.max(noteIndex, 0), NOTES.length - 1)];
      tone(f, 0.38, "sine", vol, null, delay);
      tone(f * 2, 0.26, "triangle", vol * 0.35, null, delay);
      tone(f * 3, 0.14, "sine", vol * 0.12, null, delay);
    }

    function buzz(pattern) {
      if (!enabled || !navigator.vibrate) return;
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        /* ignore */
      }
    }

    /* ---------- game sounds ---------- */

    function tap() {
      tone(900, 0.05, "sine", 0.08, 1300);
    }

    function swap() {
      tone(380, 0.08, "sine", 0.12, 640);
    }

    function invalid() {
      tone(230, 0.12, "square", 0.06, 170);
      tone(165, 0.18, "square", 0.06, 110, 0.1);
      buzz(40);
    }

    // Sweet match sound. The chain (combo) makes the pitch climb,
    // just like Candy Crush cascades.
    function match(combo = 1, size = 3) {
      const base = Math.min(combo - 1, 4);

      tone(700, 0.09, "sine", 0.08, 380); // soft pop
      chime(base, 0.13);
      chime(base + 2, 0.12, 0.07);
      chime(base + 4, 0.12, 0.14);

      if (size >= 4 || combo >= 2) {
        for (let k = 0; k < 4; k++) {
          tone(2100 + k * 320, 0.09, "sine", 0.035, null, 0.12 + k * 0.045);
        }
      }

      buzz(combo >= 2 ? [15, 20, 15] : 15);
    }

    function banger() {
      noise(0.3, 0.28, 2200, { endFreq: 250 });
      tone(160, 0.4, "sine", 0.3, 42);
      tone(520, 0.14, "square", 0.04, 180);
      buzz([30, 30, 50]);
    }

    function blast() {
      noise(0.45, 0.35, 2600, { endFreq: 180 });
      noise(0.25, 0.1, 5000, { type: "highpass", delay: 0.04 });
      tone(130, 0.55, "sawtooth", 0.16, 36);
      tone(70, 0.6, "sine", 0.4, 28);
      buzz([60, 30, 90]);
    }

    function thunder() {
      noise(0.9, 0.4, 500, { endFreq: 80 });
      tone(85, 0.9, "sawtooth", 0.17, 28);
      noise(0.5, 0.2, 300, { delay: 0.18 });
      blast();
      lightning();
      buzz([100, 40, 140]);
    }

    function pepper() {
      noise(0.5, 0.12, 4500, { type: "highpass", endFreq: 1500 }); // sizzle
      blast();
    }

    function shuffleSound() {
      for (let i = 0; i < 7; i++) {
        tone(500 + i * 90, 0.05, "triangle", 0.07, null, i * 0.045);
      }
    }

    function win() {
      [0, 2, 4, 5, 7, 9].forEach((n, i) => chime(n, 0.14, i * 0.11));
      chime(7, 0.1, 0.75);
      chime(9, 0.1, 0.75);
      buzz([50, 40, 50, 40, 120]);
    }

    function lose() {
      [440, 392, 330, 262].forEach((f, i) => {
        tone(f, 0.3, "triangle", 0.12, f * 0.97, i * 0.2);
      });
    }

    /* ---------- visual effects ---------- */

    let shakeAnim = null;

    // level: 1 = light, 2 = medium, 3 = heavy (true/false also work)
    function shake(level = 1) {
      if (calm) return;

      const lvl = level === true ? 3 : level === false ? 1 : level;
      const el = $("gameShell") || $("board");
      if (!el) return;

      const amp = [0, 5, 10, 18][Math.min(Math.max(lvl, 1), 3)];
      const steps = 12;
      const frames = [];

      for (let i = 0; i < steps; i++) {
        const decay = 1 - i / steps;
        frames.push({
          transform:
            `translate(${rand(-amp, amp) * decay}px, ${rand(-amp, amp) * decay}px) ` +
            `rotate(${rand(-1, 1) * amp * 0.08 * decay}deg)`
        });
      }

      frames.push({ transform: "translate(0,0) rotate(0deg)" });

      if (shakeAnim) shakeAnim.cancel();

      shakeAnim = el.animate(frames, {
        duration: 250 + lvl * 130,
        easing: "linear"
      });
    }

    function lightning() {
      if (calm) return;

      let flash = $("naijaFlash");

      if (!flash) {
        flash = document.createElement("div");
        flash.id = "naijaFlash";

        Object.assign(flash.style, {
          position: "fixed",
          inset: "0",
          background: "#fff",
          opacity: "0",
          pointerEvents: "none",
          zIndex: "9998"
        });

        document.body.appendChild(flash);
      }

      flash.animate(
        [
          { opacity: 0 },
          { opacity: 0.85, offset: 0.08 },
          { opacity: 0.1, offset: 0.2 },
          { opacity: 0.6, offset: 0.3 },
          { opacity: 0 }
        ],
        { duration: 600 }
      );
    }

    let bannerAnim = null;

    function banner(title, subtitle = "", emoji = "💥") {
      let el = $("naijaBanner");

      if (!el) {
        el = document.createElement("div");
        el.id = "naijaBanner";

        Object.assign(el.style, {
          position: "fixed",
          left: "50%",
          top: "36%",
          transform: "translate(-50%, -50%)",
          zIndex: "9999",
          pointerEvents: "none",
          textAlign: "center",
          opacity: "0",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          fontWeight: "900",
          color: "#fff",
          whiteSpace: "nowrap",
          textShadow: "0 4px 0 #b3003a, 0 0 26px #ffd700"
        });

        document.body.appendChild(el);
      }

      el.textContent = "";

      const icon = document.createElement("div");
      icon.textContent = emoji;
      icon.style.fontSize = "clamp(40px, 12vw, 72px)";

      const head = document.createElement("div");
      head.textContent = title;
      head.style.fontSize = "clamp(28px, 9vw, 54px)";

      const sub = document.createElement("div");
      sub.textContent = subtitle;
      sub.style.fontSize = "clamp(14px, 4vw, 22px)";

      el.append(icon, head, sub);

      if (bannerAnim) bannerAnim.cancel();

      bannerAnim = el.animate(
        [
          { opacity: 0, transform: "translate(-50%,-50%) scale(.3) rotate(-6deg)" },
          { opacity: 1, transform: "translate(-50%,-50%) scale(1.25) rotate(3deg)", offset: 0.22 },
          { opacity: 1, transform: "translate(-50%,-50%) scale(1) rotate(0deg)", offset: 0.7 },
          { opacity: 0, transform: "translate(-50%,-95%) scale(1.05)" }
        ],
        { duration: 1150, easing: "ease-out" }
      );
    }

    function setEnabled(value) {
      enabled = !!value;
      return enabled;
    }

    function toggle() {
      enabled = !enabled;
      return enabled;
    }

    // Unlock audio on the first real user gesture.
    ["pointerdown", "touchend", "keydown"].forEach(evt => {
      window.addEventListener(evt, unlock, { passive: true });
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    });

    return {
      unlock,
      tap,
      swap,
      invalid,
      match,
      banger,
      blast,
      thunder,
      pepper,
      shuffle: shuffleSound,
      win,
      lose,
      shake,
      lightning,
      banner,
      combo: banner, // old name still works
      setEnabled,
      toggle,
      isEnabled: () => enabled
    };
  })();

  window.NaijaFX = FX;

  /* ==========================================================
     ✨ PARTICLES (explosions, rings, floating scores)
     ========================================================== */

  const Particles = (() => {
    const colors = [
      "#FFD700", "#FF8C00", "#FF3D67",
      "#FFFFFF", "#00E5FF", "#7CFF6B"
    ];

    function layer() {
      const board = $("board");
      if (!board) return null;

      if (getComputedStyle(board).position === "static") {
        board.style.position = "relative";
      }

      let el = board.querySelector(".naija-particle-layer");

      if (!el) {
        el = document.createElement("div");
        el.className = "naija-particle-layer";

        Object.assign(el.style, {
          position: "absolute",
          inset: "0",
          pointerEvents: "none",
          zIndex: "50",
          overflow: "visible"
        });

        board.appendChild(el);
      }

      return el;
    }

    function fly(el, dx, dy, duration, spin = 0) {
      el.animate(
        [
          { transform: "translate(-50%,-50%) scale(1) rotate(0deg)", opacity: 1 },
          {
            transform: `translate(calc(-50% + ${dx * 0.65}px), calc(-50% + ${dy * 0.65 - 14}px)) scale(1.1) rotate(${spin * 0.6}deg)`,
            opacity: 1,
            offset: 0.5
          },
          {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 36}px)) scale(0.2) rotate(${spin}deg)`,
            opacity: 0
          }
        ],
        { duration, easing: "cubic-bezier(.2,.7,.4,1)" }
      ).onfinish = () => el.remove();
    }

    function burst(x, y, amount = 12, power = 1) {
      const host = layer();
      if (!host) return;

      for (let i = 0; i < amount; i++) {
        const p = document.createElement("span");
        const size = rand(5, 10);

        Object.assign(p.style, {
          position: "absolute",
          left: `${x}px`,
          top: `${y}px`,
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          background: colors[Math.floor(Math.random() * colors.length)],
          boxShadow: "0 0 8px rgba(255,215,0,.9)"
        });

        const angle = Math.random() * Math.PI * 2;
        const dist = (28 + Math.random() * 70) * power;

        host.appendChild(p);
        fly(p, Math.cos(angle) * dist, Math.sin(angle) * dist, rand(500, 800));
      }
    }

    // Tiny pieces of the food itself flying out.
    function bits(x, y, emoji, amount = 3) {
      const host = layer();
      if (!host || !emoji) return;

      for (let i = 0; i < amount; i++) {
        const p = document.createElement("span");
        p.textContent = i % 2 ? "✨" : emoji;

        Object.assign(p.style, {
          position: "absolute",
          left: `${x}px`,
          top: `${y}px`,
          fontSize: `${rand(12, 20)}px`,
          lineHeight: "1"
        });

        const angle = Math.random() * Math.PI * 2;
        const dist = rand(40, 90);

        host.appendChild(p);
        fly(p, Math.cos(angle) * dist, Math.sin(angle) * dist, rand(600, 900), rand(-200, 200));
      }
    }

    function ring(x, y, big = false) {
      const host = layer();
      if (!host) return;

      const r = document.createElement("span");

      Object.assign(r.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        border: `${big ? 5 : 3}px solid #FFD700`,
        boxShadow: "0 0 14px #FF8C00",
        transform: "translate(-50%,-50%)"
      });

      host.appendChild(r);

      r.animate(
        [
          { transform: "translate(-50%,-50%) scale(.2)", opacity: 1 },
          { transform: `translate(-50%,-50%) scale(${big ? 9 : 5})`, opacity: 0 }
        ],
        { duration: big ? 650 : 450, easing: "ease-out" }
      ).onfinish = () => r.remove();
    }

    function score(x, y, points = 100) {
      const host = layer();
      if (!host) return;

      const label = document.createElement("span");
      label.textContent = `+${points}`;

      Object.assign(label.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        fontWeight: "900",
        fontSize: "18px",
        color: "#FFD700",
        textShadow: "0 2px 0 #7a3b00, 0 0 10px #fff",
        whiteSpace: "nowrap"
      });

      host.appendChild(label);

      label.animate(
        [
          { transform: "translate(-50%,-50%) scale(.5)", opacity: 0 },
          { transform: "translate(-50%,-90%) scale(1.35)", opacity: 1, offset: 0.2 },
          { transform: "translate(-50%,-260%) scale(1)", opacity: 0 }
        ],
        { duration: 950, easing: "ease-out" }
      ).onfinish = () => label.remove();
    }

    function center(tile) {
      const board = $("board");
      const b = board.getBoundingClientRect();
      const t = tile.getBoundingClientRect();

      return {
        x: t.left - b.left + t.width / 2,
        y: t.top - b.top + t.height / 2
      };
    }

    function celebrateTile(tile, points = 100, big = false) {
      if (!tile) return;

      const { x, y } = center(tile);
      const emoji = tile.textContent;

      ring(x, y, big);
      burst(x, y, big ? 20 : 12, big ? 1.4 : 1);
      bits(x, y, emoji, big ? 4 : 3);
      score(x, y, points);
    }

    // Fireworks across the board (used for level wins).
    function confetti(times = 14) {
      const board = $("board");
      if (!board) return;

      const w = board.clientWidth;
      const h = board.clientHeight;

      for (let i = 0; i < times; i++) {
        setTimeout(() => {
          const x = rand(w * 0.1, w * 0.9);
          const y = rand(h * 0.1, h * 0.9);
          ring(x, y, false);
          burst(x, y, 18, 1.3);
        }, i * 90);
      }
    }

    return { burst, bits, ring, score, celebrateTile, confetti };
  })();

  window.NaijaParticles = Particles;

  /* ==========================================================
     🗣️ PIDGIN VOICE (spoken lines, rate-limited)
     ========================================================== */

  const Voice = {
    enabled: true,
    lastSpoke: 0,

    lines: {
      tap: ["Oya, make we play!", "Touch am, my guy!"],
      match: ["Oyaaa! Correct match!", "Chop am! You don try!", "Nice one, no dulling!"],
      combo: ["Omoooo! Wetin dey happen!", "Ah! You dey burst everywhere!", "Correct! Continue jare!"],
      win: ["You don win o! You too sabi!", "Omo! Na correct player be this!", "Congratulations! You don do am!"],
      lose: ["Chai! Your moves don finish o!", "Ah-ah! Try again, no give up!", "Oya, one more time!"],
      pepper: ["Pepper don land! Everybody clear road!", "Omo! Everywhere don hot!"]
    },

    speak(type, force = false) {
      if (!this.enabled || !("speechSynthesis" in window)) return;

      const options = this.lines[type];
      if (!options) return;

      const now = Date.now();

      // Don't chatter on every match.
      if (!force && (now - this.lastSpoke < 3500 || speechSynthesis.speaking)) {
        return;
      }

      this.lastSpoke = now;

      if (force) speechSynthesis.cancel();

      const message = options[Math.floor(Math.random() * options.length)];
      const utterance = new SpeechSynthesisUtterance(message);
      const voices = speechSynthesis.getVoices();

      utterance.voice =
        voices.find(v => v.lang === "en-NG") ||
        voices.find(v => v.lang === "en-GB") ||
        voices.find(v => v.lang && v.lang.startsWith("en")) ||
        null;

      utterance.lang = (utterance.voice && utterance.voice.lang) || "en-GB";
      utterance.rate = 1.08;
      utterance.pitch = 1.15;
      utterance.volume = 1;

      speechSynthesis.speak(utterance);
    },

    toggle() {
      this.enabled = !this.enabled;

      if (!this.enabled && "speechSynthesis" in window) {
        speechSynthesis.cancel();
      }

      return this.enabled;
    }
  };

  window.NaijaVoice = Voice;

  // Voices load asynchronously in most browsers.
  if ("speechSynthesis" in window) {
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
  }

  /* ==========================================================
     🎮 GAME
     ========================================================== */

  function boot() {
    const boardElement = $("board");
    const scoreElement = $("score");
    const bestElement = $("bestScore");
    const movesElement = $("moves");
    const targetElement = $("target");
    const progressElement = $("progress");
    const levelTag = $("levelTag");
    const messageElement = $("message");
    const overlay = $("overlay");

    // Small touch-friendliness tweaks.
    const style = document.createElement("style");
    style.textContent =
      "#board .tile{touch-action:manipulation;-webkit-tap-highlight-color:transparent;}";
    document.head.appendChild(style);

    let board = [];
    let selected = null;
    let score = 0;
    let moves = 25;
    let level = 1;
    let target = 500;

    let locked = false;
    let gameOver = false;

    let bestScore = 0;

    try {
      bestScore = Number(localStorage.getItem("naijaCrushBest") || 0);
    } catch (e) {
      bestScore = 0;
    }

    bestElement.textContent = bestScore;

    /* ---------- helpers ---------- */

    function randomFood() {
      return Math.floor(Math.random() * foods.length);
    }

    function getTile(row, col) {
      return boardElement.querySelector(
        `.tile[data-row="${row}"][data-col="${col}"]`
      );
    }

    const popFrames = [
      { transform: "scale(1) rotate(0deg)", filter: "brightness(1)", opacity: 1 },
      { transform: "scale(1.4) rotate(10deg)", filter: "brightness(1.9)", opacity: 1, offset: 0.35 },
      { transform: "scale(0) rotate(-25deg)", filter: "brightness(2.4)", opacity: 0 }
    ];

    function bump(el) {
      if (!el) return;
      el.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.35)", offset: 0.4 },
          { transform: "scale(1)" }
        ],
        { duration: 260, easing: "ease-out" }
      );
    }

    /* ---------- board creation ---------- */

    function createBoard() {
      do {
        board = [];

        for (let row = 0; row < SIZE; row++) {
          board[row] = [];

          for (let col = 0; col < SIZE; col++) {
            let food;

            do {
              food = randomFood();
            } while (
              (col >= 2 &&
                board[row][col - 1] === food &&
                board[row][col - 2] === food) ||
              (row >= 2 &&
                board[row - 1][col] === food &&
                board[row - 2][col] === food)
            );

            board[row][col] = food;
          }
        }
      } while (!findPossibleMove());

      renderBoard(null, true);
    }

    /* ---------- drawing ---------- */

    // falls: matrix of "rows this tile fell" (for drop animation)
    // intro: every tile drops in from above (level start / shuffle)
    function renderBoard(falls = null, intro = false) {
      boardElement.querySelectorAll(".tile").forEach(tile => tile.remove());

      const fragment = document.createDocumentFragment();
      const made = [];

      for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
          const button = document.createElement("button");
          const food = board[row][col];

          button.type = "button";
          button.className = "tile";
          button.dataset.row = row;
          button.dataset.col = col;

          if (food === null) {
            button.classList.add("empty");
            button.textContent = "";
            button.disabled = true;
            button.setAttribute("aria-label", "Empty tile");
          } else {
            button.textContent = foods[food].emoji;
            button.setAttribute("aria-label", foods[food].name);
          }

          if (selected && selected.row === row && selected.col === col) {
            button.classList.add("selected");
          }

          button.addEventListener("click", () => handleTile(row, col));

          fragment.appendChild(button);
          made.push({ button, row, col });
        }
      }

      boardElement.appendChild(fragment);

      if (falls || intro) animateEntrances(made, falls, intro);
    }

    const durFor = fall => 220 + fall * 50;

    function animateEntrances(made, falls, intro) {
      const tiles = boardElement.querySelectorAll(".tile");
      if (tiles.length <= SIZE) return;

      const step =
        tiles[SIZE].getBoundingClientRect().top -
        tiles[0].getBoundingClientRect().top;

      if (!step) return;

      for (const { button, row, col } of made) {
        if (board[row][col] === null) continue;

        const fall = intro ? SIZE + 1 : falls[row][col];
        if (!fall) continue;

        const dist = fall * step;
        const fresh = intro || row - fall < 0;
        const delay = intro ? col * 35 + (SIZE - row) * 16 : 0;

        const frames = [
          {
            transform: `translateY(${-dist}px)`,
            opacity: fresh ? 0 : 1,
            offset: 0,
            easing: "cubic-bezier(.5,0,.9,.6)"
          }
        ];

        if (fresh) frames.push({ opacity: 1, offset: 0.2 });

        frames.push(
          { transform: "translateY(0)", opacity: 1, offset: 0.62, easing: "ease-out" },
          { transform: "translateY(-8px)", offset: 0.8, easing: "ease-in" },
          { transform: "translateY(0)", offset: 1 }
        );

        button.animate(frames, {
          duration: durFor(fall) + (intro ? 120 : 0),
          delay,
          fill: "backwards"
        });
      }
    }

    /* ---------- input ---------- */

    function handleTile(row, col) {
      FX.unlock();

      if (locked || gameOver) return;
      if (board[row][col] === null) return;

      if (!selected) {
        selected = { row, col };
        FX.tap();
        renderBoard();
        return;
      }

      if (selected.row === row && selected.col === col) {
        selected = null;
        renderBoard();
        return;
      }

      const distance =
        Math.abs(selected.row - row) + Math.abs(selected.col - col);

      if (distance !== 1) {
        selected = { row, col };
        FX.tap();
        renderBoard();
        return;
      }

      const first = selected;
      selected = null;

      swapTiles(first.row, first.col, row, col);
    }

    function swapData(r1, c1, r2, c2) {
      const temp = board[r1][c1];
      board[r1][c1] = board[r2][c2];
      board[r2][c2] = temp;
    }

    async function swapTiles(r1, c1, r2, c2) {
      if (locked || gameOver) return;

      locked = true;

      try {
        renderBoard(); // clear the "selected" highlight

        const a = getTile(r1, c1);
        const b = getTile(r2, c2);

        let dx = 0;
        let dy = 0;

        if (a && b) {
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          dx = rb.left - ra.left;
          dy = rb.top - ra.top;
        }

        // Test the swap before committing to it.
        swapData(r1, c1, r2, c2);
        const valid = findMatches().size > 0;
        swapData(r1, c1, r2, c2);

        if (!valid) {
          // Slide over and bounce back.
          FX.swap();

          const there = (x, y) => [
            { transform: "translate(0,0)" },
            { transform: `translate(${x}px,${y}px)`, offset: 0.5 },
            { transform: "translate(0,0)" }
          ];

          if (a && b) {
            a.animate(there(dx, dy), { duration: 300, easing: "ease-in-out" });
            b.animate(there(-dx, -dy), { duration: 300, easing: "ease-in-out" });
          }

          await sleep(300);

          FX.invalid();
          FX.shake(1);

          messageElement.textContent = "No match! Try another move, abeg.";
          return;
        }

        // Valid move: slide tiles into each other's place.
        FX.swap();

        if (a && b) {
          const slide = (x, y) =>
            [{ transform: "translate(0,0)" }, { transform: `translate(${x}px,${y}px)` }];

          a.animate(slide(dx, dy), { duration: 150, easing: "ease-in-out", fill: "forwards" });
          b.animate(slide(-dx, -dy), { duration: 150, easing: "ease-in-out", fill: "forwards" });

          await sleep(150);
        }

        swapData(r1, c1, r2, c2);
        moves--;

        updateStats();
        renderBoard();

        await runCascade();
        await afterMove();
      } finally {
        if (!gameOver) locked = false;
      }
    }

    /* ---------- matching ---------- */

    function findMatches() {
      const matched = new Set();

      // Horizontal
      for (let row = 0; row < SIZE; row++) {
        let count = 1;

        for (let col = 1; col <= SIZE; col++) {
          const current = col < SIZE ? board[row][col] : -1;
          const previous = board[row][col - 1];

          if (current !== null && current === previous) {
            count++;
          } else {
            if (previous !== null && previous !== undefined && count >= 3) {
              for (let k = col - count; k < col; k++) {
                matched.add(`${row},${k}`);
              }
            }

            count = 1;
          }
        }
      }

      // Vertical
      for (let col = 0; col < SIZE; col++) {
        let count = 1;

        for (let row = 1; row <= SIZE; row++) {
          const current = row < SIZE ? board[row][col] : -1;
          const previous = board[row - 1][col];

          if (current !== null && current === previous) {
            count++;
          } else {
            if (previous !== null && previous !== undefined && count >= 3) {
              for (let k = row - count; k < row; k++) {
                matched.add(`${k},${col}`);
              }
            }

            count = 1;
          }
        }
      }

      return matched;
    }

    // Returns a swap that creates a match, or null if none exists.
    function findPossibleMove() {
      for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
          const neighbours = [
            [row, col + 1],
            [row + 1, col]
          ];

          for (const [r, c] of neighbours) {
            if (r >= SIZE || c >= SIZE) continue;
            if (board[row][col] === null || board[r][c] === null) continue;

            swapData(row, col, r, c);
            const found = findMatches().size > 0;
            swapData(row, col, r, c);

            if (found) return { row, col, r, c };
          }
        }
      }

      return null;
    }

    /* ---------- the juicy part ---------- */

    async function popTiles(cells, pointsEach, big = false) {
      const stagger = Math.min(28, 260 / Math.max(cells.length, 1));

      cells.forEach(([r, c], i) => {
        const tile = getTile(r, c);
        if (!tile) return;

        setTimeout(() => {
          Particles.celebrateTile(tile, pointsEach, big);

          tile.animate(popFrames, {
            duration: 300,
            easing: "ease-in",
            fill: "forwards"
          });
        }, i * stagger);
      });

      await sleep(300 + cells.length * stagger);
    }

    const TIERS = [
      // minimum "power" → banner
      { min: 16, title: "DIVINE!", sub: "Omo wahala! 🔥", emoji: "👑", shake: 3, sound: "thunder" },
      { min: 11, title: "TOO SWEET!", sub: "You dey burst am!", emoji: "🤩", shake: 3, sound: "blast" },
      { min: 7, title: "SWEET!", sub: "Correct combo!", emoji: "🍬", shake: 2, sound: "banger" },
      { min: 5, title: "TASTY!", sub: "Nice one!", emoji: "😋", shake: 1, sound: null }
    ];

    async function clearMatches(matches, combo) {
      const size = matches.size;
      const cells = [...matches].map(key => key.split(",").map(Number));
      const pointsEach = 20 * combo;

      // "power" grows with both match size and cascade depth.
      const power = size + (combo - 1) * 4;
      const tier = TIERS.find(t => power >= t.min) || null;

      FX.match(combo, size);

      if (tier) {
        if (tier.sound === "thunder") FX.thunder();
        else if (tier.sound === "blast") FX.blast();
        else if (tier.sound === "banger") FX.banger();

        FX.shake(tier.shake);
        FX.banner(
          combo >= 2 ? `${tier.title}  x${combo}` : tier.title,
          tier.sub,
          tier.emoji
        );

        Voice.speak(power >= 11 ? "combo" : "match");
      } else if (combo >= 2) {
        FX.banner(`COMBO x${combo}`, "Keep am going!", "✨");
        FX.shake(1);
        Voice.speak("match");
      }

      score += size * pointsEach;
      scoreElement.textContent = score;
      bump(scoreElement);
      updateStats();

      messageElement.textContent =
        power >= 7
          ? "Omo! Big combo! 🔥"
          : "Correct! You don match am! ✨";

      await popTiles(cells, pointsEach, power >= 7);

      for (const [r, c] of cells) {
        board[r][c] = null;
      }
    }

    function dropTiles() {
      const falls = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

      for (let col = 0; col < SIZE; col++) {
        const stack = [];

        for (let row = SIZE - 1; row >= 0; row--) {
          if (board[row][col] !== null) {
            stack.push({ food: board[row][col], from: row });
          }
        }

        const empties = SIZE - stack.length;
        let index = 0;

        for (let row = SIZE - 1; row >= 0; row--) {
          if (index < stack.length) {
            const item = stack[index++];
            board[row][col] = item.food;
            falls[row][col] = row - item.from;
          } else {
            board[row][col] = randomFood();
            falls[row][col] = empties; // new tiles drop in from above
          }
        }
      }

      return falls;
    }

    // Clears matches, drops tiles, repeats until the board is calm.
    async function runCascade() {
      let combo = 0;

      while (true) {
        const matches = findMatches();
        if (matches.size === 0) break;

        combo++;

        await clearMatches(matches, combo);

        const falls = dropTiles();
        renderBoard(falls);

        const maxFall = Math.max(...falls.flat());
        await sleep(durFor(maxFall) + 60);
      }

      return combo;
    }

    // Win / lose / dead-board checks after everything settles.
    async function afterMove() {
      updateStats();

      if (score >= target) {
        finishLevel(true);
        return;
      }

      if (moves <= 0) {
        finishLevel(false);
        return;
      }

      if (!findPossibleMove()) {
        messageElement.textContent = "No moves left — shuffling the board!";
        await sleep(400);
        shuffleCore();
        return;
      }

      messageElement.textContent = "Keep going! You fit do am! 🇳🇬";
    }

    /* ---------- stats ---------- */

    function updateStats() {
      scoreElement.textContent = score;
      movesElement.textContent = moves;
      targetElement.textContent = target;

      levelTag.textContent = `LEVEL ${level}`;

      progressElement.style.width =
        Math.min(100, (score / target) * 100) + "%";

      if (score > bestScore) {
        bestScore = score;
        bestElement.textContent = bestScore;

        try {
          localStorage.setItem("naijaCrushBest", String(bestScore));
        } catch (e) {
          /* ignore */
        }
      }
    }

    /* ---------- win / lose ---------- */

    function finishLevel(won) {
      if (gameOver) return;

      gameOver = true;
      locked = true;

      $("modalEmoji").textContent = won ? "🏆" : "😅";
      $("modalTitle").textContent = won ? "You Don Win!" : "E Don Finish!";

      $("modalText").textContent = won
        ? `Sweet victory! You scored ${score} points. Ready for the next level?`
        : `You scored ${score} points. Try again and show this challenge pepper!`;

      $("modalButton").textContent = won ? "Next Level →" : "Try Again ↻";

      if (won) {
        FX.win();
        FX.shake(2);
        Particles.confetti(16);
        FX.banner("LEVEL CLEAR!", "You too sabi!", "🏆");
        Voice.speak("win", true);

        setTimeout(() => overlay.classList.add("show"), 1100);
      } else {
        FX.lose();
        Voice.speak("lose", true);
        overlay.classList.add("show");
      }
    }

    function startLevel(newLevel = level) {
      level = newLevel;

      score = 0;
      moves = 25;
      target = 500 + (level - 1) * 250;

      selected = null;
      locked = false;
      gameOver = false;

      overlay.classList.remove("show");

      messageElement.textContent = "Tap one food, then tap a neighbour!";

      updateStats();
      createBoard();
    }

    /* ---------- boosters ---------- */

    // Shuffles until the board has no ready-made matches
    // but still has at least one possible move.
    function shuffleCore() {
      const values = board.flat().filter(v => v !== null);

      for (let attempt = 0; attempt < 60; attempt++) {
        for (let i = values.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [values[i], values[j]] = [values[j], values[i]];
        }

        let index = 0;

        for (let row = 0; row < SIZE; row++) {
          for (let col = 0; col < SIZE; col++) {
            board[row][col] = values[index++];
          }
        }

        if (findMatches().size === 0 && findPossibleMove()) break;
      }

      selected = null;

      FX.shuffle();
      renderBoard(null, true);

      messageElement.textContent = "Board don shuffle! Find your next match.";
    }

    function shuffleBoard() {
      FX.unlock();
      if (locked || gameOver) return;

      shuffleCore();
    }

    async function pepperBlast() {
      FX.unlock();
      if (locked || gameOver) return;

      const present = [...new Set(board.flat().filter(v => v !== null))];

      if (present.length === 0) return;

      locked = true;

      try {
        const foodType = present[Math.floor(Math.random() * present.length)];
        const cells = [];

        for (let row = 0; row < SIZE; row++) {
          for (let col = 0; col < SIZE; col++) {
            if (board[row][col] === foodType) cells.push([row, col]);
          }
        }

        selected = null;
        renderBoard();

        moves--;
        score += cells.length * 10;

        updateStats();
        bump(scoreElement);

        FX.pepper();
        FX.shake(3);
        FX.banner("PEPPER DON LAND!", `${cells.length} tiles cleared`, "🌶️");
        Voice.speak("pepper", true);

        messageElement.textContent =
          `Pepper don land! ${cells.length} tiles cleared! 🌶️`;

        await popTiles(cells, 10, true);

        for (const [r, c] of cells) board[r][c] = null;

        const falls = dropTiles();
        renderBoard(falls);

        await sleep(durFor(Math.max(...falls.flat())) + 60);

        await runCascade();
        await afterMove();
      } finally {
        if (!gameOver) locked = false;
      }
    }

    function findHint() {
      FX.unlock();
      if (locked || gameOver) return;

      const move = findPossibleMove();

      if (!move) {
        messageElement.textContent = "No easy match found. Shuffle the board!";
        return;
      }

      selected = { row: move.row, col: move.col };
      renderBoard();

      FX.tap();

      // Pulse both tiles of the suggested swap.
      [getTile(move.row, move.col), getTile(move.r, move.c)].forEach(tile => {
        if (!tile) return;

        tile.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.25)", offset: 0.5 },
            { transform: "scale(1)" }
          ],
          { duration: 500, iterations: 3, easing: "ease-in-out" }
        );
      });

      messageElement.textContent = "Try this tile! Match three or more.";
    }

    /* ---------- buttons ---------- */

    $("restartButton").addEventListener("click", () => {
      FX.unlock();
      startLevel(level);
    });

    $("nextButton").addEventListener("click", () => {
      if (gameOver) return;

      messageElement.textContent =
        "Complete your mission to unlock the next level!";

      if (score >= target) finishLevel(true);
    });

    $("modalButton").addEventListener("click", () => {
      FX.unlock();
      startLevel(score >= target ? level + 1 : level);
    });

    $("pepperBooster").addEventListener("click", pepperBlast);
    $("shuffleBooster").addEventListener("click", shuffleBoard);
    $("hintBooster").addEventListener("click", findHint);

    $("soundButton").addEventListener("click", event => {
      FX.unlock();

      const on = FX.toggle();
      Voice.enabled = on;

      if (!on && "speechSynthesis" in window) speechSynthesis.cancel();

      event.currentTarget.textContent = on ? "🔊" : "🔇";

      if (on) FX.match(1, 3);
    });

    // LAUNCH
    startLevel(1);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();