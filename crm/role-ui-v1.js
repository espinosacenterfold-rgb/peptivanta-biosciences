(() => {
  'use strict';

  const frame = document.getElementById('crmFrame');
  if (!frame) return;

  const ROLES = {
    '普通销售': {
      label: '销售',
      scope: '仅本人数据',
      summary: '只看本人负责的客户、跟进和本人订单。',
      actions: '可新增/编辑本人客户、记录跟进、推进销售阶段和报价；不能查看其他销售数据、成本利润或账号设置。'
    },
    '二级管理员 / 组长': {
      label: '组长',
      scope: '本销售组',
      summary: '查看本组全部客户、跟进和订单。',
      actions: '可协助本组客户跟进、管道推进、报价以及查看本组数据；不能管理其他销售组和系统账号。'
    },
    '一级管理员': {
      label: '主管',
      scope: '所管理销售组',
      summary: '查看所负责销售组的全部客户和订单。',
      actions: '可转移客户、管理下级账号和销售组、查看负责范围的数据分析；不能进入超级管理员级系统设置或成本利润。'
    },
    '超级管理员': {
      label: '超级管理员',
      scope: '全部数据',
      summary: '查看和管理全部客户、订单、账号与系统配置。',
      actions: '包含成本利润、数据导出、账号与权限管理。超级管理员不通过“新增子账号”创建。'
    }
  };

  const ROLE_ORDER = ['普通销售', '二级管理员 / 组长', '一级管理员'];

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function roleLabel(v) { return ROLES[v]?.label || v || '—'; }

  function patchStyles(d) {
    if (d.getElementById('roleUiStyles')) return;
    const st = d.createElement('style');
    st.id = 'roleUiStyles';
    st.textContent = `
      .role-help-card{grid-column:1/-1;border:1px solid #d7e1ef;background:#f7f9fc;border-radius:6px;padding:12px 14px;margin-top:-2px}
      .role-help-card strong{display:block;font-size:13px;color:#172033;margin-bottom:4px}
      .role-help-card p{margin:3px 0;color:#667085;font-size:12px;line-height:1.55}
      .role-scope{display:inline-block;margin-left:6px;padding:1px 6px;border:1px solid #cbd7e8;border-radius:4px;background:#fff;color:#315f72;font-size:11px;font-weight:500}
      .role-guide-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:4px 0}
      .role-guide-card{border:1px solid #d9dee7;border-radius:7px;background:#fff;padding:15px}
      .role-guide-card h3{margin:0 0 5px;font-size:15px;color:#172033}
      .role-guide-card .scope{font-size:12px;color:#315f72;background:#eef4fb;border-radius:4px;padding:3px 7px;display:inline-block;margin-bottom:9px}
      .role-guide-card p{margin:5px 0;color:#667085;font-size:12px;line-height:1.6}
      .role-guide-card.super{border-color:#b9cbea;background:#f9fbff}
      .role-guide-note{margin-top:12px;border-left:3px solid #315fbd;background:#f5f8ff;padding:10px 12px;color:#475467;font-size:12px;line-height:1.6}
      @media(max-width:900px){.role-guide-grid{grid-template-columns:1fr}}
    `;
    d.head.appendChild(st);
  }

  function updateRoleHelp(d) {
    const sel = d.getElementById('accountPermissionSelect');
    const box = d.getElementById('roleHelpCard');
    if (!sel || !box) return;
    const r = ROLES[sel.value] || ROLES['普通销售'];
    box.innerHTML = `<strong>${esc(r.label)} <span class="role-scope">数据范围：${esc(r.scope)}</span></strong><p>${esc(r.summary)}</p><p>${esc(r.actions)}</p>`;

    const team = d.getElementById('accountTeamSelect');
    const teamLabel = team?.closest('label')?.querySelector('span');
    if (teamLabel) teamLabel.textContent = sel.value === '一级管理员' ? '管理销售组 *' : '所属销售小组 *';
  }

  function patchAccountModal(d) {
    const form = d.getElementById('accountForm');
    const sel = d.getElementById('accountPermissionSelect');
    if (!form || !sel) return;

    const current = ROLE_ORDER.includes(sel.value) ? sel.value : '普通销售';
    sel.innerHTML = ROLE_ORDER.map(v => `<option value="${esc(v)}">${esc(ROLES[v].label)}</option>`).join('');
    sel.value = current;

    const permissionLabel = sel.closest('label')?.querySelector('span');
    if (permissionLabel) permissionLabel.textContent = '账号角色 *';

    const wa = d.getElementById('accountWaSelect');
    const waLabel = wa?.closest('label')?.querySelector('span');
    if (waLabel) waLabel.textContent = '绑定 WhatsApp（可选）';

    const grid = form.querySelector('.form-grid');
    if (grid && !d.getElementById('roleHelpCard')) {
      const help = d.createElement('div');
      help.id = 'roleHelpCard';
      help.className = 'role-help-card';
      const roleLabelEl = sel.closest('label');
      if (roleLabelEl?.nextSibling) grid.insertBefore(help, roleLabelEl.nextSibling);
      else grid.appendChild(help);
    }

    if (!sel.dataset.roleUiBound) {
      sel.dataset.roleUiBound = '1';
      sel.addEventListener('change', () => updateRoleHelp(d));
    }
    updateRoleHelp(d);
  }

  function patchAccountsTable(d) {
    const content = d.getElementById('settingsContent');
    if (!content) return;
    const table = content.querySelector('.setting-table');
    if (!table) return;

    const heads = table.querySelectorAll('thead th');
    if (heads[2]) heads[2].textContent = '角色';
    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells[2]) cells[2].textContent = roleLabel(cells[2].textContent.trim());
    });

    const title = content.querySelector('.settings-toolbar h2');
    const desc = content.querySelector('.settings-toolbar p');
    if (title) title.textContent = '子账号管理';
    if (desc) desc.textContent = '创建账号时只需要选择角色和销售组，系统自动套用对应的数据范围与功能权限。';

    const aside = content.querySelector('.settings-grid > aside.panel');
    if (aside) {
      aside.innerHTML = `<div class="settings-toolbar"><div><h2>角色怎么选</h2><p>按人员职责选择，不需要逐项勾权限。</p></div></div>
        <div class="system-note"><b>销售</b>：只处理自己的客户。<br><br><b>组长</b>：查看并协助整个销售组。<br><br><b>主管</b>：管理所负责销售组和下级账号。<br><br><b>超级管理员</b>：仅保留给系统最高管理账号。</div>`;
    }
  }

  function renderPermissionGuide(d) {
    const content = d.getElementById('settingsContent');
    const active = d.querySelector('[data-settings-tab="permissions"].active');
    if (!content || !active) return;
    if (content.dataset.roleGuide === '1') return;
    content.dataset.roleGuide = '1';
    const order = ['普通销售','二级管理员 / 组长','一级管理员','超级管理员'];
    content.innerHTML = `<article class="panel full-panel"><div class="settings-toolbar"><div><h2>角色权限</h2><p>权限由角色统一控制。新增账号时只选择角色，不需要逐项配置。</p></div></div><div class="role-guide-grid">${order.map(v => {
      const r = ROLES[v];
      return `<div class="role-guide-card ${v === '超级管理员' ? 'super' : ''}"><h3>${esc(r.label)}</h3><span class="scope">${esc(r.scope)}</span><p><b>可见数据：</b>${esc(r.summary)}</p><p><b>主要能力：</b>${esc(r.actions)}</p></div>`;
    }).join('')}</div><div class="role-guide-note">角色决定“能看多大范围的数据”和“能执行哪些操作”。客户归属仍跟随负责人和销售组，不会因为调整角色而自动改变客户负责人。</div></article>`;
  }

  function patchSettings(d) {
    patchStyles(d);
    const active = d.querySelector('[data-settings-tab].active')?.dataset.settingsTab;
    const content = d.getElementById('settingsContent');
    if (!content) return;
    if (active !== 'permissions') delete content.dataset.roleGuide;
    if (active === 'accounts') patchAccountsTable(d);
    if (active === 'permissions') renderPermissionGuide(d);

    const tab = d.querySelector('[data-settings-tab="permissions"]');
    if (tab) tab.textContent = '角色权限';
  }

  function install(d) {
    if (!d || d.documentElement.dataset.roleUiInstalled === '1') return;
    d.documentElement.dataset.roleUiInstalled = '1';
    patchStyles(d);

    d.addEventListener('click', e => {
      if (e.target.closest('#addAccountBtn')) setTimeout(() => patchAccountModal(d), 0);
      if (e.target.closest('[data-settings-tab]')) setTimeout(() => patchSettings(d), 0);
    }, true);

    const settings = d.getElementById('settingsContent');
    if (settings) {
      let pending = false;
      new MutationObserver(() => {
        if (pending) return;
        pending = true;
        setTimeout(() => { pending = false; patchSettings(d); }, 0);
      }).observe(settings, { childList:true, subtree:true });
    }

    patchSettings(d);
    patchAccountModal(d);
    setTimeout(() => { patchSettings(d); patchAccountModal(d); }, 500);
  }

  function attach() {
    try { install(frame.contentDocument); } catch (_) {}
  }

  frame.addEventListener('load', () => {
    setTimeout(attach, 50);
    setTimeout(attach, 500);
  });
  setInterval(attach, 1500);
})();
