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

  const boardElement = $("board");
  const scoreElement = $("score");
  const bestElement = $("bestScore");
  const movesElement = $("moves");
  const targetElement = $("target");
  const progressElement = $("progress");
  const levelTag = $("levelTag");
  const messageElement = $("message");
  const overlay = $("overlay");

  let board = [];
  let selected = null;
  let score = 0;
  let moves = 25;
  let level = 1;
  let target = 500;

  let locked = false;
  let gameOver = false;
  let soundOn = true;
  let audioContext = null;

  let bestScore = Number(
    localStorage.getItem("naijaCrushBest") || 0
  );

  bestElement.textContent = bestScore;

  // RANDOM FOOD

  function randomFood() {
    return Math.floor(Math.random() * foods.length);
  }

  // CREATE A BOARD WITHOUT STARTING MATCHES

  function createBoard() {
    board = [];

    for (let row = 0; row < SIZE; row++) {
      board[row] = [];

      for (let col = 0; col < SIZE; col++) {
        let food;

        do {
          food = randomFood();
        } while (
          (
            col >= 2 &&
            board[row][col - 1] === food &&
            board[row][col - 2] === food
          ) ||
          (
            row >= 2 &&
            board[row - 1][col] === food &&
            board[row - 2][col] === food
          )
        );

        board[row][col] = food;
      }
    }

    renderBoard();
  }

  // DRAW THE GAME BOARD
  // FIX: Remove old tiles without deleting particle effects.

  function renderBoard() {
    boardElement
      .querySelectorAll(".tile")
      .forEach(tile => tile.remove());

    const fragment = document.createDocumentFragment();

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

          button.setAttribute(
            "aria-label",
            foods[food].name
          );
        }

        if (
          selected &&
          selected.row === row &&
          selected.col === col
        ) {
          button.classList.add("selected");
        }

        button.addEventListener("click", () => {
          handleTile(row, col);
        });

        fragment.appendChild(button);
      }
    }

    boardElement.appendChild(fragment);
  }

  // SIMPLE SOUND EFFECTS

  function playSound(frequency = 520) {
    if (!soundOn) return;

    try {
      const Audio =
        window.AudioContext || window.webkitAudioContext;

      if (!Audio) return;

      audioContext = audioContext || new Audio();

      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(
        0.045,
        audioContext.currentTime
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.12
      );

      oscillator.start();

      oscillator.stop(
        audioContext.currentTime + 0.12
      );
    } catch (error) {
      // The game can still run without audio.
    }
  }

  // SELECT AND SWAP TILES

  function handleTile(row, col) {
    if (locked || gameOver) return;
    if (board[row][col] === null) return;

    if (!selected) {
      selected = { row, col };
      renderBoard();
      return;
    }

    if (
      selected.row === row &&
      selected.col === col
    ) {
      selected = null;
      renderBoard();
      return;
    }

    const distance =
      Math.abs(selected.row - row) +
      Math.abs(selected.col - col);

    if (distance !== 1) {
      selected = { row, col };
      renderBoard();
      return;
    }

    const first = selected;

    selected = null;

    swapTiles(
      first.row,
      first.col,
      row,
      col
    );
  }

  function swapTiles(r1, c1, r2, c2) {
    if (locked || gameOver) return;

    locked = true;

    const temp = board[r1][c1];

    board[r1][c1] = board[r2][c2];
    board[r2][c2] = temp;

    renderBoard();

    const matches = findMatches();

    if (matches.size === 0) {
      setTimeout(() => {
        const tempBack = board[r1][c1];

        board[r1][c1] = board[r2][c2];
        board[r2][c2] = tempBack;

        renderBoard();

        locked = false;

        messageElement.textContent =
          "No match! Try another move, abeg.";

        playSound(180);
      }, 180);

      return;
    }

    moves--;

    updateStats();
    playSound(620);

    resolveMatches();
  }

  // FIND HORIZONTAL AND VERTICAL MATCHES

  function findMatches() {
    const matched = new Set();

    // HORIZONTAL MATCHES

    for (let row = 0; row < SIZE; row++) {
      let count = 1;

      for (let col = 1; col <= SIZE; col++) {
        const current =
          col < SIZE ? board[row][col] : -1;

        const previous = board[row][col - 1];

        if (
          current !== null &&
          current === previous
        ) {
          count++;
        } else {
          if (
            previous !== null &&
            previous !== undefined &&
            count >= 3
          ) {
            for (
              let k = col - count;
              k < col;
              k++
            ) {
              matched.add(`${row},${k}`);
            }
          }

          count = 1;
        }
      }
    }

    // VERTICAL MATCHES

    for (let col = 0; col < SIZE; col++) {
      let count = 1;

      for (let row = 1; row <= SIZE; row++) {
        const current =
          row < SIZE ? board[row][col] : -1;

        const previous = board[row - 1][col];

        if (
          current !== null &&
          current === previous
        ) {
          count++;
        } else {
          if (
            previous !== null &&
            previous !== undefined &&
            count >= 3
          ) {
            for (
              let k = row - count;
              k < row;
              k++
            ) {
              matched.add(`${k},${col}`);
            }
          }

          count = 1;
        }
      }
    }

    return matched;
  }

  // REMOVE MATCHES AND DROP NEW FOOD

  function resolveMatches() {
    const matches = findMatches();

    if (matches.size === 0) {
      locked = false;

      updateStats();

      if (score >= target) {
        finishLevel(true);
      } else if (moves <= 0) {
        finishLevel(false);
      } else {
        messageElement.textContent =
          "Keep going! You fit do am! 🇳🇬";
      }

      return;
    }

    // SCORE POINTS

    score += matches.size * 20;

    scoreElement.textContent = score;

    messageElement.textContent =
      matches.size >= 5
        ? "Omo! Big combo! 🔥"
        : "Correct! You don match am! ✨";

    // 💥 GOLDEN EXPLOSIONS + FLOATING SCORES

    if (window.NaijaParticles) {
      for (const key of matches) {
        const [row, col] = key
          .split(",")
          .map(Number);

        const tile = boardElement.querySelector(
          `[data-row="${row}"][data-col="${col}"]`
        );

        if (tile) {
          window.NaijaParticles.celebrateTile(
            tile,
            20
          );
        }
      }
    }

    // REMOVE MATCHED TILES

    for (const key of matches) {
      const [row, col] = key
        .split(",")
        .map(Number);

      board[row][col] = null;
    }

    updateStats();
    renderBoard();

    // DROP FOOD AND CHECK FOR MORE MATCHES

    setTimeout(() => {
      dropTiles();

      renderBoard();

      setTimeout(() => {
        resolveMatches();
      }, 160);
    }, 160);
  }

  function dropTiles() {
    for (let col = 0; col < SIZE; col++) {
      const remaining = [];

      for (
        let row = SIZE - 1;
        row >= 0;
        row--
      ) {
        if (board[row][col] !== null) {
          remaining.push(board[row][col]);
        }
      }

      let index = 0;

      for (
        let row = SIZE - 1;
        row >= 0;
        row--
      ) {
        if (index < remaining.length) {
          board[row][col] = remaining[index++];
        } else {
          board[row][col] = randomFood();
        }
      }
    }
  }

  // UPDATE SCORES AND PROGRESS

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

      localStorage.setItem(
        "naijaCrushBest",
        String(bestScore)
      );
    }
  }

  // WIN OR LOSE

  function finishLevel(won) {
    if (gameOver) return;

    gameOver = true;
    locked = true;

    $("modalEmoji").textContent =
      won ? "🏆" : "😅";

    $("modalTitle").textContent =
      won ? "You Don Win!" : "E Don Finish!";

    $("modalText").textContent = won
      ? `Sweet victory! You scored ${score} points. Ready for the next level?`
      : `You scored ${score} points. Try again and show this challenge pepper!`;

    $("modalButton").textContent =
      won ? "Next Level →" : "Try Again ↻";

    overlay.classList.add("show");
  }

  // START OR RESTART A LEVEL

  function startLevel(newLevel = level) {
    level = newLevel;

    score = 0;
    moves = 25;
    target = 500 + (level - 1) * 250;

    selected = null;
    locked = false;
    gameOver = false;

    overlay.classList.remove("show");

    messageElement.textContent =
      "Tap one food, then tap a neighbour!";

    updateStats();
    createBoard();
  }

  // SHUFFLE BOOSTER

  function shuffleBoard() {
    if (locked || gameOver) return;

    const values = board
      .flat()
      .filter(value => value !== null);

    for (
      let i = values.length - 1;
      i > 0;
      i--
    ) {
      const j = Math.floor(
        Math.random() * (i + 1)
      );

      [values[i], values[j]] =
        [values[j], values[i]];
    }

    let index = 0;

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        board[row][col] = values[index++];
      }
    }

    selected = null;

    renderBoard();

    messageElement.textContent =
      "Board don shuffle! Find your next match.";
  }

  // PEPPER BLAST BOOSTER

  function pepperBlast() {
    if (locked || gameOver) return;

    const foodType = randomFood();
    let removed = 0;

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (board[row][col] === foodType) {
          board[row][col] = null;
          removed++;
        }
      }
    }

    if (removed === 0) {
      messageElement.textContent =
        "Pepper miss! Try again.";

      return;
    }

    score += removed * 10;
    moves--;

    locked = true;

    updateStats();

    messageElement.textContent =
      `Pepper don land! ${removed} tiles cleared! 🌶️`;

    renderBoard();

    setTimeout(() => {
      dropTiles();

      renderBoard();

      // Resolve any new matches created by falling food.
      resolveMatches();
    }, 250);
  }

  // FIND A POSSIBLE MATCH

  function findHint() {
    if (locked || gameOver) return;

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const neighbours = [
          [row, col + 1],
          [row + 1, col]
        ];

        for (const [r, c] of neighbours) {
          if (r >= SIZE || c >= SIZE) continue;

          const temp = board[row][col];

          board[row][col] = board[r][c];
          board[r][c] = temp;

          const matches = findMatches();

          // Restore the board after testing.

          board[r][c] = board[row][col];
          board[row][col] = temp;

          if (matches.size > 0) {
            selected = { row, col };

            renderBoard();

            messageElement.textContent =
              "Try this tile! Match three or more.";

            return;
          }
        }
      }
    }

    messageElement.textContent =
      "No easy match found. Shuffle the board!";
  }

  // BUTTON EVENTS

  $("restartButton").addEventListener(
    "click",
    () => {
      startLevel(level);
    }
  );

  $("nextButton").addEventListener(
    "click",
    () => {
      if (gameOver) return;

      messageElement.textContent =
        "Complete your mission to unlock the next level!";

      if (score >= target) {
        finishLevel(true);
      }
    }
  );

  $("modalButton").addEventListener(
    "click",
    () => {
      const won = score >= target;

      if (won) {
        startLevel(level + 1);
      } else {
        startLevel(level);
      }
    }
  );

  $("pepperBooster").addEventListener(
    "click",
    pepperBlast
  );

  $("shuffleBooster").addEventListener(
    "click",
    shuffleBoard
  );

  $("hintBooster").addEventListener(
    "click",
    findHint
  );

  $("soundButton").addEventListener(
    "click",
    event => {
      soundOn = !soundOn;

      event.currentTarget.textContent =
        soundOn ? "🔊" : "🔇";

      if (soundOn) {
        playSound();
      }
    }
  );

  // LAUNCH THE GAME

  startLevel(1);

})();


