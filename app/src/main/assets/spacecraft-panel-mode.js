'use strict';

// Keep spacecraft installation artwork coupled to the selected AGC rope.
// CM/Comanche and LM/Luminary deliberately use separate body classes so their
// surrounding cockpit panels can be reconstructed independently from primary
// source drawings without touching the shared Block II DSKY geometry.
(() => {
  function applySpacecraftPanelMode() {
    let mission = 'comanche055';
    try {
      if (typeof selectedMission !== 'undefined') mission = selectedMission;
      else mission = localStorage.getItem('agcMission') || mission;
    } catch (_) {}

    document.body.classList.toggle('spacecraft-cm', mission === 'comanche055');
    document.body.classList.toggle('spacecraft-lm', mission === 'luminary099');
  }

  applySpacecraftPanelMode();

  if (typeof cycleMission === 'function') {
    const baseCycleMission = cycleMission;
    cycleMission = function spacecraftAwareCycleMission(...args) {
      const result = baseCycleMission.apply(this, args);
      applySpacecraftPanelMode();
      return result;
    };
  }

  if (window.AGCDSKY) {
    window.AGCDSKY.applySpacecraftPanelMode = applySpacecraftPanelMode;
  }
})();
