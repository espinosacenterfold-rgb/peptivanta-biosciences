(() => {
  'use strict';
  const frame=document.getElementById('crmFrame');if(!frame)return;
  function clean(){try{const d=frame.contentDocument;if(!d)return;d.querySelectorAll('.pv-follow-tools').forEach(x=>{if(!x.children.length&&!x.textContent.trim())x.remove();});}catch(_){}}
  frame.addEventListener('load',()=>{setTimeout(clean,250);setTimeout(clean,900);});setInterval(clean,1200);
})();
