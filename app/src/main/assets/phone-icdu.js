'use strict';

/*
 * Phone motion sensors -> Apollo IMU CDU pulse inputs.
 *
 * This deliberately does NOT write Noun 20, erasable memory, or DSKY fields.
 * The handset orientation is converted into physical-style incremental CDU
 * pulses through VirtualAGC unprogrammed-increment packets for counters 032/033/034.  Comanche then
 * sees CDUX/CDUY/CDUZ exactly as it would see the spacecraft IMU CDU counters.
 *
 * Axis nomenclature from the flight software:
 *   CDUX = outer gimbal (phi)
 *   CDUY = inner gimbal (theta)
 *   CDUZ = middle gimbal (psi)
 *
 * CDU resolution is 2^15 counts/revolution (32768 / 360 degrees).
 */
(() => {
  const api = window.AGCDSKY = window.AGCDSKY || {};
  const CDU_CHANNEL = [0o200 | 0o32, 0o200 | 0o33, 0o200 | 0o34];
  // Socket t-bit 0200 marks an unprogrammed counter sequence.
  // Counter 032/033/034 are CDUX/CDUY/CDUZ.  Fictitious 0174/0175/0176
  // are yaAGC IMU-drive OUTPUT channels and must never be used as inputs.
  const PCDU_FAST = 0o21;
  const MCDU_FAST = 0o23;
  const COUNTS_PER_REV = 32768;
  const COUNTS_PER_DEG = COUNTS_PER_REV / 360;
  const MAX_PULSES_PER_AXIS_PER_PUMP = 24; // 24 * 250 Hz = 6000 cps, below 6400-cps CDU high rate.

  // Apollo CM PIPAs: counters 037/040/041, entered through the socket
  // protocol t-bit as unprogrammed PINC/MINC sequences. One CM PIPA pulse
  // represents 5.85 cm/s of accumulated delta-V.
  const PIPA_CHANNEL = [0o200 | 0o37, 0o200 | 0o40, 0o200 | 0o41];
  const PINC = 0o00;
  const MINC = 0o02;
  const PIPA_DV_PER_PULSE = 0.0585; // m/s per pulse, Comanche/CM scale.
  const MAX_PIPA_PULSES_PER_AXIS_PER_PUMP = 16;
  const PIPA_CAL_SAMPLES = 60;

  let referenceQ = null;
  let lastEuler = null;
  let unwrappedDeg = [0, 0, 0];
  let baselineCounts = [0, 0, 0];
  let desiredCounts = [0, 0, 0];
  let emittedCounts = [0, 0, 0];
  let pending = [0, 0, 0];
  let sensorSeen = false;
  let sensorSource = 'none';
  let nativeSensorName = 'none';
  let permissionRequested = false;
  let screenEpoch = screenAngle();
  let latestQ = null;

  // While the camera sextant is open the handset becomes the optical hand
  // controller.  Phone motion is then consumed by the optics proxy and must
  // not simultaneously move the simulated spacecraft ICDUs or PIPAs.
  let opticsCapture = false;
  let opticsReferenceQ = null;
  let opticsAngles = [0,0,0];

  // Absolute magnetic rotation-vector reference. This never writes an AGC
  // channel directly; it only removes long-term yaw drift from the phone's
  // GAME_ROTATION_VECTOR while preserving the user's zero reference.
  let magneticQ = null;
  let magneticRawQ = null;
  let magneticSeen = false;
  let magneticSensorName = 'none';
  let magneticAccuracy = 0;
  let magneticEnabled = true;
  let magneticReferenceYaw = null;
  let magneticYawCorrection = 0;

  let pipaSensorSeen = false;
  let pipaSensorName = 'none';
  let pipaLastTimestamp = null;
  let pipaBias = [0,0,0];
  let pipaFraction = [0,0,0];
  let pipaPending = [0,0,0];
  let pipaEmitted = [0,0,0];
  let pipaCalRemaining = 0;
  let pipaCalSum = [0,0,0];
  let pipaCalibrated = false;
  let pipaLatestAcceleration = [0,0,0];
  let pipaLatestTimestamp = null;

  // True camera boresight from the native absolute rotation vector. This is
  // phone-side star-finder data only and is never written to the AGC.
  let skyPointing = {seen:false,az:NaN,alt:NaN,accuracy:0,declination:0,timestamp:0,source:'none'};
  let rawNativeSky = {seen:false,az:NaN,alt:NaN,accuracy:0,declination:0,timestamp:0};
  let skyDeclination = 0;
  const SKY_CAL_KEY = 'sxtCameraBoresightV1';
  let cameraBoresightDevice = [0,0,-1];
  let skyCalibration = null;

  // Phone-side sensor health only. These counters never affect the AGC.
  const health = {
    imu:{last:0,hz:0,count:0,windowStart:performance.now()},
    mag:{last:0,hz:0,count:0,windowStart:performance.now()},
    pipa:{last:0,hz:0,count:0,windowStart:performance.now()}
  };
  let cduWriteRejected=0,pipaWriteRejected=0,lastCduAccept=0,lastPipaAccept=0;
  function sampleHealth(k){
    const h=health[k],now=performance.now(); if(!h)return;
    h.last=Date.now(); h.count++;
    const dt=now-h.windowStart;
    if(dt>=1000){h.hz=h.count*1000/dt;h.count=0;h.windowStart=now}
  }
  function unit3(v){const n=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/n,v[1]/n,v[2]/n]}
  function loadSkyCalibration(){
    try{
      const c=JSON.parse(localStorage.getItem(SKY_CAL_KEY)||'null');
      if(c&&c.schema===1&&Array.isArray(c.boresight)&&c.boresight.length===3&&c.boresight.every(Number.isFinite)){
        cameraBoresightDevice=unit3(c.boresight.map(Number));skyCalibration=c;
      }
    }catch(_){ }
  }
  loadSkyCalibration();

  const rad = d => d * Math.PI / 180;
  const deg = r => r * 180 / Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap180 = a => ((a + 180) % 360 + 360) % 360 - 180;

  function screenAngle() {
    const s = screen.orientation;
    const a = s && Number.isFinite(s.angle) ? s.angle : (Number(window.orientation) || 0);
    return ((a % 360) + 360) % 360;
  }

  function qMul(a, b) {
    return [
      a[0]*b[0] - a[1]*b[1] - a[2]*b[2] - a[3]*b[3],
      a[0]*b[1] + a[1]*b[0] + a[2]*b[3] - a[3]*b[2],
      a[0]*b[2] - a[1]*b[3] + a[2]*b[0] + a[3]*b[1],
      a[0]*b[3] + a[1]*b[2] - a[2]*b[1] + a[3]*b[0]
    ];
  }

  function qConj(q) { return [q[0], -q[1], -q[2], -q[3]]; }

  function qNorm(q) {
    const n = Math.hypot(q[0],q[1],q[2],q[3]) || 1;
    return q.map(v => v/n);
  }

  function qRotate(q, v) {
    const [w,x,y,z] = q, [vx,vy,vz] = v;
    const tx = 2 * (y*vz - z*vy);
    const ty = 2 * (z*vx - x*vz);
    const tz = 2 * (x*vy - y*vx);
    return [
      vx + w*tx + (y*tz - z*ty),
      vy + w*ty + (z*tx - x*tz),
      vz + w*tz + (x*ty - y*tx)
    ];
  }

  function rotateScreenVector(v, angleDeg) {
    const a = rad(angleDeg), c = Math.cos(a), sn = Math.sin(a);
    return [c*v[0] - sn*v[1], sn*v[0] + c*v[1], v[2]];
  }

  function qAxis(axis, angleRad) {
    const h = angleRad/2, c = Math.cos(h), s = Math.sin(h);
    if (axis === 'x') return [c,s,0,0];
    if (axis === 'y') return [c,0,s,0];
    return [c,0,0,s];
  }

  // DeviceOrientation uses intrinsic Z-X'-Y'' rotations. Convert that to a
  // quaternion, then rotate the device frame by the current display rotation
  // so portrait/landscape do not silently swap CDU axes.
  function quaternionFromDeviceOrientation(alpha, beta, gamma) {
    let q = qMul(qMul(qAxis('z',rad(alpha)), qAxis('x',rad(beta))), qAxis('y',rad(gamma)));
    q = qMul(q, qAxis('z', -rad(screenAngle())));
    return qNorm(q);
  }

  // Relative orientation -> conventional X/Y/Z roll/pitch/yaw decomposition.
  // These are used as the simulated outer/inner/middle gimbal angles.
  function eulerXYZ(q) {
    const [w,x,y,z] = q;
    const sinr = 2*(w*x + y*z);
    const cosr = 1 - 2*(x*x + y*y);
    const roll = Math.atan2(sinr, cosr);
    const sinp = clamp(2*(w*y - z*x), -1, 1);
    const pitch = Math.asin(sinp);
    const siny = 2*(w*z + x*y);
    const cosy = 1 - 2*(y*y + z*z);
    const yaw = Math.atan2(siny, cosy);
    return [deg(roll), deg(pitch), deg(yaw)];
  }

  function zeroHere(q=null) {
    referenceQ = q;
    if (magneticQ) magneticReferenceYaw = eulerXYZ(magneticQ)[2];
    else magneticReferenceYaw = null;
    magneticYawCorrection = 0;
    lastEuler = [0,0,0];
    unwrappedDeg = [0,0,0];
    baselineCounts = emittedCounts.slice();
    desiredCounts = emittedCounts.slice();
    pending = [0,0,0];
    // A recenter changes the simulated stable-platform axes. Do not carry a
    // sub-pulse delta-V fragment across that coordinate-frame change.
    pipaLastTimestamp = null;
    pipaFraction = [0,0,0];
    updateButton();
    updatePipaButton();
  }

  function ingestQuaternion(q, effectiveScreenAngle=screenAngle()) {
    sampleHealth('imu');
    sensorSeen = true;
    latestQ = q;
    const core = typeof api.getCore === 'function' ? api.getCore() : null;
    // Clock mode and Android backgrounding intentionally pause the simulated AGC.
    // Rebase the phone while paused so moving the handset outside AGC mode cannot
    // create a hidden attitude jump when the core resumes.
    if (!core || !core.running) {
      referenceQ = q;
      if (magneticQ) magneticReferenceYaw = eulerXYZ(magneticQ)[2];
      else magneticReferenceYaw = null;
      magneticYawCorrection = 0;
      lastEuler = null;
      unwrappedDeg = [0,0,0];
      baselineCounts = emittedCounts.slice();
      desiredCounts = emittedCounts.slice();
      pending = [0,0,0];
      updateButton();
      return;
    }
    const currentScreen = effectiveScreenAngle;
    if (currentScreen !== screenEpoch) {
      screenEpoch = currentScreen;
      if (opticsCapture) {
        opticsReferenceQ = q;
        opticsAngles = [0,0,0];
      }
      zeroHere(q);
      return;
    }

    if (opticsCapture) {
      if (!opticsReferenceQ) opticsReferenceQ = q;
      const opticalRel = qNorm(qMul(qConj(opticsReferenceQ), q));
      opticsAngles = eulerXYZ(opticalRel);

      // Treat handset motion as movement of the optical line of sight only.
      // Continuously rebase the spacecraft-phone relationship so closing the
      // sextant cannot create a hidden ICDU jump from the aiming motion.
      referenceQ = q;
      lastEuler = [0,0,0];
      unwrappedDeg = [0,0,0];
      baselineCounts = emittedCounts.slice();
      desiredCounts = emittedCounts.slice();
      pending = [0,0,0];
      updateButton();
      return;
    }

    if (!referenceQ) {
      zeroHere(q);
      return;
    }

    const rel = qNorm(qMul(qConj(referenceQ), q));
    const e = eulerXYZ(rel);

    // GAME_ROTATION_VECTOR intentionally ignores magnetic north and therefore
    // has excellent short-term motion but can drift in yaw. Use the absolute
    // rotation vector only as a very slow yaw reference. At IMU ZERO we store
    // the current magnetic yaw, so this cannot pull the simulated spacecraft
    // toward magnetic north; it only corrects drift relative to that zero.
    if (magneticEnabled && magneticSeen && magneticQ && magneticReferenceYaw != null
        && magneticAccuracy !== 0) {
      const magRelYaw = wrap180(eulerXYZ(magneticQ)[2] - magneticReferenceYaw);
      const err = wrap180(magRelYaw - (e[2] + magneticYawCorrection));
      magneticYawCorrection += clamp(err * 0.0025, -0.05, 0.05);
      e[2] += magneticYawCorrection;
    }
    if (!lastEuler) {
      lastEuler = e;
      updateButton();
      return;
    }

    // Unwrap each gimbal continuously. A real CDU is a cyclic incremental
    // counter; crossing 0/360 must generate a small delta, not a 360-degree jump.
    for (let axis=0; axis<3; axis++) {
      unwrappedDeg[axis] += wrap180(e[axis] - lastEuler[axis]);
      desiredCounts[axis] = baselineCounts[axis] + Math.round(unwrappedDeg[axis] * COUNTS_PER_DEG);
      pending[axis] = desiredCounts[axis] - emittedCounts[axis];
    }
    lastEuler = e;
    updateButton();
  }

  function startPipaCalibration() {
    pipaCalRemaining = PIPA_CAL_SAMPLES;
    pipaCalSum = [0,0,0];
    pipaLastTimestamp = null;
    pipaFraction = [0,0,0];
    pipaCalibrated = false;
    updatePipaButton();
  }

  function updatePipaButton() {
    const b = document.getElementById('pipa-cal');
    if (!b) return;
    if (!pipaSensorSeen) b.textContent = 'PIPA SENSOR WAITING';
    else if (pipaCalRemaining > 0) b.textContent = 'PIPA CALIBRATING…';
    else b.textContent = 'PIPA CALIBRATE';
    b.title = pipaSensorSeen
      ? ('Phone acceleration active via ' + pipaSensorName
          + '. Tap while holding still to recalibrate phone bias; AGC PIPA counters are not reset')
      : 'Waiting for phone linear-acceleration sensor';
  }

  function ingestLinearAcceleration(ax, ay, az, timestampSeconds, effectiveScreenAngle=screenAngle()) {
    if (![ax,ay,az,timestampSeconds].every(Number.isFinite)) return;
    sampleHealth('pipa');
    pipaSensorSeen = true;
    const core = typeof api.getCore === 'function' ? api.getCore() : null;

    // Aiming the sextant is an input-device gesture, not spacecraft
    // acceleration. Discard accelerometer integration while SXT is open.
    if (opticsCapture) {
      pipaLastTimestamp = timestampSeconds;
      pipaFraction = [0,0,0];
      pipaPending = [0,0,0];
      return;
    }

    // Sensor vector is in Android device axes. Remap it to screen axes, then
    // rotate through the current body-to-reference attitude so the PIPAs live
    // in the same simulated stable-platform frame as CDUX/CDUY/CDUZ.
    let v = rotateScreenVector([ax,ay,az], effectiveScreenAngle);
    if (referenceQ && latestQ) {
      const rel = qNorm(qMul(qConj(referenceQ), latestQ));
      v = qRotate(rel, v);
    }
    pipaLatestAcceleration = v.slice();
    pipaLatestTimestamp = timestampSeconds;

    if (pipaCalRemaining > 0) {
      for (let i=0;i<3;i++) pipaCalSum[i] += v[i];
      pipaCalRemaining--;
      pipaLastTimestamp = timestampSeconds;
      if (pipaCalRemaining === 0) {
        pipaBias = pipaCalSum.map(x => x / PIPA_CAL_SAMPLES);
        pipaCalibrated = true;
        pipaFraction = [0,0,0];
      }
      updatePipaButton();
      return;
    }

    // As with the ICDUs, CLOCK/background motion is intentionally discarded.
    if (!core || !core.running || !referenceQ || !latestQ) {
      pipaLastTimestamp = timestampSeconds;
      pipaFraction = [0,0,0];
      pipaPending = [0,0,0];
      updatePipaButton();
      return;
    }

    if (pipaLastTimestamp == null) {
      pipaLastTimestamp = timestampSeconds;
      return;
    }
    let dt = timestampSeconds - pipaLastTimestamp;
    pipaLastTimestamp = timestampSeconds;
    if (!(dt > 0) || dt > 0.20) return;
    dt = Math.min(dt, 0.05);

    for (let axis=0; axis<3; axis++) {
      const corrected = v[axis] - pipaBias[axis];
      pipaFraction[axis] += corrected * dt / PIPA_DV_PER_PULSE;
      const whole = pipaFraction[axis] < 0 ? Math.ceil(pipaFraction[axis]) : Math.floor(pipaFraction[axis]);
      if (whole) {
        pipaPending[axis] += whole;
        pipaFraction[axis] -= whole;
      }
    }
    updatePipaButton();
  }

  function pulsePipa(core, axis, sign) {
    const accepted = core.writeIo(PIPA_CHANNEL[axis], sign > 0 ? PINC : MINC);
    if (!(accepted > 0)) { pipaWriteRejected++; return false; }
    lastPipaAccept=Date.now();
    pipaEmitted[axis] += sign > 0 ? 1 : -1;
    pipaPending[axis] -= sign;
    return true;
  }

  function pumpPipas(core) {
    if (!pipaSensorSeen) return;
    for (let axis=0; axis<3; axis++) {
      const left = pipaPending[axis] | 0;
      if (!left) continue;
      const sign = left > 0 ? 1 : -1;
      const n = Math.min(Math.abs(left), MAX_PIPA_PULSES_PER_AXIS_PER_PUMP);
      for (let i=0; i<n; i++) {
        if (!pulsePipa(core, axis, sign)) break;
      }
    }
  }

  function onDeviceOrientation(e) {
    if (!Number.isFinite(e.alpha) || !Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return;
    // Native Android rotation-vector data wins when available. Browser motion
    // remains only as a fallback for non-Android/web use.
    if (sensorSource === 'native') return;
    sensorSource = 'web';
    ingestQuaternion(quaternionFromDeviceOrientation(e.alpha,e.beta,e.gamma), screenAngle());
  }

  function requestPermission() {
    if (permissionRequested) return;
    permissionRequested = true;
    try {
      const D = window.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function') {
        D.requestPermission().then(state => {
          if (state === 'granted') addEventListener('deviceorientation',onDeviceOrientation,true);
        }).catch(()=>{});
      }
    } catch (_) {}
  }

  function pulse(core, axis, sign) {
    // VirtualAGC unprogrammed increment protocol: 01 = +CDU, 03 = -CDU;
    // bit 020 requests the genuine 6400-cps high-rate CDU path.
    const accepted = core.writeIo(CDU_CHANNEL[axis], sign > 0 ? PCDU_FAST : MCDU_FAST);
    if (!(accepted > 0)) { cduWriteRejected++; return false; } // Ring buffer full: retry this physical pulse later.
    lastCduAccept=Date.now();
    emittedCounts[axis] += sign > 0 ? 1 : -1;
    pending[axis] = desiredCounts[axis] - emittedCounts[axis];
    return true;
  }

  function pump() {
    const core = typeof api.getCore === 'function' ? api.getCore() : null;
    if (!core || !core.running || !sensorSeen) return;
    if (opticsCapture) return;
    for (let axis=0; axis<3; axis++) {
      let left = pending[axis] | 0;
      if (!left) continue;
      const sign = left > 0 ? 1 : -1;
      const n = Math.min(Math.abs(left), MAX_PULSES_PER_AXIS_PER_PUMP);
      for (let i=0; i<n; i++) {
        if (!pulse(core,axis,sign)) break;
      }
    }
    pumpPipas(core);
  }

  function updateButton() {
    const b = document.getElementById('imu-zero');
    if (!b) return;
    b.textContent = sensorSeen ? (sensorSource==='native' ? 'IMU ZERO' : 'IMU ZERO WEB SENSOR') : 'IMU SENSOR WAITING';
    b.title = sensorSeen
      ? ('Phone IMU active via ' + sensorSource + (sensorSource==='native' ? ' ('+nativeSensorName+')' : '')
          + (magneticSeen ? (magneticEnabled ? '; magnetic yaw drift correction active' : '; magnetic correction disabled') : '')
          + '. Tap to re-center without altering current AGC CDU counts')
      : 'Waiting for phone orientation sensor';
  }

  function updateMagButton() {
    const b = document.getElementById('mag-lock');
    if (!b) return;
    if (!magneticSeen) b.textContent = 'MAGNETOMETER WAITING';
    else b.textContent = magneticEnabled ? 'MAGNETOMETER ON' : 'MAGNETOMETER OFF';
    b.title = magneticSeen
      ? ('Magnetometer-assisted yaw drift correction via ' + magneticSensorName
          + (magneticAccuracy === 0 ? ' (accuracy unreliable)' : '')
          + '. This does not feed magnetic heading into the AGC.')
      : 'Waiting for magnetic rotation-vector reference';
  }

  // Android WebView delivers DeviceOrientation directly on supported devices.
  addEventListener('deviceorientation',onDeviceOrientation,true);
  addEventListener('orientationchange',()=>{ screenEpoch=screenAngle(); referenceQ=null; lastEuler=null; },{passive:true});
  document.addEventListener('pointerdown',requestPermission,{once:true,passive:true});
  document.addEventListener('click',e=>{
    if (e.target && e.target.id === 'imu-zero') {
      referenceQ = null;
      lastEuler = null;
      unwrappedDeg = [0,0,0];
      baselineCounts = emittedCounts.slice();
      desiredCounts = emittedCounts.slice();
      pending = [0,0,0];
      pipaLastTimestamp = null;
      pipaFraction = [0,0,0];
      requestPermission();
      updateButton();
    } else if (e.target && e.target.id === 'pipa-cal') {
      startPipaCalibration();
    } else if (e.target && e.target.id === 'mag-lock') {
      magneticEnabled = !magneticEnabled;
      magneticYawCorrection = 0;
      magneticReferenceYaw = magneticQ ? eulerXYZ(magneticQ)[2] : null;
      updateMagButton();
      updateButton();
    }
  },true);


  // Native Android SensorManager bridge. q is Android's [w,x,y,z]
  // rotation-vector quaternion. Right-multiply by display rotation so phone
  // screen X/Y remain the CDU outer/inner axes in portrait or landscape.
  api.nativePhoneQuaternion = (w,x,y,z,displayAngle=0) => {
    if (![w,x,y,z].every(Number.isFinite)) return;
    const a = Number.isFinite(displayAngle) ? ((displayAngle%360)+360)%360 : 0;
    sensorSource = 'native';
    sensorSeen = true;
    let q = qNorm([w,x,y,z]);
    q = qNorm(qMul(q, qAxis('z', -rad(a))));
    ingestQuaternion(q, a);
  };

  api.setOpticsCaptureActive = active => {
    opticsCapture = !!active;
    opticsAngles = [0,0,0];
    opticsReferenceQ = opticsCapture ? latestQ : null;
    pipaLastTimestamp = null;
    pipaFraction = [0,0,0];
    pipaPending = [0,0,0];
    if (latestQ) {
      referenceQ = latestQ;
      lastEuler = [0,0,0];
      unwrappedDeg = [0,0,0];
      baselineCounts = emittedCounts.slice();
      desiredCounts = emittedCounts.slice();
      pending = [0,0,0];
    }
  };

  api.zeroOpticsCapture = () => {
    if (!opticsCapture) return false;
    opticsReferenceQ = latestQ;
    opticsAngles = [0,0,0];
    return !!latestQ;
  };

  api.phoneOpticsAngles = () => ({
    active: opticsCapture,
    sensorSeen,
    roll: opticsAngles[0],
    pitch: opticsAngles[1],
    yaw: opticsAngles[2]
  });

  api.nativePhoneSensorStatus = (name,available) => {
    nativeSensorName = String(name || 'unknown');
    if (!available && sensorSource !== 'web') {
      sensorSource = 'none';
      sensorSeen = false;
    }
    updateButton();
  };

  function publishSkyPointing(az,alt,accuracy=0,declination=0,source='native') {
    az=Number(az);alt=Number(alt);accuracy=Number(accuracy);declination=Number(declination);
    if(!Number.isFinite(az)||!Number.isFinite(alt))return;
    skyPointing={seen:true,az:((az%360)+360)%360,alt,
      accuracy:Number.isFinite(accuracy)?accuracy:0,
      declination:Number.isFinite(declination)?declination:0,
      timestamp:Date.now(),source:String(source||'native')};
    try{dispatchEvent(new CustomEvent('agcdsky-skypointing',{detail:{...skyPointing}}))}catch(_){ }
  }

  function horizontalVector(azDeg,altDeg){
    const az=rad(azDeg),alt=rad(altDeg),ca=Math.cos(alt);
    return [ca*Math.sin(az),ca*Math.cos(az),Math.sin(alt)]; // east,north,up
  }
  function horizontalFromVector(v){
    const east=v[0],north=v[1],up=v[2],h=Math.hypot(east,north);
    if(!Number.isFinite(h)||(!h&&Math.abs(up)<1e-9))return null;
    return {az:((deg(Math.atan2(east,north))%360)+360)%360,alt:deg(Math.atan2(up,h))};
  }
  function skyFromAbsoluteQuaternion(rawQ,accuracy=0) {
    if(!rawQ)return;
    // Android absolute ROTATION_VECTOR is referenced to magnetic East/North/Up.
    // The persisted boresight is a physical vector in the phone's device frame,
    // so camera/sensor mounting offsets remain valid in portrait and landscape.
    const v=qRotate(rawQ,cameraBoresightDevice),h=horizontalFromVector(v);if(!h)return;
    publishSkyPointing(h.az+skyDeclination,h.alt,accuracy,skyDeclination,
      skyCalibration?'rotation-vector-calibrated':'rotation-vector');
  }

  api.calibrateSkyBoresight = (targetAz,targetAlt,label='') => {
    targetAz=Number(targetAz);targetAlt=Number(targetAlt);
    if(!magneticRawQ||![targetAz,targetAlt].every(Number.isFinite))return {ok:false,error:'ABSOLUTE ROTATION VECTOR WAITING'};
    // Convert true target azimuth into the magnetic ENU frame used by Android.
    const targetMag=horizontalVector(targetAz-skyDeclination,targetAlt);
    cameraBoresightDevice=unit3(qRotate(qConj(magneticRawQ),targetMag));
    skyCalibration={schema:1,boresight:cameraBoresightDevice.slice(),timestamp:Date.now(),label:String(label||''),declination:skyDeclination};
    try{localStorage.setItem(SKY_CAL_KEY,JSON.stringify(skyCalibration))}catch(_){ }
    skyFromAbsoluteQuaternion(magneticRawQ,magneticAccuracy);
    return {ok:true,calibration:{...skyCalibration}};
  };
  api.clearSkyBoresightCalibration = () => {
    cameraBoresightDevice=[0,0,-1];skyCalibration=null;
    try{localStorage.removeItem(SKY_CAL_KEY)}catch(_){ }
    if(magneticRawQ)skyFromAbsoluteQuaternion(magneticRawQ,magneticAccuracy);
    return true;
  };
  api.skyCalibrationStatus = () => ({calibrated:!!skyCalibration,calibration:skyCalibration?{...skyCalibration}:null,boresight:cameraBoresightDevice.slice(),declination:skyDeclination,rawNative:{...rawNativeSky}});
  api.projectSkyTarget = (targetAz,targetAlt) => {
    targetAz=Number(targetAz);targetAlt=Number(targetAlt);
    if(!magneticRawQ||![targetAz,targetAlt].every(Number.isFinite))return null;
    const targetWorldMag=horizontalVector(targetAz-skyDeclination,targetAlt);
    const targetDevice=unit3(qRotate(qConj(magneticRawQ),targetWorldMag));
    const b=unit3(cameraBoresightDevice);
    const dot=(a,c)=>a[0]*c[0]+a[1]*c[1]+a[2]*c[2];
    const cross=(a,c)=>[a[1]*c[2]-a[2]*c[1],a[2]*c[0]-a[0]*c[2],a[0]*c[1]-a[1]*c[0]];
    // Device +X is screen-right. Project it onto the calibrated camera tangent
    // plane; +Y then defines screen-up. This keeps the cue correct while the
    // handset is rolled, unlike an azimuth/elevation-only arrow.
    let right=[1,0,0];
    const rb=dot(right,b);right=unit3([right[0]-rb*b[0],right[1]-rb*b[1],right[2]-rb*b[2]]);
    if(Math.hypot(...right)<1e-5){right=[0,1,0];const r2=dot(right,b);right=unit3([right[0]-r2*b[0],right[1]-r2*b[1],right[2]-r2*b[2]])}
    const up=unit3(cross(right,b));
    const f=clamp(dot(targetDevice,b),-1,1),x=dot(targetDevice,right),y=dot(targetDevice,up);
    const distance=deg(Math.acos(f));
    return {distance,screenAngle:deg(Math.atan2(x,y)),x,y,forward:f,accuracy:magneticAccuracy,calibrated:!!skyCalibration,timestamp:Date.now()};
  };

  api.nativeMagneticQuaternion = (w,x,y,z,displayAngle=0,accuracy=1) => {
    if (![w,x,y,z].every(Number.isFinite)) return;
    sampleHealth('mag');
    const a = Number.isFinite(displayAngle) ? ((displayAngle%360)+360)%360 : 0;
    magneticRawQ = qNorm([w,x,y,z]);
    let q = qNorm(qMul(magneticRawQ, qAxis('z', -rad(a))));
    magneticQ = q;
    magneticSeen = true;
    magneticAccuracy = Number.isFinite(accuracy) ? Number(accuracy) : 1;
    skyFromAbsoluteQuaternion(magneticRawQ,magneticAccuracy);
    if (referenceQ && magneticReferenceYaw == null) magneticReferenceYaw = eulerXYZ(q)[2];
    updateMagButton();
  };

  api.nativeMagneticSensorStatus = (name,available,primaryMagnetic=false) => {
    magneticSensorName = String(name || 'unknown');
    magneticSeen = !!available;
    if (!available) {
      magneticQ = null;
      magneticRawQ = null;
      magneticReferenceYaw = null;
      magneticYawCorrection = 0;
    }
    updateMagButton();
    updateButton();
  };

  api.nativeSkyPointing = (az,alt,accuracy=0,declination=0) => {
    az=Number(az);alt=Number(alt);accuracy=Number(accuracy);declination=Number(declination);
    if(!Number.isFinite(az)||!Number.isFinite(alt))return;
    skyDeclination=Number.isFinite(declination)?declination:0;
    rawNativeSky={seen:true,az:((az%360)+360)%360,alt,accuracy:Number.isFinite(accuracy)?accuracy:0,declination:skyDeclination,timestamp:Date.now()};
    // Once calibrated, the physical camera boresight derived from the absolute
    // quaternion is authoritative. Native az/alt remains visible in diagnostics.
    if(skyCalibration&&magneticRawQ)skyFromAbsoluteQuaternion(magneticRawQ,magneticAccuracy);
    else publishSkyPointing(az,alt,accuracy,skyDeclination,'native');
  };

  api.phoneSkyPointing = () => ({...skyPointing});

  api.nativePipaSensorStatus = (name,available) => {
    pipaSensorName = String(name || 'unknown');
    if (available) {
      const wasSeen = pipaSensorSeen;
      pipaSensorSeen = true;
      if (!wasSeen && !pipaCalibrated && pipaCalRemaining === 0) startPipaCalibration();
    } else {
      pipaSensorSeen = false;
      pipaLastTimestamp = null;
    }
    updatePipaButton();
  };

  api.nativePhoneLinearAcceleration = (ax,ay,az,timestampSeconds,displayAngle=0) => {
    const a = Number.isFinite(displayAngle) ? ((displayAngle%360)+360)%360 : 0;
    ingestLinearAcceleration(Number(ax),Number(ay),Number(az),Number(timestampSeconds),a);
  };

  setInterval(pump,4);
  updateButton();
  updatePipaButton();
  updateMagButton();

  api.phoneIcduStatus = () => ({
    sensorSeen,
    sensorSource,
    nativeSensorName,
    unwrappedDegrees:{outer:unwrappedDeg[0],inner:unwrappedDeg[1],middle:unwrappedDeg[2]},
    desiredCounts:{x:desiredCounts[0],y:desiredCounts[1],z:desiredCounts[2]},
    emittedCounts:{x:emittedCounts[0],y:emittedCounts[1],z:emittedCounts[2]},
    pending:{x:pending[0],y:pending[1],z:pending[2]},
    magnetic:{seen:magneticSeen,sensorName:magneticSensorName,enabled:magneticEnabled,accuracy:magneticAccuracy,yawCorrection:magneticYawCorrection},
    health:{imu:{...health.imu,ageMs:health.imu.last?Date.now()-health.imu.last:null},mag:{...health.mag,ageMs:health.mag.last?Date.now()-health.mag.last:null},pipa:{...health.pipa,ageMs:health.pipa.last?Date.now()-health.pipa.last:null},cduWriteRejected,pipaWriteRejected,lastCduAccept,lastPipaAccept},
    skyCalibration:{calibrated:!!skyCalibration,calibration:skyCalibration?{...skyCalibration}:null,boresight:cameraBoresightDevice.slice(),declination:skyDeclination,rawNative:{...rawNativeSky}},
    pipa:{sensorSeen:pipaSensorSeen,sensorName:pipaSensorName,calibrated:pipaCalibrated,calRemaining:pipaCalRemaining,
      bias:{x:pipaBias[0],y:pipaBias[1],z:pipaBias[2]},
      acceleration:{x:pipaLatestAcceleration[0],y:pipaLatestAcceleration[1],z:pipaLatestAcceleration[2],timestamp:pipaLatestTimestamp},
      emitted:{x:pipaEmitted[0],y:pipaEmitted[1],z:pipaEmitted[2]},
      pending:{x:pipaPending[0],y:pipaPending[1],z:pipaPending[2]},
      fractional:{x:pipaFraction[0],y:pipaFraction[1],z:pipaFraction[2]}},
    sky:{...skyPointing}
  });
  api.recenterPhoneImu = () => { referenceQ=null; lastEuler=null; unwrappedDeg=[0,0,0]; baselineCounts=emittedCounts.slice(); desiredCounts=emittedCounts.slice(); pending=[0,0,0]; magneticReferenceYaw=magneticQ?eulerXYZ(magneticQ)[2]:null; magneticYawCorrection=0; };
})();
