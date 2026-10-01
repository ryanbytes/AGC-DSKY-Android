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

need(source.includes('M75.4402,9.2002'), 'PROG regression fixture lost exact comma-separated crash prefix');
need(source.includes('private static int skipPathSeparators(String d,int i)'), 'path parser separator skipper missing');
need(source.includes('int start=skipPathSeparators(d,i),end=pathNumberEnd(d,start)'), 'path number reader must skip commas/whitespace before slicing');
need(source.includes('return skipPathSeparators(d,end)'), 'path parser must advance past separators before the next coordinate');
function parseNumbersLikeFixedParser(d) {
  const out = [];
  let i = 0;
  while (i < d.length) {
    while (i < d.length && /[\s,]/.test(d[i])) i++;
    if (i >= d.length) break;
    if (/[A-Za-z]/.test(d[i])) { i++; continue; }
    const m = d.slice(i).match(/^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?/);
    need(m, `parser regression: invalid numeric token at ${d.slice(i, i + 16)}`);
    out.push(Number(m[0]));
    i += m[0].length;
  }
  return out;
}
for (const label of labels) {
  const match = source.match(new RegExp(`private static final Path ${label}_LABEL=labelPath\\\\("([^"]+)"\\\\);`));
  const parsed = parseNumbersLikeFixedParser(match[1]);
  need(parsed.every(Number.isFinite), `${label}: parser regression produced a non-finite coordinate`);
}
const commaRegression = parseNumbersLikeFixedParser('M75.4402,9.2002L76.3346,9.2002');
need(commaRegression.length === 4 && commaRegression[0] === 75.4402 && commaRegression[1] === 9.2002, 'comma-separated path parser regression');

need(!/Typeface|drawText\s*\(/.test(source), 'runtime font or text draw remains in widget renderer');
need(source.includes('private static Path labelPath(String d)') && source.includes('path.cubicTo('), 'Android SVG path parser does not support curved glyph outlines');
console.log('EL widget static label outline smoke: PASS');
console.log('  fixed filled paths for PROG, VERB, NOUN, COMP, ACTY; no runtime font or text rendering');
