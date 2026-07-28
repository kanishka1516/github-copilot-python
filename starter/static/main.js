// Client-side rendering and interaction for the Flask-backed Sudoku
const SIZE = 9;
const LEADERBOARD_KEY = 'sudoku-leaderboard';
const THEME_KEY = 'sudoku-theme';
let puzzle = [];
let timerInterval = null;
let timerStartedAt = null;
let currentDifficulty = 'medium';
let completedTimeSeconds = 0;
let leaderboardEntrySaved = false;
let activeGameRequestId = 0;
let activeGameController = null;
let lastIncorrectIndices = new Set();

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

function getCellClassName(row, col, extraClass = '') {
  const classes = ['sudoku-cell'];
  if ((Math.floor(row / 3) + Math.floor(col / 3)) % 2 === 1) {
    classes.push('group-alt');
  }
  if (extraClass) {
    classes.push(extraClass);
  }
  return classes.join(' ');
}

function isMoveValid(board, row, col, value) {
  if (value === '' || value === null) {
    return true;
  }

  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 9) {
    return true;
  }

  for (let index = 0; index < SIZE; index += 1) {
    if (index !== col && board[row][index] === num) {
      return false;
    }
    if (index !== row && board[index][col] === num) {
      return false;
    }
  }

  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let boxRow = startRow; boxRow < startRow + 3; boxRow += 1) {
    for (let boxCol = startCol; boxCol < startCol + 3; boxCol += 1) {
      if ((boxRow !== row || boxCol !== col) && board[boxRow][boxCol] === num) {
        return false;
      }
    }
  }

  return true;
}

function updateCellValidation(input) {
  const row = Number(input.dataset.row);
  const col = Number(input.dataset.col);
  const board = getBoardState();
  const isValid = isMoveValid(board, row, col, input.value);
  const baseClass = getCellClassName(row, col);
  const index = row * SIZE + col;

  if (input.disabled) {
    return;
  }

  if (lastIncorrectIndices.has(index)) {
    lastIncorrectIndices.delete(index);
  }

  if (input.value === '' || input.value === null) {
    input.className = baseClass;
    return;
  }

  if (isValid) {
    input.className = baseClass;
    return;
  }

  input.className = getCellClassName(row, col, 'invalid');
}

function createBoardElement() {
  const boardDiv = document.getElementById('sudoku-board');
  if (!boardDiv) {
    return;
  }

  boardDiv.replaceChildren();
  for (let i = 0; i < SIZE; i++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'sudoku-row';
    for (let j = 0; j < SIZE; j++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.className = getCellClassName(i, j);
      input.dataset.row = i;
      input.dataset.col = j;
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^1-9]/g, '');
        e.target.value = val;
        updateCellValidation(e.target);
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
  if (!timerDisplay) {
    return;
  }

  const valueElement = timerDisplay.querySelector('.timer-display__value');
  const formattedTime = formatTime(seconds);

  if (valueElement) {
    valueElement.textContent = formattedTime;
  } else {
    timerDisplay.textContent = formattedTime;
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
    if (!timerStartedAt) {
      return;
    }
    const elapsedSeconds = (Date.now() - timerStartedAt) / 1000;
    updateTimerDisplay(elapsedSeconds);
  }, 250);
}

function renderPuzzle(puz) {
  puzzle = puz;
  lastIncorrectIndices.clear();
  createBoardElement();
  const boardDiv = document.getElementById('sudoku-board');
  if (!boardDiv) {
    return;
  }

  const inputs = boardDiv.querySelectorAll('input');
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      const idx = i * SIZE + j;
      const val = puzzle[i][j];
      const inp = inputs[idx];
      if (val !== 0) {
        inp.value = val;
        inp.disabled = true;
        inp.className = getCellClassName(i, j, 'prefilled');
      } else {
        inp.value = '';
        inp.disabled = false;
        inp.className = getCellClassName(i, j);
      }
    }
  }
}

function getLeaderboardEntries() {
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveLeaderboardEntries(entries) {
  try {
    window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
  } catch (error) {
    // Ignore storage failures.
  }
}

function renderLeaderboard() {
  const entries = getLeaderboardEntries()
    .slice()
    .sort((a, b) => Number(a.time) - Number(b.time))
    .slice(0, 10);
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
    const safeName = String(entry.name || 'Anonymous').trim() || 'Anonymous';
    const safeDifficulty = String(entry.difficulty || 'medium').toLowerCase();
    const item = document.createElement('li');
    item.textContent = `${index + 1}. ${safeName} — ${formatTime(Number(entry.time || 0))} — ${safeDifficulty}`;
    list.appendChild(item);
  });
}

