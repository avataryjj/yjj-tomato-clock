/* ===== 常量 ===== */
const FOCUS_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;
const STORAGE_KEY_TIMER = 'pomodoro_timer';

/* ===== 状态 ===== */
const state = {
  mode: 'idle',
  timeLeft: FOCUS_TIME,
  total: FOCUS_TIME,
  running: false,
  intervalId: null,
  lastTick: 0,
};

/* ===== DOM ===== */
const $ = id => document.getElementById(id);
const timerDisplay = $('timerDisplay');
const timerStatus = $('timerStatus');
const timerRing = document.querySelector('.timer-ring');
const timerSection = document.querySelector('.timer-section');
const btnStart = $('btnStart');
const btnPause = $('btnPause');
const btnReset = $('btnReset');
const taskInput = $('taskInput');
const btnAddTask = $('btnAddTask');
const taskList = $('taskList');
const taskStats = $('taskStats');
const taskSummary = $('taskSummary');
const btnClearCompleted = $('btnClearCompleted');
const dailyCount = $('dailyCount');
const btnInstall = $('btnInstall');
const notifGuide = $('notifGuide');
const btnEnableNotif = $('btnEnableNotif');
/* ===== Format ===== */
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function updateRing(ratio) {
  if (!timerRing) return;
  const deg = Math.round(Math.min(ratio, 1) * 360);
  timerRing.style.background =
    `conic-gradient(#d9534f 0deg ${deg}deg, #e8ddd0 ${deg}deg 360deg)`;
}

function getModeLabel(mode) {
  switch (mode) {
    case 'focus': return '专注中';
    case 'break': return '休息中';
    default:      return '准备就绪';
  }
}

/* ===== UI ===== */
function updateTimerDisplay() {
  if (!timerDisplay || !timerStatus || !timerSection || !btnStart || !btnPause) return;
  timerDisplay.textContent = formatTime(state.timeLeft);
  const ratio = 1 - state.timeLeft / state.total;
  updateRing(ratio);
  timerStatus.textContent = getModeLabel(state.mode);
  timerSection.dataset.state = state.running ? 'running' : (state.mode === 'idle' ? 'idle' : 'paused');
  timerSection.dataset.mode = state.mode;
  btnStart.disabled = state.running;
  btnPause.disabled = !state.running;
}

function setMode(mode) {
  state.mode = mode;
  state.running = false;
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  state.total = mode === 'focus' ? FOCUS_TIME : BREAK_TIME;
  state.timeLeft = state.total;
  updateTimerDisplay();
}

/* ===== Beep ===== */
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (_) {}
}

function sendNotification() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification('🍅 时间到！', {
      body: state.mode === 'focus' ? '专注结束，休息一下吧！' : '休息结束，开始新番茄！',
      icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="48" fill="%23d9534f"/%3E%3Ctext x="50" y="68" font-size="50" text-anchor="middle" fill="white"%3E🍅%3C/text%3E%3C/svg%3E',
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

function handleTimeUp() {
  playBeep();
  sendNotification();
  if (state.mode === 'focus') {
    incrementDailyPomodoro();
    updateDailyCountDisplay();
  }
  const nextMode = state.mode === 'focus' ? 'break' : 'focus';
  setMode(nextMode);
  timerStatus.textContent = '⏰ 时间到！';
}

/* ===== Tick ===== */
function tick() {
  if (!state.running) return;
  const now = Date.now();
  if (state.lastTick > 0) {
    const elapsed = Math.round((now - state.lastTick) / 1000);
    if (elapsed > 1) {
      state.timeLeft = Math.max(0, state.timeLeft - (elapsed - 1));
    }
  }
  state.lastTick = now;
  state.timeLeft--;
  if (state.timeLeft <= 0) {
    state.running = false;
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    updateTimerDisplay();
    handleTimeUp();
    return;
  }
  updateTimerDisplay();
}

/* ===== Controls ===== */
function startTimer() {
  if (state.running) return;
  if (state.mode === 'idle') setMode('focus');
  state.running = true;
  state.lastTick = Date.now();
  state.intervalId = setInterval(tick, 1000);
  updateTimerDisplay();
}

function pauseTimer() {
  if (!state.running) return;
  state.running = false;
  state.lastTick = 0;
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  updateTimerDisplay();
  saveTimerState();
}

function resetTimer() {
  state.running = false;
  state.lastTick = 0;
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  state.total = (state.mode === 'focus' || state.mode === 'idle') ? FOCUS_TIME : BREAK_TIME;
  state.timeLeft = state.total;
  if (state.mode === 'idle') state.mode = 'focus';
  updateTimerDisplay();
}

/* ===== Tasks ===== */
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderTaskList() {
  const tasks = getTasks();
  const total = tasks.length;
  const done = tasks.filter(t => t.completed).length;

  taskStats.textContent = total > 0 ? `已完成 ${done}/${total}` : '';
  taskSummary.textContent = total > 0 ? `已完成 ${done}/${total} 项` : '暂无任务';
  btnClearCompleted.style.display = done > 0 ? '' : 'none';

  if (total === 0) {
    taskList.innerHTML = '<li class="empty-tasks">还没有任务，添加一个吧 ✏️</li>';
    return;
  }

  taskList.innerHTML = tasks.map(t => `
    <li class="task-item" data-id="${t.id}">
      <input type="checkbox" id="task_${t.id}" ${t.completed ? 'checked' : ''}>
      <label class="task-label" for="task_${t.id}">
        <span>${escapeHtml(t.text)}</span>
      </label>
      <button type="button" class="task-delete-btn" data-action="delete" aria-label="删除任务">✕</button>
    </li>
  `).join('');
}

function updateDailyCountDisplay() {
  const record = getDailyPomodoro();
  const today = record.date === todayStr();
  dailyCount.textContent = today ? `今日 \uD83C\uDF45\u00D7${record.count}` : '';
}

/* ===== Storage (timer only) ===== */
function saveTimerState() {
  try {
    localStorage.setItem(STORAGE_KEY_TIMER, JSON.stringify({
      timeLeft: state.timeLeft, total: state.total,
      mode: state.mode, savedAt: Date.now(),
    }));
  } catch (_) {}
}

function loadTimerState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TIMER);
    if (!raw) return;
    const saved = JSON.parse(raw);
    const elapsed = Math.round((Date.now() - saved.savedAt) / 1000);
    state.timeLeft = Math.max(0, saved.timeLeft - elapsed);
    state.total = saved.total;
    state.mode = saved.mode;
    updateTimerDisplay();
    if (state.timeLeft <= 0) timerStatus.textContent = '⏰ 时间到！';
  } catch (_) {}
}

