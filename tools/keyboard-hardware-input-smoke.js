#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const SRC=fs.readFileSync(path.join(ROOT,'app/src/main/assets/keyboard-electrical-interlock.js'),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
for(const marker of [
  'const KEYBOARD_MAP = Object.freeze',
  "'Enter':'E'",
  "'Escape':'C'",
  "window.addEventListener('keydown', onKeyDown",
  "window.addEventListener('keyup', onKeyUp",
  "makeContact(keyboardState)",
  "assertKeyResetIfReady()"
]) assert(SRC.includes(marker),'hardware keyboard contract missing: '+marker);
assert(!/input\.keyMake\([^)]*event\.key/.test(SRC),'hardware keyboard must not bypass the shared electrical make path');
assert(SRC.includes("target.isContentEditable")&&SRC.includes("INPUT|TEXTAREA|SELECT"),'typing fields must be excluded from DSKY keyboard capture');
console.log('hardware keyboard smoke: PASS');
