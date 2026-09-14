(() => {
  'use strict';

  const api = window.AGCDSKY;
  if (!api) return;

  const CLOCK_FORMAT_KEY = 'clockHourFormat';
  let clockHourFormat = readClockHourFormat();
  const originalClockTimeLabel = typeof window.clockTimeLabel === 'function' ? window.clockTimeLabel : null;

  function readClockHourFormat() {
    try {
      return localStorage.getItem(CLOCK_FORMAT_KEY) === '12' ? 12 : 24;
    } catch (_) {
      return 24;
    }
  }

  function saveClockHourFormat() {
    try { localStorage.setItem(CLOCK_FORMAT_KEY, String(clockHourFormat)); } catch (_) {}
  }

  function clockDate() {
    try {
      if (typeof api.accurateDate === 'function') return api.accurateDate();
    } catch (_) {}
    return new Date();
  }

  function fiveDigits(value) {
    return String(value).padStart(5, '0').slice(-5).split('');
  }

  function displayedHour(date) {
    const hour = date.getHours();
    return clockHourFormat === 12 ? (hour % 12 || 12) : hour;
  }

  // app.js resolves desiredClockDigits dynamically. Replacing the global
  // function keeps the existing relay queue/timing model intact while changing
  // only the hour value presented by clock mode.
  window.desiredClockDigits = function desiredClockDigitsForHourMode() {
    const date = clockDate();
    return {
      r1: fiveDigits(displayedHour(date)),
      r2: fiveDigits(date.getMinutes()),
      r3: fiveDigits(date.getSeconds())
    };
  };

  window.clockTimeLabel = function clockTimeLabelForHourMode() {
    const base = originalClockTimeLabel ? originalClockTimeLabel() : 'PHONE CLOCK';
    if (clockHourFormat === 24) return `${base} · 24H`;
    return `${base} · 12H ${clockDate().getHours() < 12 ? 'AM' : 'PM'}`;
  };

  const clockButton = document.getElementById('clock');
  let formatButton = document.getElementById('clock-format');
  if (!formatButton && clockButton) {
    formatButton = document.createElement('button');
    formatButton.id = 'clock-format';
    clockButton.insertAdjacentElement('afterend', formatButton);
  }

  function renderClockFormatControl() {
    if (formatButton) {
      formatButton.textContent = clockHourFormat === 24 ? 'CLOCK 24H' : 'CLOCK 12H';
      formatButton.setAttribute('aria-pressed', clockHourFormat === 12 ? 'true' : 'false');
      formatButton.setAttribute('aria-label', `Clock display format: ${clockHourFormat}-hour`);
    }
    try {
      if (api.appStatus().mode === 'clock') {
        const modeLabel = document.getElementById('mode');
        if (modeLabel) modeLabel.textContent = window.clockTimeLabel();
      }
    } catch (_) {}
  }

  function applyClockHourFormat(next) {
    const normalized = String(next).toLowerCase();
    clockHourFormat = normalized === '12' || normalized === '12h' ? 12 : 24;
    saveClockHourFormat();
    try { if (typeof window.stopClockQueue === 'function') window.stopClockQueue(); } catch (_) {}
    try { if (typeof window.syncClockFace === 'function') window.syncClockFace(); } catch (_) {}
    renderClockFormatControl();
    return clockHourFormat;
  }

  if (formatButton) {
    formatButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      applyClockHourFormat(clockHourFormat === 24 ? 12 : 24);
    });
  }

  // app.js registered the normal CLOCK MODE listener before this script. Refresh
  // the status label after that listener runs so it always includes 12H/24H.
  if (clockButton) {
    clockButton.addEventListener('click', () => setTimeout(renderClockFormatControl, 0));
  }

  api.clockHourFormat = () => clockHourFormat;
  api.setClockHourFormat = applyClockHourFormat;
  renderClockFormatControl();

  // Clock mode remains visually passive. COMP ACTY is not synthesized here;
  // once the real AGC is active, app.js owns that lamp from channel 011.
  const AGC_KEY = Object.freeze({
    '1':0o01,'2':0o02,'3':0o03,'4':0o04,'5':0o05,'6':0o06,'7':0o07,'8':0o10,'9':0o11,'0':0o20,
    V:0o21,R:0o22,K:0o31,'+':0o32,'-':0o33,E:0o34,C:0o36,N:0o37
  });
  const pendingKeys = [];
  let promoting = false;

  async function promoteClockInput(key) {
    pendingKeys.push(key);
    if (promoting) return;
    promoting = true;

    try {
      await api.enterAgc();
      const core = api.getCore && api.getCore();
      const status = api.appStatus();
      if (!core || status.mode !== 'agc') {
        pendingKeys.length = 0;
        return;
      }
      while (pendingKeys.length) {
        const next = pendingKeys.shift();
        const code = AGC_KEY[next];
        if (code !== undefined) core.keyPress(code);
      }
      if (typeof api.scheduleAgcAutosave === 'function') api.scheduleAgcAutosave('clock keypad handoff');
    } catch (error) {
      pendingKeys.length = 0;
      console.error('Clock-to-AGC keypad handoff', error);
    } finally {
      promoting = false;
    }
  }

  document.addEventListener('pointerdown', event => {
    const key = event.target && event.target.closest ? event.target.closest('[data-key]') : null;
    if (!key) return;
    let mode = '';
    try { mode = api.appStatus().mode; } catch (_) { return; }
    if (mode !== 'clock' && mode !== 'agc-loading') return;

    // Stop app.js's local clock-entry handler from consuming the key. Other
    // capture listeners on document still receive the completed user gesture.
    event.preventDefault();
    event.stopPropagation();
    key.classList.add('pressed');
    setTimeout(() => key.classList.remove('pressed'), 90);
    promoteClockInput(key.dataset.key);
  }, {capture:true, passive:false});

  window.AGCDSKY_CLOCK_BEHAVIOR = {
    promoteClockInput,
    isPromoting: () => promoting,
    pendingCount: () => pendingKeys.length,
    hourFormat: () => clockHourFormat,
    setHourFormat: applyClockHourFormat
  };
})();
