'use strict';

// CM-only build: lock the mission and apply the mounted-CM DSKY finish.
(() => {
  function applyCmMode() {
    try { localStorage.setItem('agcMission','comanche055'); } catch (_) {}
    document.body.classList.add('spacecraft-cm');
  }

  function installFlightHardwareUi() {
    if (document.querySelector('script[data-feature="flight-hardware-ui"]')) return;
    const script = document.createElement('script');
    script.src = 'flight-hardware-ui.js';
    script.dataset.feature = 'flight-hardware-ui';
    script.async = false;
    document.body.appendChild(script);
  }

  function installKeyMechanicalSpec() {
    if (document.querySelector('script[data-feature="key-mechanical-spec"]')) return;
    const script = document.createElement('script');
    script.src = 'key-mechanical-spec.js';
    script.dataset.feature = 'key-mechanical-spec';
    script.async = false;
    document.body.appendChild(script);
  }

  function installKeyboardElectricalInterlock() {
    if (document.querySelector('script[data-feature="keyboard-electrical-interlock"]')) return;
    const script = document.createElement('script');
    script.src = 'keyboard-electrical-interlock.js';
    script.dataset.feature = 'keyboard-electrical-interlock';
    script.async = false;
    document.body.appendChild(script);
  }

  function installLightingElectricalModel() {
    if (document.querySelector('script[data-feature="lighting-electrical-model"]')) return;
    const script = document.createElement('script');
    script.src = 'lighting-electrical-model.js';
    script.dataset.feature = 'lighting-electrical-model';
    script.async = false;
    document.body.appendChild(script);
  }

  function installRelayShow() {
    if (document.getElementById('relay-show')) return;
    const controls = document.getElementById('controls');
    if (!controls) return;
    const button = document.createElement('button');
    button.id = 'relay-show';
    button.textContent = 'RELAY SHOW';
    const display = document.getElementById('display');
    if (display && display.parentNode === controls) controls.insertBefore(button, display);
    else controls.appendChild(button);

    const script = document.createElement('script');
    script.src = 'relay-show.js';
    script.dataset.feature = 'relay-show';
    document.body.appendChild(script);
  }

  function installCmFeatures() {
    installFlightHardwareUi();
    installKeyMechanicalSpec();
    installKeyboardElectricalInterlock();
    installLightingElectricalModel();
    installRelayShow();
  }

  applyCmMode();
  if (window.AGCDSKY) window.AGCDSKY.applyCmMode = applyCmMode;
  if (document.readyState === 'complete') installCmFeatures();
  else window.addEventListener('load', installCmFeatures, {once:true});
})();