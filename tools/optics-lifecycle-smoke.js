#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const js = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/optics.js'), 'utf8');
function assert(ok, msg) { if (!ok) throw new Error(msg); }
assert(js.includes('function releaseCamera(){'), 'camera release helper missing');
assert(js.includes('function acquireCamera(){'), 'camera acquire helper missing');
assert(js.includes("document.addEventListener('visibilitychange', handleVisibilityChange)"), 'visibility lifecycle hook missing');
assert(js.includes('if (document.hidden) {\n      releaseNavContact();\n      lastPhoneAngles = null;\n      if (typeof api.setOpticsCaptureActive === \'function\') api.setOpticsCaptureActive(false);\n      releaseCamera();'), 'backgrounding must stop sextant capture and discard the prior phone-angle baseline');
assert(js.includes("if (status) status.textContent = 'SXT · CAMERA PAUSED';"), 'paused camera state missing');
assert(js.includes("lastPhoneAngles = null;\n    if (typeof api.setOpticsCaptureActive === 'function') api.setOpticsCaptureActive(true);\n    acquireCamera();\n  }\n\n  document.addEventListener('visibilitychange'"), 'visible sextant must rebase phone-angle capture before reacquiring camera');
assert(js.includes("document.hidden || !view.classList.contains('open')"), 'late getUserMedia result must be discarded when no longer visible/open');
assert(js.includes('cameraGeneration++'), 'camera generation invalidation missing');
assert(js.includes('if (cameraAcquire) return cameraAcquire;'), 'duplicate camera acquisition guard missing');
console.log('optics lifecycle smoke: PASS');
