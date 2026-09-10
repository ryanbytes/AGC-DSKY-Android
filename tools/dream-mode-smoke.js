'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dreamService = fs.readFileSync(path.join(root, 'app/src/main/java/org/apollo/agcdsky/AgcDreamService.java'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'app/src/main/assets/dream-agc.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'app/src/main/assets/index.html'), 'utf8');

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Dream AGC smoke: ${label} missing: ${needle}`);
}
function forbid(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Dream AGC smoke: ${label} must not contain: ${needle}`);
}

requireText(dreamService, 'index.html?dream=1&agc=1&display=1', 'DreamService real-AGC URL');
forbid(dreamService, 'index.html?dream=1&clock=1', 'DreamService wall-clock URL');
requireText(index, '<script src="dream-agc.js"></script>', 'dream bootstrap script');

requireText(bootstrap, "params.get('dream') === '1' && params.get('agc') === '1'", 'explicit dream-AGC gate');
requireText(bootstrap, "mode = 'dream-agc-loading'", 'clock suppression while AGC loads');
requireText(bootstrap, "mode = 'dream-agc'", 'dedicated dream AGC mode');
requireText(bootstrap, "new AgcCore({", 'separate AGC core');
requireText(bootstrap, "wasmUrl: 'yaAGC.wasm'", 'pinned yaAGC WASM');
requireText(bootstrap, 'ropeUrl: selected.rope', 'Comanche mission rope');
requireText(bootstrap, 'decodeChannel10(value)', 'DSKY relay channel route');
requireText(bootstrap, 'decodeChannel11(value)', 'DSKY status channel route');
requireText(bootstrap, 'decodeChannel163(value)', 'DSKY alarm channel route');
requireText(bootstrap, 'agcCore.start(1)', 'AGC execution start');
requireText(bootstrap, "addEventListener('pagehide'", 'dream teardown stop');

// The screensaver must show the user's current AGC display instead of a bare
// reset-vector blank DSKY. It clones the saved snapshot into a separate core.
requireText(bootstrap, "localStorage.getItem('agcSnapshotV1')", 'read-only saved snapshot lookup');
requireText(bootstrap, 'agcCore.importSnapshot(payload.core)', 'snapshot core clone');
requireText(bootstrap, 'applySnapshotUi(payload.ui)', 'snapshot DSKY clone');
requireText(bootstrap, 'renderAgcSnapshot()', 'cloned DSKY render');

// Dream execution is read-only with respect to the interactive app. In
// particular, do not use the normal restore helper because it can delete a bad
// snapshot, and never save/autosave or change the interactive run mode.
forbid(bootstrap, 'restoreSavedAgcState', 'interactive snapshot restore helper');
forbid(bootstrap, 'saveAgcState', 'interactive snapshot save');
forbid(bootstrap, 'scheduleAgcAutosave', 'interactive snapshot autosave');
forbid(bootstrap, "store.set('runMode'", 'interactive run-mode mutation');
forbid(bootstrap, "localStorage.setItem('agcSnapshotV1'", 'dream snapshot write');
forbid(bootstrap, "localStorage.removeItem('agcSnapshotV1'", 'dream snapshot delete');

console.log('dream AGC smoke: PASS');
console.log('  DreamService clones the last interactive Comanche/yaAGC state into a separate read-only AGC core');
