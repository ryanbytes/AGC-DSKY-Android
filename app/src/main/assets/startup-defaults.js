(() => {
  try {
    if (localStorage.getItem('runMode') === null) {
      localStorage.setItem('runMode', 'clock');
    }
  } catch (e) {
    // app.js already handles unavailable localStorage; leave its in-memory clock default alone.
  }
})();
