const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { gzipSync } = require('node:zlib');
const path = require('node:path');
test('runtime stays framework-free and under 24 KiB gzip (HTML/CSS/JS/manifest)', () => {
  const root = path.join(__dirname, '..');
  const files = [
    'index.html',
    'style.css',
    'app.js',
    'timer-core.js',
    'persian-cal.js',
    'theme.js',
    'sw.js',
    'manifest.json'
  ];
  const bytes = files.reduce(
    (sum, name) => sum + gzipSync(readFileSync(path.join(root, name))).length,
    0
  );
  assert.ok(bytes < 24 * 1024, `Runtime gzip size: ${bytes} bytes`);
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
});
