'use strict';

// Implementation registry for the stable phone/IMU/optics public API owned by
// agc-api-runtime.js. Phone modules publish implementations here; they never
// define, replace, or accessor-wrap properties on the root AGCDSKY facade.
(() => {
  const NAMES=Object.freeze([
    'nativePhoneQuaternion','setOpticsCaptureActive','zeroOpticsCapture','phoneOpticsAngles',
    'nativePhoneSensorStatus','calibrateSkyBoresight','clearSkyBoresightCalibration',
    'skyCalibrationStatus','projectSkyTarget','nativeMagneticQuaternion',
    'nativeMagneticSensorStatus','nativeSkyPointing','phoneSkyPointing',
    'nativePipaSensorStatus','nativePhoneLinearAcceleration','phoneIcduStatus','recenterPhoneImu'
  ]);
  const allowed=new Set(NAMES);
  const implementations=Object.create(null);
  const versions=Object.create(null);
  const reasons=Object.create(null);

  function assertName(name){
    if(!allowed.has(name))throw new Error(`Unknown phone API implementation: ${String(name)}`);
  }
  function implementation(name){
    assertName(name);
    return implementations[name]||null;
  }
  function installImplementation(name,next,reason='explicit phone API implementation'){
    assertName(name);
    if(typeof next!=='function')throw new TypeError(`Phone API implementation must be a function: ${String(name)}`);
    implementations[name]=next;
    versions[name]=(versions[name]||0)+1;
    reasons[name]=String(reason||'explicit phone API implementation');
    return next;
  }
  function installImplementations(source,reason='explicit phone API module registration'){
    if(!source||(typeof source!=='object'&&typeof source!=='function'))throw new TypeError('Phone API implementation source must be an object');
    for(const name of NAMES){
      if(!Object.prototype.hasOwnProperty.call(source,name))throw new Error(`Phone API module missing implementation: ${name}`);
      if(typeof source[name]!=='function')throw new TypeError(`Phone API implementation must be a function: ${name}`);
    }
    for(const name of NAMES)installImplementation(name,source[name],reason);
    return source;
  }

  window.AGCDSKY_SERVICE_REGISTRY.publish('AGCDSKY_PHONE',Object.freeze({
    keys:()=>NAMES.slice(),
    implementation,
    installImplementation,
    installImplementations,
    compatibilityVersions:()=>Object.freeze(Object.fromEntries(NAMES.map(name=>[name,versions[name]||0]))),
    registrationReasons:()=>Object.freeze(Object.fromEntries(NAMES.map(name=>[name,reasons[name]||null])))
  }),'phone-api-runtime publication');
})();
