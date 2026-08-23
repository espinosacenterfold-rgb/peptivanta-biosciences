(() => {
  'use strict';
  const frame = document.getElementById('crmFrame');
  if (!frame) return;

  function applyUi() {
    try {
      const d = frame.contentDocument;
      if (!d || !d.head) return;
      if (!d.getElementById('pv-v8-ui')) {
        const link = d.createElement('link');
        link.id = 'pv-v8-ui';
        link.rel = 'stylesheet';
        link.href = './v8-ui.css?v=20260824-1';
        d.head.appendChild(link);
      }
    } catch (_) {}
  }

  frame.addEventListener('load', () => {
    applyUi();
    setTimeout(applyUi, 250);
    setTimeout(applyUi, 900);
  });
})();
