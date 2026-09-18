(() => {
  'use strict';

  const api = window.AGCDSKYPWA = window.AGCDSKYPWA || {};
  const dsky = window.AGCDSKY = window.AGCDSKY || {};
  const status = api.capabilities = api.capabilities || {};

  status.orientation = ('DeviceOrientationEvent' in window) ? 'waiting' : 'unsupported';
  status.motion = ('DeviceMotionEvent' in window) ? 'waiting' : 'unsupported';
  status.absoluteOrientation = ('DeviceOrientationEvent' in window) ? 'waiting' : 'unsupported';
  status.wakeLock = ('wakeLock' in navigator) ? 'waiting' : 'unsupported';
  status.camera = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  status.geolocation = 'geolocation' in navigator;

  let motionStarted = false;
  let absoluteStarted = false;
  let relativeSensorStarted = false;
  let linearSensorStarted = false;
  let permissionRequest = null;
  let absoluteSensor = null;
  let relativeSensor = null;
  let linearSensor = null;
  let wakeLock = null;
  const gravity = [0, 0, 0];
  let gravityValid = false;

  const rad = degrees => degrees * Math.PI / 180;
  const normAngle = degrees => ((Number(degrees) % 360) + 360) % 360;

  function isAppleMobileWebKit() {
    const ua = String(navigator.userAgent || '');
    const platform = String(navigator.platform || '');
    const touch = Number(navigator.maxTouchPoints) || 0;
    return /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && touch > 1);
  }

  function isAndroid() {
    return /Android/i.test(String(navigator.userAgent || ''));
  }

  function isBraveBrowser() {
    return !!navigator.brave;
  }

  status.browser = isAndroid() && isBraveBrowser() ? 'brave-android'
    : isAndroid() ? 'chromium-android'
    : isAppleMobileWebKit() ? 'webkit-ios'
    : 'other';
  status.genericAbsolute = typeof window.AbsoluteOrientationSensor === 'function' ? 'available' : 'unsupported';
  status.genericRelative = typeof window.RelativeOrientationSensor === 'function' ? 'available' : 'unsupported';
  status.genericLinearAcceleration = typeof window.LinearAccelerationSensor === 'function' ? 'available' : 'unsupported';
  status.sensorBlock = null;

  function publish() {
    try {
      window.dispatchEvent(new CustomEvent('agcdsky-pwa-status', {detail: {...api}}));
    } catch (_) {}
  }

  function screenAngle() {
    const orientation = screen.orientation;
    const value = orientation && Number.isFinite(orientation.angle)
      ? orientation.angle
      : Number(window.orientation) || 0;
    return normAngle(value);
  }

  function qMul(a, b) {
    return [
      a[0]*b[0] - a[1]*b[1] - a[2]*b[2] - a[3]*b[3],
      a[0]*b[1] + a[1]*b[0] + a[2]*b[3] - a[3]*b[2],
      a[0]*b[2] - a[1]*b[3] + a[2]*b[0] + a[3]*b[1],
      a[0]*b[3] + a[1]*b[2] - a[2]*b[1] + a[3]*b[0]
    ];
  }

  function qAxis(axis, angle) {
    const h = angle / 2, c = Math.cos(h), s = Math.sin(h);
    if (axis === 'x') return [c,s,0,0];
    if (axis === 'y') return [c,0,s,0];
    return [c,0,0,s];
  }

  function qNorm(q) {
    const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
    return q.map(v => v / n);
  }

  function rawQuaternionFromOrientation(alpha, beta, gamma) {
    return qNorm(qMul(qMul(qAxis('z', rad(alpha)), qAxis('x', rad(beta))), qAxis('y', rad(gamma))));
  }

  function motionVector(event) {
    const direct = event.acceleration;
    if (direct && [direct.x, direct.y, direct.z].every(Number.isFinite)) return [direct.x, direct.y, direct.z];

    const withGravity = event.accelerationIncludingGravity;
    if (!withGravity || ![withGravity.x, withGravity.y, withGravity.z].every(Number.isFinite)) return null;
    const v = [withGravity.x, withGravity.y, withGravity.z];
    if (!gravityValid) {
      for (let i=0; i<3; i++) gravity[i] = v[i];
      gravityValid = true;
      return [0,0,0];
    }
    for (let i=0; i<3; i++) gravity[i] = gravity[i] * 0.92 + v[i] * 0.08;
    return v.map((x, i) => x - gravity[i]);
  }

  function onMotion(event) {
    const v = motionVector(event);
    if (!v || typeof dsky.nativePhoneLinearAcceleration !== 'function') return;
    if (!motionStarted) {
      motionStarted = true;
      status.motion = 'active';
      if (typeof dsky.nativePipaSensorStatus === 'function') dsky.nativePipaSensorStatus('web-device-motion', true);
      publish();
    }
    dsky.nativePhoneLinearAcceleration(v[0], v[1], v[2], performance.now()/1000, screenAngle());
  }

  function orientationAccuracy(event) {
    const compassAccuracy = Number(event.webkitCompassAccuracy);
    if (!Number.isFinite(compassAccuracy)) return 1;
    if (compassAccuracy < 0) return 0;
    if (compassAccuracy <= 20) return 3;
    if (compassAccuracy <= 45) return 2;
    return 1;
  }

  function onAbsoluteOrientation(event) {
    if (![event.alpha, event.beta, event.gamma].every(Number.isFinite)) return;
    const compassHeading = Number(event.webkitCompassHeading);
    const hasWebkitCompass = Number.isFinite(compassHeading) && compassHeading >= 0;
    if (event.absolute !== true && !hasWebkitCompass) return;
    if (typeof dsky.nativeMagneticQuaternion !== 'function') return;

    let alpha = Number(event.alpha);
    // WebKit documents alpha/beta/gamma as relative to an arbitrary starting
    // direction. Its webkitCompassHeading is the real-world magnetic heading,
    // so use that for the star-finder world frame.
    if (event.absolute !== true && hasWebkitCompass) alpha = 360 - compassHeading;

    const q = rawQuaternionFromOrientation(alpha, Number(event.beta), Number(event.gamma));
    if (!absoluteStarted) {
      absoluteStarted = true;
      status.absoluteOrientation = 'active';
      if (typeof dsky.nativeMagneticSensorStatus === 'function') dsky.nativeMagneticSensorStatus('web-absolute-orientation', true, true);
      publish();
    }
    dsky.nativeMagneticQuaternion(q[0], q[1], q[2], q[3], screenAngle(), orientationAccuracy(event));
  }


  function sensorError(kind, event) {
    const name = String(event?.error?.name || event?.name || 'SensorError');
    status[kind] = 'error:' + name;
    if (status.browser === 'brave-android' && (name === 'NotAllowedError' || name === 'SecurityError')) {
      status.sensorBlock = 'brave-android-motion-sensors-blocked';
    }
    publish();
  }

  function startGenericSensorFallback() {
    if (isAppleMobileWebKit()) return;

    if (!absoluteSensor && typeof window.AbsoluteOrientationSensor === 'function') {
      try {
        absoluteSensor = new window.AbsoluteOrientationSensor({frequency:30, referenceFrame:'device'});
        absoluteSensor.addEventListener('reading', () => {
          const q = absoluteSensor && absoluteSensor.quaternion;
          if (!q || q.length < 4 || !Array.from(q).every(Number.isFinite)
              || typeof dsky.nativeMagneticQuaternion !== 'function') return;
          if (!absoluteStarted) {
            absoluteStarted = true;
            status.absoluteOrientation = 'active';
            status.genericAbsolute = 'active';
            status.sensorBlock = null;
            if (typeof dsky.nativeMagneticSensorStatus === 'function') {
              dsky.nativeMagneticSensorStatus('web-absolute-orientation-sensor', true, true);
            }
            publish();
          }
          // Generic Sensor quaternion order is [x,y,z,w]; the shared bridge
          // accepts [w,x,y,z].
          dsky.nativeMagneticQuaternion(q[3], q[0], q[1], q[2], screenAngle(), 1);
        });
        absoluteSensor.addEventListener('error', e => {
          sensorError('genericAbsolute', e);
          absoluteSensor = null;
        });
        status.genericAbsolute = 'starting';
        absoluteSensor.start();
      } catch (e) {
        sensorError('genericAbsolute', e);
        absoluteSensor = null;
      }
    }

    if (!relativeSensor && typeof window.RelativeOrientationSensor === 'function') {
      try {
        relativeSensor = new window.RelativeOrientationSensor({frequency:30, referenceFrame:'device'});
        relativeSensor.addEventListener('reading', () => {
          const q = relativeSensor && relativeSensor.quaternion;
          if (!q || q.length < 4 || !Array.from(q).every(Number.isFinite)
              || typeof dsky.nativePhoneQuaternion !== 'function') return;
          if (!relativeSensorStarted) {
            relativeSensorStarted = true;
            status.orientation = 'active';
            status.genericRelative = 'active';
            if (typeof dsky.nativePhoneSensorStatus === 'function') {
              dsky.nativePhoneSensorStatus('web-relative-orientation-sensor', true);
            }
            publish();
          }
          dsky.nativePhoneQuaternion(q[3], q[0], q[1], q[2], screenAngle());
        });
        relativeSensor.addEventListener('error', e => {
          sensorError('genericRelative', e);
          relativeSensor = null;
        });
        status.genericRelative = 'starting';
        relativeSensor.start();
      } catch (e) {
        sensorError('genericRelative', e);
        relativeSensor = null;
      }
    }

    if (!linearSensor && typeof window.LinearAccelerationSensor === 'function') {
      try {
        linearSensor = new window.LinearAccelerationSensor({frequency:30});
        linearSensor.addEventListener('reading', () => {
          const x=Number(linearSensor?.x),y=Number(linearSensor?.y),z=Number(linearSensor?.z);
          if (![x,y,z].every(Number.isFinite) || typeof dsky.nativePhoneLinearAcceleration !== 'function') return;
          if (!linearSensorStarted) {
            linearSensorStarted = true;
            status.motion = 'active';
            status.genericLinearAcceleration = 'active';
            if (typeof dsky.nativePipaSensorStatus === 'function') {
              dsky.nativePipaSensorStatus('web-linear-acceleration-sensor', true);
            }
            publish();
          }
          const ts = Number(linearSensor.timestamp);
          dsky.nativePhoneLinearAcceleration(x,y,z,Number.isFinite(ts)?ts/1000:performance.now()/1000,screenAngle());
        });
        linearSensor.addEventListener('error', e => {
          sensorError('genericLinearAcceleration', e);
          linearSensor = null;
        });
        status.genericLinearAcceleration = 'starting';
        linearSensor.start();
      } catch (e) {
        sensorError('genericLinearAcceleration', e);
        linearSensor = null;
      }
    }
  }

  function addSensorListeners() {
    window.addEventListener('devicemotion', onMotion, {capture:true, passive:true});
    window.addEventListener('deviceorientationabsolute', onAbsoluteOrientation, {capture:true, passive:true});
    window.addEventListener('deviceorientation', onAbsoluteOrientation, {capture:true, passive:true});
  }

  async function requestSensorPermissions(options={}) {
    const absolute = options === true || !!(options && options.absolute);
    if (permissionRequest) return permissionRequest;

    // iPhone/iPad WebKit exposes the usable magnetic heading through
    // deviceorientation.webkitCompassHeading after the ordinary orientation
    // permission grant. Passing the newer absolute=true form there can produce
    // a denial even though the legacy WebKit compass path is available.
    const appleWebKitCompass = isAppleMobileWebKit();

    const run = (async () => {
      let orientationRequest = Promise.resolve(window.DeviceOrientationEvent ? 'granted' : 'unsupported');
      let motionRequest = Promise.resolve(window.DeviceMotionEvent ? 'granted' : 'unsupported');

      try {
        const Orientation = window.DeviceOrientationEvent;
        if (Orientation && typeof Orientation.requestPermission === 'function') {
          orientationRequest = absolute && !appleWebKitCompass
            ? Orientation.requestPermission(true)
            : Orientation.requestPermission();
        }
      } catch (_) { orientationRequest = Promise.resolve('error'); }

      try {
        const Motion = window.DeviceMotionEvent;
        if (Motion && typeof Motion.requestPermission === 'function') {
          motionRequest = Motion.requestPermission();
        }
      } catch (_) { motionRequest = Promise.resolve('error'); }

      const [orientationState, motionState] = await Promise.all([
        Promise.resolve(orientationRequest).catch(() => 'error'),
        Promise.resolve(motionRequest).catch(() => 'error')
      ]);

      const orientationAllowed = orientationState === 'granted';
      const motionAllowed = motionState === 'granted';

      status.orientation = orientationAllowed ? 'enabled'
        : orientationState === 'unsupported' ? 'unsupported'
        : orientationState === 'error' ? 'error' : 'denied';
      status.motion = motionAllowed ? 'enabled'
        : motionState === 'unsupported' ? 'unsupported'
        : motionState === 'error' ? 'error' : 'denied';

      // For Apple WebKit, webkitCompassHeading is the absolute-heading source
      // carried by the ordinary deviceorientation stream. Other browsers use
      // deviceorientationabsolute after requestPermission(true).
      if (absolute) {
        status.absoluteOrientation = orientationAllowed ? 'enabled' : status.orientation;
      } else if (!orientationAllowed && status.absoluteOrientation !== 'active') {
        status.absoluteOrientation = status.orientation;
      }

      if (status.browser === 'brave-android' && (orientationState === 'denied' || motionState === 'denied')) {
        status.sensorBlock = 'brave-android-motion-sensors-blocked';
      }
      startGenericSensorFallback();
      publish();
      return {...status};
    })();

    permissionRequest = run;
    try { return await run; }
    finally { if (permissionRequest === run) permissionRequest = null; }
  }

  async function acquireWakeLock() {
    if (!('wakeLock' in navigator) || document.hidden || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      status.wakeLock = 'active';
      delete status.wakeLockError;
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
        status.wakeLock = 'released';
        publish();
      }, {once:true});
      publish();
    } catch (error) {
      status.wakeLock = 'error';
      status.wakeLockError = String(error && error.name ? error.name : error);
      publish();
    }
  }

  function completedGesture() {
    // Sensor prompts belong to the control that needs them (not an arbitrary
    // first tap on the page). Keep only the wake-lock opportunistic request.
    acquireWakeLock();
  }

  addSensorListeners();
  for (const eventName of ['pointerup', 'touchend', 'click']) {
    document.addEventListener(eventName, completedGesture, {capture:true, passive:true, once:true});
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      gravityValid = false;
      return;
    }
    acquireWakeLock();
  }, {passive:true});

  window.addEventListener('pageshow', acquireWakeLock, {passive:true});
  api.requestSensorPermissions = requestSensorPermissions;
  api.acquireWakeLock = acquireWakeLock;
  api.parityStatus = () => ({...status});
  acquireWakeLock();
  publish();
})();
