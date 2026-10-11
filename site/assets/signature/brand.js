(() => {
  const brand = document.querySelector('.signature-brand');
  const englishCanvas = brand?.querySelector('.signature-brand-name-canvas');
  const chineseCanvas = brand?.querySelector('.signature-brand-ink canvas');
  if (!brand || !englishCanvas || !chineseCanvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  Promise.all([
    fetch('assets/signature/lockup.json').then(response => {
      if (!response.ok) throw new Error('English signature unavailable');
      return response.json();
    }),
    fetch('assets/signature/data.json').then(response => {
      if (!response.ok) throw new Error('Chinese signature unavailable');
      return response.json();
    })
  ])
    .then(([lockup, chinese]) => {
      brand.classList.add('is-lockup', 'is-animated');
      brand.classList.remove('is-lockup-pending');
      const english = SigEngine(englishCanvas, {
        view: [-770, 105, 760, 165],
        inks: [lockup.inks[0]],
        ini: ''
      });
      english.setStrokes(lockup.strokes.slice(0, 5));
      english.setColor([30, 41, 59]);
      const chineseEngine = SigEngine(chineseCanvas, { view: [10, 14, 800, 380], ink: chinese.ink, ini: '' });
      chineseEngine.setStrokes(chinese.strokes);
      chineseEngine.setColor([30, 41, 59]);

      let frame = 0;
      let replayTimer;
      let current = -1;
      const rate = 2;
      const handoff = 120;
      const englishEnd = english.total;
      const chineseStart = englishEnd + handoff;
      const end = chineseStart + chineseEngine.total + chineseEngine.fadeTime / rate;

      function play() {
        clearTimeout(replayTimer);
        replayTimer = setTimeout(play, 10000);
        cancelAnimationFrame(frame);
        if (document.hidden) {
          current = end;
          english.draw(englishEnd + 20);
          chineseEngine.draw(chineseEngine.total + 20);
          return;
        }
        const start = performance.now() + 300;
        current = -1;
        const step = now => {
          current = (now - start) * rate;
          english.draw(Math.min(englishEnd + 20, current));
          chineseEngine.draw(Math.max(-1, current - chineseStart));
          if (current < end) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      }

      play();
      document.querySelector('.brand-font-picker')?.addEventListener('brand:replay', play);
      let resizeTimer;
      new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          english.resize();
          chineseEngine.resize();
          english.draw(Math.min(englishEnd + 20, current));
          chineseEngine.draw(Math.max(-1, current - chineseStart));
        }, 120);
      }).observe(brand);
    })
    .catch(error => {
      brand.dataset.signatureError = error?.message || 'unknown';
      brand.classList.remove('is-lockup-pending');
    });
})();
