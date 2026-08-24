(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');
  if(!frame)return;
  let CATALOG=[],loading=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').toLowerCase().replace(/\s+/g,' ').trim();

  async function loadCatalog(){
    if(CATALOG.length)return CATALOG;if(loading)return loading;
    loading=fetch('./product-catalog-data-v1.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}).then(x=>{CATALOG=Array.isArray(x)?x:[];return CATALOG;}).catch(()=>{CATALOG=[];return CATALOG;});
    return loading;
  }
  function styles(d){
    if(d.getElementById('pvProductCatalogStyles'))return;
    const s=d.createElement('style');s.id='pvProductCatalogStyles';s.textContent=`
      .pv-product-wrap{position:relative}.pv-product-hint{margin-top:5px;font-size:10.5px;color:#667085;display:flex;align-items:center;gap:7px;flex-wrap:wrap}.pv-product-hint b{color:#315fbd}.pv-product-menu{position:absolute;left:0;right:0;top:100%;z-index:120;background:#fff;border:1px solid #cfd6df;border-radius:7px;box-shadow:0 12px 28px rgba(16,24,40,.13);margin-top:4px;max-height:290px;overflow:auto;display:none}.pv-product-menu.open{display:block}.pv-product-item{width:100%;border:0;border-bottom:1px solid #edf0f3;background:#fff;padding:9px 11px;text-align:left;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px}.pv-product-item:last-child{border-bottom:0}.pv-product-item:hover,.pv-product-item.active{background:#f3f7ff}.pv-product-item strong{font-size:12.5px;color:#172033}.pv-product-item small{font-size:10px;color:#8a94a3;white-space:nowrap}.pv-product-empty{padding:12px;color:#98a2b3;font-size:11px}.pv-variant-box{margin-top:7px;padding:8px 9px;border:1px solid #e0e5ec;border-radius:7px;background:#fafbfc;display:none}.pv-variant-box.show{display:block}.pv-variant-title{font-size:10.5px;font-weight:700;color:#667085;margin-bottom:6px}.pv-variant-list{display:flex;flex-wrap:wrap;gap:6px}.pv-variant-chip{height:29px;padding:0 9px;border:1px solid #d2dae5;border-radius:6px;background:#fff;color:#344054;font-size:10.5px;cursor:pointer}.pv-variant-chip:hover{border-color:#7fa3df;background:#eef4ff;color:#2457a7}.pv-variant-chip b{font-weight:750}.pv-variant-chip span{color:#8a94a3;margin-left:5px}
    `;d.head.appendChild(s);
  }
  function findProduct(value){const n=norm(value);return CATALOG.find(p=>norm(p.name)===n)||null;}
  function searchProducts(value){const q=norm(value);if(!q)return CATALOG.slice(0,12);return CATALOG.filter(p=>norm(p.name).includes(q)||p.variants.some(v=>norm(v.cat).includes(q)||norm(v.spec).includes(q))).slice(0,16);}
  function demandTargetFor(input,d){if(input.name==='product')return d.getElementById('customerForm')?.elements.namedItem('demandDetail')||null;if(input.id==='pvPProduct')return d.getElementById('pvPDemand');return null;}
  function addSpec(target,product,variant){if(!target)return;const line=`${product.name} ${variant.spec}`;const current=String(target.value||'').trim();if(!current)target.value=line;else if(!norm(current).includes(norm(line)))target.value=current+(current.endsWith(';')||current.endsWith('；')?' ':'；')+line;target.dispatchEvent(new Event('input',{bubbles:true}));target.focus();}
  function renderVariants(box,product,target){if(!product){box.classList.remove('show');box.innerHTML='';return;}box.classList.add('show');box.innerHTML=`<div class="pv-variant-title">${esc(product.name)} · 可选规格（点击带入需求规格 / 数量）</div><div class="pv-variant-list">${product.variants.map((v,i)=>`<button type="button" class="pv-variant-chip" data-v="${i}"><b>${esc(v.spec)}</b><span>${esc(v.cat)}</span></button>`).join('')}</div>`;box.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>addSpec(target,product,product.variants[Number(b.dataset.v)]));}
  function enhanceInput(d,input){
    if(!input||input.dataset.pvProductCatalog==='1'||!CATALOG.length)return;
    input.dataset.pvProductCatalog='1';styles(d);const label=input.closest('label');if(!label)return;
    const wrap=d.createElement('div');wrap.className='pv-product-wrap';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
    const menu=d.createElement('div');menu.className='pv-product-menu';wrap.appendChild(menu);
    const hint=d.createElement('div');hint.className='pv-product-hint';hint.innerHTML=`<span>产品库：输入产品名或 Cat. No. 搜索</span><b>${CATALOG.length} 个产品 · ${CATALOG.reduce((n,p)=>n+p.variants.length,0)} 个规格</b>`;wrap.insertAdjacentElement('afterend',hint);
    const variantBox=d.createElement('div');variantBox.className='pv-variant-box';hint.insertAdjacentElement('afterend',variantBox);const target=demandTargetFor(input,d);let active=-1;
    const close=()=>{menu.classList.remove('open');active=-1;};
    const choose=p=>{input.value=p.name;input.dispatchEvent(new Event('input',{bubbles:true}));close();renderVariants(variantBox,p,target);};
    const draw=()=>{const rs=searchProducts(input.value);active=-1;menu.innerHTML=rs.length?rs.map((p,i)=>`<button type="button" class="pv-product-item" data-p="${i}"><strong>${esc(p.name)}</strong><small>${p.variants.length} 个规格</small></button>`).join(''):'<div class="pv-product-empty">没有匹配产品，可继续手工输入。</div>';menu.classList.add('open');menu.querySelectorAll('[data-p]').forEach((b,i)=>b.onclick=()=>choose(rs[i]));renderVariants(variantBox,findProduct(input.value),target);};
    input.addEventListener('focus',draw);input.addEventListener('input',draw);input.addEventListener('keydown',e=>{const items=[...menu.querySelectorAll('.pv-product-item')];if(!items.length)return;if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(items.length-1,active+1);}else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(0,active-1);}else if(e.key==='Enter'&&active>=0){e.preventDefault();items[active].click();return;}else if(e.key==='Escape'){close();return;}else return;items.forEach((x,i)=>x.classList.toggle('active',i===active));items[active]?.scrollIntoView({block:'nearest'});});
    d.addEventListener('mousedown',e=>{if(!wrap.contains(e.target))close();});renderVariants(variantBox,findProduct(input.value),target);
  }
  function apply(){try{const d=frame.contentDocument;if(!d||!CATALOG.length)return;enhanceInput(d,d.getElementById('customerForm')?.elements.namedItem('product'));enhanceInput(d,d.getElementById('pvPProduct'));}catch(_){}}
  async function attach(){const d=frame.contentDocument;if(!d)return;await loadCatalog();apply();if(!d.documentElement.dataset.pvProductObs){d.documentElement.dataset.pvProductObs='1';new MutationObserver(()=>setTimeout(apply,30)).observe(d.body,{childList:true,subtree:true});}}
  frame.addEventListener('load',()=>{setTimeout(attach,180);setTimeout(attach,800);});loadCatalog().then(()=>setTimeout(apply,300));setInterval(apply,1200);
})();