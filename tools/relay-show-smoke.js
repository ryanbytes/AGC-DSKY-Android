'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error(`RELAY SHOW FAIL: ${m}`);process.exit(1);};
const req=(t,n,l)=>{if(!t.includes(n))fail(`${l} missing: ${n}`);};
const no=(t,n,l)=>{if(t.includes(n))fail(`${l} must not contain: ${n}`);};

const show=read('app/src/main/assets/relay-show.js');
const cm=read('app/src/main/assets/cm-mode.js');

try{new vm.Script(show,{filename:'relay-show.js'});}catch(error){fail(`syntax error: ${error.message}`);}

req(cm,"button.id = 'relay-show'",'controls button');
req(cm,"button.textContent = 'RELAY SHOW'",'controls button label');
req(cm,"script.src = 'relay-show.js'",'feature loader');

req(show,"mode = 'relay-show'",'exclusive demo mode');
req(show,"agcCore.stop()",'AGC task pause');
req(show,"saveAgcState('relay show checkpoint')",'durable pre-show checkpoint');
req(show,'decodeChannel10','physical bank drive path');
req(show,'NON_DECIMAL_CODES','contact-matrix burst');
req(show,'for (let digit = 0; digit <= 9; digit++)','digit chase');
req(show,'const SHOW_TEMPO = 2.0','slower presentation tempo');
req(show,'const showSleep = ms => sleep(ms * SHOW_TEMPO)','presentation-only timing scale');
req(show,"decodeChannel11(0o46)",'finale auxiliary relay drive');
req(show,"decodeChannel163(0o730)",'finale annunciator relay drive');
req(show,'await showSleep(1000)','slowed full-panel finale hold');
req(show,'saved.latches[row]','physical state restoration');
req(show,'mode = saved.mode','previous mode restoration');
req(show,'agcCore.start(1)','previous AGC task resume');
req(show,'clockRelayWords = {...saved.clockRelayWords}','previous clock task restoration');
req(show,"status('RELAY SHOW · RESTORING PREVIOUS TASK')",'restore status');
req(show,'tickSound = saved.tickSound','sound preference restoration');

// User explicitly rejected a brightness flare. The demo may change only relay
// driven DSKY state; it must not add transient optical enhancement effects.
no(show,'brightness(','brightness flare');
no(show,'filter:','CSS/filter flare');
no(show,'classList.add(\'relay-flare\'','relay flare class');

console.log('Relay show smoke: PASS');
console.log('  slower bank sweep, digit chase, contact burst, finale, and previous-task restore verified');
