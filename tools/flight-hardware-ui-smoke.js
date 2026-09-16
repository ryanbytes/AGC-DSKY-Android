#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error(`FLIGHT HARDWARE UI FAIL: ${m}`);process.exit(1)};
const req=(t,n,l)=>{if(!t.includes(n))fail(`${l} missing: ${n}`)};
const no=(t,n,l)=>{if(t.includes(n))fail(`${l} must not contain: ${n}`)};

const ui=read('app/src/main/assets/flight-hardware-ui.js');
const rheostat=read('app/src/main/assets/lighting-rheostat-stop.js');
const keySpec=read('app/src/main/assets/key-mechanical-spec.js');
const interlock=read('app/src/main/assets/keyboard-electrical-interlock.js');
const proceed=read('app/src/main/assets/proceed-electrical.js');
const cm=read('app/src/main/assets/cm-mode.js');
const html=read('app/src/main/assets/index.html');
const finish=read('app/src/main/assets/cm-dsky-finish.css');
const controls=read('app/src/main/assets/controls-layout.css');
const hw=read('app/src/main/assets/hardware-fidelity.js');
const sw=read('pwa/static/sw.js');

for(const [text,filename] of [[ui,'flight-hardware-ui.js'],[rheostat,'lighting-rheostat-stop.js'],[keySpec,'key-mechanical-spec.js'],[interlock,'keyboard-electrical-interlock.js'],[proceed,'proceed-electrical.js'],[cm,'cm-mode.js']]){
  try{new vm.Script(text,{filename})}catch(error){fail(`${filename} syntax error: ${error.message}`)}
}

const features=['flight-hardware-ui','lighting-rheostat-stop','key-mechanical-spec','keyboard-electrical-interlock','lighting-electrical-model','relay-perceptual-personality','relay-show'];
let previous=-1;
for(const feature of features){
  const tag=`<script src="${feature}.js" data-feature="${feature}"></script>`,pos=html.indexOf(tag);
  if(pos<0)fail(`index.html missing parser-loaded ${feature}`);
  if(pos<=previous)fail(`${feature} parser order changed`);
  previous=pos;
  no(cm,`script.src = '${feature}.js'`,'CM configuration module');
}
no(cm,"createElement('script')",'CM configuration module');
req(cm,"localStorage.setItem('agcMission','comanche055')",'CM mission lock');
req(cm,"document.body.classList.add('spacecraft-cm')",'CM body mode');
for(const feature of ['flight-hardware-ui','lighting-rheostat-stop','key-mechanical-spec','keyboard-electrical-interlock'])req(sw,`'./${feature}.js'`,'offline PWA cache');

for(const marker of ["const LEVELS = Object.freeze([1.00, 0.75, 0.50, 0.25, 0.00])","saveIndex('dskyNumericsLevel'","saveIndex('dskyIntegralLevel'","--numerics-level","--integral-level","NUMERICS ${levelText(numericsIndex)}","INTEGRAL ${levelText(integralIndex)}","LIGHT BUS DEMO","NUMERICS FEED OPEN","INTEGRAL FEED OPEN","BOTH LIGHTING FEEDS OPEN","RELAY STATE RETAINED"])req(ui,marker,'independent lighting model');
for(const marker of ["const MIN_NORMAL_LEVEL = 0.25","cycleWithMechanicalStop","normalizeOne('numerics')","normalizeOne('integral')","completeOffMethod:'open lighting feed / circuit breaker, not normal rheostat rotation'","zeroReservedFor:'LIGHT BUS DEMO feed-open state'"])req(rheostat,marker,'lighting rheostat mechanical stop');
for(const forbidden of ['decodeChannel10(','agcCore.stop(','agcCore.reset(','resetAgcFace('])no(ui,forbidden,'lighting bus demo state isolation');

for(const marker of ["const KEY_CONTACT_BASE_MS = 36","const KEY_RETURN_SOUND_BASE_MS = 18","const HARDWARE_SEED_KEY = 'dskyHardwareUnitSeedV1'","contactMs: Number(vary(KEY_CONTACT_BASE_MS","returnSoundMs: Number(vary(KEY_RETURN_SOUND_BASE_MS","makePitch: Number(vary(520","returnPitch: Number(vary(330","--key-travel","function prepareKeys()","const lighting = Object.freeze({","function hardwarePersonality()","window.AGCDSKY_FLIGHT_HARDWARE_UI=Object.freeze({lighting,hardwarePersonality})"])req(ui,marker,'key presentation personality service');
for(const forbidden of ['window.AGCDSKY.lighting =','window.AGCDSKY.hardwarePersonality =','NORMAL_KEY_CHANNEL','DSKY_KEY_CODE','function fireKeyContact(','function onKeyDown(','function releaseAgcKey(','function releaseKey(','function releaseAllKeys(',"document.addEventListener('pointerdown'","document.addEventListener('pointerup'","document.addEventListener('pointercancel'",'core.keyPress(code)','core.writeIo(0o15','keyState = new Map()'])no(ui,forbidden,'presentation layer electrical/facade ownership');

