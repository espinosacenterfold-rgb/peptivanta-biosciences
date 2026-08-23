(() => {
  let lastCustomerId = null;
  let lastClickAt = 0;
  const WINDOW_MS = 480;

  document.addEventListener('click', event => {
    const card = event.target.closest('#customerPool [data-detail-customer]');
    if (!card) return;
    if (event.target.closest('[data-open-detail]')) return;

    const id = card.dataset.detailCustomer;
    const now = Date.now();

    if (id === lastCustomerId && now - lastClickAt <= WINDOW_MS) {
      event.preventDefault();
      event.stopPropagation();
      lastCustomerId = null;
      lastClickAt = 0;

      setTimeout(() => {
        const freshCard = [...document.querySelectorAll('#customerPool [data-detail-customer]')]
          .find(el => el.dataset.detailCustomer === id);
        const openButton = freshCard?.querySelector('[data-open-detail]');
        if (openButton) openButton.click();
      }, 0);
      return;
    }

    lastCustomerId = id;
    lastClickAt = now;
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      const focused = document.activeElement?.closest?.('#customerPool [data-detail-customer]');
      focused?.querySelector('[data-open-detail]')?.click();
    }
  });
})();