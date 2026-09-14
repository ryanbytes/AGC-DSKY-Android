#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'app/src/main/assets');
const source = fs.readFileSync(path.join(ASSETS, 'dsky-display-renderer.js'), 'utf8');
const app = fs.readFileSync(path.join(ASSETS, 'app.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class Classes {
  constructor(){ this.values = new Set(); }
  add(name){ this.values.add(name); }
  remove(...names){ names.forEach(name => this.values.delete(name)); }
  toggle(name, force){ if (force) this.values.add(name); else this.values.delete(name); }
  contains(name){ return this.values.has(name); }
}
class Element {
  constructor(){ this.innerHTML = ''; this.classList = new Classes(); }
}

const elements = {
  prog:new Element(), verb:new Element(), noun:new Element(), r1:new Element(), r2:new Element(), r3:new Element(),
  lamp:new Element()
};
const body = new Element();
const context = {
  document:{
    body,
    querySelector(selector){ return selector === '[data-lamp="test"]' ? elements.lamp : null; },
    querySelectorAll(selector){ return selector === '[data-lamp]' ? [elements.lamp] : []; }
  },
  $: id => elements[id],
  String,
  Object
};
vm.createContext(context);
new vm.Script(source, {filename:'dsky-display-renderer.js'}).runInContext(context);

vm.runInContext("set2('prog','16'); setReg('r1','+','12345'); setLamp('test',true);", context);
assert(elements.prog.innerHTML.includes('data-seg="a"'), 'two-digit renderer did not emit EL segment paths');
assert(elements.r1.innerHTML.includes('el-sign') && elements.r1.innerHTML.includes('el-glyph'),
  'register renderer did not emit sign and digit geometry');
assert(elements.lamp.classList.contains('on'), 'setLamp did not assert annunciator class');
body.classList.add('vn-flash-off'); body.classList.add('el-off');
vm.runInContext('clearLamps();', context);
assert(!elements.lamp.classList.contains('on'), 'clearLamps did not clear annunciator class');
assert(!body.classList.contains('vn-flash-off') && !body.classList.contains('el-off'),
  'clearLamps did not restore display visibility classes');

for (const token of ['const SEG=', 'const PATH=', 'function renderDigits(', 'function set2(', 'function setLamp(']) {
  assert(source.includes(token), `renderer missing ${token}`);
  assert(!app.includes(token), `app.js regained renderer ownership: ${token}`);
}

console.log('display runtime smoke: PASS');
console.log('  extracted EL digits/registers and annunciator primitives execute independently of app.js');