// 🇳🇬 NAIJA CRUSH — SOUND ENGINE 💥

window.NaijaFX = (() => {
  let audio;
  let enabled = true;

  function initAudio() {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) return null;

    if (!audio) audio = new AudioContext();

    if (audio.state === "suspended") {
      audio.resume();
    }

    return audio;
  }

  function tone(freq, duration, type, volume, endFreq) {
    if (!enabled) return;

    const ctx = initAudio();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type || "sine";

    osc.frequency.setValueAtTime(
      freq,
      ctx.currentTime
    );

    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(30, endFreq),
        ctx.currentTime + duration
      );
    }

    gain.gain.setValueAtTime(
      volume || 0.1,
      ctx.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + duration
    );

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function noise(duration, volume, frequency) {
    if (!enabled) return;

    const ctx = initAudio();
    if (!ctx) return;

    const length = Math.floor(
      ctx.sampleRate * duration
    );

    const buffer = ctx.createBuffer(
      1,
      length,
      ctx.sampleRate
    );

    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = "lowpass";
    filter.frequency.value = frequency || 700;

    gain.gain.setValueAtTime(
      volume || 0.1,
      ctx.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + duration
    );

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start();
    source.stop(ctx.currentTime + duration);
  }

  // 🍉 Normal match

  function pop() {
    tone(600, 0.09, "sine", 0.09, 350);
    tone(900, 0.07, "triangle", 0.05, 600);
  }

  // 🔥 Heavy match

  function banger() {
    noise(0.22, 0.18, 1400);
    tone(150, 0.35, "sawtooth", 0.12, 45);
    tone(500, 0.15, "square", 0.04, 180);
  }

  // ⚡ THUNDER STRIKE

  function thunder() {
    noise(0.8, 0.25, 400);
    tone(85, 0.85, "sawtooth", 0.17, 32);

    setTimeout(() => {
      noise(0.45, 0.12, 250);
    }, 180);

    lightning();
    shake(true);
  }

  // ⚡ Screen lightning

  function lightning() {
    const flash = document.getElementById("lightning");

    if (!flash) return;

    flash.classList.remove("strike");

    void flash.offsetWidth;

    flash.classList.add("strike");

    setTimeout(() => {
      flash.classList.remove("strike");
    }, 750);
  }

  // 💥 Screen shake

  function shake(heavy) {
    const game = document.getElementById("gameShell");

    if (!game) return;

    game.classList.remove("shake", "shake-heavy");

    void game.offsetWidth;

    game.classList.add(
      heavy ? "shake-heavy" : "shake"
    );

    setTimeout(() => {
      game.classList.remove("shake", "shake-heavy");
    }, 650);
  }

  // 🗣️ Naija reactions

  function voice(message) {
    if (
      !enabled ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const speech =
      new SpeechSynthesisUtterance(message);

    speech.rate = 1.08;
    speech.pitch = 1.15;
    speech.volume = 1;

    window.speechSynthesis.speak(speech);
  }

  // 💥 Combo announcement

  function combo(message, subtitle, emoji) {
    const banner = document.getElementById("comboBanner");
    const title = document.getElementById("comboTitle");
    const sub = document.getElementById("comboSubtitle");
    const icon = document.getElementById("comboEmoji");

    if (!banner || !title || !sub || !icon) return;

    title.textContent = message;
    sub.textContent = subtitle;
    icon.textContent = emoji || "💥";

    banner.classList.remove("show");

    void banner.offsetWidth;

    banner.classList.add("show");
  }

  function toggle() {
    enabled = !enabled;

    if (
      !enabled &&
      "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel();
    }

    return enabled;
  }

  return {
    pop,
    banger,
    thunder,
    voice,
    combo,
    shake,
    toggle
  };
})();


