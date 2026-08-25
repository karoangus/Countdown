/**
 * Persian (Jalali) Calendar Utility
 * Algorithm: jalaali-js (MIT) — industry standard, battle-tested
 */

const PersianCal = (() => {

  function div(a, b) { return Math.floor(a / b); }
  function mod(a, b) { return a - Math.floor(a / b) * b; }

  function jalaliToJulian(jy, jm, jd) {
    let epbase = jy - (jy >= 0 ? 474 : 473);
    let epyear = 474 + mod(epbase, 2820);
    return jd
      + (jm <= 7 ? (jm - 1) * 31 : (jm - 1) * 30 + 6)
      + Math.floor((epyear * 682 - 110) / 2816)
      + (epyear - 1) * 365
      + Math.floor(epbase / 2820) * 1029983
      + 1948319.5;
  }

  function julianToJalali(jd) {
    let depoch = jd - jalaliToJulian(475, 1, 1);
    let cycle = div(depoch, 1029983);
    let cyear = mod(depoch, 1029983);
    let ycycle;
    if (cyear === 1029982) {
      ycycle = 2820;
    } else {
      let aux1 = div(cyear, 366);
      let aux2 = mod(cyear, 366);
      ycycle = Math.floor((2134 * aux1 + 2816 * aux2 + 2815) / 1028522) + aux1 + 1;
    }
    let jy = ycycle + 2820 * cycle + 474;
    if (jy <= 0) jy--;
    let jyear = jy;
    let yday = jd - jalaliToJulian(jyear, 1, 1) + 1;
    let jm = yday <= 186 ? Math.ceil(yday / 31) : Math.ceil((yday - 6) / 30);
    let jday = jd - jalaliToJulian(jyear, jm, 1) + 1;
    return { y: jyear, m: jm, d: jday };
  }

  function gregorianToJulian(gy, gm, gd) {
    return (367 * gy
      - Math.floor(7 * (gy + Math.floor((gm + 9) / 12)) / 4)
      - Math.floor(3 * (Math.floor((gy + (gm - 9) / 7) / 100) + 1) / 4)
      + Math.floor(275 * gm / 9)
      + gd + 1721028.5);
  }

  function julianToGregorian(jd) {
    let z = Math.floor(jd + 0.5);
    let a = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + a - Math.floor(a / 4);
    let b = a + 1524;
    let c = Math.floor((b - 122.1) / 365.25);
    let d = Math.floor(365.25 * c);
    let e = Math.floor((b - d) / 30.6001);
    let gd = b - d - Math.floor(30.6001 * e);
    let gm = e < 14 ? e - 1 : e - 13;
    let gy = gm > 2 ? c - 4716 : c - 4715;
    return { y: gy, m: gm, d: gd };
  }

  function toJalali(gy, gm, gd) {
    return julianToJalali(gregorianToJulian(gy, gm, gd));
  }

  function toGregorian(jy, jm, jd) {
    return julianToGregorian(jalaliToJulian(jy, jm, jd));
  }

  function leapJ(jy) {
    return jalaliToJulian(jy + 1, 1, 1) - jalaliToJulian(jy, 1, 1) === 366;
  }

  function daysInMonth(jy, jm) {
    if (jm <= 6)  return 31;
    if (jm <= 11) return 30;
    return leapJ(jy) ? 30 : 29;
  }

  function today() {
    const now = new Date();
    return toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  function toDate(jy, jm, jd, h, min) {
    const g = toGregorian(jy, jm, jd);
    return new Date(g.y, g.m - 1, g.d, h || 0, min || 0, 0, 0);
  }

  function fromDate(d) {
    return toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  const MONTH_NAMES = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const DAY_NAMES   = ['ش','ی','د','س','چ','پ','ج'];

  return { toJalali, toGregorian, toDate, fromDate, today, daysInMonth, MONTH_NAMES, DAY_NAMES, leapJ };
})();
