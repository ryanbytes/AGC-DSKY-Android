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
      ? 'ANDROID PRINT FIX · 2 LARGE CHECKLIST PAGES FILL EACH LETTER SHEET · the preview may show them sideways; cut on the dashed guides and turn the cards upright.'
      : '2 LARGE CHECKLIST PAGES PER LANDSCAPE LETTER SHEET · print or save PDF, then cut on the dashed guides and stack.';
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
  #app{display:block!important;width:min(100%,1056px)!important;height:auto!important;margin:12px auto!important;padding:0!important;overflow:visible!important}
  #agc-cheat-sheet{display:block!important;max-height:none!important;overflow:visible!important}

  /* Brave/Chromium on Android may ignore @page landscape and hand the system
     print service a portrait Letter page. Pack the same portrait checklist
     cards into that physical page sideways: two 5.20 x 7.70 in cards become
     7.70 x 5.20 in after rotation and fill almost the entire sheet. */
  body.pwa-android-imposed #app{width:8.10in!important;margin:10px auto!important}
  body.pwa-android-imposed #agc-cheat-sheet{width:8.10in!important}
  body.pwa-android-imposed .cheat-body{
    display:grid!important;
    grid-template-columns:8.10in!important;
    grid-auto-rows:5.20in!important;
    gap:.20in 0!important;
    justify-content:center!important;
    align-content:start!important;
    width:8.10in!important;
    margin:0!important;
    padding:0!important;
    overflow:visible!important;
  }
  body.pwa-android-imposed .cheat-pane{
    display:block!important;
    box-sizing:border-box!important;
    width:5.20in!important;
    height:7.70in!important;
    min-height:0!important;
    margin:0!important;
    justify-self:center!important;
    align-self:center!important;
    transform:rotate(90deg)!important;
    transform-origin:center center!important;
    break-before:auto!important;
    page-break-before:auto!important;
    break-inside:avoid!important;
    page-break-inside:avoid!important;
  }
  body.pwa-android-imposed .cheat-pane:nth-child(2n+1):not(:first-child){
    break-before:page!important;
    page-break-before:always!important;
  }

  @media print{
    #pwa-print-toolbar{display:none!important}
    #app{width:auto!important;margin:0!important}
    body.pwa-android-imposed{background:#fff!important}
    body.pwa-android-imposed #app,
    body.pwa-android-imposed #agc-cheat-sheet,
    body.pwa-android-imposed .cheat-body{width:8.10in!important}
  }
  ${android ? '@page{size:Letter portrait;margin:.20in}' : ''}
</style>
</head>
<body${android ? ' class="pwa-android-imposed"' : ''}>
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