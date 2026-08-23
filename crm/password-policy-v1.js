(() => {
  'use strict';
  const frame = document.getElementById('crmFrame');
  if (!frame) return;

  function patch() {
    try {
      const d = frame.contentDocument;
      const form = d?.getElementById('accountForm');
      const p = form?.elements?.namedItem('password');
      if (!p) return;
      p.minLength = 4;
      p.setAttribute('minlength', '4');
      p.placeholder = '由管理员自行设置，至少 4 位';
      const label = p.closest('label');
      const title = label?.querySelector('span');
      if (title) title.textContent = '自定义登录密码 *';
      let note = label?.querySelector('.password-note') || label?.querySelector('small');
      if (note) note.textContent = '至少 4 位；创建账号时由管理员直接设置。';
    } catch (_) {}
  }

  frame.addEventListener('load', () => {
    setTimeout(patch, 80);
    setTimeout(patch, 500);
  });
  setInterval(patch, 800);
})();
