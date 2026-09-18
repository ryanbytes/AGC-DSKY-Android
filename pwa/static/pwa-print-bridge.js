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

    return {
      html: clone.outerHTML,
      panes: Array.from(clone.querySelectorAll('.cheat-pane')).map(pane => pane.outerHTML)
    };
  }

  function androidSheetMarkup(panes) {
    if (!panes || !panes.length) return '';
    const sheets = [];
    for (let index = 0; index < panes.length; index += 2) {
      const pair = panes.slice(index, index + 2);
      const slots = pair.map((pane, slot) =>
        `<div class="pwa-model-slot" data-model-slot="${slot + 1}">${pane}</div>`
      ).join('');
      sheets.push(
        `<section class="pwa-model-sheet${pair.length === 1 ? ' single' : ''}" data-model-sheet="${Math.floor(index / 2) + 1}">${slots}</section>`
      );
    }
    return `<section id="agc-cheat-sheet" class="open pwa-model-checklist"><div class="pwa-model-sheets">${sheets.join('')}</div></section>`;
  }

  function printableDocument(snapshot) {
    const cssUrl = new URL('cheatsheet.css', location.href).href;
    const android = isAndroid();
    const checklistHtml = android && snapshot.panes.length
      ? androidSheetMarkup(snapshot.panes)
      : snapshot.html;
    const guidance = android
      ? 'ANDROID · 2 LARGE MODEL PAGES PER LETTER SHEET · cut on the dashed guide, rotate each card upright, and stack in page order.'
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

  /*
   * Android Chromium/Brave can ignore CSS landscape when handing HTML to the
   * system print service. Do not depend on a transform to participate in page
   * layout. Build explicit portrait-Letter sheet boxes instead: each sheet has
   * two fixed 8.10 x 5.20 in slots. A portrait model page is centered and
   * rotated inside each slot, so the paginator sees the entire physical sheet.
   */
  body.pwa-android-imposed #app{width:8.10in!important;margin:8px auto!important}
  body.pwa-android-imposed #agc-cheat-sheet{
    width:8.10in!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    background:#fff!important;
  }
  body.pwa-android-imposed .pwa-model-sheets{
    display:block!important;
    width:8.10in!important;
    margin:0!important;
    padding:0!important;
  }
  body.pwa-android-imposed .pwa-model-sheet{
    display:grid!important;
    grid-template-columns:8.10in!important;
    grid-template-rows:5.20in 5.20in!important;
    row-gap:.20in!important;
    width:8.10in!important;
    height:10.60in!important;
    margin:0!important;
    padding:0!important;
    overflow:hidden!important;
    background:#fff!important;
    break-after:page!important;
    page-break-after:always!important;
  }
  body.pwa-android-imposed .pwa-model-sheet:last-child{
    break-after:auto!important;
    page-break-after:auto!important;
  }
  body.pwa-android-imposed .pwa-model-sheet.single{
    grid-template-rows:5.20in!important;
    align-content:center!important;
  }
  body.pwa-android-imposed .pwa-model-slot{
    position:relative!important;
    box-sizing:border-box!important;
    width:8.10in!important;
    height:5.20in!important;
    margin:0!important;
    padding:0!important;
    overflow:visible!important;
  }
  body.pwa-android-imposed .pwa-model-slot>.cheat-pane{
    display:block!important;
    position:absolute!important;
    left:50%!important;
    top:50%!important;
    box-sizing:border-box!important;
    width:5.20in!important;
    height:7.70in!important;
    min-height:0!important;
    margin:0!important;
    transform:translate(-50%,-50%) rotate(90deg)!important;
    transform-origin:center center!important;
    outline-offset:-.04in!important;
    break-before:auto!important;
    page-break-before:auto!important;
    break-after:auto!important;
    page-break-after:auto!important;
    break-inside:avoid!important;
    page-break-inside:avoid!important;
  }

  @media print{
    #pwa-print-toolbar{display:none!important}
    #app{width:auto!important;margin:0!important}
    body.pwa-android-imposed{background:#fff!important}
    body.pwa-android-imposed #app,
    body.pwa-android-imposed #agc-cheat-sheet,
    body.pwa-android-imposed .pwa-model-sheets,
    body.pwa-android-imposed .pwa-model-sheet{width:8.10in!important}
  }
  ${android ? '@page{size:8.5in 11in;margin:.20in}' : ''}
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
      pwa.lastChecklistPrint = {
        ok:true,
        mode:isAndroid()?'android-explicit-sheet-imposition':'browser-print-dialog',
        sheets:isAndroid()?Math.ceil(snapshot.panes.length/2):null
      };
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