const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../persian-cal.js');
test('Nowruz and leap-day known anchors (no 1404-only patch)', () => {
  for (const [g, j] of [
    [
      [2024, 3, 20],
      [1403, 1, 1]
    ],
    [
      [2025, 3, 20],
      [1403, 12, 30]
    ],
    [
      [2025, 3, 21],
      [1404, 1, 1]
    ],
    [
      [2026, 3, 20],
      [1404, 12, 29]
    ],
    [
      [2026, 3, 21],
      [1405, 1, 1]
    ],
    [
      [2027, 3, 21],
      [1406, 1, 1]
    ]
  ]) {
    assert.deepEqual(P.toJalali(...g), { y: j[0], m: j[1], d: j[2] });
    assert.deepEqual(P.toGregorian(...j), { y: g[0], m: g[1], d: g[2] });
  }
  assert.equal(P.leapJ(1403), true);
  assert.equal(P.leapJ(1404), false);
});
test('every supported Gregorian day roundtrips, including century boundaries', () => {
  for (let ms = Date.UTC(1901, 0, 1); ms < Date.UTC(2200, 0, 1); ms += 86400000) {
    const d = new Date(ms),
      j = P.toJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    assert.deepEqual(P.toGregorian(j.y, j.m, j.d), {
      y: d.getUTCFullYear(),
      m: d.getUTCMonth() + 1,
      d: d.getUTCDate()
    });
  }
});
test('all Persian month ends are valid and the next day is rejected', () => {
  for (let y = 1279; y <= 1578; y++)
    for (let m = 1; m <= 12; m++) {
      const days = P.daysInMonth(y, m);
      assert.doesNotThrow(() => P.toGregorian(y, m, days));
      assert.throws(() => P.toGregorian(y, m, days + 1));
    }
});
test('invalid input cannot silently overflow into another date', () => {
  for (const args of [
    [1404, 12, 30],
    [1405, 13, 1],
    [1405, 1, 0],
    [1405, 1, 1.1]
  ])
    assert.throws(() => P.toGregorian(...args));
  assert.throws(() => P.toJalali(2025, 2, 29));
  assert.throws(() => P.toDate(1405, 1, 1, 24, 0));
  assert.throws(() => P.toDate(1405, 1, 1, 0, -1));
});
test('local time conversion preserves selected wall time', () => {
  const d = P.toDate(1405, 7, 1, 14, 35);
  assert.equal(d.getHours(), 14);
  assert.equal(d.getMinutes(), 35);
  assert.deepEqual(P.fromDate(d), { y: 1405, m: 7, d: 1 });
});
test('DST gaps are rejected and conversions work in multiple time zones', () => {
  const { execFileSync } = require('node:child_process');
  for (const tz of ['Asia/Tehran', 'America/New_York', 'Pacific/Auckland']) {
    const code = `const assert = require('node:assert/strict'); const P = require('./persian-cal.js');
      const d = P.toDate(1405, 7, 1, 14, 35);
      assert.equal(d.getHours(), 14); assert.equal(d.getMinutes(), 35);
      assert.deepEqual(P.fromDate(d), { y: 1405, m: 7, d: 1 });
      if (process.env.TZ === 'America/New_York') {
        const j = P.toJalali(2026, 3, 8);
        assert.throws(() => P.toDate(j.y, j.m, j.d, 2, 30));
      }`;
    execFileSync(process.execPath, ['-e', code], {
      cwd: require('node:path').join(__dirname, '..'),
      env: { ...process.env, TZ: tz }
    });
  }
});
