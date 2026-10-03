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
    for (let index = 0; index < panes.length; index += 4) {
      const group = panes.slice(index, index + 4);
      const slots = group.map((pane, slot) =>
        `<div class="pwa-model-slot" data-model-slot="${slot + 1}">${pane}</div>`
      ).join('');
      sheets.push(
        `<section class="pwa-model-sheet${group.length === 1 ? ' single' : ''}" data-model-sheet="${Math.floor(index / 4) + 1}">${slots}</section>`
      );
    }
    return `<section id="agc-cheat-sheet" class="open pwa-model-checklist"><div class="pwa-model-sheets">${sheets.join('')}</div></section>`;
  }

  function printableDocument(snapshot) {
    const cssUrl = new URL('cheatsheet.css', location.href).href;
    const printCssUrl = new URL('pwa-print.css', location.href).href;
    const androidPrintCssUrl = new URL('pwa-print-android.css', location.href).href;
    const printScriptUrl = new URL('pwa-print-window.js', location.href).href;
    const android = isAndroid();
    const checklistHtml = android && snapshot.panes.length
      ? androidSheetMarkup(snapshot.panes)
      : snapshot.html;
    const guidance = android
      ? 'ANDROID · 4 COMPACT MODEL PAGES PER LETTER SHEET · cut on the dashed guides, rotate each card upright, and stack in page order.'
      : '4 COMPACT CHECKLIST PAGES PER LANDSCAPE LETTER SHEET · print or save PDF, then cut on the dashed guides and stack.';
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Apollo CMC / DSKY Checklist</title>
<link rel="stylesheet" href="${cssUrl}">
<link rel="stylesheet" href="${printCssUrl}">
${android ? `<link rel="stylesheet" href="${androidPrintCssUrl}">` : ''}
</head>
<body${android ? ' class="pwa-android-imposed"' : ''}>
<div id="pwa-print-toolbar">
  <div class="copy">${guidance}</div>
  <button id="pwa-print-action" type="button">PRINT / SAVE PDF</button>
  <button id="pwa-print-close" type="button">CLOSE</button>
</div>
<main id="app">${checklistHtml}</main>
<script src="${printScriptUrl}"></script>
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
        sheets:isAndroid()?Math.ceil(snapshot.panes.length/4):null
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
