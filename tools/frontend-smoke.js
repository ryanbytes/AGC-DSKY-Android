#!/usr/bin/env node
'use strict';

/*
 * Dependency-free smoke test for the current CM-only Android web frontend and
 * source invariants. This intentionally complements, rather than replaces,
 * Android/WebView/device testing.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const APP_JS = path.join(ROOT, 'app/src/main/assets/app.js');
const INDEX_HTML = path.join(ROOT, 'app/src/main/assets/index.html');
const MANIFEST = path.join(ROOT, 'app/src/main/AndroidManifest.xml');
const APP_GRADLE = path.join(ROOT, 'app/build.gradle');
const SENSOR_ACTIVITY = path.join(
    ROOT, 'app/src/main/java/org/apollo/agcdsky/SensorMainActivity.java');
const DREAM_SERVICE = path.join(
    ROOT, 'app/src/main/java/org/apollo/agcdsky/AgcDreamService.java');
const NET_CLIENT = path.join(
    ROOT, 'app/src/main/java/org/apollo/agcdsky/NetClient.java');
const DEBUG_REPORTER = path.join(
    ROOT, 'app/src/main/java/org/apollo/agcdsky/DebugReporter.java');

class Classes {
    constructor() { this.values = new Set(); }
    add(...names) { names.forEach((name) => this.values.add(name)); }
    remove(...names) { names.forEach((name) => this.values.delete(name)); }
    toggle(name, force) {
        if (force === undefined) force = !this.values.has(name);
        if (force) this.values.add(name);
        else this.values.delete(name);
        return force;
    }
    contains(name) { return this.values.has(name); }
}

class Element {
    constructor(id = '') {
        this.id = id;
        this.textContent = '';
        this.innerHTML = '';
        this.dataset = {};
        this.classList = new Classes();
        this.listeners = {};
        this.style = { filter: '', setProperty() {} };
    }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    closest() { return null; }
}

class FakeAgcCore {
    constructor(options = {}) {
        this.options = options;
        this.running = false;
        this.rope = null;
        this.keyCodes = [];
        this.startCount = 0;
        this.stopCount = 0;
        this.resetCount = 0;
        this.configureCount = 0;
        this.importCount = 0;
        this.exportCount = 0;
        this.snapshotSerial = 0;
    }
    async load(options) { this.rope = options.ropeUrl; this.wasm = options.wasmUrl; }
    reset() { this.resetCount++; }
    configureInputMasks() { this.configureCount++; }
    start() { this.running = true; this.startCount++; }
    stop() { this.running = false; this.stopCount++; }
    version() { return 'fake-test-core'; }
    keyPress(code) { this.keyCodes.push(code); }
    exportSnapshot() {
        this.exportCount++;
        const serial = ++this.snapshotSerial;
        return { schema: 1, byteLength: 64, fingerprint: `fake-${serial}`, memoryB64: '' };
    }
    importSnapshot(snapshot) { this.importCount++; this.lastImported = snapshot; return true; }
    snapshotFingerprint() { return `fake-${this.snapshotSerial}`; }
}

function createEnvironment({ search = '', initialStorage = {} } = {}) {
    const elementIds = [
        'prog', 'verb', 'noun', 'r1', 'r2', 'r3', 'mode', 'agc', 'clock',
        'dim', 'dreambright', 'sound', 'display', 'dsky', 'controls', 'hint',
        'comp', 'imu-zero', 'mag-lock', 'pipa-cal', 'sxt', 'cheat', 'diagnostics'
    ];
    const elements = Object.fromEntries(
        elementIds.map((id) => [id, new Element(id)])
    );

    const lampNames = [
        'uplink', 'temp', 'noatt', 'gimbal', 'stby', 'prog', 'keyrel',
        'restart', 'oprerr', 'tracker', 'alt', 'vel', 'comp'
    ];
    for (const name of lampNames) {
        const element = new Element();
        element.dataset.lamp = name;
        elements[`lamp-${name}`] = element;
    }

    const keyElements = 'V + 7 8 9 C E N - 4 5 6 P R 0 1 2 3 K'
        .split(' ')
        .map((key) => {
            const element = new Element();
            element.dataset.key = key;
            return element;
        });
    const allLamps = Object.values(elements).filter((element) => element.dataset.lamp);

    const document = {
        hidden: false,
        body: new Element('body'),
        listeners: {},
        getElementById(id) { return elements[id] || null; },
        querySelector(selector) {
            const match = selector.match(/^\[data-lamp="(.+)"\]$/);
            return match ? elements[`lamp-${match[1]}`] : null;
        },
        querySelectorAll(selector) {
            if (selector === '[data-lamp]') return allLamps;
            if (selector === '[data-key]') return keyElements;
            return [];
        },
        addEventListener(name, callback) { this.listeners[name] = callback; }
    };

    const storage = new Map(
        Object.entries(initialStorage).map(([key, value]) => [key, String(value)])
    );
    const localStorage = {
        getItem(key) { return storage.has(key) ? storage.get(key) : null; },
        setItem(key, value) { storage.set(key, String(value)); },
        removeItem(key) { storage.delete(key); }
    };

    const windowListeners = {};
    const context = {
        console,
        document,
        localStorage,
        location: { search },
        navigator: {},
        window: null,
        AgcCore: FakeAgcCore,
        URLSearchParams,
        Date,
        Math,
        Number,
        JSON,
        performance: { now: () => 0 },
        setInterval: () => 1,
        clearInterval: () => {},
        setTimeout(callback) { callback(); return 1; },
        clearTimeout: () => {},
        addEventListener(name, callback) { windowListeners[name] = callback; }
    };
    context.window = context;

    vm.createContext(context);
    vm.runInContext(fs.readFileSync(APP_JS, 'utf8'), context, { filename: 'app.js' });
    return { context, document, elements, keyElements, storage, windowListeners };
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function flushAsync() {
    return new Promise((resolve) => setImmediate(resolve));
}

function checkWebViewLockdown(source, label) {
    assert(source.includes('setBlockNetworkLoads(true)'),
        `${label} must explicitly block WebView network loads`);
    assert(source.includes('setAllowFileAccess(false)'),
        `${label} must disable file:// access`);
    assert(source.includes('setAllowContentAccess(false)'),
        `${label} must disable content:// access`);
}

function checkDebugOnlyWebViewInspection(source, label) {
    const flag = source.indexOf('ApplicationInfo.FLAG_DEBUGGABLE');
    const enable = source.indexOf('WebView.setWebContentsDebuggingEnabled(true)');
    assert(flag >= 0 && enable > flag,
        `${label} must gate WebView remote debugging on FLAG_DEBUGGABLE`);
}

function checkSourceInvariants() {
    const manifest = fs.readFileSync(MANIFEST, 'utf8');
    assert(!manifest.includes('android.permission.INTERNET'),
        'manifest must remain offline/no-INTERNET');
    assert(manifest.includes('android:allowBackup="false"'),
        'application backup must remain disabled for local-only state');
    assert(manifest.includes('android.webkit.WebView.MetricsOptOut'),
        'WebView metrics collection must remain opted out');
    assert(manifest.includes('android:name=".SensorMainActivity"'),
        'SensorMainActivity must remain the interactive launcher');
    assert(manifest.includes('android:targetActivity=".SensorMainActivity"'),
        'MainActivity alias must continue routing widget/legacy intents to SensorMainActivity');
    assert(manifest.includes('android.permission.CAMERA'),
        'camera permission required by optics is missing');
    assert(manifest.includes('android.permission.ACCESS_COARSE_LOCATION'),
        'coarse location permission is missing');
    assert(manifest.includes('android.permission.ACCESS_FINE_LOCATION'),
        'fine location permission is missing');
    assert(manifest.includes('android.permission.BIND_DREAM_SERVICE'),
        'DreamService bind permission missing');

    const gradle = fs.readFileSync(APP_GRADLE, 'utf8');
    assert(gradle.includes("file('../vendor/webAGC/src/yaAGC.wasm')"),
        'pinned yaAGC WASM input missing');
    assert(gradle.includes("file('../vendor/webAGC/demo/agc/Comanche055.bin')"),
        'pinned Comanche055 input missing');
    assert(!gradle.includes('Luminary099.bin'),
        'CM-only Gradle configuration must not stage Luminary099');
    assert(gradle.includes('verifyPinnedAgcAssets'),
        'pinned AGC binary verification task missing');
    assert(gradle.includes("tasks.register('stagePinnedAgcAssets', Sync)"),
        'verified AGC binary staging task missing');
    assert(gradle.includes("it.name == 'preBuild'"),
        'ordinary Android preBuild must stage verified AGC assets');

    const assetRoots = gradle.match(/assets\.srcDirs\s*=\s*\[([\s\S]*?)\]/);
    assert(assetRoots, 'Android asset roots missing');
    assert(assetRoots[1].includes('generatedAgcAssetsDir'),
        'generated verified AGC asset root missing');
    assert(!assetRoots[1].includes('vendor/webAGC'),
        'whole webAGC vendor directories must not be Android asset roots');

    const html = fs.readFileSync(INDEX_HTML, 'utf8');
    assert(!html.includes('id="mission"'),
        'CM-only frontend must not expose the removed mission selector');
    assert(html.includes('id="clock"') && html.includes('id="agc"'),
        'clock/AGC controls are missing from index.html');
    assert(html.includes('controls-layout.css'),
        'responsive controls stylesheet missing from index.html');
    const coreIndex = html.indexOf('<script src="agc-core.js"></script>');
    const appIndex = html.indexOf('<script src="app.js"></script>');
    const phoneIndex = html.indexOf('<script src="phone-icdu.js"></script>');
    const diagnosticsIndex = html.indexOf('<script src="diagnostics.js"></script>');
    assert(coreIndex >= 0 && appIndex > coreIndex && phoneIndex > appIndex && diagnosticsIndex > phoneIndex,
        'current AGC/app/phone/diagnostics script order is invalid');
    for (const removed of ['runtime-debug.js', 'app-refine.js', 'v35-audio-refine.js', 'spacecraft-panels.js']) {
        assert(!html.includes(`src="${removed}"`), `removed/stale script is loaded: ${removed}`);
    }

    const sensorActivity = fs.readFileSync(SENSOR_ACTIVITY, 'utf8');
    checkWebViewLockdown(sensorActivity, 'SensorMainActivity');
    checkDebugOnlyWebViewInspection(sensorActivity, 'SensorMainActivity');
    assert(sensorActivity.includes('isLocalAssetOrigin(origin)'),
        'SensorMainActivity geolocation must be restricted to packaged origin');
    assert(sensorActivity.includes('isLocalAssetOrigin(request.getOrigin().toString())'),
        'SensorMainActivity camera permission must be restricted to packaged origin');
    for (const bridge of [
        'nativePhoneQuaternion', 'nativeMagneticQuaternion',
        'nativePhoneLinearAcceleration', 'nativeSkyPointing'
    ]) {
        assert(sensorActivity.includes(bridge), `SensorMainActivity missing bridge call ${bridge}`);
    }

    const dreamService = fs.readFileSync(DREAM_SERVICE, 'utf8');
    checkWebViewLockdown(dreamService, 'AgcDreamService');
    checkDebugOnlyWebViewInspection(dreamService, 'AgcDreamService');

    const netClient = fs.readFileSync(NET_CLIENT, 'utf8');
    assert(netClient.includes('shouldOverrideUrlLoading'),
        'NetClient must prevent navigation away from packaged content');
    assert(netClient.includes('isPackagedAssetUri'),
        'NetClient packaged-asset navigation guard missing');
    assert(netClient.includes('headers.put("Cache-Control", "no-store")'),
        'packaged WebView assets must not be served from stale cache');
    assert(netClient.includes('headers.put("X-Content-Type-Options", "nosniff")'),
        'packaged WebView assets must disable MIME sniffing');

    const debugReporter = fs.readFileSync(DEBUG_REPORTER, 'utf8');
    assert(debugReporter.includes('packageVersion(context)'),
        'debug report must include the exact app version');
    assert(debugReporter.includes('WebView.getCurrentWebViewPackage()'),
        'debug report must include the installed WebView/Trichrome package version');
    assert(debugReporter.includes('location coordinates are intentionally not included'),
        'debug report must continue excluding saved location coordinates');
}

async function main() {
    checkSourceInvariants();

    // A fresh non-dream install defaults to the real CM AGC unless the user
    // explicitly chose clock mode previously.
    const fresh = createEnvironment();
    await flushAsync();
    const core = fresh.context.AGCDSKY.getCore();
    assert(core, 'fresh interactive frontend must create the AGC core');
    assert(fresh.context.AGCDSKY.getMission() === 'comanche055',
        'frontend mission must be fixed to Comanche055');
    assert(core.rope === 'Comanche055.bin' && core.wasm === 'yaAGC.wasm',
        'fresh AGC mode must load the pinned Comanche/yaAGC filenames');
    assert(core.running, 'fresh AGC core must start while the app is visible');
    assert(fresh.storage.get('runMode') === 'agc',
        'fresh AGC mode must persist runMode=agc');
    assert(fresh.elements.mode.textContent.includes('COMANCHE055'),
        'mode status must identify Comanche055');

    // Normal DSKY keys still route into the real AGC keyboard path. PRO is
    // intentionally excluded here because current hardware-fidelity handling
    // owns its physical semantics outside app.js.
    const key1 = fresh.keyElements.find((element) => element.dataset.key === '1');
    assert(key1 && typeof key1.listeners.pointerdown === 'function',
        'DSKY key pointer handler must be installed');
    key1.listeners.pointerdown({ preventDefault() {} });
    assert(core.keyCodes.includes(0o01),
        'DSKY digit 1 must route keycode 01 to AgcCore');

    // Clock mode suspends the same running AGC and saves a snapshot. Returning
    // to AGC resumes that same core rather than reloading another rope.
    fresh.elements.clock.listeners.click();
    assert(!core.running, 'clock mode must suspend the AGC core');
    assert(fresh.storage.get('runMode') === 'clock',
        'clock mode must persist runMode=clock');
    assert(fresh.storage.has('agcSnapshotV1'),
        'clock suspend must save an AGC snapshot');
    const exportsAfterClock = core.exportCount;
    fresh.elements.agc.listeners.click();
    await flushAsync();
    assert(fresh.context.AGCDSKY.getCore() === core,
        'returning from clock must resume the existing AGC core');
    assert(core.running, 'returning from clock must restart the suspended core');
    assert(core.exportCount === exportsAfterClock,
        'clock-to-AGC resume must not reload/replace the core');
    assert(fresh.storage.get('runMode') === 'agc',
        'AGC resume must persist runMode=agc');

    // Native visibility transitions pause/save and resume the same core.
    const exportsBeforeHide = core.exportCount;
    fresh.context.AGCDSKY.setAppVisible(false);
    assert(!core.running, 'hidden app must pause the AGC core');
    assert(core.exportCount > exportsBeforeHide,
        'hidden app must snapshot current AGC state');
    fresh.context.AGCDSKY.setAppVisible(true);
    assert(core.running, 'visible app must resume the same AGC core');

    // Explicitly remembered clock mode must suppress automatic AGC startup.
    const clockOnly = createEnvironment({ initialStorage: { runMode: 'clock' } });
    await flushAsync();
    assert(clockOnly.context.AGCDSKY.getCore() === null,
        'remembered clock mode must not auto-start yaAGC');
    assert(clockOnly.context.AGCDSKY.appStatus().mode === 'clock',
        'remembered clock mode must stay in clock mode');

    // DreamService page is always phone-clock/display-only and must never boot
    // the AGC even if the saved interactive run mode is AGC.
    const dream = createEnvironment({
        search: '?dream=1&clock=1&display=1',
        initialStorage: { runMode: 'agc' }
    });
    await flushAsync();
    assert(dream.context.AGCDSKY.getCore() === null,
        'DreamService page must not start yaAGC');
    assert(dream.document.body.classList.contains('dream'),
        'DreamService page must enter dream mode');
    assert(dream.document.body.classList.contains('display-only'),
        'DreamService page must stay display-only');

    console.log('frontend/source smoke: PASS');
    console.log('  CM-only startup, DSKY key route, snapshot suspend/resume, visibility lifecycle, clock persistence, and dream isolation verified');
}

main().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
