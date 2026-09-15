'use strict';

// Android DreamService uses the same clock renderer as the interactive app,
// but the screen saver must remain silent. Keep the user's saved RELAY CLICKS
// preference untouched so leaving Dream mode restores the normal app exactly as
// configured.
(() => {
  const state = window.AGCDSKY_APP_STATE;
  if (!state || !state.dream) return;
  const compat=window.AGCDSKY_COMPAT;
  if(!compat)throw new Error('Runtime compatibility bridge unavailable');

  // Audio slots already exist before Dream mode is applied. Replace them
  // explicitly rather than mutating parser globals; later recovery/personality
  // layers still compose on top of these Dream-safe base implementations.
  compat.replace('ensureAudio',()=>null,'DreamService silence');
  compat.replace('playRelayBurst',()=>{},'DreamService silence');

  window.AGCDSKY_DREAM_SILENT = true;
})();
