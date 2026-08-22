(() => {
  const STORAGE_KEY = "peptivanta-crm-v1";
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const offsetDate = (days) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const stageMeta = {
    new: { label: "新线索", probability: 15 },
    qualifying: { label: "需求确认", probability: 35 },
    quoted: { label: "已报价", probability: 60 },
    payment: { label: "待付款", probability: 82 },
    fulfillment: { label: "已付款 / 发货", probability: 100 },
    repeat: { label: "复购", probability: 100 },
  };
  const stageOrder = Object.keys(stageMeta);

  const seedState = () => ({
    customers: [
      {
        id: "PV-260823-001", name: "Alex Morgan", country: "United States", company: "Independent reseller", type: "经销商",
        contact: "+1 *** *** 1820", source: "Facebook Ads", product: "Tirzepatide 10mg", stage: "quoted", grade: "A", value: 860,
        nextFollowUp: offsetDate(0), lastContact: offsetDate(-1), createdAt: offsetDate(-5), language: "English", risk: "低", owner: "Sales Admin",
        concern: "价格 / COA / 物流时效", note: "已发送价格和 COA，客户正在比较第二家供应商。",
        timeline: [
          { date: offsetDate(-1), type: "报价", text: "发送 Tirzepatide 报价和 COA，并确认目的地。" },
          { date: offsetDate(-4), type: "需求确认", text: "客户确认初次采购，希望先做小批量测试。" },
          { date: offsetDate(-5), type: "首次咨询", text: "来自 Facebook 广告，询问产品目录和最低起订量。" },
        ]
      },
      {
        id: "PV-260823-002", name: "Sofia Bennett", country: "Canada", company: "Research supply buyer", type: "机构采购",
        contact: "+1 *** *** 5246", source: "Website", product: "Retatrutide 20mg", stage: "qualifying", grade: "S", value: 4200,
        nextFollowUp: offsetDate(-1), lastContact: offsetDate(-2), createdAt: offsetDate(-8), language: "English", risk: "待审核", owner: "Sales Admin",
        concern: "COA / HPLC / MS / 样品", note: "大额潜在采购。先做资质与需求审核，不直接承诺样品。",
        timeline: [
          { date: offsetDate(-2), type: "资料审核", text: "客户提供公司信息，要求实验室检测文件。" },
          { date: offsetDate(-5), type: "需求确认", text: "询问长期供应与样品评估流程。" },
          { date: offsetDate(-8), type: "首次咨询", text: "网站进入，称正在拓展供应商网络。" },
        ]
      },
      {
        id: "PV-260823-003", name: "Daniel Reed", country: "Australia", company: "Private buyer", type: "个人客户",
        contact: "+61 *** *** 903", source: "Facebook Ads", product: "GHK-Cu 50mg", stage: "payment", grade: "A", value: 520,
        nextFollowUp: offsetDate(0), lastContact: offsetDate(0), createdAt: offsetDate(-3), language: "English", risk: "低", owner: "Sales Admin",
        concern: "付款 / 发货", note: "客户已确认订单，等待付款完成。",
        timeline: [
          { date: offsetDate(0), type: "付款", text: "发送最终金额和付款信息，等待到账。" },
          { date: offsetDate(-1), type: "报价", text: "确认产品规格、数量和国际运费。" },
          { date: offsetDate(-3), type: "首次咨询", text: "询问 GHK-Cu 批量价格。" },
        ]
      },
      {
        id: "PV-260823-004", name: "Marco Ruiz", country: "Mexico", company: "Wellness retailer", type: "零售商",
        contact: "+52 *** *** 761", source: "WhatsApp", product: "Tirzepatide 5mg", stage: "new", grade: "B", value: 310,
        nextFollowUp: offsetDate(1), lastContact: offsetDate(0), createdAt: offsetDate(0), language: "Español", risk: "低", owner: "Sales Admin",
        concern: "MOQ / 目录", note: "刚进入的新线索，先确认实际采购用途和数量。",
        timeline: [ { date: offsetDate(0), type: "首次咨询", text: "WhatsApp 主动咨询价格表和 MOQ。" } ]
      },
      {
        id: "PV-260823-005", name: "Emily Carter", country: "United States", company: "Boutique distributor", type: "经销商",
        contact: "+1 *** *** 4471", source: "Referral", product: "5-Amino-1MQ 50mg", stage: "fulfillment", grade: "A", value: 1280,
        nextFollowUp: offsetDate(5), lastContact: offsetDate(-1), createdAt: offsetDate(-18), language: "English", risk: "低", owner: "Sales Admin",
        concern: "Tracking / 签收", note: "已付款发货，下一步关注签收后满意度和复购周期。",
        timeline: [
          { date: offsetDate(-1), type: "物流", text: "Tracking 已更新，包裹运输中。" },
          { date: offsetDate(-4), type: "发货", text: "完成备货并交付物流。" },
          { date: offsetDate(-6), type: "付款", text: "确认到账并进入备货。" },
        ]
      },
      {
        id: "PV-260823-006", name: "Noah Williams", country: "United Kingdom", company: "Research customer", type: "科研客户",
        contact: "+44 *** *** 199", source: "Facebook Ads", product: "BPC-157 10mg", stage: "repeat", grade: "B", value: 740,
        nextFollowUp: offsetDate(7), lastContact: offsetDate(-9), createdAt: offsetDate(-46), language: "English", risk: "低", owner: "Sales Admin",
        concern: "复购 / 现货", note: "首单已完成，预计下周做复购回访。",
        timeline: [
          { date: offsetDate(-9), type: "售后", text: "确认签收，无物流异常。" },
          { date: offsetDate(-21), type: "订单", text: "完成首单采购。" },
          { date: offsetDate(-46), type: "首次咨询", text: "广告进入，先索要目录。" },
        ]
      },
      {
        id: "PV-260823-007", name: "Mia Thompson", country: "United States", company: "Individual", type: "个人客户",
        contact: "+1 *** *** 6034", source: "Facebook Ads", product: "Retatrutide 10mg", stage: "quoted", grade: "C", value: 260,
        nextFollowUp: offsetDate(-3), lastContact: offsetDate(-6), createdAt: offsetDate(-12), language: "English", risk: "低", owner: "Sales Admin",
        concern: "价格", note: "报价后未回复，适合轻度唤醒，不要连续追问。",
        timeline: [
          { date: offsetDate(-6), type: "回访", text: "报价后第一次轻度回访，暂无回复。" },
          { date: offsetDate(-9), type: "报价", text: "发送价格和基础产品资料。" },
        ]
      },
    ],
    orders: [
      { id: "SO-2608-018", customerId: "PV-260823-005", customer: "Emily Carter", product: "5-Amino-1MQ 50mg", amount: 1280, cost: 711, payment: "已付款", logistics: "运输中", tracking: "FX-•••-1842", date: offsetDate(-6) },
      { id: "SO-2608-013", customerId: "PV-260823-006", customer: "Noah Williams", product: "BPC-157 10mg", amount: 740, cost: 408, payment: "已付款", logistics: "已签收", tracking: "FX-•••-9071", date: offsetDate(-21) },
      { id: "SO-2608-020", customerId: "PV-260823-003", customer: "Daniel Reed", product: "GHK-Cu 50mg", amount: 520, cost: 286, payment: "待付款", logistics: "待发货", tracking: "—", date: offsetDate(0) },
    ],
    tasksDone: [],
    activityLog: []
  });

  let state = loadState();
  let activeView = "dashboard";
  let leadFilter = "all";
  let queueFilter = "all";
  let taskFilter = "open";
  let searchTerm = "";
  let selectedCustomerId = null;
  let drawerTab = "overview";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const fmtMoney = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n || 0));
  const fmtDate = (iso) => {
    if (!iso) return "未安排";
    const d = new Date(`${iso}T12:00:00`);
    return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(d);
  };
  const initials = (name) => name.split(/\s+/).map(x => x[0]).join("").slice(0,2).toUpperCase();
  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedState();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.customers) || !Array.isArray(parsed.orders)) return seedState();
      parsed.tasksDone ||= [];
      parsed.activityLog ||= [];
      return parsed;
    } catch { return seedState(); }
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  function dayState(date) {
    if (!date) return { key: "future", text: "未安排" };
    const t = todayISO();
    if (date < t) return { key: "overdue", text: `逾期 ${Math.max(1, diffDays(date, t))} 天` };
    if (date === t) return { key: "today", text: "今天" };
    return { key: "future", text: `${fmtDate(date)}` };
  }
  function diffDays(a, b) {
    const aa = new Date(`${a}T12:00:00`), bb = new Date(`${b}T12:00:00`);
    return Math.round((bb - aa) / 86400000);
  }
  function customerTaskId(c) { return `follow-${c.id}-${c.nextFollowUp || "none"}`; }
  function isTaskDone(c) { return state.tasksDone.includes(customerTaskId(c)); }

  function stagePill(stage) {
    const meta = stageMeta[stage] || stageMeta.new;
    return `<span class="stage-pill ${stage}">${meta.label}</span>`;
  }
  function gradePill(grade) { return `<span class="grade-pill ${grade}">${grade}</span>`; }
  function avatarClass(name) {
    const classes = ["", "purple", "green", "orange", "gray"];
    let sum = 0; for (const ch of name) sum += ch.charCodeAt(0);
    return classes[sum % classes.length];
  }

  function renderAll() {
    renderKpis(); renderQueue(); renderFunnel(); renderRecentLeads(); renderLeads(); renderPipeline(); renderFollowups(); renderOrders(); renderReports(); renderBadges();
    if (selectedCustomerId) renderDrawer(selectedCustomerId);
  }

  function renderKpis() {
    const t = todayISO();
    const dueToday = state.customers.filter(c => c.nextFollowUp === t && !isTaskDone(c)).length;
    const overdue = state.customers.filter(c => c.nextFollowUp && c.nextFollowUp < t && !isTaskDone(c)).length;
    const payment = state.customers.filter(c => c.stage === "payment").length;
    const won = state.orders.filter(o => o.payment === "已付款").reduce((s,o) => s + o.amount, 0);
    const kpis = [
      { label:"今日待跟进", value: dueToday, foot:"今天必须处理的客户", icon:"◷", cls:"warning" },
      { label:"逾期跟进", value: overdue, foot:"按逾期天数优先处理", icon:"!", cls:"danger" },
      { label:"待付款机会", value: payment, foot:`机会金额 ${fmtMoney(state.customers.filter(c=>c.stage==='payment').reduce((s,c)=>s+c.value,0))}`, icon:"$", cls:"" },
      { label:"已收订单额", value: fmtMoney(won), foot:`${state.orders.filter(o=>o.payment==='已付款').length} 笔已付款订单`, icon:"↗", cls:"success" },
    ];
    $("#kpiGrid").innerHTML = kpis.map(k => `<div class="kpi-card ${k.cls}"><div class="kpi-top"><span class="kpi-label">${k.label}</span><span class="kpi-icon">${k.icon}</span></div><div class="kpi-value">${k.value}</div><div class="kpi-foot">${k.foot}</div></div>`).join("");
  }

  function actionableCustomers() {
    return [...state.customers]
      .filter(c => c.nextFollowUp && !isTaskDone(c))
      .sort((a,b) => a.nextFollowUp.localeCompare(b.nextFollowUp) || b.value - a.value);
  }

  function renderQueue() {
    let rows = actionableCustomers();
    const t = todayISO();
    if (queueFilter === "overdue") rows = rows.filter(c => c.nextFollowUp < t);
    if (queueFilter === "today") rows = rows.filter(c => c.nextFollowUp === t);
    rows = rows.slice(0, 7);
    const el = $("#todayQueue");
    if (!rows.length) { el.innerHTML = `<div class="empty-state">当前筛选下没有待处理客户。</div>`; return; }
    el.innerHTML = rows.map(c => {
      const due = dayState(c.nextFollowUp);
      const action = getNextAction(c);
      return `<div class="queue-row customer-open" data-id="${c.id}">
        <div class="queue-priority ${due.key}">${due.key === "overdue" ? "!" : due.key === "today" ? "今" : "→"}</div>
        <div class="customer-cell"><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(c.country)} · ${escapeHtml(c.product)}</span></div>
        <div class="queue-action"><strong>${action.title}</strong><span>${action.sub}</span></div>
        <div class="date-state ${due.key}">${due.text}</div>
        <div class="queue-grade">${gradePill(c.grade)}</div>
        <button class="row-menu" aria-label="打开客户">›</button>
      </div>`;
    }).join("");
    bindCustomerOpeners(el);
  }

  function getNextAction(c) {
    const map = {
      new: ["确认采购需求", "用途、数量、规格、目的地"],
      qualifying: ["完成需求审核", "确认资质、文件与采购计划"],
      quoted: ["报价后推进", "确认价格反馈与下一步"],
      payment: ["推动付款确认", "确认付款方式与到账"],
      fulfillment: ["物流 / 签收跟进", "Tracking、清关、签收状态"],
      repeat: ["复购回访", "确认库存与下一采购周期"],
    };
    const [title, sub] = map[c.stage] || map.new;
    return { title, sub };
  }

  function renderFunnel() {
    const counts = stageOrder.map(stage => ({ stage, count: state.customers.filter(c => c.stage === stage).length }));
    const max = Math.max(1, ...counts.map(x => x.count));
    $("#funnelList").innerHTML = counts.map(x => `<div class="funnel-row"><div class="funnel-label">${stageMeta[x.stage].label}</div><div class="funnel-track"><div class="funnel-fill" style="width:${(x.count/max)*100}%"></div></div><div class="funnel-value">${x.count}</div></div>`).join("");
    const openValue = state.customers.filter(c => !["fulfillment","repeat"].includes(c.stage)).reduce((s,c)=>s+c.value,0);
    const hot = state.customers.filter(c => ["S","A"].includes(c.grade)).length;
    $("#pipelineHealth").innerHTML = `<div class="health-top"><strong>Pipeline Health</strong><span>实时</span></div><div class="health-metrics"><div class="health-metric"><b>${fmtMoney(openValue)}</b><small>开放机会金额</small></div><div class="health-metric"><b>${hot}</b><small>S/A 重点客户</small></div></div>`;
  }

  function renderRecentLeads() {
    const rows = [...state.customers].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,6);
    $("#recentLeadsBody").innerHTML = rows.map(customerRowLite).join("");
    bindCustomerOpeners($("#recentLeadsBody"));
  }
  function customerRowLite(c) {
    const due = dayState(c.nextFollowUp);
    return `<tr class="customer-open" data-id="${c.id}">
      <td><div class="avatar-name"><span class="avatar ${avatarClass(c.name)}">${initials(c.name)}</span><div><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.id)}</small></div></div></td>
      <td>${escapeHtml(c.country)}</td><td>${escapeHtml(c.product)}</td><td>${stagePill(c.stage)}</td><td>${gradePill(c.grade)}</td>
      <td><span class="date-state ${due.key}">${due.text}</span></td><td class="money">${fmtMoney(c.value)}</td><td><button class="row-menu">›</button></td>
    </tr>`;
  }

  function filteredCustomers() {
    let rows = [...state.customers];
    const q = searchTerm.trim().toLowerCase();
    if (q) rows = rows.filter(c => [c.name,c.country,c.company,c.type,c.product,c.source,c.id].join(" ").toLowerCase().includes(q));
    if (leadFilter === "hot") rows = rows.filter(c => ["S","A"].includes(c.grade));
    if (leadFilter === "unanswered") rows = rows.filter(c => c.nextFollowUp && c.nextFollowUp < todayISO());
    if (leadFilter === "quoted") rows = rows.filter(c => c.stage === "quoted");
    if (leadFilter === "repeat") rows = rows.filter(c => c.stage === "repeat");
    return rows.sort((a,b) => (a.nextFollowUp || "9999").localeCompare(b.nextFollowUp || "9999") || b.value-a.value);
  }

  function renderLeads() {
    const rows = filteredCustomers();
    $("#leadResultCount").textContent = rows.length;
    $("#leadsBody").innerHTML = rows.map(c => {
      const due = dayState(c.nextFollowUp), prob = stageMeta[c.stage]?.probability ?? 15;
      return `<tr class="customer-open" data-id="${c.id}">
        <td><div class="avatar-name"><span class="avatar ${avatarClass(c.name)}">${initials(c.name)}</span><div><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.contact || c.id)}</small></div></div></td>
        <td><strong>${escapeHtml(c.company)}</strong><div class="muted">${escapeHtml(c.type)}</div></td>
        <td>${escapeHtml(c.country)}</td><td>${escapeHtml(c.source)}</td><td>${escapeHtml(c.product)}</td><td>${stagePill(c.stage)}</td><td>${gradePill(c.grade)}</td>
        <td><div class="probability"><div class="probability-track"><i style="width:${prob}%"></i></div><span>${prob}%</span></div></td>
        <td><span class="date-state ${due.key}">${due.text}</span></td><td class="money">${fmtMoney(c.value)}</td><td><button class="row-menu">⋯</button></td>
      </tr>`;
    }).join("");
    bindCustomerOpeners($("#leadsBody"));
  }

  function renderPipeline() {
    const openValue = state.customers.filter(c => !["fulfillment","repeat"].includes(c.stage)).reduce((s,c)=>s+c.value,0);
    const weighted = state.customers.reduce((s,c)=>s+c.value*((stageMeta[c.stage]?.probability||0)/100),0);
    $("#pipelineSummary").innerHTML = `<div class="summary-chip"><small>开放机会</small><strong>${fmtMoney(openValue)}</strong></div><div class="summary-chip"><small>加权预测</small><strong>${fmtMoney(weighted)}</strong></div>`;
    $("#kanbanBoard").innerHTML = stageOrder.map(stage => {
      const customers = state.customers.filter(c=>c.stage===stage).sort((a,b)=>(a.nextFollowUp||"9999").localeCompare(b.nextFollowUp||"9999"));
      const value = customers.reduce((s,c)=>s+c.value,0);
      return `<section class="kanban-column" data-stage="${stage}">
        <div class="kanban-head"><div class="kanban-title"><strong>${stageMeta[stage].label}</strong><span class="kanban-count">${customers.length}</span></div><div class="kanban-value">${fmtMoney(value)}</div></div>
        <div class="kanban-cards">${customers.map(dealCard).join("")}</div>
      </section>`;
    }).join("");
    bindKanban();
    bindCustomerOpeners($("#kanbanBoard"));
  }
  function dealCard(c) {
    const due = dayState(c.nextFollowUp);
    return `<article class="deal-card customer-open" draggable="true" data-id="${c.id}">
      <div class="deal-card-top"><div><h3>${escapeHtml(c.name)}</h3><div class="deal-product">${escapeHtml(c.product)}</div></div>${gradePill(c.grade)}</div>
      <div class="deal-card-tags"><span class="mini-tag">${escapeHtml(c.country)}</span><span class="mini-tag ${["S","A"].includes(c.grade)?"hot":""}">${escapeHtml(c.source)}</span></div>
      <div class="deal-card-footer"><strong>${fmtMoney(c.value)}</strong><span class="deal-due"><i class="activity-dot ${due.key}"></i>${due.text}</span></div>
    </article>`;
  }
  function bindKanban() {
    $$(".deal-card").forEach(card => {
      card.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", card.dataset.id); card.classList.add("dragging"); });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    });
    $$(".kanban-column").forEach(col => {
      col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("drag-over"); });
      col.addEventListener("dragleave", e => { if (!col.contains(e.relatedTarget)) col.classList.remove("drag-over"); });
      col.addEventListener("drop", e => {
        e.preventDefault(); col.classList.remove("drag-over");
        const id = e.dataTransfer.getData("text/plain"), stage = col.dataset.stage;
        const c = state.customers.find(x=>x.id===id); if (!c || c.stage===stage) return;
        const old = c.stage; c.stage = stage; c.lastContact = todayISO();
        c.timeline.unshift({ date: todayISO(), type: "阶段更新", text: `销售阶段从「${stageMeta[old].label}」调整为「${stageMeta[stage].label}」。` });
        saveState(); renderAll(); toast(`已移动到「${stageMeta[stage].label}」`);
      });
    });
  }

  function renderFollowups() {
    const rows = [...state.customers].filter(c => c.nextFollowUp).sort((a,b)=>a.nextFollowUp.localeCompare(b.nextFollowUp));
    const filtered = rows.filter(c => taskFilter === "done" ? isTaskDone(c) : !isTaskDone(c));
    $("#followupList").innerHTML = filtered.length ? filtered.map(c => {
      const due = dayState(c.nextFollowUp), action = getNextAction(c), done = isTaskDone(c);
      return `<div class="task-row customer-open" data-id="${c.id}">
        <button class="task-checkbox ${done?"done":""}" data-task-id="${c.id}" aria-label="${done?"恢复":"完成"}任务">✓</button>
        <div class="task-main"><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(c.product)} · ${escapeHtml(c.country)}</span></div>
        <div class="task-type"><strong>${action.title}</strong><div>${action.sub}</div></div>
        <div>${stagePill(c.stage)}</div><div class="date-state ${due.key}">${due.text}</div>
      </div>`;
    }).join("") : `<div class="empty-state">这一栏已经处理完了。</div>`;
    $$(".task-checkbox", $("#followupList")).forEach(btn => btn.addEventListener("click", e => {
      e.stopPropagation(); toggleTask(btn.dataset.taskId);
    }));
    bindCustomerOpeners($("#followupList"));
    renderFocusCard();
  }
  function toggleTask(customerId) {
    const c = state.customers.find(x=>x.id===customerId); if (!c) return;
    const id = customerTaskId(c), idx = state.tasksDone.indexOf(id);
    if (idx >= 0) state.tasksDone.splice(idx,1); else state.tasksDone.push(id);
    saveState(); renderAll(); toast(idx>=0 ? "任务已恢复" : "跟进已标记完成");
  }
  function renderFocusCard() {
    const open = actionableCustomers();
    const target = open[0];
    if (!target) { $("#focusCard").innerHTML = `<span class="eyebrow">NEXT BEST ACTION</span><h3>今日已清空</h3><p>当前没有未完成跟进。</p>`; return; }
    const action = getNextAction(target), due = dayState(target.nextFollowUp);
    $("#focusCard").innerHTML = `<span class="eyebrow">NEXT BEST ACTION</span><h3>${escapeHtml(target.name)}</h3><p>当前最优先处理的客户。系统依据跟进日期与机会状态排序。</p><div class="focus-list"><div class="focus-item"><small>建议动作</small><strong>${action.title}</strong></div><div class="focus-item"><small>当前阶段</small><strong>${stageMeta[target.stage].label}</strong></div><div class="focus-item"><small>到期状态</small><strong class="date-state ${due.key}">${due.text}</strong></div><div class="focus-item"><small>机会金额</small><strong>${fmtMoney(target.value)}</strong></div></div><button class="button primary" style="width:100%;margin-top:12px" data-focus-open="${target.id}">打开客户详情</button>`;
    $("[data-focus-open]")?.addEventListener("click", () => openDrawer(target.id));
  }

  function renderOrders() {
    const paid = state.orders.filter(o=>o.payment==="已付款").reduce((s,o)=>s+o.amount,0);
    const pending = state.orders.filter(o=>o.payment!=="已付款").reduce((s,o)=>s+o.amount,0);
    const profit = state.orders.reduce((s,o)=>s+(o.amount-o.cost),0);
    const inTransit = state.orders.filter(o=>["运输中","待发货"].includes(o.logistics)).length;
    $("#orderKpis").innerHTML = [
      ["已收金额",fmtMoney(paid)],["待收金额",fmtMoney(pending)],["累计毛利润",fmtMoney(profit)],["待履约订单",inTransit]
    ].map(([a,b])=>`<div class="order-kpi"><small>${a}</small><strong>${b}</strong></div>`).join("");
    $("#ordersBody").innerHTML = [...state.orders].sort((a,b)=>b.date.localeCompare(a.date)).map(o => {
      const p = o.amount - o.cost;
      return `<tr data-order-customer="${o.customerId}"><td><strong>${escapeHtml(o.id)}</strong></td><td>${escapeHtml(o.customer)}</td><td>${escapeHtml(o.product)}</td><td class="money">${fmtMoney(o.amount)}</td><td>${fmtMoney(o.cost)}</td><td class="profit-positive">+${fmtMoney(p)}</td><td><span class="status-pill ${o.payment==='已付款'?'success':'warning'}">${o.payment}</span></td><td><span class="status-pill ${o.logistics==='已签收'?'success':o.logistics==='运输中'?'neutral':'warning'}">${o.logistics}</span></td><td>${escapeHtml(o.tracking)}</td><td>${fmtDate(o.date)}</td></tr>`;
    }).join("");
    $$('[data-order-customer]').forEach(row=>row.addEventListener("click",()=>openDrawer(row.dataset.orderCustomer)));
  }

  function renderReports() {
    const months = ["4月","5月","6月","7月","8月","9月"];
    const leadVals = [12,18,23,31,state.customers.length,0], salesVals=[2,4,7,9,state.orders.filter(o=>o.payment==='已付款').length,0];
    const max = Math.max(...leadVals,...salesVals,1);
    $("#monthlyChart").innerHTML = months.map((m,i)=>`<div class="month-bar-group"><div class="bar" style="height:${(leadVals[i]/max)*75+4}%" data-value="线索 ${leadVals[i]}"></div><div class="bar sales" style="height:${(salesVals[i]/max)*75+4}%" data-value="成交 ${salesVals[i]}"></div><span class="month-label">${m}</span></div>`).join("");
    renderRank("#sourceChart", countBy(state.customers,"source"));
    renderRank("#countryChart", countBy(state.customers,"country"));
    const products = countBy(state.customers,"product").slice(0,5), pmax=Math.max(...products.map(x=>x.value),1);
    $("#productChart").innerHTML = products.map(x=>`<div class="product-column"><div class="column-value">${x.value}</div><div class="column-bar" style="height:${Math.max(15,(x.value/pmax)*180)}px"></div><div class="column-label">${escapeHtml(x.label)}</div></div>`).join("");
  }
  function countBy(arr,key) {
    const map={}; arr.forEach(x=>map[x[key]]=(map[x[key]]||0)+1); return Object.entries(map).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
  }
  function renderRank(selector, data) {
    const max=Math.max(...data.map(x=>x.value),1);
    $(selector).innerHTML=data.map(x=>`<div class="rank-row"><div class="rank-label">${escapeHtml(x.label)}</div><div class="rank-track"><i style="width:${(x.value/max)*100}%"></i></div><div class="rank-value">${x.value}</div></div>`).join("");
  }

  function renderBadges() {
    $("#leadCountBadge").textContent = state.customers.length;
    $("#followCountBadge").textContent = actionableCustomers().filter(c=>c.nextFollowUp<=todayISO()).length;
  }

  function bindCustomerOpeners(root=document) {
    $$(".customer-open", root).forEach(el => {
      el.addEventListener("click", e => {
        if (e.target.closest(".task-checkbox")) return;
        openDrawer(el.dataset.id);
      });
    });
  }

  function openDrawer(id) {
    selectedCustomerId = id; drawerTab = "overview"; renderDrawer(id);
    $("#customerDrawer").classList.add("open"); $("#drawerBackdrop").classList.add("open"); $("#customerDrawer").setAttribute("aria-hidden","false");
  }
  function closeDrawer() {
    selectedCustomerId=null; $("#customerDrawer").classList.remove("open"); $("#drawerBackdrop").classList.remove("open"); $("#customerDrawer").setAttribute("aria-hidden","true");
  }
  function renderDrawer(id) {
    const c=state.customers.find(x=>x.id===id); if(!c) return closeDrawer();
    const due=dayState(c.nextFollowUp), orders=state.orders.filter(o=>o.customerId===c.id), total=orders.reduce((s,o)=>s+o.amount,0), action=getNextAction(c);
    $("#drawerContent").innerHTML = `
      <div class="drawer-head"><div class="drawer-head-top"><div class="drawer-person"><span class="avatar ${avatarClass(c.name)}">${initials(c.name)}</span><div><h2>${escapeHtml(c.name)}</h2><p>${escapeHtml(c.company)} · ${escapeHtml(c.country)}</p></div></div><button class="icon-button" id="drawerClose">×</button></div>
      <div class="drawer-status-row">${stagePill(c.stage)} ${gradePill(c.grade)} <span class="status-pill neutral">${escapeHtml(c.type)}</span><span class="status-pill ${c.risk==='低'?'success':'warning'}">风险 ${escapeHtml(c.risk)}</span></div></div>
      <div class="drawer-tabs"><button data-drawer-tab="overview" class="${drawerTab==='overview'?'active':''}">概览</button><button data-drawer-tab="timeline" class="${drawerTab==='timeline'?'active':''}">跟进时间线</button><button data-drawer-tab="orders" class="${drawerTab==='orders'?'active':''}">订单 (${orders.length})</button></div>
      <div class="drawer-body">${drawerTab==='overview'?drawerOverview(c,due,action,total):drawerTab==='timeline'?drawerTimeline(c):drawerOrders(orders)}</div>`;
    $("#drawerClose").addEventListener("click",closeDrawer);
    $$("[data-drawer-tab]").forEach(btn=>btn.addEventListener("click",()=>{drawerTab=btn.dataset.drawerTab;renderDrawer(id);}));
    $("#saveNoteBtn")?.addEventListener("click",()=>saveNote(c.id));
    $("#scheduleFollowBtn")?.addEventListener("click",()=>scheduleTomorrow(c.id));
    $("#markFollowDoneBtn")?.addEventListener("click",()=>toggleTask(c.id));
  }
  function drawerOverview(c,due,action,total) {
    return `<div class="drawer-section"><div class="drawer-section-title"><h3>销售动作</h3></div><div class="drawer-actions"><button class="button primary" id="markFollowDoneBtn">✓ 完成本次跟进</button><button class="button secondary" id="scheduleFollowBtn">＋ 明天继续跟进</button></div></div>
    <div class="drawer-section"><div class="drawer-section-title"><h3>客户信息</h3></div><div class="info-grid">
      <div class="info-card"><small>联系方式</small><strong>${escapeHtml(c.contact||'未填写')}</strong></div><div class="info-card"><small>语言</small><strong>${escapeHtml(c.language||'未确认')}</strong></div>
      <div class="info-card"><small>来源</small><strong>${escapeHtml(c.source)}</strong></div><div class="info-card"><small>负责人</small><strong>${escapeHtml(c.owner||'Sales Admin')}</strong></div>
      <div class="info-card"><small>客户编号</small><strong>${escapeHtml(c.id)}</strong></div><div class="info-card"><small>首次建档</small><strong>${fmtDate(c.createdAt)}</strong></div>
    </div></div>
    <div class="drawer-section"><div class="drawer-section-title"><h3>当前机会</h3></div><div class="info-grid">
      <div class="info-card"><small>主要需求</small><strong>${escapeHtml(c.product)}</strong></div><div class="info-card"><small>机会金额</small><strong>${fmtMoney(c.value)}</strong></div>
      <div class="info-card"><small>下一步</small><strong>${action.title}</strong></div><div class="info-card"><small>下次跟进</small><strong class="date-state ${due.key}">${due.text}</strong></div>
      <div class="info-card"><small>客户关注点</small><strong>${escapeHtml(c.concern||'未记录')}</strong></div><div class="info-card"><small>历史订单额</small><strong>${fmtMoney(total)}</strong></div>
    </div></div>
    <div class="drawer-section"><div class="drawer-section-title"><h3>销售备注</h3></div><div class="note-box"><textarea id="noteInput" rows="3" placeholder="记录这次沟通的重点…"></textarea><button class="button secondary small" id="saveNoteBtn">保存跟进记录</button></div></div>
    <div class="drawer-section"><div class="drawer-section-title"><h3>当前备注</h3></div><div class="info-card"><strong>${escapeHtml(c.note||'暂无备注')}</strong></div></div>`;
  }
  function drawerTimeline(c) {
    const items=[...(c.timeline||[])].sort((a,b)=>b.date.localeCompare(a.date));
    return `<div class="drawer-section"><div class="drawer-section-title"><h3>完整沟通记录</h3></div><div class="timeline">${items.map(x=>`<div class="timeline-item"><strong>${escapeHtml(x.type)}</strong><p>${escapeHtml(x.text)}</p><time>${fmtDate(x.date)}</time></div>`).join("")||'<p class="muted">暂无记录</p>'}</div></div>`;
  }
  function drawerOrders(orders) {
    if(!orders.length) return `<div class="empty-state">这个客户还没有订单。</div>`;
    return orders.map(o=>`<div class="info-card" style="margin-bottom:8px"><small>${escapeHtml(o.id)} · ${fmtDate(o.date)}</small><strong>${escapeHtml(o.product)} · ${fmtMoney(o.amount)}</strong><div style="margin-top:7px;display:flex;gap:5px"><span class="status-pill ${o.payment==='已付款'?'success':'warning'}">${o.payment}</span><span class="status-pill neutral">${o.logistics}</span></div></div>`).join("");
  }
  function saveNote(id) {
    const input=$("#noteInput"); const text=input?.value.trim(); if(!text) return toast("请先输入跟进内容");
    const c=state.customers.find(x=>x.id===id); if(!c)return;
    c.timeline ||= []; c.timeline.unshift({date:todayISO(),type:"跟进记录",text}); c.lastContact=todayISO(); c.note=text; saveState(); renderAll(); drawerTab="timeline"; renderDrawer(id); toast("跟进记录已保存");
  }
  function scheduleTomorrow(id) {
    const c=state.customers.find(x=>x.id===id); if(!c)return;
    c.nextFollowUp=offsetDate(1); state.tasksDone=state.tasksDone.filter(x=>!x.startsWith(`follow-${c.id}-`)); saveState(); renderAll(); toast("已安排明天继续跟进");
  }

  function switchView(view) {
    activeView=view;
    $$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${view}`));
    $$(".nav-item[data-view]").forEach(btn=>btn.classList.toggle("active",btn.dataset.view===view));
    const meta={dashboard:["销售工作台","优先处理今天需要推进的客户与交易"],leads:["线索 / 客户","查看全部客户、筛选重点机会并打开单客详情"],pipeline:["销售管道","用可视化阶段推进机会并识别卡单"],followups:["待办跟进","按优先级处理逾期、今日与未来跟进"],orders:["订单管理","集中查看付款、物流、Tracking 与利润"],reports:["数据分析","查看销售来源、市场和产品需求分布"],settings:["系统设置","数据模式、备份和后端升级说明"]};
    $("#pageTitle").textContent=meta[view][0]; $("#pageSubtitle").textContent=meta[view][1];
    window.scrollTo({top:0,behavior:"smooth"});
    $("#sidebar").classList.remove("open");
  }

  function openModal() { $("#customerModal").classList.add("open"); $("#modalBackdrop").classList.add("open"); setTimeout(()=>$("#customerForm [name=name]").focus(),50); }
  function closeModal() { $("#customerModal").classList.remove("open"); $("#modalBackdrop").classList.remove("open"); }
  function addCustomer(form) {
    const data=Object.fromEntries(new FormData(form));
    const seq=String(state.customers.length+1).padStart(3,"0");
    const id=`PV-${todayISO().slice(2).replaceAll('-','')}-${seq}`;
    const customer={ id,name:data.name.trim(),country:data.country.trim(),company:data.company.trim()||"未填写",type:data.company.trim()?"待确认":"个人客户",contact:data.contact.trim(),source:data.source,product:data.product.trim(),stage:data.stage,grade:data.grade,value:Number(data.value||0),nextFollowUp:data.nextFollowUp||offsetDate(1),lastContact:todayISO(),createdAt:todayISO(),language:"待确认",risk:"待审核",owner:"Sales Admin",concern:"待确认",note:data.note.trim(),timeline:[{date:todayISO(),type:"首次建档",text:data.note.trim()||"新增销售线索。"}] };
    state.customers.unshift(customer); saveState(); form.reset(); closeModal(); renderAll(); switchView("leads"); toast(`已创建客户 ${customer.name}`);
  }

  function exportData() {
    const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`peptivanta-crm-${todayISO()}.json`; a.click(); URL.revokeObjectURL(url); toast("CRM 数据已导出");
  }
  function resetData() { if(!confirm("确定恢复演示数据？当前浏览器里的修改会被覆盖。"))return; state=seedState(); saveState(); closeDrawer(); renderAll(); toast("已恢复演示数据"); }
  function addDemoOrder() {
    const c=state.customers.find(x=>x.stage==="payment")||state.customers[0]; if(!c)return;
    const id=`SO-${todayISO().slice(2,7).replace('-','')}-${String(state.orders.length+21).padStart(3,'0')}`;
    state.orders.unshift({id,customerId:c.id,customer:c.name,product:c.product,amount:c.value||300,cost:Math.round((c.value||300)*.55),payment:"待付款",logistics:"待发货",tracking:"—",date:todayISO()}); saveState(); renderAll(); toast("已添加一笔示例订单");
  }

  let toastTimer;
  function toast(text) { const el=$("#toast"); el.textContent=text; el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2200); }

  function bindStaticEvents() {
    $$(".nav-item[data-view]").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.view)));
    $$('[data-go-view]').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.goView)));
    $("#addCustomerBtn").addEventListener("click",openModal);
    $("#modalClose").addEventListener("click",closeModal); $("#modalCancel").addEventListener("click",closeModal); $("#modalBackdrop").addEventListener("click",closeModal);
    $("#drawerBackdrop").addEventListener("click",closeDrawer);
    $("#customerForm").addEventListener("submit",e=>{e.preventDefault();addCustomer(e.currentTarget);});
    $("#exportBtn").addEventListener("click",exportData); $("#settingsExportBtn").addEventListener("click",exportData); $("#resetDataBtn").addEventListener("click",resetData); $("#addDemoOrderBtn").addEventListener("click",addDemoOrder);
    $("#mobileMenu").addEventListener("click",()=>$("#sidebar").classList.add("open")); $("#sidebarClose").addEventListener("click",()=>$("#sidebar").classList.remove("open"));
    $$("#queueFilter button").forEach(btn=>btn.addEventListener("click",()=>{queueFilter=btn.dataset.filter; $$("#queueFilter button").forEach(x=>x.classList.toggle("active",x===btn));renderQueue();}));
    $$("#taskTabs button").forEach(btn=>btn.addEventListener("click",()=>{taskFilter=btn.dataset.taskFilter; $$("#taskTabs button").forEach(x=>x.classList.toggle("active",x===btn));renderFollowups();}));
    $$("[data-lead-filter]").forEach(btn=>btn.addEventListener("click",()=>{leadFilter=btn.dataset.leadFilter; $$("[data-lead-filter]").forEach(x=>x.classList.toggle("active",x===btn));renderLeads();}));
    $("#globalSearch").addEventListener("input",e=>{searchTerm=e.target.value; if(activeView!=="leads")switchView("leads"); renderLeads();});
    document.addEventListener("keydown",e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#globalSearch").focus();}
      if(e.key==="Escape"){closeDrawer();closeModal();$("#sidebar").classList.remove("open");}
    });
  }

  bindStaticEvents();
  renderAll();
})();
