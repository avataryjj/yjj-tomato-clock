/* ===== 存储 key 常量 ===== */
const STORAGE_KEY_TASKS = 'pomodoro-tasks';

/* ===== 工具：生成短 ID ===== */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ===== 获取全部任务 ===== */
function getTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TASKS);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

/* ===== 写入任务列表 ===== */
function saveTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
  } catch (_) {}
}

/* ===== 添加任务 ===== */
function addTask(text) {
  const tasks = getTasks();
  tasks.push({ id: uid(), text: String(text).trim(), completed: false });
  saveTasks(tasks);
  return tasks;
}

/* ===== 切换完成状态 ===== */
function toggleTask(id) {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === id);
  if (task) task.completed = !task.completed;
  saveTasks(tasks);
  return tasks;
}

/* ===== 按 id 删除任务 ===== */
function deleteTask(id) {
  const tasks = getTasks().filter(t => t.id !== id);
  saveTasks(tasks);
  return tasks;
}

/* ===== 清除所有已完成任务 ===== */
function clearCompleted() {
  const tasks = getTasks().filter(t => !t.completed);
  saveTasks(tasks);
  return tasks;
}
/* ===== 每日番茄计数 ===== */
const STORAGE_KEY_DAILY = 'pomodoro-daily';

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDailyPomodoro() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DAILY);
    if (!raw) return { date: todayStr(), count: 0 };
    return JSON.parse(raw);
  } catch (_) {
    return { date: todayStr(), count: 0 };
  }
}

function incrementDailyPomodoro() {
  let record = getDailyPomodoro();
  const today = todayStr();
  if (record.date !== today) {
    record = { date: today, count: 1 };
  } else {
    record.count++;
  }
  try {
    localStorage.setItem(STORAGE_KEY_DAILY, JSON.stringify(record));
  } catch (_) {}
  return record;
}
