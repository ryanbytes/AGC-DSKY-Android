# SXT camera lifecycle

The home-screen EL widget does not access the camera. It launches the interactive activity through the `MainActivity` alias.

When the SXT view is open, `optics.js` owns the camera stream. The camera stream is explicitly released when the document becomes hidden and reacquired when the document becomes visible again, while preserving the open SXT view and phone-side pointing state. A late `getUserMedia()` result is discarded if the app was backgrounded or the SXT was closed before the request completed.

`tools/optics-lifecycle-smoke.js` guards this behavior in the repository verification harness.
