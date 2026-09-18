#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const js = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/cheatsheet.js'), 'utf8');
const css = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/cheatsheet.css'), 'utf8');
const activity = fs.readFileSync(path.resolve(__dirname, '../app/src/main/java/org/apollo/agcdsky/MainActivity.java'), 'utf8');
function assert(ok, msg) { if (!ok) throw new Error(msg); }
const headStart = js.indexOf('<div class="cheat-head" id="cheat-drag">');
const tabsStart = js.indexOf('<div class="cheat-tabs">');
const actionsStart = js.indexOf('<div class="cheat-head-actions">');
const actionsClose = js.indexOf('</div>', actionsStart);
assert(headStart >= 0 && actionsStart > headStart, 'cheat sheet header/action markup missing');
assert(tabsStart > actionsClose, 'cheat tabs must not live inside the draggable header');
assert(js.includes("sheet.classList.contains('open')?close():open()"), 'CHEAT launcher must toggle sheet closed/open');
assert(js.includes("sheet.classList.remove('open','minimized')"), 'close must fully dismiss/reset sheet');
assert(css.includes('.cheat-head-actions{display:flex'), 'fixed header action container missing');
assert(css.includes('#cheat-print,#cheat-min,#cheat-close{\n  min-width:44px;\n  min-height:36px'), 'print/close/minimize touch targets too small');
assert(css.includes('overflow-x:auto'), 'tabs must scroll instead of pushing close control off-screen');
assert(js.includes('id="cheat-print"'), 'print button missing from checklist header');
assert(js.includes("PrintBridge.printChecklist()"), 'checklist print button must invoke native print bridge');
assert(css.includes('size:5.5in 8in'), 'Apollo checklist print page must be 5.5 x 8 inches');
assert(css.includes('.cheat-pane{\n    display:block!important;'), 'print layout must expand every checklist section');
assert(activity.includes('new PrintAttributes.MediaSize('), 'native custom checklist media size missing');
assert(activity.includes('"APOLLO_CHECKLIST_5_5X8","Apollo Checklist 5.5 x 8 in",5500,8000'), 'native checklist media size must be 5.5 x 8 inches');
assert(activity.includes('addJavascriptInterface(new ChecklistPrintBridge(),"PrintBridge")'), 'PrintBridge must be installed on the WebView');
assert(activity.includes('WebViewTeardown.destroy(doomed,"DebugBridge","PrintBridge")'), 'PrintBridge must be removed during WebView teardown');
console.log('cheat sheet smoke: PASS');
