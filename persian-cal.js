/** Solar Hijri conversion using the browser's standard Persian calendar (ICU).
 * No network, third-party library or year-specific leap-day patches.
 * UTC is used for civil-date conversion; toDate deliberately uses local time.
 */
const PersianCal = (() => {
  const MIN_YEAR = 1200;
  const MAX_YEAR = 1600;
  const DAY = 86400000;
  const formatter = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  const starts = new Map();
  function parts(ms) {
    const p = Object.fromEntries(formatter.formatToParts(ms).map((p) => [p.type, p.value]));
    return { y: Number(p.year), m: Number(p.month), d: Number(p.day) };
  }
  function yearStart(year) {
    if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR + 1)
      throw new RangeError('Unsupported Persian year');
    if (!starts.has(year)) {
      let low = Date.UTC(year + 621, 0, 1) / DAY;
      let high = Date.UTC(year + 622, 0, 1) / DAY;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (parts(mid * DAY).y < year) low = mid + 1;
        else high = mid;
      }
      starts.set(year, low * DAY);
    }
    return starts.get(year);
  }
  function leapJ(year) {
    return yearStart(year + 1) - yearStart(year) === 366 * DAY;
  }
  function daysInMonth(year, month) {
    if (
      !Number.isInteger(year) ||
      year < MIN_YEAR ||
      year > MAX_YEAR ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    )
      throw new RangeError('Invalid Persian month');
    return month <= 6 ? 31 : month <= 11 ? 30 : leapJ(year) ? 30 : 29;
  }
  function toJalali(y, m, d) {
    const date = new Date(Date.UTC(y, m - 1, d));
    if (
      ![y, m, d].every(Number.isInteger) ||
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() !== m - 1 ||
      date.getUTCDate() !== d
    )
      throw new RangeError('Invalid Gregorian date');
    return parts(date.getTime());
  }
  function toGregorian(y, m, d) {
    if (!Number.isInteger(d) || d < 1 || d > daysInMonth(y, m))
      throw new RangeError('Invalid Persian day');
    const offset = m <= 7 ? (m - 1) * 31 : 186 + (m - 7) * 30;
    const date = new Date(yearStart(y) + (offset + d - 1) * DAY);
    return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
  }
  function toDate(y, m, d, hour = 0, minute = 0) {
    if (
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23 ||
      !Number.isInteger(minute) ||
      minute < 0 ||
      minute > 59
    )
      throw new RangeError('Invalid time');
    const g = toGregorian(y, m, d);
    const date = new Date(g.y, g.m - 1, g.d, hour, minute);
    // Reject nonexistent wall-clock times during daylight-saving transitions.
    if (
      date.getFullYear() !== g.y ||
      date.getMonth() !== g.m - 1 ||
      date.getDate() !== g.d ||
      date.getHours() !== hour ||
      date.getMinutes() !== minute
    )
      throw new RangeError('Nonexistent local time');
    return date;
  }
  function fromDate(date) {
    return toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }
  function today() {
    return fromDate(new Date());
  }
  const MONTH_NAMES = [
    'فروردین',
    'اردیبهشت',
    'خرداد',
    'تیر',
    'مرداد',
    'شهریور',
    'مهر',
    'آبان',
    'آذر',
    'دی',
    'بهمن',
    'اسفند'
  ];
  const DAY_NAMES = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  return {
    MIN_YEAR,
    MAX_YEAR,
    toJalali,
    toGregorian,
    toDate,
    fromDate,
    today,
    daysInMonth,
    MONTH_NAMES,
    DAY_NAMES,
    leapJ
  };
})();
if (typeof module !== 'undefined') module.exports = PersianCal;
