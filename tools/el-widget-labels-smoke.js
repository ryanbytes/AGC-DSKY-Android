#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.resolve(__dirname, '../app/src/main/java/org/apollo/agcdsky/ElWidgetProvider.java'), 'utf8');
function need(condition, message) { if (!condition) throw new Error(message); }
const labels = ['PROG', 'VERB', 'NOUN', 'COMP', 'ACTY'];
const bounds = {
  PROG: [66.441, 0.554, 105.966, 12.232],
  VERB: [0, 41.203, 39.525, 52.881],
  NOUN: [66.441, 41.203, 105.966, 52.881],
  COMP: [0, 0.633, 39.525, 36.471],
  ACTY: [0, 0.633, 39.525, 36.471],
};
for (const label of labels) {
  const match = source.match(new RegExp(`private static final Path ${label}_LABEL=labelPath\\("([^"]+)"\\);`));
  need(match, `${label}: fixed vector outline missing`);
  need(match[1].length > 300, `${label}: vector outline is incomplete`);
  need(source.includes(`c.drawPath(${label}_LABEL,LABEL_P)`), `${label}: renderer does not draw fixed outline`);
  const tokens = match[1].match(/[A-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)/g);
  need(tokens && /^[MLCZ]/.test(tokens.join('')), `${label}: malformed SVG path`);
  need(!/[AaHhQqSsTtVv]/.test(match[1]), `${label}: unsupported SVG command in Android path parser input`);
  const values = tokens.filter(t => !/^[A-Z]$/.test(t)).map(Number);
  const [x0, y0, x1, y1] = bounds[label];
  need(values.length >= 6, `${label}: path has too few coordinates`);
  need(values.every((v, i) => i % 2 === 0 ? v >= x0 - 1 && v <= x1 + 1 : v >= y0 - 1 && v <= y1 + 1), `${label}: outline escapes its SCD legend area`);
}
need(!/Typeface|drawText\s*\(/.test(source), 'runtime font or text draw remains in widget renderer');
need(source.includes('private static Path labelPath(String d)') && source.includes('path.cubicTo('), 'Android SVG path parser does not support curved glyph outlines');
console.log('EL widget static label outline smoke: PASS');
console.log('  fixed filled paths for PROG, VERB, NOUN, COMP, ACTY; no runtime font or text rendering');
