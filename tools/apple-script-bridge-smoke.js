#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../apple/Sources/AGCWebView.swift'), 'utf8');
const handler = source.match(/func userContentController\([\s\S]*?\n    }/)?.[0];
if (!handler) throw new Error('WKScriptMessageHandler entry point was not found');

const checks = [
  'message.frameInfo.isMainFrame',
  'origin.protocol.lowercased() == AGCAssetSchemeHandler.scheme',
  'origin.host.lowercased() == AGCAssetSchemeHandler.host',
  'message.name == "DebugBridge"',
  'message.name == "HapticBridge"',
  'message.name == "PrintBridge"'
];
for (const check of checks) {
  if (!handler.includes(check)) throw new Error(`Native bridge handler is missing required policy: ${check}`);
}

const guardEnd = handler.indexOf('else { return }');
const firstAction = Math.min(handler.indexOf('performKeyHaptic(command)'), handler.indexOf('printChecklist(from: webView)'));
if (guardEnd < 0 || firstAction < 0 || guardEnd > firstAction) {
  throw new Error('Native bridge origin/frame checks must run before dispatching native actions');
}

for (const check of [
  '#if DEBUG\n        configuration.userContentController.add(self, name: "DebugBridge")',
  "window.addEventListener('unhandledrejection'",
  "window.addEventListener('securitypolicyviolation'",
  'ready: detail => report(\'ready\', detail)',
  "report('report', 'debug bridge installed at document start')",
  'NSLog("[AGC DSKY DEBUG] bridge origin: main=%@ scheme=%@ host=%@"',
  'NSLog("[AGC DSKY DEBUG] %@: %@"'
]) {
  if (!source.includes(check)) throw new Error(`Apple Debug WebView diagnostics are incomplete: ${check}`);
}

const hapticScript = source.match(/let hapticScript = """([\s\S]*?)"""/)?.[1];
if (!hapticScript) throw new Error('Apple haptic bridge script was not found');
for (const check of [
  'CHHapticEngine.capabilitiesForHardware().supportsHaptics',
  "relayImpact:function(durationMs,amplitude)",
  "relayWaveform:function(timings,amplitudes)",
  "type:'relayImpact'",
  "type:'relayWaveform'",
  'performRelayHaptic(payload)',
  'eventType: .hapticTransient',
  'elapsedMs <= 750',
  'timingParts.count <= 192'
]) {
  if (!source.includes(check)) throw new Error(`Apple haptic bridge is missing required relay support or bound: ${check}`);
}

console.log('Apple WebKit bridge origin and relay-haptic policy smoke: PASS');
