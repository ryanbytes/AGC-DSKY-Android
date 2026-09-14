#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const js = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/cheatsheet.js'), 'utf8');
const css = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/cheatsheet.css'), 'utf8');
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
assert(css.includes('#cheat-min,#cheat-close{min-width:44px;min-height:36px'), 'close/minimize touch targets too small');
assert(css.includes('overflow-x:auto'), 'tabs must scroll instead of pushing close control off-screen');
console.log('cheat sheet smoke: PASS');
