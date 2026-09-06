'use strict';

// Command Module is the canonical/default spacecraft. Existing explicit user
// choices are preserved; this only seeds a fresh install/profile.
(() => {
  try {
    if (localStorage.getItem('agcMission') === null) {
      localStorage.setItem('agcMission', 'comanche055');
    }
  } catch (_) {}
})();
