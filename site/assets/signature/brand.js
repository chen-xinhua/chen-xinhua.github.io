(() => {
  const brand = document.querySelector('.signature-brand');
  if (!brand || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  fetch('assets/signature/data.json')
    .then(response => {
      if (!response.ok) throw new Error('Signature data unavailable');
      return response.json();
    })
    .then(({ ink, strokes }) => {
      const canvas = brand.querySelector('canvas');
      const engine = SigEngine(canvas, { view: [10, 14, 800, 380], ink, ini: '' });
      engine.setStrokes(strokes);
      engine.setColor([30, 41, 59]);
      let frame = 0;
      let current = engine.total;

      function play() {
        cancelAnimationFrame(frame);
        if (document.hidden) {
          current = engine.total + 20;
          engine.draw(current);
          return;
        }
        const start = performance.now();
        current = -1;
        engine.draw(current);
        const step = now => {
          current = now - start;
          engine.draw(current);
          if (current < engine.total + 20) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      }

      brand.classList.add('is-animated');
      play();
      setInterval(play, 10000);
      new ResizeObserver(() => {
        engine.resize();
        engine.draw(current);
      }).observe(brand);
    })
    .catch(() => {
      // Keep the static SVG visible if the animation cannot load.
    });
})();
