const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../timer-core.js');
const timer = (patch = {}) => ({
  id: 'old1',
  title: 'تولد',
  emoji: '🎉',
  color: '#7c3aed',
  targetMs: Date.UTC(2030, 0, 1),
  ...patch
});
test('legacy timers survive normalization and complex emoji are not split', () => {
  const t = timer({ emoji: '👨‍👩‍👧‍👦' });
  assert.deepEqual(C.normalizeTimers([t]), { timers: [t], rejected: 0 });
});
test('null, primitives, invalid timestamps, duplicate IDs and injected IDs are rejected safely', () => {
  const result = C.normalizeTimers([
    null,
    1,
    'a',
    {},
    timer(),
    timer(),
    timer({ id: "');alert(1)//" }),
    timer({ id: 'x', targetMs: '2030-01-01' }),
    timer({ id: 'y', targetMs: Infinity })
  ]);
  assert.equal(result.timers.length, 1);
  assert.equal(result.rejected, 8);
});
test('colors are allowlisted, unsafe attributes ignored and text bounded', () => {
  const result = C.normalizeTimers([
    timer({ color: 'url(evil)', title: 'a'.repeat(100), surprise: true })
  ]).timers[0];
  assert.equal(result.color, C.COLORS[0]);
  assert.equal(result.title.length, 60);
  assert.equal(result.surprise, undefined);
});
test('collection size and malformed collections are rejected', () => {
  for (const bad of [null, {}, '[]', Array(1001).fill(timer())])
    assert.throws(() => C.normalizeTimers(bad));
});
test('countdown rounds up, expires exactly at boundary and splits units', () => {
  assert.deepEqual(C.calcDiff(90061000, 0), { days: 1, hours: 1, minutes: 1, seconds: 1 });
  assert.deepEqual(C.calcDiff(1, 0), { days: 0, hours: 0, minutes: 0, seconds: 1 });
  assert.equal(C.calcDiff(0, 0), null);
  assert.equal(C.calcDiff(NaN, 0), null);
});
test('Persian and Arabic digits and search variations normalize', () => {
  assert.equal(C.toFaNum(123), '۱۲۳');
  assert.equal(C.toEnNum('۱۲٣٤'), '1234');
  assert.equal(C.normalizeSearch(' كيك ۱۴۰۵ '), 'کیک 1405');
});
test('text is HTML escaped including quotes', () =>
  assert.equal(C.escapeHTML('<img x="\'">&'), '&lt;img x=&quot;&#39;&quot;&gt;&amp;'));
test('versioned and legacy backups roundtrip; invalid imports fail atomically', () => {
  assert.deepEqual(C.parseBackup(JSON.stringify({ version: 1, timers: [timer()] })), [timer()]);
  assert.deepEqual(C.parseBackup(JSON.stringify([timer()])), [timer()]);
  for (const text of ['null', '{}', '[null]', '{"version":2,"timers":[]}', 'broken'])
    assert.throws(() => C.parseBackup(text));
});
test('backup merging is non-destructive and idempotent', () => {
  const original = [timer()],
    incoming = [timer({ title: 'old backup' }), timer({ id: 'new2' })];
  const merged = C.mergeTimers(original, incoming);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].title, 'تولد');
  assert.deepEqual(C.mergeTimers(merged, incoming), merged);
  assert.equal(original.length, 1);
});
