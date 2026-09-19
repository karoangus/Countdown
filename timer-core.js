/** Pure helpers shared by the UI and dependency-free Node tests. */
const TimerCore = (() => {
  const COLORS = [
    '#7c3aed',
    '#2563eb',
    '#059669',
    '#dc2626',
    '#d97706',
    '#db2777',
    '#0891b2',
    '#65a30d'
  ];
  const MAX_TIMERS = 1000;
  const MIN_MS = new Date(1901, 0, 1).getTime();
  const MAX_MS = new Date(2200, 0, 1).getTime();
  const toFaNum = (value) => String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const toEnNum = (value) =>
    String(value).replace(/[۰-۹٠-٩]/g, (d) =>
      String('۰۱۲۳۴۵۶۷۸۹'.includes(d) ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(d) : '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    );
  const normalizeSearch = (value) =>
    toEnNum(value)
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[\u200c\u200d]/g, '')
      .toLocaleLowerCase()
      .trim();
  const escapeHTML = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  function normalizeTimers(value) {
    if (!Array.isArray(value) || value.length > MAX_TIMERS)
      throw new TypeError('Invalid timer collection');
    const ids = new Set();
    let rejected = 0;
    const timers = [];
    for (const t of value) {
      if (
        !t ||
        typeof t !== 'object' ||
        typeof t.id !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,100}$/.test(t.id) ||
        ids.has(t.id) ||
        typeof t.title !== 'string' ||
        !t.title.trim() ||
        typeof t.targetMs !== 'number' ||
        !Number.isFinite(t.targetMs) ||
        t.targetMs < MIN_MS ||
        t.targetMs >= MAX_MS
      ) {
        rejected++;
        continue;
      }
      ids.add(t.id);
      timers.push({
        id: t.id,
        title: t.title.trim().slice(0, 60),
        emoji:
          typeof t.emoji === 'string' ? [...t.emoji.trim()].slice(0, 32).join('') || '⏳' : '⏳',
        color: COLORS.includes(t.color) ? t.color : COLORS[0],
        targetMs: Math.trunc(t.targetMs)
      });
    }
    return { timers, rejected };
  }
  function calcDiff(targetMs, now = Date.now()) {
    if (!Number.isFinite(targetMs) || targetMs <= now) return null;
    const s = Math.ceil((targetMs - now) / 1000);
    return {
      days: Math.floor(s / 86400),
      hours: Math.floor((s % 86400) / 3600),
      minutes: Math.floor((s % 3600) / 60),
      seconds: s % 60
    };
  }
  function parseBackup(text) {
    const value = JSON.parse(text);
    if (!Array.isArray(value) && (!value || value.version !== 1 || !Array.isArray(value.timers)))
      throw new TypeError('Unsupported backup');
    const result = normalizeTimers(Array.isArray(value) ? value : value.timers);
    if (result.rejected) throw new TypeError('Invalid timers in backup');
    return result.timers;
  }
  function mergeTimers(current, incoming) {
    const result = [...current];
    const ids = new Set(current.map((t) => t.id));
    // Existing IDs win: importing the same backup twice is safe and idempotent.
    for (const t of incoming)
      if (!ids.has(t.id)) {
        result.push(t);
        ids.add(t.id);
      }
    if (result.length > MAX_TIMERS) throw new RangeError('Too many timers');
    return result;
  }
  return {
    COLORS,
    MAX_TIMERS,
    MIN_MS,
    MAX_MS,
    toFaNum,
    toEnNum,
    normalizeSearch,
    escapeHTML,
    normalizeTimers,
    calcDiff,
    parseBackup,
    mergeTimers
  };
})();
if (typeof module !== 'undefined') module.exports = TimerCore;
