'use strict';

// Stable owner for the phone/IMU/optics API surface. phone-icdu.js still uses
// its historical `api.name = implementation` syntax while it is being split up,
// but those writes now register implementations into owned slots instead of
// replacing public AGCDSKY method identities at runtime.
(() => {
  const api=window.AGCDSKY;
  if(!api)throw new Error('AGCDSKY public facade unavailable');

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
  const delegates=Object.create(null);

  function implementation(name){
    if(!allowed.has(name))throw new Error(`Unknown phone API implementation: ${String(name)}`);
    return implementations[name]||null;
  }
  function installImplementation(name,next,reason='explicit phone API implementation'){
    if(!allowed.has(name))throw new Error(`Unknown phone API implementation: ${String(name)}`);
    if(typeof next!=='function')throw new TypeError(`Phone API implementation must be a function: ${String(name)}`);
    implementations[name]=next;
    versions[name]=(versions[name]||0)+1;
    reasons[name]=String(reason||'explicit phone API implementation');
    return next;
  }

  for(const name of NAMES){
    const prior=typeof api[name]==='function'?api[name]:null;
    const delegate=function(...args){
      const impl=implementations[name];
      return typeof impl==='function'?Reflect.apply(impl,api,args):undefined;
    };
    delegates[name]=delegate;
    Object.defineProperty(api,name,{
      enumerable:true,
      configurable:false,
      get:()=>delegate,
      set:next=>installImplementation(name,next,'legacy phone-icdu registration')
    });
    if(prior)installImplementation(name,prior,'pre-bound phone API implementation');
  }

  window.AGCDSKY_PHONE=Object.freeze({
    keys:()=>NAMES.slice(),
    implementation,
    installImplementation,
    compatibilityVersions:()=>Object.freeze(Object.fromEntries(NAMES.map(name=>[name,versions[name]||0]))),
    registrationReasons:()=>Object.freeze(Object.fromEntries(NAMES.map(name=>[name,reasons[name]||null])))
  });
})();
