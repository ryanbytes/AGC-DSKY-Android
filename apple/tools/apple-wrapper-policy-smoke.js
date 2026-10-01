#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'apple/Sources/AGCWebView.swift'), 'utf8');
const assets = fs.readFileSync(path.join(root, 'app/src/main/assets/optics.js'), 'utf8');
const project = fs.readFileSync(path.join(root, 'apple/AGCDSKY.xcodeproj/project.pbxproj'), 'utf8');

const permissionMethod = source.match(/func webView\(\s*_ webView: WKWebView,\s*requestMediaCapturePermissionFor origin:[\s\S]*?\n    }/);
if (!permissionMethod) throw new Error('Apple media-capture permission delegate is missing');
if (!permissionMethod[0].includes('type == .camera')) {
  throw new Error('Apple wrapper must grant camera capture for the trusted local origin');
}
if (/type\s*==\s*\.cameraAndMicrophone/.test(permissionMethod[0])) {
  throw new Error('Apple wrapper must not grant microphone capture');
}
if (!/getUserMedia\s*\(\s*\{\s*audio\s*:\s*false/.test(assets)) {
  throw new Error('Shared sextant must request camera video without microphone audio');
}
if (/INFOPLIST_KEY_NSMicrophoneUsageDescription/.test(project)) {
  throw new Error('Apple target unexpectedly declares microphone use');
}

console.log('Apple wrapper camera-only permission policy: PASS');
