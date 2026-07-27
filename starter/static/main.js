// Client-side rendering and interaction for the Flask-backed Sudoku
const SIZE = 9;
const LEADERBOARD_KEY = 'sudoku-leaderboard';
const THEME_KEY = 'sudoku-theme';
let puzzle = [];
let timerInterval = null;
let timerStartedAt = null;
let currentDifficulty = 'medium';
let completedTimeSeconds = 0;

function getStoredTheme() {
  try {
    return window.localStorage.getItem(THEME_KEY);
  } catch (error) {
    return null;
  }
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.dataset.theme = isDark ? 'dark' : 'light';
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(isDark));
    const icon = toggle.querySelector('.theme-toggle__icon');
    const label = toggle.querySelector('.theme-toggle__label');
    if (icon) {
      icon.textContent = isDark ? '☀️' : '🌙';
    }
    if (label) {
      label.textContent = isDark ? 'Light mode' : 'Dark mode';
    }
  }
}

function toggleTheme() {
  const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
  try {
    window.localStorage.setItem(THEME_KEY, nextTheme);
  } catch (error) {
    // Ignore storage failures.
  }
}

function initializeTheme() {
  const storedTheme = getStoredTheme();
  const preferredTheme = storedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(preferredTheme);
}

function createBoardElement() {
  const boardDiv = document.getElementById('sudoku-board');
  boardDiv.innerHTML = '';
  for (let i = 0; i < SIZE; i++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'sudoku-row';
    for (let j = 0; j < SIZE; j++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.className = 'sudoku-cell';
      input.dataset.row = i;
      input.dataset.col = j;
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^1-9]/g, '');
        e.target.value = val;
      });
      rowDiv.appendChild(input);
    }
    boardDiv.appendChild(rowDiv);
  }
}

function formatTime(seconds) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
}

function updateTimerDisplay(seconds) {
  const timerDisplay = document.getElementById('timer-display');
  if (timerDisplay) {
    timerDisplay.innerText = `Time: ${formatTime(seconds)}`;
  }
}

function stopTimer() {
  if (timerInterval) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer() {
  stopTimer();
  timerStartedAt = Date.now();
  updateTimerDisplay(0);
  timerInterval = window.setInterval(() => {
    const elapsedSeconds = (Date.now() - timerStartedAt) / 1000;
    updateTimerDisplay(elapsedSeconds);
  }, 250);
}

function renderPuzzle(puz) {
  puzzle = puz;
  createBoardElement();
  const boardDiv = document.getElementById('sudoku-board');
  const inputs = boardDiv.getElementsByTagName('input');
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      const idx = i * SIZE + j;
      const val = puzzle[i][j];
      const inp = inputs[idx];
      if (val !== 0) {
        inp.value = val;
        inp.disabled = true;
        inp.className += ' prefilled';
      } else {
        inp.value = '';
        inp.disabled = false;
      }
    }
  }
}

function getLeaderboardEntries() {
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function saveLeaderboardEntries(entries) {
  window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
}

function renderLeaderboard() {
  const entries = getLeaderboardEntries();
  const list = document.getElementById('leaderboard-list');
  if (!list) return;
  list.innerHTML = '';
  if (entries.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.textContent = 'No scores yet.';
    list.appendChild(emptyItem);
    return;
  }
  entries.forEach((entry, index) => {
    const item = document.createElement('li');
    item.textContent = `${index + 1}. ${entry.name} — ${formatTime(entry.time)} — ${entry.difficulty}`;
    list.appendChild(item);
  });
}

function addLeaderboardEntry(name, timeSeconds, difficulty) {
  const entries = getLeaderboardEntries();
  const newEntries = entries.concat([{ name, time: timeSeconds, difficulty }])
    .sort((a, b) => a.time - b.time)
    .slice(0, 10);
  saveLeaderboardEntries(newEntries);
  renderLeaderboard();
}

function getSelectedDifficulty() {
  const select = document.getElementById('difficulty-select');
  return select ? select.value : currentDifficulty;
}

async function newGame() {
  const difficulty = getSelectedDifficulty();
  const res = await fetch(`/new?difficulty=${encodeURIComponent(difficulty)}`);
  const data = await res.json();
  renderPuzzle(data.puzzle);
  currentDifficulty = data.difficulty || difficulty;
  completedTimeSeconds = 0;
  startTimer();
  document.getElementById('message').innerText = '';
}

function getBoardState() {
  const boardDiv = document.getElementById('sudoku-board');
  const inputs = boardDiv.getElementsByTagName('input');
  const board = [];
  for (let i = 0; i < SIZE; i++) {
    board[i] = [];
    for (let j = 0; j < SIZE; j++) {
      const idx = i * SIZE + j;
      const val = inputs[idx].value;
      board[i][j] = val ? parseInt(val, 10) : 0;
    }
  }
  return board;
}

async function checkSolution() {
  const board = getBoardState();
  const res = await fetch('/check', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({board})
  });
  const data = await res.json();
  const msg = document.getElementById('message');
  if (data.error) {
    msg.style.color = '#d32f2f';
    msg.innerText = data.error;
    return;
  }
  const incorrect = new Set(data.incorrect.map(x => x[0]*SIZE + x[1]));
  for (let idx = 0; idx < inputs.length; idx++) {
    const inp = inputs[idx];
    if (inp.disabled) continue;
    inp.className = 'sudoku-cell';
    if (incorrect.has(idx)) {
      inp.className = 'sudoku-cell incorrect';
    }
  }
  if (incorrect.size === 0) {
    stopTimer();
    const elapsedSeconds = data.elapsed_seconds ?? ((Date.now() - timerStartedAt) / 1000);
    completedTimeSeconds = elapsedSeconds;
    updateTimerDisplay(elapsedSeconds);
    msg.style.color = '#388e3c';
    msg.innerText = 'Congratulations! You solved it!';
  } else {
    msg.style.color = '#d32f2f';
    msg.innerText = 'Some cells are incorrect.';
  }
}

async function requestHint() {
  const board = getBoardState();
  const res = await fetch('/hint', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({board})
  });
  const data = await res.json();
  const msg = document.getElementById('message');
  if (data.error) {
    msg.style.color = '#d32f2f';
    msg.innerText = data.error;
    return;
  }
  const boardDiv = document.getElementById('sudoku-board');
  const inputs = boardDiv.getElementsByTagName('input');
  const index = data.row * SIZE + data.col;
  const input = inputs[index];
  if (input) {
    input.value = data.value;
    input.className = 'sudoku-cell hinted';
    input.disabled = false;
  }
  msg.style.color = '#388e3c';
  msg.innerText = `Hint placed in row ${data.row + 1}, column ${data.col + 1}.`;
}

// Wire buttons
window.addEventListener('load', () => {
  initializeTheme();
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  document.getElementById('new-game').addEventListener('click', newGame);
  document.getElementById('hint-cell').addEventListener('click', requestHint);
  document.getElementById('check-solution').addEventListener('click', checkSolution);
  // initialize
  newGame();
});