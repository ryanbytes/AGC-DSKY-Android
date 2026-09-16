#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const ASSETS=path.join(ROOT,'app/src/main/assets');
const OWNER='agc-api-runtime.js';
const RESERVED=[
  'services','lifecycle','agcChannel','getCore','setAppVisible','getMission',
  'enterClock','enterAgc','appStatus','saveAgcState','clearSavedAgcState',
  'savedSnapshotInfo','verifySnapshotRoundTrip','scheduleAgcAutosave',
  'accurateTime','accurateDate','ntpStatus','nativeNtpStatus',
  'hardware','audioStatus','relayShow','openDiagnostics','closeDiagnostics'
];
function escapeRegExp(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
const files=fs.readdirSync(ASSETS).filter(name=>name.endsWith('.js')).sort();
const violations=[];
for(const name of files){
  if(name===OWNER)continue;
  const source=fs.readFileSync(path.join(ASSETS,name),'utf8');
  const aliases=[];
  if(/\b(?:const|let|var)\s+api\s*=\s*window\.AGCDSKY\b/.test(source)||/\b(?:const|let|var)\s+api\s*=\s*window\.AGCDSKY\s*=/.test(source))aliases.push('api');
  for(const key of RESERVED){
    const escaped=escapeRegExp(key);
    const direct=new RegExp(`\\bwindow\\.AGCDSKY\\.${escaped}\\s*=\\s*(?!=)`,'m');
    const bracket=new RegExp(`\\bwindow\\.AGCDSKY\\[['\"]${escaped}['\"]\\]\\s*=\\s*(?!=)`,'m');
    if(direct.test(source)||bracket.test(source)){violations.push(`${name}: window.AGCDSKY.${key}`);continue;}
    for(const alias of aliases){
      const viaAlias=new RegExp(`\\b${alias}\\.${escaped}\\s*=\\s*(?!=)`,'m');
      if(viaAlias.test(source)){violations.push(`${name}: ${alias}.${key}`);break;}
    }
  }
}
if(violations.length)throw new Error(`stable public facade mutated outside ${OWNER}: ${violations.join(', ')}`);
const owner=fs.readFileSync(path.join(ASSETS,OWNER),'utf8');
for(const marker of [
  'function publicEnterAgc()',
  'function publicEnterClock()',
  'function publicHardware()',
  'function publicAudioStatus()',
  'function publicOpenDiagnostics(...args)',
  'function publicCloseDiagnostics(...args)',
  'const publicRelayShow=Object.freeze({',
  'window.AGCDSKY={services:apiServices'
])if(!owner.includes(marker))throw new Error(`public facade owner marker missing: ${marker}`);
console.log('public facade boundary smoke: PASS');
console.log(`  ${RESERVED.length} stable AGCDSKY facade keys remain owned by ${OWNER}`);
require('./phone-api-runtime-smoke.js');
