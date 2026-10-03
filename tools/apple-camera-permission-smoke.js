#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const webView = fs.readFileSync(path.join(root, 'apple/Sources/AGCWebView.swift'), 'utf8');
const optics = fs.readFileSync(path.join(root, 'app/src/main/assets/optics.js'), 'utf8');
const project = fs.readFileSync(path.join(root, 'apple/AGCDSKY.xcodeproj/project.pbxproj'), 'utf8');

const permissionMethod = webView.match(/func webView\([\s\S]*?requestMediaCapturePermissionFor origin:[\s\S]*?\n    }/)?.[0];
if (!permissionMethod ||
    !permissionMethod.includes('origin.protocol.lowercased() == AGCAssetSchemeHandler.scheme') ||
    !permissionMethod.includes('origin.host.lowercased() == AGCAssetSchemeHandler.host') ||
    !permissionMethod.includes('frame.isMainFrame') ||
    !permissionMethod.includes('type == .camera') ||
    !permissionMethod.includes('decisionHandler(.grant)') ||
    !permissionMethod.includes('decisionHandler(.deny)') ||
    permissionMethod.includes('.cameraAndMicrophone')) {
  throw new Error('Apple media capture must grant camera only to the packaged app origin and deny everything else');
}

if (!/getUserMedia\(\s*\{\s*audio\s*:\s*false\s*,\s*video\s*:/s.test(optics)) {
  throw new Error('The sextant camera request must remain video-only');
}
if (project.includes('NSMicrophoneUsageDescription')) {
  throw new Error('The app does not implement a microphone permission flow');
}

console.log('Apple camera permission policy smoke: PASS');