// 🇳🇬 NAIJA CRUSH — GOLDEN PARTICLE EFFECTS
// FIX: Use a separate overlay layer so particles never
// become grid items or disappear during board redraws.

window.NaijaParticles = (() => {
  const boardElement = document.getElementById("board");

  if (!boardElement) return {};

  const colors = [
    "#FFD700",
    "#FF8C00",
    "#FF3D67",
    "#FFFFFF",
    "#00E5FF",
    "#7CFF6B"
  ];

  // Create one permanent particle overlay.

  if (getComputedStyle(boardElement).position === "static") {
    boardElement.style.position = "relative";
  }

  let particleLayer = boardElement.querySelector(
    ".naija-particle-layer"
  );

  if (!particleLayer) {
    particleLayer = document.createElement("div");

    particleLayer.className = "naija-particle-layer";

    particleLayer.style.position = "absolute";
    particleLayer.style.inset = "0";
    particleLayer.style.width = "100%";
    particleLayer.style.height = "100%";
    particleLayer.style.pointerEvents = "none";
    particleLayer.style.zIndex = "50";
    particleLayer.style.overflow = "hidden";

    boardElement.appendChild(particleLayer);
  }

  function burst(x, y, amount = 12) {
    for (let i = 0; i < amount; i++) {
      const particle = document.createElement("span");

      const angle = Math.random() * Math.PI * 2;
      const distance = 25 + Math.random() * 65;

      particle.className = "naija-particle";

      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;

      particle.style.background =
        colors[Math.floor(Math.random() * colors.length)];

      particle.style.setProperty(
        "--dx",
        `${Math.cos(angle) * distance}px`
      );

      particle.style.setProperty(
        "--dy",
        `${Math.sin(angle) * distance}px`
      );

      particleLayer.appendChild(particle);

      setTimeout(() => {
        particle.remove();
      }, 750);
    }
  }

  function score(x, y, points = 100) {
    const label = document.createElement("span");

    label.className = "naija-floating-score";
    label.textContent = `+${points}`;

    label.style.left = `${x}px`;
    label.style.top = `${y}px`;

    particleLayer.appendChild(label);

    setTimeout(() => {
      label.remove();
    }, 1000);
  }

  function celebrateTile(tile, points = 100) {
    if (!tile) return;

    const boardRect = boardElement.getBoundingClientRect();
    const tileRect = tile.getBoundingClientRect();

    const x =
      tileRect.left -
      boardRect.left +
      tileRect.width / 2;

    const y =
      tileRect.top -
      boardRect.top +
      tileRect.height / 2;

    burst(x, y, 14);
    score(x, y, points);

    tile.classList.remove("naija-tile-pop");

    void tile.offsetWidth;

    tile.classList.add("naija-tile-pop");

    setTimeout(() => {
      tile.classList.remove("naija-tile-pop");
    }, 400);
  }

  return {
    burst,
    score,
    celebrateTile
  };
})();