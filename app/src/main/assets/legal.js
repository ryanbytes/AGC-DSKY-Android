'use strict';
(() => {
  const SOURCE_REPO = 'https://github.com/ryanbytes/AGC-DSKY-Android';
  const SOURCE_SNAPSHOT = 'release/1.0-commercial-1';
  const PRIVACY_URL = 'https://github.com/ryanbytes/AGC-DSKY-Android/blob/release/1.0-commercial-1/PRIVACY.md';
  let panel = null;
  let loaded = false;

  function escapeHtml(value){
    return String(value).replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));
  }

  function build(){
    if (panel) return panel;
    document.body.insertAdjacentHTML('beforeend', `
      <section id="legal-panel" role="dialog" aria-modal="true" aria-label="Legal, privacy, and source information">
        <div class="legal-head"><strong>LEGAL / SOURCE</strong><button id="legal-close" type="button">CLOSE</button></div>
        <div class="legal-body">
          <h2>AGC DSKY Android 1.0</h2>
          <p class="legal-note">Independent historical simulator. Not affiliated with, sponsored by, or endorsed by NASA or the United States Government.</p>
          <h3>Privacy</h3>
          <p>The app processes camera, location, and motion-sensor inputs locally for simulator features. It does not declare the Android INTERNET permission and does not intentionally transmit user data to the developer or third parties.</p>
          <p>Public privacy policy: <code>${PRIVACY_URL}</code></p>
          <details><summary>PRIVACY POLICY</summary><pre id="legal-privacy">Loading packaged privacy policy…</pre></details>
          <h3>Corresponding source</h3>
          <p>This binary is distributed under GNU GPL version 2. The public corresponding-source repository is:</p>
          <p><code>${SOURCE_REPO}</code></p>
          <p>Commercial release source snapshot: <code>${SOURCE_SNAPSHOT}</code>.</p>
          <p>Recipients may copy, modify, and redistribute the GPL-covered software under GPLv2. No warranty is provided except as required by applicable law.</p>
          <details><summary>GNU GPL VERSION 2</summary><pre id="legal-gpl">Loading packaged license…</pre></details>
          <details><summary>THIRD-PARTY NOTICES</summary><pre id="legal-third">Loading packaged notices…</pre></details>
        </div>
      </section>`);
    panel = document.getElementById('legal-panel');
    document.getElementById('legal-close').addEventListener('click', close);
    panel.addEventListener('click', e => { if (e.target === panel) close(); });
    return panel;
  }

  async function loadText(id, file){
    const target = document.getElementById(id);
    if (!target) return;
    try {
      const response = await fetch(file, {cache:'no-store'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      target.innerHTML = escapeHtml(await response.text());
    } catch (error) {
      target.textContent = `Packaged notice unavailable: ${error && error.message ? error.message : error}`;
    }
  }

  function open(){
    build().classList.add('open');
    if (!loaded) {
      loaded = true;
      loadText('legal-privacy','PRIVACY_POLICY.txt');
      loadText('legal-gpl','LICENSE-GPL-2.0.txt');
      loadText('legal-third','THIRD_PARTY_NOTICES.txt');
    }
  }
  function close(){ if (panel) panel.classList.remove('open'); }

  function init(){
    const launch = document.getElementById('legal');
    if (launch) launch.addEventListener('click', open);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
