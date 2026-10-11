(() => {
  const picker = document.querySelector('.brand-font-picker');
  if (!picker) return;
  const localPreview = ['127.0.0.1', 'localhost'].includes(location.hostname) || location.protocol === 'file:';
  if (localPreview) picker.style.display = 'block';

  const toggle = picker.querySelector('.brand-font-picker-toggle');
  const options = picker.querySelector('.brand-font-picker-options');
  const choices = [...picker.querySelectorAll('[data-brand-font-option]')];
  const fonts = {
    kaushan: 'Kaushan Script',
    berkshire: 'Berkshire Swash',
    dancing: 'Dancing Script',
    pacifico: 'Pacifico'
  };

  function select(name) {
    if (!fonts[name]) return;
    document.body.dataset.brandFont = name;
    choices.forEach(choice => {
      choice.setAttribute('aria-pressed', String(choice.dataset.brandFontOption === name));
    });
    document.fonts.load(`28px "${fonts[name]}"`);
    try { sessionStorage.setItem('brandFontPreviewSelected', name); } catch (_) {}
    picker.dispatchEvent(new Event('brand:replay'));
  }

  function close() {
    options.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => {
    options.hidden = !options.hidden;
    toggle.setAttribute('aria-expanded', String(!options.hidden));
  });
  choices.forEach(choice => choice.addEventListener('click', () => select(choice.dataset.brandFontOption)));
  document.addEventListener('click', event => { if (!picker.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });

  let saved = 'dancing';
  try { saved = localStorage.getItem('brandFontPreviewSelected') || sessionStorage.getItem('brandFontPreviewSelected') || saved; } catch (_) {}
  select(saved);

  const brand = document.querySelector('.signature-brand');
  const englishCanvas = brand?.querySelector('.signature-brand-name-canvas');
  const chineseMark = brand?.querySelector('.signature-brand-ink');
  const tuning = [...picker.querySelectorAll('[data-signature-control]')];
  const savedTuning = (() => {
    try {
      return JSON.parse(localStorage.getItem('signatureTuning') || sessionStorage.getItem('signatureTuning') || '{}');
    } catch (_) { return {}; }
  })();
  const saveButton = picker.querySelector('[data-signature-save]');
  const savedStatus = picker.querySelector('[data-signature-saved]');
  function saveTuning() {
    const values = Object.fromEntries(tuning.map(input => [input.dataset.signatureControl, Number(input.value)]));
    try {
      localStorage.setItem('signatureTuning', JSON.stringify(values));
      localStorage.setItem('brandFontPreviewSelected', document.body.dataset.brandFont || 'dancing');
      sessionStorage.setItem('signatureTuning', JSON.stringify(values));
      if (savedStatus) {
        savedStatus.textContent = '已保存';
        window.setTimeout(() => { savedStatus.textContent = ''; }, 1800);
      }
    } catch (_) {}
  }
  function applyTuning() {
    const values = Object.fromEntries(tuning.map(input => [input.dataset.signatureControl, Number(input.value)]));
    if (!brand || !englishCanvas || !chineseMark) return;
    const englishWidth = Math.round(values['en-size'] * values['en-width'] / 100);
    const englishHeight = Math.round(values['en-size'] * 165 / 760);
    englishCanvas.style.width = `${englishWidth}px`;
    englishCanvas.style.height = `${englishHeight}px`;
    englishCanvas.style.top = '50%';
    englishCanvas.style.transform = `translateY(calc(-50% + ${values['en-y']}px))`;
    brand.querySelector('.signature-brand-name').style.width = `${englishWidth}px`;
    chineseMark.style.width = `${values['zh-size']}px`;
    chineseMark.style.height = `${Math.round(values['zh-size'] * 0.48)}px`;
    chineseMark.style.transform = `translateY(${2 + values['zh-y']}px)`;
    brand.style.gap = `${values.gap}px`;
    const weight = values.weight;
    const filter = `drop-shadow(${weight}px 0 #1e293b) drop-shadow(-${weight * 0.55}px 0 #1e293b)`;
    englishCanvas.style.filter = filter;
    chineseMark.style.setProperty('--signature-filter', filter);
    tuning.forEach(input => {
      const output = picker.querySelector(`[data-signature-value="${input.dataset.signatureControl}"]`);
      if (output) output.textContent = input.dataset.signatureControl === 'en-width' ? `${input.value}%` : input.value;
    });
    try { sessionStorage.setItem('signatureTuning', JSON.stringify(values)); } catch (_) {}
  }
  const defaults = { 'en-size': 157, 'en-width': 102, 'zh-size': 140, gap: 17, 'en-y': 0, 'zh-y': -1, weight: 0.3 };
  tuning.forEach(input => {
    const name = input.dataset.signatureControl;
    if (savedTuning[name] !== undefined && (name !== 'en-width' || savedTuning['en-size'] !== undefined)) input.value = savedTuning[name];
    else if (defaults[name] !== undefined) input.value = defaults[name];
    input.addEventListener('input', applyTuning);
  });
  saveButton?.addEventListener('click', saveTuning);
  applyTuning();
  if (!localPreview) picker.remove();
})();
