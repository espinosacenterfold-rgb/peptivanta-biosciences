(() => {
  'use strict';
  const frame = document.getElementById('crmFrame');
  if (!frame) return;

  function ensureStyles(d) {
    if (d.getElementById('pvCustomerFormHelpStyles')) return;
    const st = d.createElement('style');
    st.id = 'pvCustomerFormHelpStyles';
    st.textContent = `
      #customerForm .pv-field-help{margin-top:5px;font-size:11px;color:#667085;line-height:1.55}
      #customerForm .pv-field-help summary{cursor:pointer;color:#315fbd;font-weight:600;list-style:none;user-select:none}
      #customerForm .pv-field-help summary::-webkit-details-marker{display:none}
      #customerForm .pv-field-help summary::before{content:'ⓘ';margin-right:4px;font-size:10px}
      #customerForm .pv-field-help[open]{border-left:2px solid #bfd2f5;padding-left:8px;margin-top:7px}
      #customerForm .pv-help-lines{display:grid;gap:3px;margin-top:6px;color:#475467}
      #customerForm .pv-help-lines b{color:#101828}
      #customerForm .pv-owner-note{margin-top:6px;color:#667085;font-size:11px;line-height:1.55}
    `;
    d.head.appendChild(st);
  }

  function patch(d) {
    const form = d.getElementById('customerForm');
    if (!form) return;
    ensureStyles(d);

    const grade = form.querySelector('select[name="grade"]');
    const gradeLabel = grade?.closest('label');
    if (gradeLabel && !gradeLabel.querySelector('[data-grade-help]')) {
      const help = d.createElement('details');
      help.className = 'pv-field-help';
      help.dataset.gradeHelp = '1';
      help.innerHTML = `<summary>等级怎么选？</summary><div class="pv-help-lines">
        <div><b>S</b>：核心 / 大额 / 强采购意向，最高优先级。</div>
        <div><b>A</b>：需求明确，近期成交可能较高，重点跟进。</div>
        <div><b>B</b>：有真实需求，但仍需确认或培育，正常跟进。</div>
        <div><b>C</b>：意向较弱、周期较长，低频维护。</div>
        <div><b>D</b>：无效、明确拒绝、失联或暂不继续跟进。</div>
      </div>`;
      gradeLabel.appendChild(help);
    }

    const owner = form.querySelector('select[name="owner"]');
    const ownerLabel = owner?.closest('label');
    if (ownerLabel && !ownerLabel.querySelector('[data-owner-help]')) {
      const help = d.createElement('details');
      help.className = 'pv-field-help';
      help.dataset.ownerHelp = '1';
      help.innerHTML = `<summary>客户归属说明</summary><div class="pv-help-lines">
        <div>销售创建：默认归本人，其他销售看不到。</div>
        <div>组长创建：默认归组长本人，组员看不到。</div>
        <div>只有明确转移负责人后，新负责人才能看到该客户。</div>
        <div>主管可查看其负责销售组；超级管理员可查看全部客户。</div>
      </div>`;
      ownerLabel.appendChild(help);
    }
  }

  function attach() {
    try { patch(frame.contentDocument); } catch (_) {}
  }

  frame.addEventListener('load', () => {
    setTimeout(attach, 100);
    setTimeout(attach, 600);
  });
  setInterval(attach, 1200);
})();
