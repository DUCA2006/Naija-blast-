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

  // Special tile id for the Jollof Bomb (never matches by colour).
  const BOMB = foods.length;

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

    // Magical "special tile created" sound.
    function sparkle() {
      [5, 7, 9].forEach((n, i) => chime(n, 0.1, i * 0.07));

      for (let k = 0; k < 5; k++) {
        tone(2400 + k * 260, 0.08, "sine", 0.03, null, 0.05 + k * 0.04);
      }

      buzz(20);
    }

    // Briefly lowers effects volume so spoken lines cut through.
    function duck(on) {
      if (!ctx || !master) return;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(on ? 0.35 : 0.9, t, 0.05);
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
      duck,
      sparkle,
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

    // Light beam across a row or column (striped tiles).
    function beam(tile, dir) {
      const host = layer();
      if (!host || !tile) return;

      const board = $("board");
      const { x, y } = center(tile);
      const vertical = dir === "col";
      const thick = 18;

      const el = document.createElement("span");

      Object.assign(el.style, {
        position: "absolute",
        pointerEvents: "none",
        borderRadius: "10px",
        boxShadow: "0 0 18px 6px rgba(255,200,0,.8)",
        background: vertical
          ? "linear-gradient(90deg,transparent,#fff 35%,#FFD700 50%,#fff 65%,transparent)"
          : "linear-gradient(180deg,transparent,#fff 35%,#FFD700 50%,#fff 65%,transparent)"
      });

      if (vertical) {
        el.style.left = `${x - thick / 2}px`;
        el.style.top = "0";
        el.style.width = `${thick}px`;
        el.style.height = `${board.clientHeight}px`;
      } else {
        el.style.top = `${y - thick / 2}px`;
        el.style.left = "0";
        el.style.height = `${thick}px`;
        el.style.width = `${board.clientWidth}px`;
      }

      host.appendChild(el);

      const axis = vertical ? "scaleX" : "scaleY";

      el.animate(
        [
          { transform: `${axis}(.2)`, opacity: 1 },
          { transform: `${axis}(1.7)`, opacity: 1, offset: 0.3 },
          { transform: `${axis}(0)`, opacity: 0 }
        ],
        { duration: 520, easing: "ease-out" }
      ).onfinish = () => el.remove();
    }

    // Big explosion at one tile (wrapped tiles, bombs, new specials).
    function shockwave(tile) {
      if (!tile) return;
      const { x, y } = center(tile);
      ring(x, y, true);
      burst(x, y, 26, 1.6);
    }

    // lite = fewer particles, for big clears (keeps phones smooth).
    function celebrateTile(tile, points = 100, big = false, lite = false) {
      if (!tile) return;

      const { x, y } = center(tile);
      const emoji = tile.textContent;

      if (lite) {
        burst(x, y, 6);
        bits(x, y, emoji, 1);
        return;
      }

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

    return { burst, bits, ring, score, beam, shockwave, celebrateTile, confetti };
  })();

  window.NaijaParticles = Particles;

  /* ==========================================================
  🗣️ PIDGIN VOICE (spoken lines, rate-limited)
  ========================================================== */

  const Voice = {
    enabled: true,
    lastSpoke: 0,
    duckEffects: true, // set false to never lower effects during speech
    _voice: null,

    // Short sentences + clear punctuation = clearer speech.
    lines: {
      tap: ["Oya, make we play!", "Touch am, my guy!"],
      match: ["Oya! Correct match!", "Chop am! You don try!", "Nice one! No dulling!"],
      combo: ["Omo! Wetin dey happen!", "Ah! You dey burst everywhere!", "Correct! Continue, jare!"],
      win: ["You don win, o! You too sabi!", "Omo! Na correct player be this!", "Congratulations! You don do am!"],
      lose: ["Chai! Your moves don finish, o!", "Ah ah! Try again. No give up!", "Oya! One more time!"],
      pepper: ["Pepper don land! Everybody clear road!", "Omo! Everywhere don hot!"]
    },

    // Picks the clearest English voice available on the device
    // (prefers natural/neural/Google voices, then Nigerian/British/US).
    pickVoice() {
      const voices = speechSynthesis.getVoices();
      if (!voices.length) return null;

      if (this._voice && voices.includes(this._voice)) return this._voice;

      const score = v => {
        const lang = (v.lang || "").replace("_", "-");
        let s;

        if (lang === "en-NG") s = 25;
        else if (lang === "en-GB") s = 22;
        else if (lang === "en-US") s = 20;
        else if (lang.startsWith("en")) s = 10;
        else return -1;

        if (/natural|neural|online|enhanced|premium|google/i.test(v.name)) s += 30;

        return s;
      };

      let best = null;
      let bestScore = -1;

      for (const v of voices) {
        const sc = score(v);
        if (sc > bestScore) {
          best = v;
          bestScore = sc;
        }
      }

      this._voice = best;
      return best;
    },

    speak(type, force = false) {
      if (!this.enabled || !("speechSynthesis" in window)) return;

      const options = this.lines[type];
      if (!options) return;

      const now = Date.now();

      // Don't talk over the previous line or chatter on every match.
      if (!force && (now - this.lastSpoke < 3500 || speechSynthesis.speaking)) {
        return;
      }

      this.lastSpoke = now;

      if (force) speechSynthesis.cancel();

      // Some browsers get stuck in a paused state.
      speechSynthesis.resume();

      const message = options[Math.floor(Math.random() * options.length)];
      const utterance = new SpeechSynthesisUtterance(message);
      const voice = this.pickVoice();

      if (voice) utterance.voice = voice;

      utterance.lang = (voice && voice.lang) || "en-GB";
      utterance.rate = 0.88;   // slower = easier to understand
      utterance.pitch = 1.0;   // natural pitch, no chipmunk effect
      utterance.volume = 1;    // maximum allowed by the browser

      const release = () => {
        if (this.duckEffects) FX.duck(false);
      };

      utterance.onstart = () => {
        if (this.duckEffects) FX.duck(true);
      };
      utterance.onend = release;
      utterance.onerror = release;

      speechSynthesis.speak(utterance);
    },

    toggle() {
      this.enabled = !this.enabled;

      if (!this.enabled && "speechSynthesis" in window) {
        speechSynthesis.cancel();
        FX.duck(false);
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
    style.textContent = `
      #board .tile{
        touch-action:manipulation;
        -webkit-tap-highlight-color:transparent;
        font-size: clamp(28px, 7.5vw, 34px) !important;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        padding: 0;
      }

      #board .tile[data-special]{
        position:relative;
        z-index:1;
        animation:naijaGlow 1s ease-in-out infinite alternate;
      }

      /* small badge showing what the tile does */
      #board .tile[data-badge]::after{
        content:attr(data-badge);
        position:absolute;
        right:1px;
        bottom:-1px;
        font-size:14px;
        line-height:1;
        filter:drop-shadow(0 0 2px #000);
        pointer-events:none;
      }

      /* striped tiles */
      #board .tile[data-special="row"]::before,
      #board .tile[data-special="col"]::before,
      #board .tile[data-special="cross"]::before{
        content:"";
        position:absolute;
        inset:0;
        border-radius:inherit;
        pointer-events:none;
      }
      #board .tile[data-special="row"]::before{
        background:repeating-linear-gradient(0deg,rgba(255,255,255,.6) 0 3px,transparent 3px 9px);
      }
      #board .tile[data-special="col"]::before{
        background:repeating-linear-gradient(90deg,rgba(255,255,255,.6) 0 3px,transparent 3px 9px);
      }

      /* wrapped tile */
      #board .tile[data-special="wrap"]{
        outline:3px dashed #FFD700;
        outline-offset:-3px;
      }

      /* jollof bomb */
      #board .tile[data-special="bomb"]{
        animation:naijaBomb 1.2s linear infinite;
        border-radius:50%;
      }

      @keyframes naijaGlow{
        from{box-shadow:0 0 6px 1px #FFD700;}
        to{box-shadow:0 0 16px 5px #FF8C00;}
      }
      @keyframes naijaBomb{
        0%{box-shadow:0 0 14px 4px #ff3d67;filter:hue-rotate(0deg);}
        100%{box-shadow:0 0 14px 4px #00e5ff;filter:hue-rotate(360deg);}
      }
    `;
    document.head.appendChild(style);

    let board = [];
    let special = []; // null | "row" | "col" | "cross" | "wrap" | "bomb"
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

    const emptySpecial = () =>
      Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

    function createBoard() {
      do {
        special = emptySpecial();
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

    const BADGES = { row: "↔", col: "↕", cross: "✚", wrap: "💥" };

    const SPECIAL_NAMES = {
      row: "row blast",
      col: "column blast",
      cross: "cross blast",
      wrap: "wrapped blast",
      bomb: "Jollof bomb"
    };

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
          const sp = special[row][col];

          button.type = "button";
          button.className = "tile";
          button.dataset.row = row;
          button.dataset.col = col;

          if (food === null) {
            button.classList.add("empty");
            button.textContent = "";
            button.disabled = true;
            button.setAttribute("aria-label", "Empty tile");
          } else if (food === BOMB) {
            button.textContent = "🍛";
            button.dataset.special = "bomb";
            button.setAttribute("aria-label", "Jollof bomb");
          } else {
            button.textContent = foods[food].emoji;

            let label = foods[food].name;

            if (sp) {
              button.dataset.special = sp;
              button.dataset.badge = BADGES[sp] || "";
              label += ` (${SPECIAL_NAMES[sp]})`;
            }

            button.setAttribute("aria-label", label);
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

    // Swaps food AND special markers together.
    function swapData(r1, c1, r2, c2) {
      let temp = board[r1][c1];
      board[r1][c1] = board[r2][c2];
      board[r2][c2] = temp;

      temp = special[r1][c1];
      special[r1][c1] = special[r2][c2];
      special[r2][c2] = temp;
    }

    // A swap is a "power swap" (valid even without a 3-match) when it
    // involves a Jollof bomb, or two special tiles together.
    function swapIsSpecial(r1, c1, r2, c2) {
      const a = board[r1][c1];
      const b = board[r2][c2];

      if (a === null || b === null) return false;
      if (a === BOMB || b === BOMB) return true;

      return !!(special[r1][c1] && special[r2][c2]);
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
        const specialSwap = swapIsSpecial(r1, c1, r2, c2);
        const valid = specialSwap || findMatches().size > 0;
        swapData(r1, c1, r2, c2);

        if (!valid) {
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

        // Bomb swaps and special + special swaps trigger directly.
        const forced = specialSwap ? planSwap(r1, c1, r2, c2) : null;

        await runCascade([[r1, c1], [r2, c2]], forced);
        await afterMove();
      } finally {
        if (!gameOver) locked = false;
      }
    }

    /* ---------- matching ---------- */

    // Every straight run of 3+ identical foods.
    function findRuns() {
      const runs = [];

      // Horizontal
      for (let row = 0; row < SIZE; row++) {
        let count = 1;

        for (let col = 1; col <= SIZE; col++) {
          const current = col < SIZE ? board[row][col] : -1;
          const previous = board[row][col - 1];

          if (current !== null && current === previous && current !== BOMB) {
            count++;
          } else {
            if (previous !== null && previous !== BOMB && count >= 3) {
              const cells = [];
              for (let k = col - count; k < col; k++) cells.push([row, k]);
              runs.push({ dir: "h", cells });
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

          if (current !== null && current === previous && current !== BOMB) {
            count++;
          } else {
            if (previous !== null && previous !== BOMB && count >= 3) {
              const cells = [];
              for (let k = row - count; k < row; k++) cells.push([k, col]);
              runs.push({ dir: "v", cells });
            }

            count = 1;
          }
        }
      }

      return runs;
    }

    function findMatches() {
      const matched = new Set();

      for (const run of findRuns()) {
        for (const [r, c] of run.cells) matched.add(`${r},${c}`);
      }

      return matched;
    }

    // Returns a swap that does something, or null if none exists.
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
            const found =
              swapIsSpecial(row, col, r, c) || findMatches().size > 0;
            swapData(row, col, r, c);

            if (found) return { row, col, r, c };
          }
        }
      }

      return null;
    }

    /* ---------- special tile logic ---------- */

    // Which cells a special tile destroys when it goes off.
    function blastCells(type, r, c) {
      const out = [];

      const add = (rr, cc) => {
        if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && board[rr][cc] !== null) {
          out.push(`${rr},${cc}`);
        }
      };

      if (type === "row" || type === "cross") {
        for (let k = 0; k < SIZE; k++) add(r, k);
      }

      if (type === "col" || type === "cross") {
        for (let k = 0; k < SIZE; k++) add(k, c);
      }

      if (type === "wrap") {
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            if (Math.abs(dr) + Math.abs(dc) <= 2) add(r + dr, c + dc);
          }
        }
      }

      if (type === "bomb") {
        // A bomb caught in a blast wipes out one random food.
        const present = [
          ...new Set(board.flat().filter(v => v !== null && v !== BOMB))
        ];

        if (present.length) {
          const food = present[Math.floor(Math.random() * present.length)];

          for (let rr = 0; rr < SIZE; rr++) {
            for (let cc = 0; cc < SIZE; cc++) {
              if (board[rr][cc] === food) add(rr, cc);
            }
          }
        }
      }

      return out;
    }

    // Grows `set` with chain reactions: specials inside it go off too.
    // `protect` cells (new specials being created) are never added.
    function expandBlasts(set, protect = new Set()) {
      const queue = [...set];
      const done = new Set();
      const blasts = [];

      while (queue.length) {
        const key = queue.pop();

        if (done.has(key)) continue;
        done.add(key);

        const [r, c] = key.split(",").map(Number);
        const type = special[r][c];

        if (!type) continue;

        blasts.push({ type, r, c });

        for (const k of blastCells(type, r, c)) {
          if (protect.has(k)) continue;

          if (!set.has(k)) {
            set.add(k);
            queue.push(k);
          }
        }
      }

      return blasts;
    }

    // Decides what a normal round of matches clears and creates:
    //   4 in a row  → striped tile
    //   L / T shape → wrapped tile
    //   5+ in a row → Jollof bomb
    function planMatches(hint) {
      const runs = findRuns();
      if (!runs.length) return null;

      const clear = new Set();

      for (const run of runs) {
        for (const [r, c] of run.cells) clear.add(`${r},${c}`);
      }

      const hintKeys = (hint || []).map(([r, c]) => `${r},${c}`);
      const creates = [];
      const used = new Set();

      const taken = (r, c) => creates.some(x => x.r === r && x.c === c);

      // Prefer the tile the player just moved, else the middle.
      const pick = cells => {
        const free = cells.filter(([r, c]) => !special[r][c] && !taken(r, c));
        const pool = free.length ? free : cells;

        return (
          pool.find(([r, c]) => hintKeys.includes(`${r},${c}`)) ||
          pool[Math.floor(pool.length / 2)]
        );
      };

      // 1) five or more → Jollof bomb
      for (const run of runs) {
        if (run.cells.length >= 5) {
          const [r, c] = pick(run.cells);
          creates.push({ r, c, type: "bomb" });
          used.add(run);
        }
      }

      // 2) L or T shape → wrapped tile
      const hRuns = runs.filter(x => x.dir === "h");
      const vRuns = runs.filter(x => x.dir === "v");

      for (const h of hRuns) {
        if (used.has(h)) continue;

        for (const v of vRuns) {
          if (used.has(v)) continue;

          const shared = h.cells.find(([a, b]) =>
            v.cells.some(([x, y]) => x === a && y === b)
          );

          if (shared && !taken(shared[0], shared[1])) {
            creates.push({ r: shared[0], c: shared[1], type: "wrap" });
            used.add(h);
            used.add(v);
            break;
          }
        }
      }

      // 3) exactly four → striped tile
      for (const run of runs) {
        if (used.has(run) || run.cells.length !== 4) continue;

        const [r, c] = pick(run.cells);
        creates.push({ r, c, type: run.dir === "h" ? "col" : "row" });
      }

      const protect = new Set(creates.map(x => `${x.r},${x.c}`));
      const blasts = expandBlasts(clear, protect);

      protect.forEach(k => clear.delete(k));

      return { clear, creates, blasts, kind: "match" };
    }

    // Plan for a power swap (bomb or special + special).
    function planSwap(r1, c1, r2, c2) {
      const k1 = `${r1},${c1}`;
      const k2 = `${r2},${c2}`;
      const a = board[r1][c1];
      const b = board[r2][c2];
      const clear = new Set([k1, k2]);
      let kind = "combo";

      const addAll = test => {
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            if (board[r][c] !== null && test(board[r][c])) clear.add(`${r},${c}`);
          }
        }
      };

      if (a === BOMB || b === BOMB) {
        kind = "bomb";

        // The swapped bomb is spent: don't let it also fire randomly.
        if (a === BOMB) special[r1][c1] = null;
        if (b === BOMB) special[r2][c2] = null;

        if (a === BOMB && b === BOMB) {
          addAll(() => true); // two bombs = whole board
        } else {
          const food = a === BOMB ? b : a;
          addAll(v => v === food); // bomb + food = every tile of that food
        }
      } else {
        const lines = ["row", "col"];

        // Two striped tiles together = cross blast from both.
        if (lines.includes(special[r1][c1]) && lines.includes(special[r2][c2])) {
          special[r1][c1] = "cross";
          special[r2][c2] = "cross";
        }
      }

      const blasts = expandBlasts(clear, new Set());

      return { clear, creates: [], blasts, kind };
    }

    /* ---------- the juicy part ---------- */

    async function popTiles(cells, pointsEach, big = false, lite = false) {
      const stagger = Math.min(28, 260 / Math.max(cells.length, 1));

      cells.forEach(([r, c], i) => {
        const tile = getTile(r, c);
        if (!tile) return;

        setTimeout(() => {
          Particles.celebrateTile(tile, pointsEach, big, lite);

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
      { min: 16, title: "DIVINE!", sub: "Omo wahala! 🔥", emoji: "👑", shake: 3, sound: "thunder" },
      { min: 11, title: "TOO SWEET!", sub: "You dey burst am!", emoji: "🤩", shake: 3, sound: "blast" },
      { min: 7, title: "SWEET!", sub: "Correct combo!", emoji: "🍬", shake: 2, sound: "banger" },
      { min: 5, title: "TASTY!", sub: "Nice one!", emoji: "😋", shake: 1, sound: null }
    ];

    const CREATE_INFO = {
      bomb: { title: "JOLLOF BOMB!", sub: "Swap am with any food!", emoji: "🍛" },
      wrap: { title: "WRAPPED TILE!", sub: "Match am to blast!", emoji: "💥" },
      row: { title: "STRIPED TILE!", sub: "Match am to clear a line!", emoji: "⚡" },
      col: { title: "STRIPED TILE!", sub: "Match am to clear a line!", emoji: "⚡" }
    };

    function blastVisual(b) {
      const tile = getTile(b.r, b.c);
      if (!tile) return;

      if (b.type === "row" || b.type === "cross") Particles.beam(tile, "row");
      if (b.type === "col" || b.type === "cross") Particles.beam(tile, "col");
      if (b.type === "wrap" || b.type === "bomb") Particles.shockwave(tile);
    }

    async function clearPlan(plan, combo) {
      const cells = [...plan.clear].map(key => key.split(",").map(Number));
      const size = cells.length;
      const pointsEach = 20 * combo;
      const blasts = plan.blasts;

      const usedBomb =
        plan.kind === "bomb" || blasts.some(b => b.type === "bomb");
      const usedWrap = blasts.some(b => b.type === "wrap");
      const usedStripe = blasts.some(
        b => b.type === "row" || b.type === "col" || b.type === "cross"
      );

      // "power" grows with clear size, cascade depth and blasts.
      const power = size + (combo - 1) * 4 + blasts.length * 3;
      const tier = TIERS.find(t => power >= t.min) || null;

      FX.match(combo, Math.min(size, 6));

      let shown = false;

      if (usedBomb) {
        FX.thunder();
        FX.shake(3);
        FX.banner("JOLLOF BOMB!", "Everything don scatter!", "🍛");
        Voice.speak("combo");
        shown = true;
      } else if (usedWrap) {
        FX.blast();
        FX.shake(3);
        FX.banner("BOOM!", "Wrapped blast!", "💥");
        Voice.speak("combo");
        shown = true;
      } else if (usedStripe) {
        FX.banger();
        FX.shake(2);
        FX.banner("STRIPE BLAST!", "Whole line don go!", "⚡");
        Voice.speak("match");
        shown = true;
      } else if (tier) {
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
        shown = true;
      } else if (combo >= 2) {
        FX.banner(`COMBO x${combo}`, "Keep am going!", "✨");
        FX.shake(1);
        Voice.speak("match");
        shown = true;
      }

      // New special tile announcement.
      if (plan.creates.length) {
        FX.sparkle();

        if (!shown) {
          const info = CREATE_INFO[plan.creates[0].type];
          FX.banner(info.title, info.sub, info.emoji);
          Voice.speak("match");
        }
      }

      blasts.forEach(blastVisual);

      // The tiles that are about to transform pulse and shine.
      for (const sp of plan.creates) {
        const tile = getTile(sp.r, sp.c);
        if (!tile) continue;

        Particles.shockwave(tile);

        tile.animate(
          [
            { transform: "scale(1)", filter: "brightness(1)" },
            { transform: "scale(1.45)", filter: "brightness(2)", offset: 0.45 },
            { transform: "scale(1)", filter: "brightness(1)" }
          ],
          { duration: 420, easing: "ease-out" }
        );
      }

      score += size * pointsEach;
      scoreElement.textContent = score;
      bump(scoreElement);
      updateStats();

      messageElement.textContent = plan.creates.length
        ? "New special tile! Use am well! ✨"
        : power >= 7
          ? "Omo! Big combo! 🔥"
          : "Correct! You don match am! ✨";

      const lite = size > 14;

      if (lite) {
        Particles.score(
          boardElement.clientWidth / 2,
          boardElement.clientHeight / 2,
          size * pointsEach
        );
      }

      await popTiles(cells, pointsEach, power >= 7 || blasts.length > 0, lite);

      for (const [r, c] of cells) {
        board[r][c] = null;
        special[r][c] = null;
      }

      // Place the new special tiles (they then fall with the board).
      for (const sp of plan.creates) {
        special[sp.r][sp.c] = sp.type;
        if (sp.type === "bomb") board[sp.r][sp.c] = BOMB;
      }
    }

    function dropTiles() {
      const falls = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

      for (let col = 0; col < SIZE; col++) {
        const stack = [];

        for (let row = SIZE - 1; row >= 0; row--) {
          if (board[row][col] !== null) {
            stack.push({
              food: board[row][col],
              sp: special[row][col],
              from: row
            });
          }
        }

        const empties = SIZE - stack.length;
        let index = 0;

        for (let row = SIZE - 1; row >= 0; row--) {
          if (index < stack.length) {
            const item = stack[index++];
            board[row][col] = item.food;
            special[row][col] = item.sp;
            falls[row][col] = row - item.from;
          } else {
            board[row][col] = randomFood();
            special[row][col] = null;
            falls[row][col] = empties; // new tiles drop in from above
          }
        }
      }

      return falls;
    }

    // Clears matches, drops tiles, repeats until the board is calm.
    // hint:   the two swapped cells (where new specials should appear)
    // forced: a ready-made plan for the first round (power swaps)
    async function runCascade(hint = null, forced = null) {
      let combo = 0;

      while (true) {
        let plan;

        if (forced) {
          plan = forced;
          forced = null;
        } else {
          plan = planMatches(hint);
        }

        hint = null;

        if (!plan) break;

        combo++;

        await clearPlan(plan, combo);

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
    // but still has at least one possible move. Special tiles
    // are shuffled too, so players don't lose them.
    function shuffleCore() {
      const items = [];

      for (let row = 0; row < SIZE; row++) {
        for (let col = 0; col < SIZE; col++) {
          if (board[row][col] !== null) {
            items.push({ food: board[row][col], sp: special[row][col] });
          }
        }
      }

      for (let attempt = 0; attempt < 60; attempt++) {
        for (let i = items.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [items[i], items[j]] = [items[j], items[i]];
        }

        let index = 0;

        for (let row = 0; row < SIZE; row++) {
          for (let col = 0; col < SIZE; col++) {
            board[row][col] = items[index].food;
            special[row][col] = items[index].sp;
            index++;
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

      const present = [
        ...new Set(board.flat().filter(v => v !== null && v !== BOMB))
      ];

      if (present.length === 0) return;

      locked = true;

      try {
        const foodType = present[Math.floor(Math.random() * present.length)];
        const clear = new Set();

        for (let row = 0; row < SIZE; row++) {
          for (let col = 0; col < SIZE; col++) {
            if (board[row][col] === foodType) clear.add(`${row},${col}`);
          }
        }

        // Special tiles caught in the blast go off too.
        const blasts = expandBlasts(clear, new Set());
        const cells = [...clear].map(k => k.split(",").map(Number));

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

        blasts.forEach(blastVisual);

        messageElement.textContent =
          `Pepper don land! ${cells.length} tiles cleared! 🌶️`;

        await popTiles(cells, 10, true, cells.length > 14);

        for (const [r, c] of cells) {
          board[r][c] = null;
          special[r][c] = null;
        }

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
