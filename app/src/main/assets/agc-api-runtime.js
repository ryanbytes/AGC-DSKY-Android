'use strict';

// Public application facade/bootstrap. This is the root of the explicit core
// service graph; public transition methods retain stable identity and delegate
// to runtime-transitions.js once that coordinator is published. Late hardware,
// recovery, diagnostics, optics, presentation, and phone services are resolved
// dynamically, never patched onto the facade after bootstrap.
const apiState=window.AGCDSKY_APP_STATE;
const apiCore=window.AGCDSKY_CORE_SESSION;
const apiShell=window.AGCDSKY_SHELL;
const apiRenderer=window.AGCDSKY_RENDERER;
const apiEnvironment=window.AGCDSKY_ENVIRONMENT;
const apiAudio=window.AGCDSKY_AUDIO;
const apiClock=window.AGCDSKY_CLOCK;
const apiDisplay=window.AGCDSKY_DISPLAY;
const apiSnapshot=window.AGCDSKY_SNAPSHOT;
const apiLifecycle=window.AGCDSKY_LIFECYCLE;
if(!apiState)throw new Error('Shared application state unavailable');
if(!apiCore)throw new Error('Shared AGC core session unavailable');
for(const [name,service] of Object.entries({shell:apiShell,renderer:apiRenderer,environment:apiEnvironment,audio:apiAudio,clock:apiClock,display:apiDisplay,snapshot:apiSnapshot,lifecycle:apiLifecycle}))if(!service)throw new Error(`AGC ${name} service unavailable`);

const LATE_SERVICE_GLOBALS=Object.freeze([
  'AGCDSKY_PHONE','AGCDSKY_RUNTIME','AGCDSKY_INPUT','AGCDSKY_CLOCK_BEHAVIOR',
  'AGCDSKY_OPTICS','AGCDSKY_SEXTANT_TAP_MARK','AGCDSKY_CM_MODE','AGCDSKY_HARDWARE',
  'AGCDSKY_PROCEED','AGCDSKY_AUDIO_RECOVERY','AGCDSKY_FLIGHT_HARDWARE_UI',
  'AGCDSKY_LIGHTING_RHEOSTAT_STOP','AGCDSKY_KEY_MECHANICAL_SPEC','AGCDSKY_KEYBOARD_ELECTRICAL',
  'AGCDSKY_LIGHTING_ELECTRICAL','AGCDSKY_RELAY_SHOW','AGCDSKY_HARDWARE_COLOR_MODE','AGCDSKY_DIAGNOSTICS'
]);
function createLateServiceRegistry(){
  const allowed=new Set(LATE_SERVICE_GLOBALS),values=Object.create(null),versions=Object.create(null),reasons=Object.create(null);
  function assertName(name){if(!allowed.has(name))throw new Error(`Unknown late AGC service: ${String(name)}`)}
  function get(name){assertName(name);return values[name]||null}
  function publish(name,service,reason='explicit late service publication'){
    assertName(name);
    if(service===null||(typeof service!=='object'&&typeof service!=='function'))throw new TypeError(`Late AGC service must be an object or function: ${name}`);
    const prior=values[name]||null;
    if(prior){if(prior!==service)throw new Error(`Late AGC service already published: ${name}`);return prior}
    values[name]=service;versions[name]=1;reasons[name]=String(reason||'explicit late service publication');return service;
  }
  function requireService(name){const service=get(name);if(!service)throw new Error(`Late AGC service unavailable: ${name}`);return service}
  for(const name of LATE_SERVICE_GLOBALS){
    const descriptor=Object.getOwnPropertyDescriptor(window,name),prior=descriptor?window[name]:undefined;
    if(descriptor&&!descriptor.configurable)throw new Error(`Late AGC service global is already non-configurable: ${name}`);
    Object.defineProperty(window,name,{configurable:false,enumerable:false,get:()=>values[name]||null,set:service=>publish(name,service,`compatibility global publication: ${name}`)});
    if(prior!==undefined&&prior!==null)publish(name,prior,`pre-bootstrap publication: ${name}`);
  }
  return Object.freeze({
    names:()=>LATE_SERVICE_GLOBALS.slice(),
    get,
    require:requireService,
    publish,
    describe:()=>LATE_SERVICE_GLOBALS.map(name=>Object.freeze({name,published:!!values[name],version:versions[name]||0,reason:reasons[name]||null}))
  });
}
const apiLateServiceRegistry=window.AGCDSKY_SERVICE_REGISTRY||createLateServiceRegistry();
if(!window.AGCDSKY_SERVICE_REGISTRY)Object.defineProperty(window,'AGCDSKY_SERVICE_REGISTRY',{configurable:false,enumerable:false,writable:false,value:apiLateServiceRegistry});

const apiServices=Object.freeze({shell:apiShell,renderer:apiRenderer,environment:apiEnvironment,audio:apiAudio,clock:apiClock,display:apiDisplay,snapshot:apiSnapshot,lifecycle:apiLifecycle});
window.AGCDSKY_SERVICES=apiServices;

