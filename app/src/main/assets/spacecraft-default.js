'use strict';
(() => {
  try {
    if (localStorage.getItem('agcMission') === null) localStorage.setItem('agcMission','comanche055');
  } catch (_) {}

  /* Visual-proof branch only.  Keep the production index/parser ordering
     untouched while registering the Sheet-3 surround after the static DOM
     exists.  This file is reverted before any production merge. */
  const proof=document.createElement('script');
  proof.src='cm-sheet3-surround.js';
  proof.dataset.feature='cm-sheet3-surround-proof';
  document.head.appendChild(proof);
})();