/* ===== Events ===== */
btnStart.addEventListener('click', startTimer);
btnPause.addEventListener('click', pauseTimer);
btnReset.addEventListener('click', resetTimer);

btnAddTask.addEventListener('click', () => {
  const text = taskInput.value.trim();
  if (!text) return;
  addTask(text);
  taskInput.value = '';
  renderTaskList();
  taskInput.focus();
});

taskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnAddTask.click();
});

taskList.addEventListener('click', e => {
  const li = e.target.closest('.task-item');
  if (!li) return;
  const id = li.dataset.id;
  if (!id) return;
  if (e.target.dataset.action === 'delete') {
    deleteTask(id);
    renderTaskList();
    return;
  }
  if (e.target.type === 'checkbox' || e.target.closest('.task-label')) {
    toggleTask(id);
    renderTaskList();
  }
});

btnClearCompleted.addEventListener('click', () => {
  clearCompleted();
  renderTaskList();
});

/* ===== Visibility ===== */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    saveTimerState();
  } else {
    if (!state.running) {
      loadTimerState();
    } else {
      const now = Date.now();
      if (state.lastTick > 0) {
        const elapsed = Math.round((now - state.lastTick) / 1000);
        if (elapsed > 1) {
          state.timeLeft = Math.max(0, state.timeLeft - elapsed);
          state.lastTick = now;
          updateTimerDisplay();
          if (state.timeLeft <= 0) {
            state.running = false;
            if (state.intervalId) {
              clearInterval(state.intervalId);
              state.intervalId = null;
            }
            updateTimerDisplay();
            handleTimeUp();
          }
        }
      }
    }
  }
});

window.addEventListener('beforeunload', saveTimerState);
window.addEventListener('pagehide', saveTimerState);

/* ===== 安装 PWA ===== */
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstall.style.display = '';
});

btnInstall.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const result = await deferredPrompt.userChoice;
  if (result.outcome === 'accepted') {
    btnInstall.style.display = 'none';
  }
  deferredPrompt = null;
});

window.addEventListener('appinstalled', () => {
  btnInstall.style.display = 'none';
  deferredPrompt = null;
});

/* ===== Init ===== */
renderTaskList();
loadTimerState();
updateTimerDisplay();
updateDailyCountDisplay();
updateNotifGuide();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
/* ===== 通知引导 ===== */
function updateNotifGuide() {
  if (!('Notification' in window) || !notifGuide) return;
  if (Notification.permission === 'default') {
    notifGuide.style.display = '';
  } else {
    notifGuide.style.display = 'none';
  }
}

/** 请求通知权限，成功后更新引导按钮 */
async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  const result = await Notification.requestPermission();
  updateNotifGuide();
}

if (btnEnableNotif) {
  btnEnableNotif.addEventListener('click', requestNotificationPermission);
}