function publicEnterAgc(){const runtime=window.AGCDSKY_RUNTIME;return runtime&&typeof runtime.enterAgc==='function'?runtime.enterAgc('public AGCDSKY.enterAgc'):apiLifecycle.enterAgc()}
function publicEnterClock(){const status=apiShell.clockTimeLabel(),runtime=window.AGCDSKY_RUNTIME;return runtime&&typeof runtime.enterClock==='function'?runtime.enterClock(status,true,'public AGCDSKY.enterClock'):apiLifecycle.enterClock(status,true)}
function publicHardware(){const service=window.AGCDSKY_HARDWARE;return service&&typeof service.snapshot==='function'?service.snapshot():null}
function publicAudioStatus(){const service=window.AGCDSKY_AUDIO_RECOVERY;return service&&typeof service.status==='function'?service.status():{state:apiAudio.context()?apiAudio.context().state:'none',failures:0,circuitOpen:false}}
function publicOpenDiagnostics(...args){const service=window.AGCDSKY_DIAGNOSTICS;return service&&typeof service.open==='function'?service.open(...args):false}
function publicCloseDiagnostics(...args){const service=window.AGCDSKY_DIAGNOSTICS;return service&&typeof service.close==='function'?service.close(...args):false}
function publicOpenSextant(...args){const service=window.AGCDSKY_OPTICS;return service&&typeof service.open==='function'?service.open(...args):false}
function publicCloseSextant(...args){const service=window.AGCDSKY_OPTICS;return service&&typeof service.close==='function'?service.close(...args):false}
function publicSextantStatus(...args){const service=window.AGCDSKY_OPTICS;return service&&typeof service.status==='function'?service.status(...args):null}
function publicApplyCmMode(...args){const service=window.AGCDSKY_CM_MODE;return service&&typeof service.apply==='function'?service.apply(...args):false}
function publicHardwarePersonality(...args){const mechanical=window.AGCDSKY_KEY_MECHANICAL_SPEC;if(mechanical&&typeof mechanical.hardwarePersonality==='function')return mechanical.hardwarePersonality(...args);const base=window.AGCDSKY_FLIGHT_HARDWARE_UI;return base&&typeof base.hardwarePersonality==='function'?base.hardwarePersonality(...args):null}
function publicKeyMechanicalSpec(...args){const service=window.AGCDSKY_KEY_MECHANICAL_SPEC;return service&&typeof service.spec==='function'?service.spec(...args):null}
const publicRelayShow=Object.freeze({
  start:(...args)=>{const service=window.AGCDSKY_RELAY_SHOW;if(!service||typeof service.start!=='function')return false;return service.start(...args)},
  stop:(...args)=>{const service=window.AGCDSKY_RELAY_SHOW;if(!service||typeof service.stop!=='function')return false;return service.stop(...args)},
  active:()=>{const service=window.AGCDSKY_RELAY_SHOW;return !!(service&&typeof service.active==='function'&&service.active())}
});

const PHONE_API_NAMES=Object.freeze([
  'nativePhoneQuaternion','setOpticsCaptureActive','zeroOpticsCapture','phoneOpticsAngles',
  'nativePhoneSensorStatus','calibrateSkyBoresight','clearSkyBoresightCalibration',
  'skyCalibrationStatus','projectSkyTarget','nativeMagneticQuaternion',
  'nativeMagneticSensorStatus','nativeSkyPointing','phoneSkyPointing',
  'nativePipaSensorStatus','nativePhoneLinearAcceleration','phoneIcduStatus','recenterPhoneImu'
]);
function publicPhoneImplementation(name){const service=window.AGCDSKY_PHONE;return service&&typeof service.implementation==='function'?service.implementation(name):null}
const publicPhoneApi=Object.freeze(Object.fromEntries(PHONE_API_NAMES.map(name=>[name,function(...args){const impl=publicPhoneImplementation(name);return typeof impl==='function'?Reflect.apply(impl,window.AGCDSKY,args):undefined}])));

window.AGCDSKY={services:apiServices,lifecycle:apiLifecycle,agcChannel:apiDisplay.onChannel,getCore:()=>apiCore.core,setAppVisible:apiLifecycle.setAppVisible,getMission:()=>apiState.selectedMission,enterClock:publicEnterClock,enterAgc:publicEnterAgc,appStatus:apiLifecycle.status,saveAgcState:apiSnapshot.save,clearSavedAgcState:apiSnapshot.clear,savedSnapshotInfo:apiSnapshot.savedInfo,verifySnapshotRoundTrip:apiSnapshot.verifyRoundTrip,scheduleAgcAutosave:apiSnapshot.scheduleAutosave,accurateTime:apiShell.accurateTime,accurateDate:apiShell.accurateDate,ntpStatus:()=>({...apiState.ntpStatus}),nativeNtpStatus:apiShell.updateNtpStatus,hardware:publicHardware,audioStatus:publicAudioStatus,relayShow:publicRelayShow,openDiagnostics:publicOpenDiagnostics,closeDiagnostics:publicCloseDiagnostics,openSextant:publicOpenSextant,closeSextant:publicCloseSextant,sextantStatus:publicSextantStatus,applyCmMode:publicApplyCmMode,hardwarePersonality:publicHardwarePersonality,keyMechanicalSpec:publicKeyMechanicalSpec,...publicPhoneApi,get runtimeTransitions(){return window.AGCDSKY_RUNTIME||null},get inputRuntime(){return window.AGCDSKY_INPUT||null},get clockBehavior(){return window.AGCDSKY_CLOCK_BEHAVIOR||null},get hardwareColorMode(){return window.AGCDSKY_HARDWARE_COLOR_MODE||null},get lightingElectrical(){return window.AGCDSKY_LIGHTING_ELECTRICAL||null},get lightingRheostatStop(){return window.AGCDSKY_LIGHTING_RHEOSTAT_STOP||null},get proceedElectrical(){return window.AGCDSKY_PROCEED||null},get lighting(){return window.AGCDSKY_FLIGHT_HARDWARE_UI?.lighting||null},get keyboardElectrical(){return window.AGCDSKY_KEYBOARD_ELECTRICAL||null},get sextantTapMark(){return window.AGCDSKY_SEXTANT_TAP_MARK||null}};
apiShell.initialize(window.AGCDSKY,apiServices);
