(() => {
  'use strict';

  const pwa = window.AGCDSKYPWA = window.AGCDSKYPWA || {};

  function isAndroid() {
    return /Android/i.test(String(navigator.userAgent || ''));
  }

  function checklistSnapshot() {
    const source = document.getElementById('agc-cheat-sheet');
    if (!source) return null;

    const clone = source.cloneNode(true);
    const sourceChecks = Array.from(source.querySelectorAll('[data-cheat-check]'));
    const cloneChecks = Array.from(clone.querySelectorAll('[data-cheat-check]'));
    cloneChecks.forEach((box, index) => {
      if (sourceChecks[index] && sourceChecks[index].checked) box.setAttribute('checked', '');
      else box.removeAttribute('checked');
    });
    clone.classList.add('open');
    clone.classList.remove('minimized');
    return clone.outerHTML;
  }

  function printableDocument(checklistHtml) {
    const cssUrl = new URL('cheatsheet.css', location.href).href;
    const android = isAndroid();
    const guidance = android
      ? '4 MINI CHECKLIST PAGES PER LETTER SHEET · use browser menu → Share → Print, then cut out and stack.'
      : '4 MINI CHECKLIST PAGES PER LETTER SHEET · print or save PDF, then cut out and stack.';
    const autoPrint = android ? '' : "setTimeout(()=>{try{window.print()}catch(_){}},350);";

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Apollo CMC / DSKY Checklist</title>
<link rel="stylesheet" href="${cssUrl}">
<style>
  html,body{min-height:100%;margin:0;background:#d8d3c5;color:#111}
  #pwa-print-toolbar{position:sticky;top:0;z-index:99999;display:flex;align-items:center;gap:10px;padding:10px 12px;background:#171714;color:#f5f0e3;font:700 13px/1.3 Arial,sans-serif}
  #pwa-print-toolbar .copy{flex:1}
  #pwa-print-toolbar button{min-height:42px;padding:8px 12px;border:1px solid #777;background:#f4eedf;color:#111;font-weight:800}
  #app{display:block!important;width:min(100%,816px)!important;height:auto!important;margin:12px auto!important;padding:0!important;overflow:visible!important}
  #agc-cheat-sheet{display:block!important;max-height:none!important;overflow:visible!important}
  @media print{#pwa-print-toolbar{display:none!important}#app{width:auto!important;margin:0!important}}
</style>
</head>
<body>
<div id="pwa-print-toolbar">
  <div class="copy">${guidance}</div>
  <button id="pwa-print-action" type="button">PRINT / SAVE PDF</button>
  <button id="pwa-print-close" type="button">CLOSE</button>
</div>
<main id="app">${checklistHtml}</main>
<script>
document.getElementById('pwa-print-action').addEventListener('click',()=>{try{window.print()}catch(_){}});
document.getElementById('pwa-print-close').addEventListener('click',()=>window.close());
${autoPrint}
<\/script>
</body>
</html>`;
  }

  function printChecklist() {
    const snapshot = checklistSnapshot();
    if (!snapshot) {
      pwa.lastChecklistPrint = {ok:false,error:'checklist unavailable'};
      return false;
    }

    let popup = null;
    try { popup = window.open('', '_blank'); } catch (_) {}
    if (!popup || !popup.document) {
      pwa.lastChecklistPrint = {ok:false,error:'print window blocked'};
      return false;
    }

    try {
      popup.document.open();
      popup.document.write(printableDocument(snapshot));
      popup.document.close();
      try { popup.focus(); } catch (_) {}
      pwa.lastChecklistPrint = {ok:true,mode:isAndroid()?'android-print-view':'browser-print-dialog'};
      return true;
    } catch (error) {
      try { popup.close(); } catch (_) {}
      pwa.lastChecklistPrint = {ok:false,error:String(error && error.message ? error.message : error)};
      return false;
    }
  }

  const bridge = Object.freeze({printChecklist});
  window.PrintBridge = bridge;
  pwa.printChecklist = printChecklist;
})();