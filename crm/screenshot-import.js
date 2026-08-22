(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const modal = $('#customerModal');
  const form = $('#customerForm');
  if (!modal || !form) return;

  let currentFile = null;
  let objectUrl = null;
  let ocrBusy = false;
  const productNames = [
    'Tirzepatide','Retatrutide','GHK-Cu','GHK CU','BPC-157','BPC157','5-Amino-1MQ','5 Amino 1MQ',
    'Ipamorelin','Tesamorelin','AOD9604','AOD-9604','CJC-1295','CJC1295','Semaglutide','TB-500','TB500',
    'MOTS-C','MOTSC','Epithalon','KPV','PT-141','Melanotan','NAD+','SS-31','ARA-290','AICAR'
  ];
  const uiNoise = /^(whatsapp|online|typing|today|yesterday|video call|voice call|search|message|type a message|business account|last seen|forwarded|read more|mute|block|report)$/i;

  const fields = name => form.elements.namedItem(name);
  function setField(name, value) {
    const el = fields(name); if (!el || !value) return;
    if (el.tagName === 'SELECT') {
      const options = [...el.options];
      const exact = options.find(o => o.value.toLowerCase() === String(value).toLowerCase() || o.text.toLowerCase() === String(value).toLowerCase());
      if (exact) el.value = exact.value; else return;
    } else el.value = value;
    el.classList.add('field-autofilled');
    setTimeout(() => el.classList.remove('field-autofilled'), 3500);
  }
  function uniq(arr){return [...new Set(arr.filter(Boolean))]}
  function cleanLine(v){return String(v||'').replace(/[|<>©®]/g,' ').replace(/\s+/g,' ').trim()}
  function detectPhone(text){
    const matches = text.match(/(?:\+\s?\d{1,3}[\s().-]*)?(?:\d[\s().-]*){7,14}/g) || [];
    const cleaned = matches.map(x=>x.trim()).filter(x=>x.replace(/\D/g,'').length>=8);
    const plus = cleaned.find(x=>x.includes('+'));
    return plus || cleaned[0] || '';
  }
  function countryFrom(text, phone){
    const t=text.toLowerCase();
    const named=[['canada','Canada'],['mexico','Mexico'],['australia','Australia'],['united kingdom','United Kingdom'],[' uk ','United Kingdom'],['france','France'],['germany','Germany'],['spain','Spain'],['italy','Italy'],['united states','United States'],[' usa ','United States']];
    for(const [k,v] of named) if((' '+t+' ').includes(k)) return v;
    const p=phone.replace(/[\s().-]/g,'');
    if(p.startsWith('+52'))return'Mexico'; if(p.startsWith('+61'))return'Australia'; if(p.startsWith('+44'))return'United Kingdom';
    if(p.startsWith('+33'))return'France'; if(p.startsWith('+49'))return'Germany'; if(p.startsWith('+34'))return'Spain'; if(p.startsWith('+39'))return'Italy';
    if(p.startsWith('+1'))return'United States';
    return '';
  }
  function detectProduct(text){
    const lower=text.toLowerCase();
    const found=productNames.find(p=>lower.includes(p.toLowerCase()));
    if(!found)return'';
    const norm={'GHK CU':'GHK-Cu','BPC157':'BPC-157','5 Amino 1MQ':'5-Amino-1MQ','AOD-9604':'AOD9604','CJC1295':'CJC-1295','TB500':'TB-500','MOTSC':'MOTS-C'};
    let name=norm[found]||found;
    const idx=lower.indexOf(found.toLowerCase());
    const around=text.slice(Math.max(0,idx-20),Math.min(text.length,idx+found.length+30));
    const mg=around.match(/\b\d+(?:\.\d+)?\s*mg\b/i);
    return mg ? `${name} ${mg[0].replace(/\s+/g,'')}` : name;
  }
  function detectType(text){
    const t=text.toLowerCase();
    if(/oem|private\s*label|custom\s*(label|packaging|brand)/.test(t))return'OEM/定制';
    if(/distributor|reseller|wholesale|wholesaler|bulk\s*(order|buy|purchase)/.test(t))return'经销商';
    if(/retailer|retail store|shop owner|online store/.test(t))return'零售商';
    if(/research institute|laboratory|lab buyer|procurement|purchasing department|company buyer/.test(t))return'机构采购';
    if(/research use|research customer|researcher/.test(t))return'科研客户';
    if(/brand owner|our brand|my brand/.test(t))return'品牌方';
    return'个人客户';
  }
  function detectTags(text){
    const t=text.toLowerCase(), tags=[];
    if(/price|cost|how much|quotation|quote|discount/.test(t))tags.push('价格咨询');
    if(/moq|minimum order|min\. order/.test(t))tags.push('MOQ关注');
    if(/coa|hplc|\bms\b|certificate|purity|test report/.test(t))tags.push('文件关注');
    if(/bulk|wholesale|distributor|reseller|large order|monthly order/.test(t))tags.push('批量采购');
    if(/shipping|delivery|fedex|tracking|arrive|transit/.test(t))tags.push('物流关注');
    if(/sample|testing sample|trial order/.test(t))tags.push('样品咨询');
    if(/payment|paypal|bank transfer|wire transfer|pay by/.test(t))tags.push('付款关注');
    if(/private label|oem|custom label|custom packaging/.test(t))tags.push('定制需求');
    return uniq(tags);
  }
  function detectName(lines, phone){
    const blacklist=/\b(price|product|shipping|payment|tirzepatide|retatrutide|ghk|bpc|mg|hello|hi|thanks|thank you|order|bulk|wholesale)\b/i;
    for(const raw of lines.slice(0,18)){
      const line=cleanLine(raw);
      if(!line||line.length<2||line.length>40||uiNoise.test(line)||blacklist.test(line))continue;
      if(phone&&line.includes(phone))continue;
      if(/\d{2}:\d{2}|\d{1,2}[:.]\d{2}\s?(am|pm)?/i.test(line))continue;
      if((line.match(/\d/g)||[]).length>3)continue;
      if(/^[A-Za-z][A-Za-z .'-]{1,35}$/.test(line))return line;
    }
    return'';
  }
  function detectMessage(lines, name){
    const candidates=lines.map(cleanLine).filter(x=>x.length>=8&&x.length<=240&&!uiNoise.test(x));
    const meaningful=candidates.filter(x=>x!==name&&!/^\+?[\d\s().-]{8,}$/.test(x)&&!/^\d{1,2}:\d{2}/.test(x));
    const productLine=meaningful.find(x=>/price|cost|how much|tirzepatide|retatrutide|ghk|bpc|bulk|wholesale|coa|shipping|sample|order/i.test(x));
    return productLine || meaningful.slice(-1)[0] || '';
  }
  function gradeFrom(type,tags,text){
    if(type==='机构采购' && /monthly|long[- ]?term|supplier|procurement|bulk/i.test(text)) return 'S';
    if(tags.includes('批量采购') || /ready to order|place an order|payment/i.test(text)) return 'A';
    return 'B';
  }
  function parseOCR(text){
    const lines=text.split(/\r?\n/).map(cleanLine).filter(Boolean);
    const phone=detectPhone(text), country=countryFrom(text,phone), product=detectProduct(text), type=detectType(text), tags=detectTags(text);
    const name=detectName(lines,phone), message=detectMessage(lines,name), grade=gradeFrom(type,tags,text);
    const noteParts=['截图辅助建档'];
    if(message)noteParts.push(`识别到客户消息：${message}`);
    if(tags.length)noteParts.push(`关注点：${tags.join('、')}`);
    if(phone.startsWith('+1')&&!/canada|united states|usa/i.test(text))noteParts.push('号码为 +1，国家可能是美国或加拿大，请人工确认');
    return {name,phone,country,product,type,tags,grade,message,note:noteParts.join('；')+'。'};
  }
  function applyResult(r){
    setField('name',r.name); setField('contact',r.phone); setField('country',r.country); setField('product',r.product); setField('customerType',r.type); setField('grade',r.grade);
    setField('source','Facebook Ads → WhatsApp'); setField('traits',r.tags.join(', ')); setField('firstMessage',r.message); setField('note',r.note);
    $('#ocrHint').textContent = `已预填 ${[r.name,r.phone,r.country,r.product,r.type].filter(Boolean).length} 项核心信息。黄色字段为自动识别结果，请确认后保存。`;
  }
  async function recognize(){
    if(!currentFile||ocrBusy)return;
    if(!window.Tesseract){$('#ocrStatus').textContent='识别组件加载失败';$('#ocrHint').textContent='网络未能加载本地 OCR 组件，可以更换网络后重试，或继续手动填写。';return;}
    ocrBusy=true; $('#ocrStatus').textContent='正在识别截图…'; $('#ocrProgressBar').style.width='2%'; $('#runOcrBtn').disabled=true;
    try{
      const out=await Tesseract.recognize(currentFile,'eng+chi_sim',{logger:m=>{
        if(m.status==='recognizing text'){
          const p=Math.round((m.progress||0)*100); $('#ocrProgressBar').style.width=p+'%'; $('#ocrProgressText').textContent=p+'%';
        } else if(m.status){ $('#ocrStatus').textContent = m.status.includes('loading') ? '正在加载识别模型…' : '正在处理图片…'; }
      }});
      const text=out?.data?.text||''; $('#ocrRawText').value=text; $('#ocrProgressBar').style.width='100%'; $('#ocrProgressText').textContent='100%';
      if(!text.trim()){throw new Error('未识别到可用文字')}
      const result=parseOCR(text); applyResult(result); $('#ocrStatus').textContent='识别完成，请检查表单';
    }catch(err){$('#ocrStatus').textContent='识别失败';$('#ocrHint').textContent=`${err?.message||'无法读取截图'}。可以更换更清晰的截图后重试，或切回手动录入。`;$('#ocrProgressBar').style.width='0%';}
    finally{ocrBusy=false;$('#runOcrBtn').disabled=false;}
  }
  function loadFile(file){
    if(!file||!file.type.startsWith('image/'))return;
    currentFile=file; if(objectUrl)URL.revokeObjectURL(objectUrl); objectUrl=URL.createObjectURL(file); $('#screenshotPreview').src=objectUrl;
    $('#screenshotReview').hidden=false; $('#screenshotDrop').hidden=true; $('#ocrRawText').value=''; $('#ocrProgressBar').style.width='0%'; $('#ocrProgressText').textContent='';
    recognize();
  }
  function setMode(mode){
    $$('.create-tab').forEach(b=>b.classList.toggle('active',b.dataset.createMode===mode)); $('#screenshotAssist').hidden=mode!=='screenshot';
    if(mode==='screenshot')setTimeout(()=>$('#screenshotDrop')?.focus(),50);
  }
  $$('.create-tab').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.createMode)));
  $('#chooseScreenshotBtn').addEventListener('click',()=>$('#screenshotFile').click());
  $('#replaceScreenshotBtn').addEventListener('click',()=>$('#screenshotFile').click());
  $('#runOcrBtn').addEventListener('click',recognize);
  $('#screenshotFile').addEventListener('change',e=>loadFile(e.target.files?.[0]));
  const drop=$('#screenshotDrop');
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragover')}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragover')}));
  drop.addEventListener('drop',e=>loadFile(e.dataTransfer?.files?.[0])); drop.addEventListener('click',e=>{if(!e.target.closest('button'))$('#screenshotFile').click()});
  document.addEventListener('paste',e=>{
    if(!modal.classList.contains('open')||$('#screenshotAssist').hidden)return;
    const file=[...(e.clipboardData?.files||[])].find(f=>f.type.startsWith('image/')) || [...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'))?.getAsFile();
    if(file){e.preventDefault();loadFile(file)}
  });

  let pendingExtras = null;
  form.addEventListener('submit', () => {
    pendingExtras = {
      name: fields('name')?.value || '',
      source: fields('source')?.value || 'Manual',
      note: fields('note')?.value || '',
      firstMessage: fields('firstMessage')?.value || ''
    };
  }, true);
  form.addEventListener('submit', () => {
    if (!pendingExtras) return;
    setTimeout(() => {
      try {
        const key = 'peptivanta-crm-v2';
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const data = JSON.parse(raw);
        const c = [...(data.customers || [])].find(x => x.name === pendingExtras.name);
        if (c) {
          c.source = pendingExtras.source || c.source;
          if (pendingExtras.note) c.note = pendingExtras.note;
          if (pendingExtras.firstMessage) c.firstMessage = pendingExtras.firstMessage;
          localStorage.setItem(key, JSON.stringify(data));
        }
      } catch {}
      pendingExtras = null;
    }, 0);
  });

  form.addEventListener('reset',()=>setTimeout(()=>{setMode('manual');currentFile=null;$('#screenshotReview').hidden=true;$('#screenshotDrop').hidden=false;$('#ocrRawText').value='';},0));
})();