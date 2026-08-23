(() => {
  let lastCustomerId = null;
  let lastClickAt = 0;
  const WINDOW_MS = 480;
  document.addEventListener('click', event => {
    const card = event.target.closest('#customerPool [data-detail-customer]');
    if (!card || event.target.closest('[data-open-detail]')) return;
    const id = card.dataset.detailCustomer, now = Date.now();
    if (id === lastCustomerId && now - lastClickAt <= WINDOW_MS) {
      event.preventDefault();
      event.stopPropagation();
      lastCustomerId = null; lastClickAt = 0;
      setTimeout(() => {
        const fresh = [...document.querySelectorAll('#customerPool [data-detail-customer]')].find(x => x.dataset.detailCustomer === id);
        fresh?.querySelector('[data-open-detail]')?.click();
      }, 0);
      return;
    }
    lastCustomerId = id; lastClickAt = now;
  }, true);
})();