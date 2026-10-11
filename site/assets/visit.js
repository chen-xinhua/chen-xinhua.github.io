(() => {
  if (location.hostname !== 'chen-xinhua.github.io') return;

  const endpoint = 'https://xinhua-visitor-tracker.pages.dev/collect';
  if (!endpoint.startsWith('https://')) return;

  const key = 'xinhua-visit-last-v1';
  const now = Date.now();
  const sessionLength = 30 * 60 * 1000;
  try {
    const previous = Number(localStorage.getItem(key));
    if (previous && now - previous < sessionLength) return;
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
  });
})();
