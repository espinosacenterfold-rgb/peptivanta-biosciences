(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const modal=$('#customerModal'), form=$('#customerForm');
  if(!modal||!form)return;

  const DEMO_API_KEY='helloworld';
  let currentFile=null, objectUrl=null, busy=false;
  const fields=name=>form.elements.namedItem(name);
  const products=['Tirzepatide','Retatrutide','GHK-Cu','GHK CU','BPC-157','BPC157','5-Amino-1MQ','5 Amino 1MQ','Ipamorelin','Tesamorelin','AOD9604','AOD-9604','CJC-1295','CJC1295','Semaglutide','TB-500','TB500','MOTS-C','MOTSC','Epithalon','KPV','PT-141','Melanotan','NAD+','SS-31','ARA-290','AICAR'];

  function setStatus(title,hint='',progress=0){
    $('#ocrStatus').textContent=title;
    $('#ocrHint').textContent=hint;
    $('#ocrProgressBar').style.width=Math.max(0,Math.min(100,progress))+'%';
    $('#ocrProgressText').textContent=progress?Math.round(progress)+'%':'';
  }
  function setField(name,value){
    const el=fields(name); if(!el||value===undefined||value===null||value==='')return;
    if(el.tagName==='SELECT'){
      const opt=[...el.options].find(o=>o.value.toLowerCase()===String(value).toLowerCase()||o.text.toLowerCase()===String(value).toLowerCase());
      if(!opt)return; el.value=opt.value;
    }else el.value=value;
    el.classList.add('field-autofilled');
    setTimeout(()=>el.classList.remove('field-autofilled'),3000);
  }
  const clean=v=>String(v||'').replace(/[|<>©®]/g,' ').replace(/\s+/g,' ').trim();
  const uniq=a=>[...new Set(a.filter(Boolean))];

  function detectPhone(text){const m=text.match(/(?:\+\s?\d{1,3}[\s().-]*)?(?:\d[\s().-]*){7,14}/g)||[];const a=m.map(x=>x.trim()).filter(x=>x.replace(/\D/g,'').length>=8);return a.find(x=>x.includes('+'))||a[0]||''}
  function detectCountry(text,phone){const t=' '+text.toLowerCase()+' ';for(const [k,v] of [[' canada ','Canada'],[' mexico ','Mexico'],[' australia ','Australia'],[' united kingdom ','United Kingdom'],[' uk ','United Kingdom'],[' france ','France'],[' germany ','Germany'],[' spain ','Spain'],[' italy ','Italy'],[' united states ','United States'],[' usa ','United States']])if(t.includes(k))return v;const p=phone.replace(/[\s().-]/g,'');if(p.startsWith('+52'))return'Mexico';if(p.startsWith('+61'))return'Australia';if(p.startsWith('+44'))return'United Kingdom';if(p.startsWith('+33'))return'France';if(p.startsWith('+49'))return'Germany';if(p.startsWith('+34'))return'Spain';if(p.startsWith('+39'))return'Italy';if(p.startsWith('+1'))return'United States';return''}
  function detectProduct(text){const low=text.toLowerCase(),found=products.find(p=>low.includes(p.toLowerCase()));if(!found)return'';const map={'GHK CU':'GHK-Cu','BPC157':'BPC-157','5 Amino 1MQ':'5-Amino-1MQ','AOD-9604':'AOD9604','CJC1295':'CJC-1295','TB500':'TB-500','MOTSC':'MOTS-C'},name=map[found]||found,idx=low.indexOf(found.toLowerCase()),around=text.slice(Math.max(0,idx-30),Math.min(text.length,idx+found.length+45)),mg=around.match(/\b\d+(?:\.\d+)?\s*mg\b/i);return mg?`${name} ${mg[0].replace(/\s+/g,'')}`:name}
  function detectType(text){const t=text.toLowerCase();if(/oem|private\s*label|custom\s*(label|packaging|brand)/.test(t))return'OEM/定制';if(/distributor|reseller|wholesale|wholesaler|bulk\s*(order|buy|purchase)/.test(t))return'经销商';if(/retailer|retail store|shop owner|online store/.test(t))return'零售商';if(/research institute|laboratory|lab buyer|procurement|purchasing department|company buyer/.test(t))return'机构采购';if(/research use|research customer|researcher/.test(t))return'科研客户';if(/brand owner|our brand|my brand/.test(t))return'品牌方';return'个人客户'}
  function detectTags(text){const t=text.toLowerCase(),a=[];if(/price|cost|how much|quotation|quote|discount/.test(t))a.push('价格咨询');if(/moq|minimum order|min\. order/.test(t))a.push('MOQ关注');if(/coa|hplc|\bms\b|certificate|purity|test report/.test(t))a.push('文件关注');if(/bulk|wholesale|distributor|reseller|large order|monthly order/.test(t))a.push('批量采购');if(/shipping|delivery|fedex|tracking|arrive|transit/.test(t))a.push('物流关注');if(/sample|trial order/.test(t))a.push('样品咨询');if(/payment|paypal|bank transfer|wire transfer|pay by/.test(t))a.push('付款关注');if(/private label|oem|custom label|custom packaging/.test(t))a.push('定制需求');return uniq(a)}
  function detectName(lines,phone){const bad=/\b(price|product|shipping|payment|tirzepatide|retatrutide|ghk|bpc|mg|hello|hi|thanks|order|bulk|wholesale|whatsapp|online|today|yesterday)\b/i;for(const raw of lines.slice(0,24)){const x=clean(raw);if(!x||x.length<2||x.length>42||bad.test(x))continue;if(phone&&x.includes(phone))continue;if(/\d{1,2}:\d{2}/.test(x)||(x.match(/\d/g)||[]).length>3)continue;if(/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{1,38}$/.test(x))return x}return''}
  function detectMessage(lines,name){const a=lines.map(clean).filter(x=>x.length>=7&&x.length<=300&&x!==name&&!/^\+?[\d\s().-]{8,}$/.test(x)&&!/^\d{1,2}:\d{2}/.test(x));return a.find(x=>/price|cost|how much|tirzepatide|retatrutide|ghk|bpc|bulk|wholesale|coa|shipping|sample|order|mg/i.test(x))||a.slice(-1)[0]||''}
  function parse(text){const lines=text.split(/\r?\n/).map(clean).filter(Boolean),phone=detectPhone(text),country=detectCountry(text,phone),product=detectProduct(text),type=detectType(text),tags=detectTags(text),name=detectName(lines,phone),message=detectMessage(lines,name),grade=type==='机构采购'&&/monthly|long[- ]?term|supplier|procurement|bulk/i.test(text)?'S':tags.includes('批量采购')||/ready to order|place an order|payment/i.test(text)?'A':'B';const notes=['截图 OCR 辅助建档'];if(message)notes.push(`客户消息：${message}`);if(tags.length)notes.push(`关注点：${tags.join('、')}`);if(phone.startsWith('+1')&&!/canada|united states|usa/i.test(text))notes.push('号码为 +1，请人工确认美国/加拿大');return{name,phone,country,product,type,tags,grade,message,note:notes.join('；')+'。'}}
  function apply(r){setField('name',r.name);setField('contact',r.phone);setField('country',r.country);setField('product',r.product);setField('customerType',r.type);setField('grade',r.grade);setField('source','Facebook Ads → WhatsApp');setField('traits',r.tags.join(', '));setField('firstMessage',r.message);setField('note',r.note);const n=[r.name,r.phone,r.country,r.product,r.message].filter(Boolean).length;setStatus('识别完成，请人工确认',`已预填 ${n} 项关键信息。测试通道使用 OCR.Space 免费 OCR，保存前请核对。`,100)}

  async function prepareImage(file){
    if(file.size<900000)return file;
    const bmp=await createImageBitmap(file),max=1700,scale=Math.min(1,max/Math.max(bmp.width,bmp.height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bmp.width*scale));canvas.height=Math.max(1,Math.round(bmp.height*scale));
    canvas.getContext('2d').drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close?.();
    let quality=.82,blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',quality));
    while(blob&&blob.size>950000&&quality>.45){quality-=.1;blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',quality))}
    return blob||file;
  }
  async function recognize(){
    if(!currentFile||busy)return;busy=true;$('#runOcrBtn').disabled=true;
    try{
      setStatus('正在准备截图…','图片会发送到 OCR.Space 免费测试接口进行文字识别。',10);
      const image=await prepareImage(currentFile),fd=new FormData();
      fd.append('file',image,'whatsapp.jpg');fd.append('language','eng');fd.append('isOverlayRequired','false');fd.append('detectOrientation','true');fd.append('scale','true');fd.append('OCREngine','2');
      setStatus('正在识别…','免费测试 key 限流较严，正式使用需要换成你自己的免费 API key。',35);
      const response=await fetch('https://api.ocr.space/parse/image',{method:'POST',headers:{apikey:DEMO_API_KEY},body:fd});
      if(!response.ok)throw new Error(`OCR 请求失败（${response.status}）`);
      const data=await response.json();
      if(data.IsErroredOnProcessing)throw new Error((Array.isArray(data.ErrorMessage)?data.ErrorMessage.join('；'):data.ErrorMessage)||'OCR 处理失败');
      const text=(data.ParsedResults||[]).map(x=>x.ParsedText||'').join('\n').trim();
      $('#ocrRawText').value=text;
      if(!text)throw new Error('没有识别到可用文字');
      apply(parse(text));
    }catch(err){
      setStatus('OCR 识别失败',`${err?.message||'无法识别截图'}。可重试，或在下方粘贴聊天文字继续解析。`,0);
    }finally{busy=false;$('#runOcrBtn').disabled=false}
  }
  function ensureTextFallback(){
    const panel=$('.ocr-panel');if(!panel||$('#assistTextInput'))return;
    const wrap=document.createElement('div');wrap.style.cssText='margin-top:12px;padding-top:12px;border-top:1px solid #e4e7ec';
    wrap.innerHTML='<label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px">聊天文字备用解析</label><textarea id="assistTextInput" rows="5" style="width:100%;resize:vertical;border:1px solid #d0d5dd;border-radius:6px;padding:9px;font:inherit" placeholder="OCR 失败时，把 WhatsApp 聊天文字粘贴到这里。"></textarea><div style="display:flex;justify-content:flex-end;margin-top:8px"><button type="button" class="button secondary small" id="parseAssistTextBtn">解析文字</button></div>';
    panel.appendChild(wrap);$('#parseAssistTextBtn').onclick=()=>{const text=$('#assistTextInput').value.trim();if(!text)return;$('#ocrRawText').value=text;apply(parse(text))};
  }
  function loadFile(file){if(!file||!file.type.startsWith('image/'))return;currentFile=file;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);$('#screenshotPreview').src=objectUrl;$('#screenshotReview').hidden=false;$('#screenshotDrop').hidden=true;$('#ocrRawText').value='';ensureTextFallback();setStatus('截图已载入','准备调用 OCR.Space 免费测试接口。',0);recognize()}
  function setMode(mode){$$('.create-tab').forEach(b=>b.classList.toggle('active',b.dataset.createMode===mode));$('#screenshotAssist').hidden=mode!=='screenshot';if(mode==='screenshot'){ensureTextFallback();const s=fields('source');if(s)s.value='Facebook Ads → WhatsApp'}}

  $$('.create-tab').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.createMode)));
  $('#chooseScreenshotBtn').onclick=()=>$('#screenshotFile').click();$('#replaceScreenshotBtn').onclick=()=>$('#screenshotFile').click();$('#runOcrBtn').textContent='重新OCR识别';$('#runOcrBtn').onclick=recognize;$('#screenshotFile').onchange=e=>loadFile(e.target.files?.[0]);
  const drop=$('#screenshotDrop');['dragenter','dragover'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add('dragover')}));['dragleave','drop'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove('dragover')}));drop.addEventListener('drop',e=>loadFile(e.dataTransfer?.files?.[0]));drop.addEventListener('click',e=>{if(!e.target.closest('button'))$('#screenshotFile').click()});
  document.addEventListener('paste',e=>{if(!modal.classList.contains('open')||$('#screenshotAssist').hidden)return;const file=[...(e.clipboardData?.files||[])].find(f=>f.type.startsWith('image/'))||[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'))?.getAsFile();if(file){e.preventDefault();loadFile(file)}});

  let pending=null;
  form.addEventListener('submit',()=>{pending={name:fields('name')?.value||'',source:fields('source')?.value||'Manual',note:fields('note')?.value||'',firstMessage:fields('firstMessage')?.value||''}},true);
  form.addEventListener('submit',()=>{if(!pending)return;setTimeout(()=>{try{const raw=localStorage.getItem('peptivanta-crm-v2');if(raw){const data=JSON.parse(raw),c=(data.customers||[]).find(x=>x.name===pending.name);if(c){c.source=pending.source||c.source;if(pending.note)c.note=pending.note;if(pending.firstMessage)c.firstMessage=pending.firstMessage;localStorage.setItem('peptivanta-crm-v2',JSON.stringify(data));if(pending.source!=='Manual'||pending.note||pending.firstMessage)setTimeout(()=>location.reload(),120)}}}catch{}pending=null},30)});
})();