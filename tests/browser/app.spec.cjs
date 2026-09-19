const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const future = Date.UTC(2030, 3, 5, 12, 30);
const item = (id, title, targetMs = future) => ({
  id,
  title,
  targetMs,
  emoji: '🎉',
  color: '#7c3aed'
});
async function seed(page, timers) {
  await page.addInitScript((data) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('cd_timers', JSON.stringify(data));
      sessionStorage.setItem('seeded', '1');
    }
  }, timers);
  await page.goto('/');
}
async function addTimer(page, title = 'سفر به شمال') {
  await page.locator('#btnOpenModal').click();
  await page.locator('#inputTitle').fill(title);
  await page.locator('[data-quick="week"]').click();
  await page.locator('#btnSaveTimer').click();
  await expect(page.locator('#timerDialog')).not.toBeVisible();
}

test('create, reload, edit, delete and undo without losing data', async ({ page }) => {
  await page.goto('/');
  await addTimer(page);
  await expect(page.locator('.card-title')).toHaveText('سفر به شمال');
  await page.reload();
  await expect(page.locator('.timer-card')).toHaveCount(1);
  await page.locator('[data-action="edit"]').click();
  await page.locator('#inputTitle').fill('سفر با دوستان');
  await page.locator('#inputEmoji').fill('👨‍👩‍👧‍👦');
  await page.locator('#btnSaveTimer').click();
  await expect(page.locator('.card-emoji')).toHaveText('👨‍👩‍👧‍👦');
  await page.locator('[data-action="delete"]').click();
  await expect(page.locator('.timer-card')).toHaveCount(0);
  await page.locator('#btnUndo').click();
  await expect(page.locator('.card-title')).toHaveText('سفر با دوستان');
});

test('validation accepts Persian time, rejects invalid time and submits on Enter', async ({
  page
}) => {
  await page.goto('/');
  await page.locator('#btnOpenModal').click();
  await page.locator('#btnSaveTimer').click();
  await expect(page.locator('#inputTitle')).toBeFocused();
  await page.locator('#inputTitle').fill('قرار');
  await page.locator('#inputHour').fill('۲۴');
  await page.locator('#btnSaveTimer').click();
  await expect(page.locator('#inputHour')).toBeFocused();
  await page.locator('#inputHour').fill('۲۳');
  await page.locator('#inputMinute').fill('۵۹');
  await page.locator('#inputTitle').press('Enter');
  await expect(page.locator('.card-date')).toContainText('۲۳:۵۹');
});

test('calendar browsing does not silently change the selected date', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btnOpenModal').click();
  const selection = await page.locator('#selectedDateLabel').textContent();
  await page.locator('[data-nav="1"]').click();
  await expect(page.locator('#selectedDateLabel')).toHaveText(selection);
  await expect(page.locator('.picker-cell[aria-pressed="true"]')).toHaveCount(0);
  await page.locator('#pickerYear').selectOption('1403');
  await page.locator('#pickerMonth').selectOption('12');
  await expect(page.locator('[data-day="30"]')).toBeVisible();
  await page.locator('[data-day="30"]').click();
  await expect(page.locator('#selectedDateLabel')).toContainText('۳۰ اسفند ۱۴۰۳');
  await page.locator('#pickerYear').selectOption('1404');
  await expect(page.locator('[data-day="30"]')).toHaveCount(0);
});

test('filters, normalized search, sorting and manual ordering', async ({ page }) => {
  await seed(page, [
    item('a', 'کیک تولد', future + 10000),
    item('b', 'سفر', future),
    item('c', 'گذشته', 1600000000000)
  ]);
  await page.locator('[data-filter="active"]').click();
  await expect(page.locator('.timer-card')).toHaveCount(2);
  await page.locator('#searchInput').fill('كيك');
  await expect(page.locator('.card-title')).toHaveText('کیک تولد');
  await page.locator('#searchInput').fill('');
  await page.locator('#sortOrder').selectOption('soonest');
  await expect(page.locator('.card-title').first()).toHaveText('سفر');
  await expect(page.locator('[data-action="up"]').first()).toBeDisabled();
  await page.locator('[data-filter="all"]').click();
  await page.locator('#sortOrder').selectOption('manual');
  await page.locator('[data-action="down"]').first().click();
  await expect(page.locator('.card-title').first()).toHaveText('سفر');
  await page.reload();
  await expect(page.locator('.card-title').first()).toHaveText('سفر');
});

test('null and injected records cannot crash or execute; original data is preserved', async ({
  page
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seed(page, [
    null,
    item('safe', '<img src=x onerror="window.pwned=1">'),
    item("x');alert(1)//", 'bad')
  ]);
  await expect(page.locator('.timer-card')).toHaveCount(1);
  await expect(page.locator('#storageWarning')).toBeVisible();
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cd_timers')).length)).toBe(3);
  expect(errors).toEqual([]);
});

test('malformed storage is not overwritten on startup', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cd_timers', '{broken'));
  await page.goto('/');
  await expect(page.locator('#storageWarning')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('cd_timers'))).toBe('{broken');
});

test('failed writes keep the editor and existing state intact', async ({ page }) => {
  await seed(page, [item('a', 'قبلی')]);
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('Full', 'QuotaExceededError');
    };
  });
  await page.locator('#btnOpenModal').click();
  await page.locator('#inputTitle').fill('جدید');
  await page.locator('#btnSaveTimer').click();
  await expect(page.locator('#timerDialog')).toBeVisible();
  await expect(page.locator('#formError')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cd_timers')).length)).toBe(1);
});

test('blocked localStorage still allows the app to load', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
  });
  await page.goto('/');
  await expect(page.locator('#emptyState')).toBeVisible();
  await expect(page.locator('#storageWarning')).toBeVisible();
  await page.locator('#btnOpenModal').click();
  await expect(page.locator('#timerDialog')).toBeVisible();
});

