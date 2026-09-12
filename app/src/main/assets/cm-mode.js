'use strict';

// CM-only build: lock the mission and apply the mounted-CM DSKY finish.
(() => {
  function applyCmMode() {
    try { localStorage.setItem('agcMission','comanche055'); } catch (_) {}
    document.body.classList.add('spacecraft-cm');
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

  applyCmMode();
  if (window.AGCDSKY) window.AGCDSKY.applyCmMode = applyCmMode;
  if (document.readyState === 'complete') installRelayShow();
  else window.addEventListener('load', installRelayShow, {once:true});
})();