for(const marker of ["actuationTravelIn: 3 / 16","overtravelToBottomIn: 1 / 16","totalTravelIn: 1 / 4","rateLbPerInMin: 3.0","rateLbPerInMax: 3.5","actuatingForceOzMax: 7","releaseForceOzMin: 1","pretravelInMax: 0.030","differentialMovementInMax: 0.006","overtravelInMin: 0.003","minimumBrightnessFootLamberts: 2.0","testVrms: 75","testHz: 400","contactMs: 36","returnSoundMs: 18","forceIncreaseToActuationOzMin","forceIncreaseToBottomOzMax","totalFingerForceOzMin: null","totalFingerForceOz: null","Only documented bounded spring-rate range is varied per key","Total finger force remains unresolved","const baseService = window.AGCDSKY_FLIGHT_HARDWARE_UI","window.AGCDSKY_KEY_MECHANICAL_SPEC=service"])req(keySpec,marker,'source-backed key mechanics service');
for(const forbidden of ["vary(KEY_CONTACT_BASE_MS",'window.AGCDSKY.hardwarePersonality =','window.AGCDSKY.keyMechanicalSpec ='])no(keySpec,forbidden,'key mechanics facade/timing ownership');

for(const marker of ["window.addEventListener('pointerdown', onPointerDown, {capture:true, passive:false})","if (!button || button.dataset.key === 'P') return null","const accepted = !cycleLatched","if (!state.accepted) return","if (!allNormalKeysReleased()) return","const MIN_KEYCODE_HOLD_MS = 12","const remaining = MIN_KEYCODE_HOLD_MS - elapsed","keyResetPending:!!keyResetTimer","const input = api?.inputRuntime","input.keyMake(code)","input.keyReset(electricalCore)","electricalKeyCode","window.AGCDSKY_KEYBOARD_ELECTRICAL = Object.freeze({"])req(interlock,marker,'series-contact keyboard interlock');
for(const forbidden of ["api.keyboardElectrical =","P:0o",".keyPress(",".keyRelease(","writeIo(0o15"])no(interlock,forbidden,'series-contact keyboard direct core/facade ownership');

for(const marker of ["const runtime = api?.runtimeTransitions;","const input = api?.inputRuntime;","document.querySelector('[data-key=\"P\"]')","pro.addEventListener('pointerdown', onPointerDown, true)","pro.addEventListener('pointerup', onPointerUp, true)","pro.addEventListener('pointercancel', onPointerCancel, true)",'input.proceed(true)','input.proceed(false)','runtime.onBeforeClock(releaseProceed)'])req(proceed,marker,'dedicated PRO / channel-032 path');
for(const forbidden of ['core.proceedKey(true)','core.proceedKey(false)','window.enterClock =','window.enterAgc ='])no(proceed,forbidden,'PRO transition/input ownership');
for(const forbidden of ["document.querySelector('[data-key=\"P\"]')",'proPointer','releaseProceed','proceedKey(true)','proceedKey(false)','hardwareEnterClock'])no(hw,forbidden,'relay fidelity PRO ownership');
no(ui,"P:0o",'presentation layer normal-key map');

for(const marker of ["part:'MS24367-713'","part:'MS24367-680'","riseMs:32, fallMs:48","riseMs:40, fallMs:58","source.className = `lamp-source lamp-source-${i + 1}`","--lamp-rise","--lamp-fall","--lamp-gain","legend.className = 'lamp-legend'","document.body.classList.add('lamp-hardware-ready')",".lamp .lamp-source","transition-duration:var(--lamp-fall,52ms)","transition-duration:var(--lamp-rise,36ms)"])req(ui+finish,marker,'three-bulb incandescent model');
no(finish,'transition:opacity 145ms','obsolete generic annunciator decay');no(finish,'transition-duration:85ms','obsolete generic annunciator rise');
for(const marker of ['--key-el-color','--key-el-shadow','.key.pressed','translateY(var(--key-travel,.42vmin))','color:var(--key-el-color','text-shadow:var(--key-el-shadow'])req(finish+controls,marker,'white EL key illumination / options styling');
req(ui,"oldDim.hidden = true",'retired whole-panel dimmer');req(ui,"document.body.classList.remove('dim')",'separate lighting feed enforcement');

console.log('Flight hardware UI smoke: PASS');
console.log('  parser-loaded CM features, dedicated presentation/mechanics/keyboard services, centralized normal-key/PRO input, rheostat stops, source-backed key mechanics, and three-bulb annunciators gated');
