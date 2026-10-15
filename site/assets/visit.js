(() => {
  if (location.hostname !== 'chen-xinhua.github.io') return;

  const endpoint = 'https://xinhua-visitor-tracker.pages.dev/collect';
  if (!endpoint.startsWith('https://')) return;

  const count = document.getElementById('visit-count');
  let displayedTotal = null;
  function displayTotal(total, source, updatedAt) {
    if (!Number.isSafeInteger(total) || total < 0 || !count) return;
    if (displayedTotal !== null && total < displayedTotal) return;
    displayedTotal = total;
    count.textContent = total.toLocaleString('en-US');
    count.title = source === 'snapshot' && updatedAt
      ? `Last updated ${new Date(updatedAt).toLocaleString()}`
      : 'Live visit count';
  }

  const snapshot = count ? fetch('/data/visits.json', { cache: 'no-cache' })
    .then(response => {
      if (!response.ok) throw new Error('Count snapshot unavailable');
      return response.json();
    })
    .then(({ total, updatedAt }) => displayTotal(total, 'snapshot', updatedAt))
    .catch(() => {}) : Promise.resolve();

  async function showTotal() {
    if (!count) return;
    try {
      const response = await fetch('https://xinhua-visitor-tracker.pages.dev/total', {
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Count unavailable');
      const { total } = await response.json();
      if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid count');
      displayTotal(total, 'live');
    } catch {
      await snapshot;
      if (displayedTotal === null) count.textContent = '—';
    }
  }

  const key = 'xinhua-visit-last-v1';
  const now = Date.now();
  const sessionLength = 30 * 60 * 1000;
  try {
    const previous = Number(localStorage.getItem(key));
    if (previous && now - previous < sessionLength) {
      void showTotal();
      return;
    }
    localStorage.setItem(key, String(now));
  } catch {
    // Storage can be unavailable in private browsing; still record the visit.
  }

  fetch(endpoint, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    keepalive: true,
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ path: location.pathname }),
  }).then(response => {
    if (!response.ok) throw new Error('Visit not recorded');
  }).catch(() => {
    try {
      if (localStorage.getItem(key) === String(now)) localStorage.removeItem(key);
    } catch {
      // Nothing visible should change when analytics is unavailable.
    }
  }).finally(showTotal);
})();
