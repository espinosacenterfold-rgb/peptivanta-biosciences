(() => {
  'use strict';

  const KEY = 'peptivanta-crm-v2';
  const frame = document.getElementById('crmFrame');
  const boot = document.getElementById('boot');
  const bootText = document.getElementById('bootText');
  const bootDetail = document.getElementById('bootDetail');
  const retryBtn = document.getElementById('retryBtn');
  const syncbar = document.getElementById('syncbar');

  let user = null;
  let revision = 0;
  let lastSynced = '';
  let dirty = false;
  let syncing = false;
  let syncTimer = null;
  let suppress = false;

  function setStage(text, detail = '') {
    bootText.textContent = text;
    bootDetail.textContent = detail;
  }

  function fatal(title, detail) {
    setStage(title, detail);
    retryBtn.hidden = false;
    document.querySelector('.spin').style.display = 'none';
  }

  async function req(url, opt = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        credentials: 'same-origin',
        cache: 'no-store',
        ...opt,
        signal: controller.signal,
        headers: { 'content-type': 'application/json', ...(opt.headers || {}) }
      });
      let d = {};
      try { d = await r.json(); } catch (_) {}
      return { r, d };
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('请求超时（8秒）');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  function localText() { return localStorage.getItem(KEY) || ''; }

  function setLocal(state) {
    suppress = true;
    const text = JSON.stringify(state || {});
    localStorage.setItem(KEY, text);
    lastSynced = text;
    suppress = false;
  }

  function showSync(text, cls = '') {
    syncbar.textContent = text;
    syncbar.className = cls;
    syncbar.style.display = 'block';
  }

  function permissions(p) { return !!user?.permissions?.includes(p); }

  async function logout(clearLocal = false) {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
    if (clearLocal) localStorage.removeItem(KEY);
    location.replace('./login.html');
  }

  async function syncNow() {
    if (syncing || !dirty) return;
    syncing = true;
    dirty = false;
    const text = localText();
    try {
      const state = JSON.parse(text || '{}');
      const { r, d } = await req('/api/state', { method: 'PUT', body: JSON.stringify({ revision, state }) });
      if (r.status === 401) { await logout(false); return; }
      if (r.status === 409 && d.state) {
        revision = d.revision;
        setLocal(d.state);
        showSync('检测到其他人刚刚更新了数据，点击刷新', 'update');
        syncbar.onclick = () => location.reload();
        return;
      }
      if (!r.ok || !d.ok) throw new Error(d.message || d.error || `HTTP ${r.status}`);
      revision = d.revision;
      lastSynced = text;
      showSync('数据库 · 已同步');
    } catch (e) {
      dirty = true;
      showSync('数据库 · 同步失败：' + (e?.message || e), 'error');
    } finally {
      syncing = false;
      if (dirty) syncTimer = setTimeout(syncNow, 1200);
    }
  }

  function markDirty() {
    if (suppress) return;
    const text = localText();
    if (!text || text === lastSynced) return;
    dirty = true;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, 250);
  }

  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  }

  function enhanceAccountForm(d) {
    if (!permissions('子账号管理')) return;
    const form = d.getElementById('accountForm');
    if (!form || form.dataset.cloud === '1') return;
    form.dataset.cloud = '1';
    const grid = form.querySelector('.form-grid');
    if (grid && !form.elements.namedItem('password')) {
      const label = d.createElement('label');
      label.innerHTML = '<span>初始密码 *</span><input name="password" type="password" minlength="10" required autocomplete="new-password"><small style="color:#98a2b3">至少 10 位。</small>';
      grid.appendChild(label);
    }
    form.addEventListener('submit', async e => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const x = Object.fromEntries(new frame.contentWindow.FormData(form));
      const payload = {
        username: x.login,
        displayName: x.displayName,
        permissionGroup: x.permissionGroup,
        team: x.team,
        password: x.password,
        status: x.status,
        mustChangePassword: false,
        managedTeams: x.permissionGroup === '一级管理员' ? [x.team] : []
      };
      const { r, d: data } = await req('/api/users', { method: 'POST', body: JSON.stringify(payload) });
      if (!r.ok || !data.ok) {
        alert('创建账号失败：' + (data.error || data.message || r.status));
        return;
      }
      location.reload();
    }, true);
  }

  function injectSecurityUI() {
    const d = frame.contentDocument;
    if (!d) return;
    const top = d.querySelector('.topbar-actions');
    if (top && !d.getElementById('cloudUserBadge')) {
      const badge = d.createElement('span');
      badge.id = 'cloudUserBadge';
      badge.style.cssText = 'font-size:12px;color:#475467;white-space:nowrap';
      badge.textContent = `${user.displayName} · ${user.permissionGroup}`;
      top.prepend(badge);

      const guide = d.createElement('a');
      guide.href = './guide.html';
      guide.target = '_blank';
      guide.className = 'button secondary';
      guide.textContent = '使用说明';
      top.appendChild(guide);

      const out = d.createElement('button');
      out.className = 'button secondary';
      out.textContent = '退出';
      out.onclick = () => logout(false);
      top.appendChild(out);
    }

    const meta = d.querySelector('.sidebar-footer .user-meta');
    if (meta) meta.innerHTML = `<strong>${escapeHtml(user.displayName)}</strong><small>${escapeHtml(user.permissionGroup)}</small>`;
    const avatar = d.querySelector('.sidebar-footer .user-avatar');
    if (avatar) avatar.textContent = (user.displayName || 'U').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();

    d.querySelectorAll('[data-pool-filter="mine"],[data-pool-filter="team"]').forEach(x => x.style.display = 'none');
    if (!permissions('数据分析') && !permissions('小组数据分析')) d.querySelector('[data-view="reports"]')?.style.setProperty('display','none');
    if (!permissions('子账号管理') && !permissions('销售小组管理') && !permissions('权限组管理') && !permissions('系统设置')) d.querySelector('[data-view="settings"]')?.style.setProperty('display','none');
    if (!permissions('数据导出')) d.getElementById('exportBtn')?.style.setProperty('display','none');
    if (!permissions('成本利润')) {
      const st = d.createElement('style');
      st.textContent = '#view-orders th:nth-child(6),#view-orders td:nth-child(6){display:none!important}#orderKpis .mini-kpi:nth-child(3){display:none!important}';
      d.head.appendChild(st);
    }
    enhanceAccountForm(d);
  }

  async function poll() {
    if (document.hidden || dirty || syncing || !user) return;
    try {
      const { r, d } = await req('/api/state', {}, 6000);
      if (r.status === 401) { await logout(false); return; }
      if (r.ok && d.ok && d.revision !== revision) {
        showSync('数据库有新数据，点击刷新', 'update');
        syncbar.onclick = () => { setLocal(d.state); revision = d.revision; location.reload(); };
      }
    } catch (_) {}
  }

  async function start() {
    retryBtn.hidden = true;
    document.querySelector('.spin').style.display = 'block';

    try {
      setStage('正在连接数据库…', '正在检查数据库状态');
      const status = await req('/api/auth/status');
      if (!status.r.ok || !status.d.ok) {
        if (status.d.error === 'db_binding_missing') throw new Error('Cloudflare D1 绑定 DB 未生效');
        throw new Error(status.d.message || status.d.error || `状态接口 HTTP ${status.r.status}`);
      }
      if (status.d.setupRequired) {
        location.replace('./login.html?setup=1');
        return;
      }

      setStage('正在验证登录…', '正在读取当前账号权限');
      const me = await req('/api/auth/me');
      if (me.r.status === 401) {
        location.replace('./login.html');
        return;
      }
      if (!me.r.ok || !me.d.ok) throw new Error(me.d.message || me.d.error || `登录接口 HTTP ${me.r.status}`);
      user = me.d.user;

      setStage('正在读取数据…', '正在载入客户、跟进和订单');
      const stateRes = await req('/api/state', {}, 10000);
      if (stateRes.r.status === 401) {
        location.replace('./login.html');
        return;
      }
      if (!stateRes.r.ok || !stateRes.d.ok) throw new Error(stateRes.d.message || stateRes.d.error || `数据接口 HTTP ${stateRes.r.status}`);

      const oldText = localText();
      let remote = stateRes.d.state;
      revision = stateRes.d.revision;
      let old = {};
      try { old = JSON.parse(oldText || '{}'); } catch (_) {}

      if (user.permissionGroup === '超级管理员' && (remote.customers || []).length === 0 && (old.customers || []).length > 0 && !localStorage.getItem('pv-cloud-migration-choice')) {
        const yes = confirm(`检测到本机已有 ${(old.customers || []).length} 位客户，而数据库目前为空。\n\n确定：迁移本机数据到数据库。\n取消：清空本机旧数据并使用空数据库。`);
        localStorage.setItem('pv-cloud-migration-choice', yes ? 'import' : 'empty');
        if (yes) {
          setStage('正在迁移数据…', '正在把本机客户写入数据库');
          const im = await req('/api/state', { method: 'PUT', body: JSON.stringify({ revision, state: old }) }, 12000);
          if (!im.r.ok || !im.d.ok) throw new Error(im.d.message || im.d.error || '迁移失败');
          remote = im.d.state;
          revision = im.d.revision;
        }
      }

      setLocal(remote);
      setStage('正在启动 CRM…', '数据库连接正常');
      frame.onload = () => {
        injectSecurityUI();
        setTimeout(injectSecurityUI, 400);
        boot.style.display = 'none';
        frame.style.display = 'block';
        showSync('数据库 · 已同步');
      };
      frame.src = './v7.html?cloud=2';

      setInterval(markDirty, 400);
      setInterval(poll, 30000);
    } catch (e) {
      fatal('数据库连接失败', e?.message || String(e));
    }
  }

  retryBtn.addEventListener('click', () => location.reload());
  start();
})();