test('backup export/import is non-destructive, validated and idempotent', async ({ page }) => {
  await seed(page, [item('a', 'اول')]);
  const downloaded = page.waitForEvent('download');
  await page.locator('#btnExport').click();
  const download = await downloaded;
  const path = await download.path();
  const backup = JSON.parse(require('node:fs').readFileSync(path, 'utf8'));
  expect(backup.version).toBe(1);
  expect(backup.timers).toHaveLength(1);
  const upload = (data) =>
    page
      .locator('#importFile')
      .setInputFiles({
        name: 'backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(data))
      });
  await upload({ version: 1, timers: [item('a', 'نسخه قدیمی'), item('b', 'دوم')] });
  await expect(page.locator('.timer-card')).toHaveCount(2);
  await expect(page.locator('.card-title').first()).toHaveText('اول');
  await upload(backup);
  await expect(page.locator('.timer-card')).toHaveCount(2);
  await upload({ version: 1, timers: [null] });
  await expect(page.locator('#toastMessage')).toContainText('معتبر نیست');
  await expect(page.locator('.timer-card')).toHaveCount(2);
});

test('cross-tab sync refuses to overwrite a stale open editor', async ({ page, context }) => {
  await seed(page, [item('a', 'اصلی')]);
  await page.locator('[data-action="edit"]').click();
  const second = await context.newPage();
  await second.goto('/');
  await second.locator('[data-action="edit"]').click();
  await second.locator('#inputTitle').fill('تغییر در تب دوم');
  await second.locator('#btnSaveTimer').click();
  await expect(page.locator('.card-title')).toHaveText('تغییر در تب دوم');
  await page.locator('#inputTitle').fill('تغییر قدیمی');
  await page.locator('#btnSaveTimer').click();
  await expect(page.locator('#formError')).toContainText('پنجرهٔ دیگری');
});

test('ticks retain DOM nodes, update expiry and stop while hidden', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-19T12:00:00Z') });
  await seed(page, [item('a', 'نزدیک', Date.parse('2026-09-19T12:00:04Z'))]);
  await page.evaluate(() => {
    window.originalUnit = document.querySelector('.unit-num');
    window.originalSeconds = document.querySelectorAll('.unit-num')[3];
  });
  await page.clock.runFor(1100);
  expect(
    await page.evaluate(() => document.querySelector('.unit-num') === window.originalUnit)
  ).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.hiddenValue = window.originalSeconds.textContent;
  });
  await page.clock.runFor(5000);
  expect(await page.evaluate(() => window.originalSeconds.textContent === window.hiddenValue)).toBe(
    true
  );
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.card-expired')).toBeVisible();
  await expect(page.locator('#activeCount')).toHaveText('۰');
});

test('native dialog traps focus, closes with Escape and returns focus', async ({ page }) => {
  await page.goto('/');
  await page.locator('#btnOpenModal').click();
  await expect(page.locator('#inputTitle')).toBeFocused();
  await page.locator('#btnSaveTimer').focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('dialog'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#timerDialog')).not.toBeVisible();
  await expect(page.locator('#btnOpenModal')).toBeFocused();
});

test('theme persists and desktop/mobile do not overflow', async ({ page }) => {
  await seed(page, [item('a', 'عنوان'.repeat(15))]);
  await page.locator('#btnTheme').click();
  const theme = await page.locator('html').getAttribute('data-theme');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#btnOpenModal').click();
  expect(
    await page.evaluate(
      () =>
        document.querySelector('dialog').scrollWidth <= document.querySelector('dialog').clientWidth
    )
  ).toBe(true);
});

test('accessible dashboard and editor in both themes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, [item('a', 'تولد'), item('b', 'گذشته', 1600000000000)]);
  for (const theme of ['dark', 'light']) {
    await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
    let results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.locator('#btnOpenModal').click();
    results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    await page.keyboard.press('Escape');
  }
});

test('offline reload with query works and unrelated caches survive activation', async ({
  page,
  context
}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await caches.open('unrelated-app-cache');
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await addTimer(page, 'آفلاین');
  await context.setOffline(true);
  await page.goto('/?source=installed');
  await expect(page.locator('.card-title')).toHaveText('آفلاین');
  await page.locator('#btnOpenModal').click();
  await expect(page.locator('.picker-cell')).not.toHaveCount(0);
  expect(
    await page.evaluate(async () => (await caches.keys()).includes('unrelated-app-cache'))
  ).toBe(true);
});

test('100 timers tick without rebuilding cards or static units', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-19T12:00:00Z') });
  await seed(
    page,
    Array.from({ length: 100 }, (_, i) =>
      item(`timer${i}`, `رویداد ${i}`, Date.parse('2026-10-19T12:00:30Z'))
    )
  );
  await page.evaluate(() => {
    window.mutations = [];
    window.observer = new MutationObserver((records) => window.mutations.push(...records));
    window.observer.observe(document.querySelector('#timersGrid'), {
      childList: true,
      subtree: true
    });
  });
  await page.clock.runFor(1000);
  const result = await page.evaluate(() => ({
    count: window.mutations.length,
    onlyNumbers: window.mutations.every((m) => m.target.classList.contains('unit-num'))
  }));
  expect(result).toEqual({ count: 100, onlyNumbers: true });
});

test('320px layout and reduced motion stay usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#btnOpenModal').click();
  expect(
    await page.locator('#timerDialog').evaluate((el) => getComputedStyle(el).animationName)
  ).toBe('none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#inputTitle').fill('کوچک و روان');
  await page.locator('#btnSaveTimer').click();
  await expect(page.locator('.card-title')).toHaveText('کوچک و روان');
});
