'use strict';

// Android DreamService uses the same clock renderer as the interactive app,
// but the screen saver must remain silent. Keep the user's saved RELAY CLICKS
// preference untouched so leaving Dream mode restores the normal app exactly as
// configured.
(() => {
  const isDream = new URLSearchParams(location.search).get('dream') === '1';
  if (!isDream) return;

  // Prevent creation/resumption of WebAudio in Dream mode and make the direct
  // clock relay-burst path a no-op. app.js has already established these global
  // functions, and this synchronous script runs before timer callbacks can fire.
  if (typeof ensureAudio === 'function') ensureAudio = () => null;
  if (typeof playRelayBurst === 'function') playRelayBurst = () => {};

  window.AGCDSKY_DREAM_SILENT = true;
})();
