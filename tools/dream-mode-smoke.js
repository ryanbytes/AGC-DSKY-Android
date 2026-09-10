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
requireText(bootstrap, "new AgcCore({", 'fresh AGC core');
requireText(bootstrap, "wasmUrl: 'yaAGC.wasm'", 'pinned yaAGC WASM');
requireText(bootstrap, 'ropeUrl: selected.rope', 'Comanche mission rope');
requireText(bootstrap, 'decodeChannel10(value)', 'DSKY relay channel route');
requireText(bootstrap, 'decodeChannel11(value)', 'DSKY status channel route');
requireText(bootstrap, 'decodeChannel163(value)', 'DSKY alarm channel route');
requireText(bootstrap, 'agcCore.start(1)', 'AGC execution start');
requireText(bootstrap, "addEventListener('pagehide'", 'dream teardown stop');

// The dream must never restore or overwrite the interactive app's AGC snapshot.
forbid(bootstrap, 'restoreSavedAgcState', 'interactive snapshot restore');
forbid(bootstrap, 'saveAgcState', 'interactive snapshot save');
forbid(bootstrap, 'scheduleAgcAutosave', 'interactive snapshot autosave');
forbid(bootstrap, "store.set('runMode'", 'interactive run-mode mutation');

console.log('dream AGC smoke: PASS');
console.log('  Android DreamService launches a fresh Comanche/yaAGC DSKY without touching interactive saved state');