function addLeaderboardEntry(name, timeSeconds, difficulty) {
  const entries = getLeaderboardEntries();
  const normalizedName = String(name || 'Anonymous').trim() || 'Anonymous';
  const nextEntry = {
    name: normalizedName,
    time: Number(timeSeconds),
    difficulty: String(difficulty || 'medium').toLowerCase(),
  };
  const nextEntries = entries.concat([nextEntry])
    .sort((a, b) => Number(a.time) - Number(b.time))
    .slice(0, 10);
  saveLeaderboardEntries(nextEntries);
  renderLeaderboard();
}

function saveCompletedScoreToLeaderboard() {
  if (leaderboardEntrySaved || completedTimeSeconds <= 0) {
    return;
  }

  const playerNameInput = document.getElementById('player-name');
  const name = playerNameInput ? playerNameInput.value : '';
  addLeaderboardEntry(name, completedTimeSeconds, currentDifficulty);
  leaderboardEntrySaved = true;
}

function getSelectedDifficulty() {
  const select = document.getElementById('difficulty-select');
  return select ? select.value : currentDifficulty;
}

async function newGame() {
  if (activeGameController) {
    activeGameController.abort();
  }

  const difficulty = getSelectedDifficulty();
  const requestId = activeGameRequestId + 1;
  activeGameRequestId = requestId;

  const controller = new AbortController();
  activeGameController = controller;

  try {
    const res = await fetch(`/new?difficulty=${encodeURIComponent(difficulty)}`, { signal: controller.signal });
    const data = await res.json();

    if (requestId !== activeGameRequestId || controller.signal.aborted) {
      return;
    }

    renderPuzzle(data.puzzle);
    currentDifficulty = data.difficulty || difficulty;
    completedTimeSeconds = 0;
    leaderboardEntrySaved = false;
    startTimer();
    document.getElementById('message').innerText = '';
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }

    if (requestId === activeGameRequestId) {
      const msg = document.getElementById('message');
      if (msg) {
        msg.style.color = '#d32f2f';
        msg.innerText = 'Unable to load a new game.';
      }
    }
  } finally {
    if (activeGameController === controller) {
      activeGameController = null;
    }
  }
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

function applyCheckResults(incorrectIndices) {
  const incorrectSet = incorrectIndices instanceof Set ? incorrectIndices : new Set(incorrectIndices || []);
  lastIncorrectIndices = incorrectSet;

  const boardDiv = document.getElementById('sudoku-board');
  if (!boardDiv) {
    return;
  }

  const inputs = boardDiv.getElementsByTagName('input');
  const board = getBoardState();
  for (let idx = 0; idx < inputs.length; idx += 1) {
    const inp = inputs[idx];
    if (inp.disabled) {
      continue;
    }

    const row = Math.floor(idx / SIZE);
    const col = idx % SIZE;
    const value = inp.value;

    if (value === '') {
      inp.className = getCellClassName(row, col);
      continue;
    }

    if (incorrectSet.has(idx)) {
      inp.className = getCellClassName(row, col, 'incorrect');
    } else if (!isMoveValid(board, row, col, value)) {
      inp.className = getCellClassName(row, col, 'invalid');
    } else {
      inp.className = getCellClassName(row, col);
    }
  }
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

  const incorrect = new Set((data.incorrect || []).map(x => x[0] * SIZE + x[1]));
  applyCheckResults(incorrect);

  if (data.completed) {
    stopTimer();
    const elapsedSeconds = data.elapsed_seconds ?? ((Date.now() - timerStartedAt) / 1000);
    completedTimeSeconds = elapsedSeconds;
    updateTimerDisplay(elapsedSeconds);
    saveCompletedScoreToLeaderboard();
    msg.style.color = '#388e3c';
    msg.innerText = data.message || 'Congratulations! You solved it!';
  } else if (incorrect.size === 0) {
    msg.style.color = '#388e3c';
    msg.innerText = data.message || 'No incorrect entries found.';
  } else {
    msg.style.color = '#d32f2f';
    msg.innerText = data.message || 'Some cells are incorrect.';
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
    input.className = getCellClassName(data.row, data.col, 'hinted');
    input.disabled = false;
  }

  msg.style.color = '#388e3c';
  msg.innerText = `Hint placed in row ${data.row + 1}, column ${data.col + 1}.`;
}

// Wire buttons
window.addEventListener('load', () => {
  initializeTheme();
  renderLeaderboard();
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  const difficultySelect = document.getElementById('difficulty-select');
  if (difficultySelect) {
    difficultySelect.addEventListener('change', () => {
      newGame();
    });
  }
  document.getElementById('new-game').addEventListener('click', newGame);
  document.getElementById('hint-cell').addEventListener('click', requestHint);
  document.getElementById('check-solution').addEventListener('click', checkSolution);
  // initialize
  newGame();
});