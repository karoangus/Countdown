// Apply before first paint; storage restrictions must never block rendering.
try {
  const theme = localStorage.getItem('cd_theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  /* Use the system preference. */
}
