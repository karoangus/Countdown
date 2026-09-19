/* CountDown: dependency-free UI. Persistent mutations are transactional;
 * ticks only change existing text nodes and stop when the page is hidden. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const {
    COLORS,
    MAX_TIMERS,
    MIN_MS,
    MAX_MS,
    toFaNum,
    toEnNum,
    normalizeSearch,
    escapeHTML: esc,
    normalizeTimers,
    calcDiff,
    parseBackup,
    mergeTimers
  } = TimerCore;
  const KEY = 'cd_timers';
  const pad = (n) => toFaNum(String(n).padStart(2, '0'));
  const dialog = $('timerDialog');
  const grid = $('timersGrid');
  let timers = [],
    rawSnapshot = null,
    storageBlocked = false;
  let editingId = null,
    editingSnapshot = null,
    selectedColor = COLORS[0];
  let selectedDate, viewYear, viewMonth, returnFocus;
  let filter = 'all',
    query = '',
    sort = 'manual';
  let ticker = null,
    toastTimeout = null,
    undo = null;
  let rendered = new Map(),
    expiredSnapshot = new Map(),
    todayKey = '';

  function loadTimers() {
    storageBlocked = false;
    $('storageWarning').hidden = true;
    try {
      rawSnapshot = localStorage.getItem(KEY);
      const data = normalizeTimers(JSON.parse(rawSnapshot || '[]'));
      timers = data.timers;
      if (data.rejected)
        warnStorage(
          'بعضی داده‌های ذخیره‌شده نامعتبرند. تایمرهای سالم نمایش داده می‌شوند؛ قبل از شروع دوباره، دادهٔ خام را دریافت کن.'
        );
    } catch {
      // Never overwrite unreadable storage during startup or a storage event.
      warnStorage(
        'داده‌های ذخیره‌شده قابل خواندن نیستند. برای جلوگیری از حذف اطلاعات، تغییرات غیرفعال است. دادهٔ خام را دریافت کن یا دسترسی ذخیره‌سازی مرورگر را بررسی کن.'
      );
    }
  }
  function warnStorage(message) {
    storageBlocked = true;
    $('storageMessage').textContent = message;
    $('storageWarning').hidden = false;
  }
  function persist(next) {
    if (storageBlocked) {
      notify('ذخیره‌سازی در دسترس نیست؛ پیام بالای صفحه را بررسی کن.');
      return false;
    }
    try {
      if (localStorage.getItem(KEY) !== rawSnapshot) {
        loadTimers();
        render();
        notify('اطلاعات در پنجرهٔ دیگری تغییر کرده؛ دوباره تلاش کن.');
        return false;
      }
      const data = normalizeTimers(next);
      if (data.rejected) throw new Error('Invalid mutation');
      const json = JSON.stringify(data.timers);
      localStorage.setItem(KEY, json);
      rawSnapshot = json;
      timers = data.timers;
      return true;
    } catch {
      notify('ذخیره نشد؛ فضای دستگاه یا اجازهٔ ذخیره‌سازی مرورگر را بررسی کن.');
      return false;
    }
  }
  function notify(message, undoAction = null) {
    clearTimeout(toastTimeout);
    undo = undoAction;
    $('toastMessage').textContent = message;
    $('btnUndo').hidden = !undo;
    $('toast').hidden = false;
    // Undo stays available until dismissed or another action replaces it.
    if (!undo)
      toastTimeout = setTimeout(() => {
        $('toast').hidden = true;
      }, 6500);
  }
  function dateLabel(ms) {
    const d = new Date(ms),
      j = PersianCal.fromDate(d);
    return `${toFaNum(j.d)} ${PersianCal.MONTH_NAMES[j.m - 1]} ${toFaNum(j.y)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function visibleTimers(now) {
    const list = timers.filter(
      (t) =>
        (filter === 'all' || (filter === 'active' ? t.targetMs > now : t.targetMs <= now)) &&
        normalizeSearch(t.title).includes(query)
    );
    if (sort === 'soonest') list.sort((a, b) => a.targetMs - b.targetMs);
    if (sort === 'latest') list.sort((a, b) => b.targetMs - a.targetMs);
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'fa'));
    return list;
  }
  function summary(now) {
    let active = 0,
      next = null;
    for (const t of timers)
      if (t.targetMs > now) {
        active++;
        if (!next || t.targetMs < next.targetMs) next = t;
      }
    $('activeCount').textContent = toFaNum(active);
    $('doneCount').textContent = toFaNum(timers.length - active);
    $('totalCount').textContent = toFaNum(timers.length);
    $('nextTitle').textContent = next ? `${next.emoji} ${next.title}` : 'یک اتفاق خوب اضافه کن';
    $('nextDate').textContent = next ? dateLabel(next.targetMs) : 'از همین امروز شروع کن';
    const today = PersianCal.today();
    $('todayLabel').textContent =
      `${PersianCal.DAY_NAMES[(new Date().getDay() + 1) % 7]}، ${toFaNum(today.d)} ${PersianCal.MONTH_NAMES[today.m - 1]} ${toFaNum(today.y)}`;
    todayKey = new Date().toDateString();
  }
  function units(diff) {
    return Object.values(diff)
      .map(
        (value, i) =>
          `<div class="unit"><span class="unit-num">${pad(value)}</span><span class="unit-label">${['روز', 'ساعت', 'دقیقه', 'ثانیه'][i]}</span></div>`
      )
      .join('');
  }
  function card(t, index, now) {
    const diff = calcDiff(t.targetMs, now);
    const canMove = sort === 'manual' && filter === 'all' && !query;
    const action = (name, label, symbol, disabled = false) =>
      `<button class="card-btn" data-action="${name}" aria-label="${label}" title="${label}" ${disabled ? 'disabled' : ''}>${symbol}</button>`;
    return `<article class="timer-card ${diff ? '' : 'expired'}" data-id="${esc(t.id)}" style="--card-accent:${t.color}" aria-labelledby="title-${esc(t.id)}">
      <div class="card-top"><span class="card-emoji" aria-hidden="true">${esc(t.emoji)}</span><span class="card-status"><i></i>${diff ? 'در حال شمارش' : 'به لحظه‌ش رسید'}</span></div>
      <h3 class="card-title" id="title-${esc(t.id)}">${esc(t.title)}</h3><p class="card-date">${dateLabel(t.targetMs)}</p>
      ${diff ? `<div class="card-units" role="timer" aria-label="زمان باقی‌مانده">${units(diff)}</div>` : '<div class="card-expired">✦ وقتش رسید!<small>یک لحظهٔ به‌یادموندنی دیگه</small></div>'}
      <div class="card-bottom"><span>${diff ? 'تا یک اتفاق خوب' : 'این لحظه ماندگار شد'}</span><div class="card-actions">${action('up', 'انتقال به بالا', '↑', !canMove || index === 0)}${action('down', 'انتقال به پایین', '↓', !canMove || index === timers.length - 1)}${action('edit', 'ویرایش تایمر', '✎')}${action('delete', 'حذف تایمر', '×')}</div></div>
    </article>`;
  }
  function render() {
    const now = Date.now();
    const focused = document.activeElement;
    const focusId = focused?.closest('.timer-card')?.dataset.id;
    const focusAction = focused?.dataset.action;
    const indices = new Map(timers.map((t, i) => [t.id, i]));
    const visible = visibleTimers(now);
    grid.innerHTML = visible.map((t) => card(t, indices.get(t.id), now)).join('');
    rendered = new Map();
    grid.querySelectorAll('.timer-card').forEach((el) => {
      rendered.set(el.dataset.id, { el, numbers: [...el.querySelectorAll('.unit-num')] });
    });
    expiredSnapshot = new Map(timers.map((t) => [t.id, t.targetMs <= now]));
    if (focusId && focusAction) {
      const replacement = rendered
        .get(focusId)
        ?.el.querySelector(`[data-action="${focusAction}"]:not(:disabled)`);
      (
        replacement ||
        rendered.get(focusId)?.el.querySelector('[data-action="edit"]') ||
        $('btnOpenModal')
      ).focus({ preventScroll: true });
    }
    $('emptyState').hidden = visible.length > 0;
    $('emptyTitle').textContent = timers.length ? 'لحظه‌ای پیدا نشد' : 'هر انتظار، یک شروع قشنگه';
    $('emptyDescription').textContent = timers.length
      ? 'عبارت جست‌وجو یا فیلتر رو تغییر بده.'
      : 'تولد، سفر یا یک قرار مهم؛ اولین لحظه‌ات رو بساز.';
    $('btnEmptyAdd').hidden = timers.length > 0;
    $('resultsLabel').textContent = timers.length
      ? `${toFaNum(visible.length)} لحظه از ${toFaNum(timers.length)} لحظه`
      : '';
    summary(now);
    scheduleTick();
  }
  function scheduleTick() {
    clearTimeout(ticker);
    ticker = null;
    if (document.hidden) return;
    const now = Date.now();
    const active = timers.filter((t) => t.targetMs > now);
    if (!active.length) return;
    const hasVisible = active.some((t) => rendered.has(t.id));
    const delay = hasVisible
      ? 1000 - (now % 1000)
      : Math.min(60000, ...active.map((t) => t.targetMs - now));
    ticker = setTimeout(tick, Math.max(16, delay));
  }
  function tick() {
    const now = Date.now();
    if (timers.some((t) => expiredSnapshot.get(t.id) !== t.targetMs <= now)) {
      render();
      return;
    }
    for (const t of timers) {
      const refs = rendered.get(t.id);
      if (!refs?.numbers.length) continue;
      const diff = calcDiff(t.targetMs, now);
      if (diff)
        Object.values(diff).forEach((v, i) => {
          const text = pad(v);
          if (refs.numbers[i].textContent !== text) refs.numbers[i].textContent = text;
        });
    }
    if (todayKey !== new Date().toDateString()) summary(now);
    scheduleTick();
  }
  function setSelection(date) {
    selectedDate = PersianCal.fromDate(date);
    viewYear = selectedDate.y;
    viewMonth = selectedDate.m;
    $('inputHour').value = pad(date.getHours());
    $('inputMinute').value = pad(date.getMinutes());
  }
  function updateSwatches() {
    $('colorSwatches')
      .querySelectorAll('button')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === selectedColor)));
  }
  function openModal(id = null) {
    returnFocus = document.activeElement;
    const timer = timers.find((t) => t.id === id);
    editingId = timer?.id || null;
    editingSnapshot = timer ? JSON.stringify(timer) : null;
    $('modalTitle').textContent = timer ? 'ویرایش تایمر' : 'تایمر جدید';
    $('btnSaveTimer').textContent = timer ? 'ذخیره تغییرات' : 'ساخت تایمر ←';
    $('inputTitle').value = timer?.title || '';
    $('inputEmoji').value = timer?.emoji || '';
    selectedColor = timer?.color || COLORS[0];
    $('formError').hidden = true;
    $('timerForm')
      .querySelectorAll('[aria-invalid]')
      .forEach((el) => el.removeAttribute('aria-invalid'));
    setSelection(new Date(timer?.targetMs || Date.now() + 3600000));
    updateSwatches();
    renderPicker();
    dialog.showModal();
    $('inputTitle').focus();
  }
  function closeModal() {
    dialog.close();
  }
  function formError(message, id) {
    $('formError').textContent = message;
    $('formError').hidden = false;
    if (id) {
      $(id).setAttribute('aria-invalid', 'true');
      $(id).focus();
    } else $('formError').scrollIntoView({ block: 'nearest' });
  }
  function saveTimer(event) {
    event.preventDefault();
    $('timerForm')
      .querySelectorAll('[aria-invalid]')
      .forEach((el) => el.removeAttribute('aria-invalid'));
    const title = $('inputTitle').value.trim();
    if (!title) return formError('یک عنوان برای لحظه‌ات بنویس.', 'inputTitle');
    const hour = toEnNum($('inputHour').value).trim(),
      minute = toEnNum($('inputMinute').value).trim();
    if (!/^\d{1,2}$/.test(hour) || Number(hour) > 23)
      return formError('ساعت باید از ۰ تا ۲۳ باشد.', 'inputHour');
    if (!/^\d{1,2}$/.test(minute) || Number(minute) > 59)
      return formError('دقیقه باید از ۰ تا ۵۹ باشد.', 'inputMinute');
    let targetMs;
    try {
      targetMs = PersianCal.toDate(
        selectedDate.y,
        selectedDate.m,
        selectedDate.d,
        Number(hour),
        Number(minute)
      ).getTime();
      if (targetMs < MIN_MS || targetMs >= MAX_MS) throw new RangeError();
    } catch {
      return formError('این تاریخ یا ساعت محلی معتبر نیست. تاریخ دیگری انتخاب کن.');
    }
    const index = timers.findIndex((t) => t.id === editingId);
    if (editingId && (index < 0 || JSON.stringify(timers[index]) !== editingSnapshot))
      return formError(
        'این تایمر در پنجرهٔ دیگری تغییر کرده یا حذف شده. پنجره را ببند و دوباره ویرایش کن.'
      );
    if (!editingId && timers.length >= MAX_TIMERS)
      return formError(`حداکثر ${toFaNum(MAX_TIMERS)} تایمر قابل ذخیره است.`);
    const timer = {
      id:
        editingId ||
        globalThis.crypto?.randomUUID?.() ||
        Date.now().toString(36) + Math.random().toString(36).slice(2),
      title,
      emoji: $('inputEmoji').value.trim() || '✨',
      color: selectedColor,
      targetMs
    };
    const next = [...timers];
    if (editingId) next[index] = timer;
    else next.push(timer);
    if (!persist(next))
      return formError('تغییرات ذخیره نشد. وضعیت ذخیره‌سازی را بررسی کن و دوباره تلاش کن.');
    closeModal();
    render();
    notify(
      targetMs <= Date.now() ? 'تایمر ذخیره شد؛ زمان این لحظه گذشته است.' : 'لحظه‌ات ذخیره شد ✦'
    );
  }
  function renderPicker(focusKey) {
    const today = PersianCal.today();
    const first = PersianCal.toGregorian(viewYear, viewMonth, 1);
    const offset = (new Date(first.y, first.m - 1, first.d).getDay() + 1) % 7;
    const monthOptions = PersianCal.MONTH_NAMES.map(
      (name, i) =>
        `<option value="${i + 1}" ${i + 1 === viewMonth ? 'selected' : ''}>${name}</option>`
    ).join('');
    let years = '';
    for (let y = 1279; y <= 1578; y++)
      years += `<option value="${y}" ${y === viewYear ? 'selected' : ''}>${toFaNum(y)}</option>`;
    let html = `<div class="picker-nav"><button type="button" class="picker-arrow" data-nav="-1" aria-label="ماه قبل" ${viewYear === 1279 && viewMonth === 1 ? 'disabled' : ''}>›</button><div class="picker-selects"><select id="pickerMonth" aria-label="ماه">${monthOptions}</select><select id="pickerYear" aria-label="سال">${years}</select></div><button type="button" class="picker-arrow" data-nav="1" aria-label="ماه بعد" ${viewYear === 1578 && viewMonth === 12 ? 'disabled' : ''}>‹</button><button type="button" class="picker-today" data-today>امروز</button></div><div class="picker-grid">`;
    html += PersianCal.DAY_NAMES.map(
      (day) =>
        `<span class="picker-day-name" title="${day}">${day === 'جمعه' ? 'ج' : day[0]}</span>`
    ).join('');
    html += '<span></span>'.repeat(offset);
    for (let d = 1; d <= PersianCal.daysInMonth(viewYear, viewMonth); d++) {
      const selected =
        selectedDate.y === viewYear && selectedDate.m === viewMonth && selectedDate.d === d;
      const isToday = today.y === viewYear && today.m === viewMonth && today.d === d;
      html += `<button type="button" class="picker-cell ${isToday ? 'today' : ''}" data-day="${d}" aria-pressed="${selected}" ${isToday ? 'aria-current="date"' : ''} aria-label="${toFaNum(d)} ${PersianCal.MONTH_NAMES[viewMonth - 1]} ${toFaNum(viewYear)}">${toFaNum(d)}</button>`;
    }
    $('persianDatePicker').innerHTML = html + '</div>';
    $('selectedDateLabel').textContent =
      `انتخاب‌شده: ${toFaNum(selectedDate.d)} ${PersianCal.MONTH_NAMES[selectedDate.m - 1]} ${toFaNum(selectedDate.y)}`;
    if (focusKey) $('persianDatePicker').querySelector(focusKey)?.focus({ preventScroll: true });
  }
  function download(content, filename) {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function applyTheme() {
    const light =
      document.documentElement.dataset.theme === 'light' ||
      (!document.documentElement.dataset.theme &&
        matchMedia('(prefers-color-scheme: light)').matches);
    $('btnTheme').textContent = light ? '☾' : '☀';
    $('btnTheme').setAttribute(
      'aria-label',
      light ? 'فعال کردن پوسته تیره' : 'فعال کردن پوسته روشن'
    );
    document.querySelector('meta[name="theme-color"]').content = light ? '#f7f6fb' : '#10111b';
  }

  $('btnTheme').addEventListener('click', () => {
    const light = getComputedStyle(document.documentElement).colorScheme === 'light';
    document.documentElement.dataset.theme = light ? 'dark' : 'light';
    try {
      localStorage.setItem('cd_theme', document.documentElement.dataset.theme);
    } catch {
      /* Theme still works for this session. */
    }
    applyTheme();
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);
  $('btnOpenModal').addEventListener('click', () => openModal());
  $('btnEmptyAdd').addEventListener('click', () => openModal());
  $('btnCloseModal').addEventListener('click', closeModal);
  $('btnCancelModal').addEventListener('click', closeModal);
  // Keep keyboard navigation inside the sheet instead of tabbing to browser chrome.
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const controls = [
      ...dialog.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled)'
      )
    ].filter((el) => !el.hidden);
    const first = controls[0],
      last = controls[controls.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener('close', () => {
    editingId = null;
    (returnFocus?.isConnected ? returnFocus : $('btnOpenModal')).focus({ preventScroll: true });
  });
  let backdropDown = false;
  dialog.addEventListener('pointerdown', (e) => {
    backdropDown = e.target === dialog && outsideDialog(e);
  });
  dialog.addEventListener('click', (e) => {
    if (backdropDown && e.target === dialog && outsideDialog(e)) closeModal();
    backdropDown = false;
  });
  function outsideDialog(e) {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  }
  $('timerForm').addEventListener('submit', saveTimer);
  const colorNames = ['بنفش', 'آبی', 'سبز', 'قرمز', 'نارنجی', 'صورتی', 'فیروزه‌ای', 'سبز روشن'];
  $('colorSwatches').innerHTML = COLORS.map(
    (color, i) =>
      `<button type="button" class="swatch" data-color="${color}" style="--swatch:${color}" aria-label="${colorNames[i]}" aria-pressed="false"></button>`
  ).join('');
  $('colorSwatches').addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]');
    if (b) {
      selectedColor = b.dataset.color;
      updateSwatches();
    }
  });
  document.querySelector('.quick-dates').addEventListener('click', (e) => {
    const b = e.target.closest('[data-quick]');
    if (!b) return;
    const date = new Date();
    if (b.dataset.quick === 'hour') date.setTime(date.getTime() + 3600000);
    else date.setDate(date.getDate() + (b.dataset.quick === 'week' ? 7 : 1));
    setSelection(date);
    renderPicker();
  });
  $('persianDatePicker').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.day) {
      selectedDate = { y: viewYear, m: viewMonth, d: Number(b.dataset.day) };
      renderPicker(`[data-day="${b.dataset.day}"]`);
    } else if (b.dataset.nav) {
      viewMonth += Number(b.dataset.nav);
      if (viewMonth < 1) {
        viewMonth = 12;
        viewYear--;
      }
      if (viewMonth > 12) {
        viewMonth = 1;
        viewYear++;
      }
      renderPicker(`[data-nav="${b.dataset.nav}"]`);
    } else if (b.hasAttribute('data-today')) {
      selectedDate = PersianCal.today();
      viewYear = selectedDate.y;
      viewMonth = selectedDate.m;
      renderPicker('[data-today]');
    }
  });
  $('persianDatePicker').addEventListener('change', (e) => {
    if (e.target.id === 'pickerMonth') viewMonth = Number(e.target.value);
    if (e.target.id === 'pickerYear') viewYear = Number(e.target.value);
    renderPicker(`#${e.target.id}`);
  });
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b || b.disabled) return;
    const id = b.closest('[data-id]').dataset.id,
      index = timers.findIndex((t) => t.id === id);
    if (index < 0) return;
    if (b.dataset.action === 'edit') return openModal(id);
    if (b.dataset.action === 'delete') {
      const removed = timers[index];
      if (persist(timers.filter((t) => t.id !== id))) {
        render();
        $('btnOpenModal').focus({ preventScroll: true });
        notify('تایمر حذف شد.', () => {
          if (timers.some((t) => t.id === removed.id)) return notify('این تایمر قبلاً برگشته است.');
          const next = [...timers];
          next.splice(Math.min(index, next.length), 0, removed);
          if (persist(next)) {
            render();
            notify('تایمر برگشت.');
          }
        });
      }
      return;
    }
    const other = index + (b.dataset.action === 'up' ? -1 : 1);
    if (other < 0 || other >= timers.length) return;
    const next = [...timers];
    [next[index], next[other]] = [next[other], next[index]];
    if (persist(next)) render();
  });
  document.querySelector('.filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    filter = b.dataset.filter;
    document
      .querySelectorAll('[data-filter]')
      .forEach((el) => el.setAttribute('aria-pressed', String(el === b)));
    render();
  });
  $('searchInput').addEventListener('input', (e) => {
    query = normalizeSearch(e.target.value);
    render();
  });
  $('sortOrder').addEventListener('change', (e) => {
    sort = e.target.value;
    render();
  });
  $('btnUndo').addEventListener('click', () => {
    if (undo) undo();
  });
  $('btnDismissToast').addEventListener('click', () => {
    clearTimeout(toastTimeout);
    $('toast').hidden = true;
    undo = null;
  });
  $('btnExport').addEventListener('click', () =>
    download(
      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), timers }, null, 2),
      `countdown-${new Date().toISOString().slice(0, 10)}.json`
    )
  );
  $('btnImport').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return notify('فایل پشتیبان باید کوچک‌تر از ۲ مگابایت باشد.');
    try {
      const imported = parseBackup(await file.text());
      const next = mergeTimers(timers, imported),
        added = next.length - timers.length;
      if (!added) return notify('تایمر جدیدی در این فایل نبود؛ موارد تکراری تغییری نکردند.');
      if (persist(next)) {
        render();
        notify(`${toFaNum(added)} تایمر بازیابی شد. تایمرهای قبلی حفظ شدند.`);
      }
    } catch {
      notify(
        'فایل پشتیبان معتبر نیست یا تعداد تایمرها بیش از حد مجاز است. اطلاعات فعلی تغییری نکرد.'
      );
    }
  });
  $('btnRecoveryExport').addEventListener('click', () => {
    if (rawSnapshot !== null) download(rawSnapshot, 'countdown-recovery.json');
    else notify('دادهٔ خام در دسترس نیست؛ اجازهٔ ذخیره‌سازی مرورگر را بررسی کن.');
  });
  $('btnRecoveryReset').addEventListener('click', () => {
    if (
      !confirm(
        'داده‌های ذخیره‌شده با تایمرهای سالمِ نمایش‌داده‌شده جایگزین شوند؟ اول دادهٔ خام را دریافت کن.'
      )
    )
      return;
    try {
      const json = JSON.stringify(timers);
      localStorage.setItem(KEY, json);
      rawSnapshot = json;
      storageBlocked = false;
      $('storageWarning').hidden = true;
      render();
      notify('ذخیره‌سازی دوباره آماده است.');
    } catch {
      notify('ذخیره‌سازی هنوز در دسترس نیست.');
    }
  });
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) {
      loadTimers();
      render();
      notify('تایمرها با پنجرهٔ دیگر همگام شدند.');
    }
    if (e.key === 'cd_theme' || e.key === null) {
      if (e.newValue === 'dark' || e.newValue === 'light')
        document.documentElement.dataset.theme = e.newValue;
      else delete document.documentElement.dataset.theme;
      applyTheme();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearTimeout(ticker);
      ticker = null;
    } else render();
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      loadTimers();
      render();
    }
  });

  loadTimers();
  applyTheme();
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker
      .register('./sw.js')
      .catch(() => notify('آفلاین هنوز آماده نیست؛ یک‌بار دیگر با اینترنت برنامه را باز کن.'));
  }
})();
