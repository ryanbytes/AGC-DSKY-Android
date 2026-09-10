(() => {
  'use strict';

  const comp = document.querySelector('[data-lamp="comp"]');
  if (!comp) return;

  function clockMode() {
    try {
      return window.AGCDSKY && window.AGCDSKY.appStatus && window.AGCDSKY.appStatus().mode === 'clock';
    } catch (_) {
      return false;
    }
  }

  function enforce() {
    if (clockMode() && comp.classList.contains('on')) comp.classList.remove('on');
  }

  const observer = new MutationObserver(enforce);
  observer.observe(comp, {attributes:true, attributeFilter:['class']});
  enforce();
  window.addEventListener('pageshow', enforce, {passive:true});
  document.addEventListener('visibilitychange', () => { if (!document.hidden) enforce(); }, {passive:true});

  window.AGCDSKYPWA = window.AGCDSKYPWA || {};
  window.AGCDSKYPWA.clockCompGuard = true;
})();
