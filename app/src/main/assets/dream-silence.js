'use strict';

// Android DreamService uses the same clock renderer as the interactive app,
// but the screen saver must remain silent. Keep the user's saved RELAY CLICKS
// preference untouched so leaving Dream mode restores the normal app exactly as
// configured.
(() => {
  const state = window.AGCDSKY_APP_STATE;
  if (!state || !state.dream) return;
  const audio=window.AGCDSKY_AUDIO;
  if(!audio)throw new Error('Relay audio service unavailable');

  // Audio slots already exist before Dream mode is applied. Install Dream-safe
  // base implementations through the owning service; later recovery/personality
  // layers still compose on top of these implementations.
  audio.installImplementation('ensure',()=>null,'DreamService silence');
  audio.installImplementation('playBurst',()=>{},'DreamService silence');

  window.AGCDSKY_DREAM_SILENT = true;
})();
