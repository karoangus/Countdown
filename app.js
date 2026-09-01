/**
 * CountDown App — Main Logic
 * Fully offline, no external dependencies
 */

// ─── State ───────────────────────────────────────────────
// Keep localStorage failures from preventing the app from loading (for example,
// after a manually edited or partially written value).
function loadTimers() {
  try {
    const value = JSON.parse(localStorage.getItem('cd_timers') || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

let timers = loadTimers();
let editingId = null;
let selectedColor = '#7c3aed';
let pickerState = {}; // {year, month} currently viewing in calendar
let tickInterval = null;

// ─── Helpers ─────────────────────────────────────────────
function toFaNum(n) {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}
function pad(n) { return String(n).padStart(2,'0'); }

// Timer titles and emoji are user input. Escape them before inserting cards as
// HTML so a saved value can never turn into executable markup.
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

const TIMER_COLORS = new Set(['#7c3aed', '#2563eb', '#059669', '#dc2626', '#d97706', '#db2777', '#0891b2', '#65a30d']);
function safeColor(color) { return TIMER_COLORS.has(color) ? color : '#7c3aed'; }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function saveTimers() { localStorage.setItem('cd_timers', JSON.stringify(timers)); }

// ─── Diff calculator ─────────────────────────────────────
function calcDiff(targetMs) {
  const diff = targetMs - Date.now();
  if (diff <= 0) return null;
  const s = Math.floor(diff / 1000);
  return {
    days:    Math.floor(s / 86400),
    hours:   Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60
  };
}

// ─── Render timers grid ───────────────────────────────────
function renderTimers() {
  const grid = document.getElementById('timersGrid');
  const empty = document.getElementById('emptyState');

  if (timers.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = timers.map(t => timerCard(t)).join('');
}

function timerCard(t) {
  const diff = calcDiff(t.targetMs);
  const expired = !diff;
  const jd = PersianCal.toJalali(
    new Date(t.targetMs).getFullYear(),
    new Date(t.targetMs).getMonth()+1,
    new Date(t.targetMs).getDate()
  );
  const dateStr = `${toFaNum(jd.y)}/${toFaNum(pad(jd.m))}/${toFaNum(pad(jd.d))}`;
  const timeStr = `${toFaNum(pad(new Date(t.targetMs).getHours()))}:${toFaNum(pad(new Date(t.targetMs).getMinutes()))}`;

  const color = safeColor(t.color);
  return `
  <div class="timer-card ${expired?'expired':''}" id="card-${escapeHTML(t.id)}" style="--accent:${color}">
    <div class="card-top">
      <span class="card-emoji" role="img" aria-label="آیکون تایمر">${escapeHTML(t.emoji || '⏳')}</span>
      <div class="card-actions">
        <button class="card-btn" onclick="openEdit('${t.id}')" title="ویرایش">✏️</button>
        <button class="card-btn" onclick="deleteTimer('${t.id}')" title="حذف">🗑️</button>
      </div>
    </div>
    <h3 class="card-title">${escapeHTML(t.title)}</h3>
    <div class="card-date">${dateStr} — ${timeStr}</div>
    ${expired
      ? `<div class="card-expired">🎉 وقتش رسید!</div>`
      : `<div class="card-units" id="units-${t.id}">
          ${unitBlock(diff.days,'روز')}
          ${unitBlock(diff.hours,'ساعت')}
          ${unitBlock(diff.minutes,'دقیقه')}
          ${unitBlock(diff.seconds,'ثانیه')}
        </div>`
    }
  </div>`;
}

function unitBlock(val, label) {
  return `<div class="unit">
    <span class="unit-num">${toFaNum(pad(val))}</span>
    <span class="unit-label">${label}</span>
  </div>`;
}

// ─── Tick (update seconds) ────────────────────────────────
function tick() {
  timers.forEach(t => {
    const el = document.getElementById(`units-${t.id}`);
    if (!el) return;
    const diff = calcDiff(t.targetMs);
    if (!diff) {
      // expired — re-render this card
      const card = document.getElementById(`card-${t.id}`);
      if (card) card.outerHTML = timerCard(t);
      return;
    }
    el.innerHTML =
      unitBlock(diff.days,'روز') +
      unitBlock(diff.hours,'ساعت') +
      unitBlock(diff.minutes,'دقیقه') +
      unitBlock(diff.seconds,'ثانیه');
  });
}

// ─── Modal helpers ────────────────────────────────────────
function openModal(reset=true) {
  if (reset) {
    editingId = null;
    document.getElementById('modalTitle').textContent = 'تایمر جدید';
    document.getElementById('inputTitle').value = '';
    document.getElementById('inputEmoji').value = '';
    document.getElementById('inputHour').value = '0';
    document.getElementById('inputMinute').value = '0';
    selectedColor = '#7c3aed';
    updateSwatchSelection();
    const t = PersianCal.today();
    pickerState = { year: t.y, month: t.m, day: t.d };
  }
  renderPicker();
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingId = null;
}

function openEdit(id) {
  const t = timers.find(x => x.id === id);
  if (!t) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = 'ویرایش تایمر';
  document.getElementById('inputTitle').value = t.title;
  document.getElementById('inputEmoji').value = t.emoji || '';
  const d = new Date(t.targetMs);
  document.getElementById('inputHour').value = d.getHours();
  document.getElementById('inputMinute').value = d.getMinutes();
  selectedColor = t.color;
  updateSwatchSelection();
  const jd = PersianCal.toJalali(d.getFullYear(), d.getMonth()+1, d.getDate());
  pickerState = { year: jd.y, month: jd.m, day: jd.d };
  renderPicker();
  openModal(false);
}

function deleteTimer(id) {
  if (!confirm('این تایمر حذف بشه؟')) return;
  timers = timers.filter(t => t.id !== id);
  saveTimers();
  renderTimers();
}

// ─── Save timer ───────────────────────────────────────────
function saveTimer() {
  const title = document.getElementById('inputTitle').value.trim();
  if (!title) { alert('عنوان رو وارد کن!'); return; }
  if (!pickerState.day) { alert('تاریخ رو انتخاب کن!'); return; }

  const h = parseInt(document.getElementById('inputHour').value) || 0;
  const min = parseInt(document.getElementById('inputMinute').value) || 0;
  const targetDate = PersianCal.toDate(pickerState.year, pickerState.month, pickerState.day, h, min);

  if (editingId) {
    const idx = timers.findIndex(t => t.id === editingId);
    timers[idx] = { ...timers[idx], title, emoji: document.getElementById('inputEmoji').value || '⏳', color: selectedColor, targetMs: targetDate.getTime() };
  } else {
    timers.push({
      id: genId(),
      title,
      emoji: document.getElementById('inputEmoji').value || '⏳',
      color: selectedColor,
      targetMs: targetDate.getTime()
    });
  }
  saveTimers();
  closeModal();
  renderTimers();
}

// ─── Color swatches ───────────────────────────────────────
function updateSwatchSelection() {
  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === selectedColor);
  });
}

document.getElementById('colorSwatches').addEventListener('click', e => {
  const sw = e.target.closest('.swatch');
  if (!sw) return;
  selectedColor = sw.dataset.color;
  updateSwatchSelection();
});

// ─── Persian Date Picker ──────────────────────────────────
function renderPicker() {
  const container = document.getElementById('persianDatePicker');
  const { year, month } = pickerState;
  const today = PersianCal.today();
  const daysInM = PersianCal.daysInMonth(year, month);

  // Find weekday of 1st day (0=Sat in Jalali week)
  const firstG = PersianCal.toGregorian(year, month, 1);
  const firstDate = new Date(firstG.y, firstG.m-1, firstG.d);
  // JS getDay(): 0=Sun,1=Mon,...,6=Sat
  // Jalali week starts Saturday → offset: Sat=0,Sun=1,Mon=2,Tue=3,Wed=4,Thu=5,Fri=6
  const jsDay = firstDate.getDay();
  const jalaliOffset = [1,2,3,4,5,6,0][jsDay]; // Sat=0

  let html = `
  <div class="picker-nav">
    <button class="picker-arrow" id="pickerPrev">‹</button>
    <span class="picker-month-label">${PersianCal.MONTH_NAMES[month-1]} ${toFaNum(year)}</span>
    <button class="picker-arrow" id="pickerNext">›</button>
  </div>
  <div class="picker-grid">
    ${PersianCal.DAY_NAMES.map(d=>`<div class="picker-day-name">${d}</div>`).join('')}
    ${Array(jalaliOffset).fill('<div class="picker-cell empty"></div>').join('')}`;

  for (let d=1; d<=daysInM; d++) {
    const isSelected = pickerState.day === d && pickerState.month === month && pickerState.year === year;
    const isToday = today.d===d && today.m===month && today.y===year;
    html += `<div class="picker-cell${isSelected?' selected':''}${isToday?' today':''}" data-d="${d}">${toFaNum(d)}</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;

  container.querySelector('#pickerPrev').onclick = () => {
    if (pickerState.month === 1) { pickerState.year--; pickerState.month = 12; }
    else pickerState.month--;
    pickerState.day = null;
    renderPicker();
  };
  container.querySelector('#pickerNext').onclick = () => {
    if (pickerState.month === 12) { pickerState.year++; pickerState.month = 1; }
    else pickerState.month++;
    pickerState.day = null;
    renderPicker();
  };

  container.querySelectorAll('.picker-cell[data-d]').forEach(cell => {
    cell.onclick = () => {
      pickerState.day = parseInt(cell.dataset.d);
      renderPicker();
    };
  });
}

// ─── Event Listeners ──────────────────────────────────────
document.getElementById('btnOpenModal').addEventListener('click', () => openModal(true));
document.getElementById('btnCloseModal').addEventListener('click', closeModal);
document.getElementById('btnCancelModal').addEventListener('click', closeModal);
document.getElementById('btnSaveTimer').addEventListener('click', saveTimer);
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('modalOverlay').classList.contains('open')) {
    closeModal();
  }
});

// clamp hour/minute inputs
document.getElementById('inputHour').addEventListener('change', function(){
  this.value = Math.max(0,Math.min(23,parseInt(this.value)||0));
});
document.getElementById('inputMinute').addEventListener('change', function(){
  this.value = Math.max(0,Math.min(59,parseInt(this.value)||0));
});

// ─── Init ─────────────────────────────────────────────────

// اگه تایمری با targetMs نامعتبر داشتیم (باگ قدیمی) پاکشون کن
timers = timers.filter(t => {
  const d = new Date(t.targetMs);
  return t && typeof t === 'object' && typeof t.id === 'string' && /^[a-z0-9]+$/.test(t.id)
    && typeof t.title === 'string' && t.title.trim().length > 0
    && d instanceof Date && !isNaN(d) && d.getFullYear() > 1900 && d.getFullYear() < 2200;
}).map(t => ({
  ...t,
  color: safeColor(t.color),
  emoji: typeof t.emoji === 'string' ? t.emoji.slice(0, 4) : '⏳'
}));
saveTimers();

const t = PersianCal.today();
pickerState = { year: t.y, month: t.m, day: t.d };
renderTimers();
tickInterval = setInterval(tick, 1000);
