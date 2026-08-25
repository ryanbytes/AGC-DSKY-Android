#!/usr/bin/env node
'use strict';

/*
 * Dependency-free smoke test for the Android web frontend and source invariants.
 *
 * This is intentionally not a substitute for Android/WebView testing. It
 * catches ordinary JavaScript initialization regressions and exercises the
 * mission-selection / visibility lifecycle paths with a small DOM and AgcCore
 * mock so those paths can be checked even on a machine without Android SDK.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const APP_JS = path.join(ROOT, 'app/src/main/assets/app.js');
const RUNTIME_DEBUG_JS = path.join(ROOT, 'app/src/main/assets/runtime-debug.js');
const INDEX_HTML = path.join(ROOT, 'app/src/main/assets/index.html');
const MANIFEST = path.join(ROOT, 'app/src/main/AndroidManifest.xml');
const APP_GRADLE = path.join(ROOT, 'app/build.gradle');
const MAIN_ACTIVITY = path.join(
    ROOT, 'app/src/main/java/org/apollo/agcdsky/MainActivity.java');
const DREAM_SERVICE = path.join(
    ROOT, 'app/src/main/java/org/apollo/agcdsky/AgcDreamService.java');
const NET_CLIENT = path.join(
    ROOT, 'app/src/main/java/org/apollo/agcdsky/NetClient.java');
const DEBUG_REPORTER = path.join(
    ROOT, 'app/src/main/java/org/apollo/agcdsky/DebugReporter.java');

class Classes {
    constructor() {
        this.values = new Set();
    }

    add(...names) {
        names.forEach((name) => this.values.add(name));
    }

    remove(...names) {
        names.forEach((name) => this.values.delete(name));
    }

    toggle(name, force) {
        if (force === undefined) force = !this.values.has(name);
        if (force) this.values.add(name);
        else this.values.delete(name);
        return force;
    }

    contains(name) {
        return this.values.has(name);
    }
}

class Element {
    constructor(id = '') {
        this.id = id;
        this.textContent = '';
        this.innerHTML = '';
        this.dataset = {};
        this.classList = new Classes();
        this.listeners = {};
        this.style = { setProperty() {} };
    }

    addEventListener(name, callback) {
        this.listeners[name] = callback;
    }

    closest() {
        return null;
    }
}

class FakeAgcCore {
    constructor() {
        this.running = false;
        this.rope = null;
    }

    async load(options) {
        this.rope = options.ropeUrl;
    }

    reset() {}
    configureInputMasks() {}

    start() {
        this.running = true;
    }

    stop() {
        this.running = false;
    }

    version() {
        return 'fake-test-core';
    }

    keyPress() {}
    proceedPulse() {}
}

function createEnvironment({ search = '', initialStorage = {} } = {}) {
    const elementIds = [
        'prog', 'verb', 'noun', 'r1', 'r2', 'r3', 'mode', 'mission', 'agc',
        'dim', 'dreambright', 'sound', 'display', 'dsky', 'controls', 'hint',
        'comp'
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
        getElementById(id) {
            if (!elements[id]) elements[id] = new Element(id);
            return elements[id];
        },
        querySelector(selector) {
            const match = selector.match(/^\[data-lamp="(.+)"\]$/);
            return match ? elements[`lamp-${match[1]}`] : null;
        },
        querySelectorAll(selector) {
            if (selector === '[data-lamp]') return allLamps;
            if (selector === '[data-key]') return keyElements;
            return [];
        },
        addEventListener(name, callback) {
            this.listeners[name] = callback;
        }
    };

    const storage = new Map(
        Object.entries(initialStorage).map(([key, value]) => [key, String(value)])
    );
    const localStorage = {
        getItem(key) {
            return storage.has(key) ? storage.get(key) : null;
        },
        setItem(key, value) {
            storage.set(key, String(value));
        }
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
        performance: { now: () => 0 },
        setInterval: () => 1,
        clearInterval: () => {},
        setTimeout(callback) {
            callback();
            return 1;
        },
        clearTimeout: () => {},
        addEventListener(name, callback) {
            windowListeners[name] = callback;
        }
    };
    context.window = context;

    vm.createContext(context);
    vm.runInContext(fs.readFileSync(APP_JS, 'utf8'), context, { filename: 'app.js' });

    return { context, document, elements, storage, windowListeners };
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
    assert(!manifest.includes('android:process='),
        'Activity and DreamService must share the default process/WebView data directory');
    assert(manifest.includes('android.permission.BIND_DREAM_SERVICE'),
        'DreamService bind permission missing');
    assert(manifest.includes('android.service.dreams.DreamService'),
        'DreamService intent registration missing');

    const gradle = fs.readFileSync(APP_GRADLE, 'utf8');
    assert(gradle.includes("file('../vendor/webAGC/src/yaAGC.wasm')"),
        'pinned yaAGC WASM input missing');
    assert(gradle.includes("file('../vendor/webAGC/demo/agc/Luminary099.bin')"),
        'pinned Luminary099 input missing');
    assert(gradle.includes("file('../vendor/webAGC/demo/agc/Comanche055.bin')"),
        'pinned Comanche055 input missing');
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
    assert(html.includes('id="mission"'),
        'mission selector control missing from index.html');
    assert(html.includes('controls-layout.css'),
        'responsive controls stylesheet missing from index.html');
    const debugIndex = html.indexOf('<script src="runtime-debug.js"></script>');
    const coreIndex = html.indexOf('<script src="agc-core.js"></script>');
    assert(debugIndex >= 0 && coreIndex > debugIndex,
        'runtime-debug.js must load before the AGC runtime');

    const runtimeDebug = fs.readFileSync(RUNTIME_DEBUG_JS, 'utf8');
    assert(runtimeDebug.includes("addEventListener('error'"),
        'runtime debug hook must capture unhandled JavaScript errors');
    assert(runtimeDebug.includes("addEventListener('unhandledrejection'"),
        'runtime debug hook must capture unhandled promise rejections');
    assert(runtimeDebug.includes('DebugBridge.report'),
        'runtime debug hook must report through the local native bridge');

    const activity = fs.readFileSync(MAIN_ACTIVITY, 'utf8');
    checkWebViewLockdown(activity, 'MainActivity');
    checkDebugOnlyWebViewInspection(activity, 'MainActivity');
    assert(activity.includes('isLocalAssetOrigin(origin)'),
        'MainActivity geolocation must be restricted to the packaged origin');

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
    assert(netClient.includes('200,\n                    "OK"'),
        'packaged WebView success responses must have explicit HTTP 200 status');

    const debugReporter = fs.readFileSync(DEBUG_REPORTER, 'utf8');
    assert(debugReporter.includes('packageVersion(context)'),
        'debug report must include the exact app version');
    assert(debugReporter.includes('WebView.getCurrentWebViewPackage()'),
        'debug report must include the installed WebView/Trichrome package version');
    assert(debugReporter.includes('location coordinates are intentionally not included'),
        'debug report must continue excluding saved SOLAR coordinates');
}

function testRuntimeDebugHooks() {
    const listeners = {};
    const reports = [];
    const context = {
        window: null,
        DebugBridge: {
            report(detail) {
                reports.push(String(detail));
            }
        },
        addEventListener(name, callback) {
            listeners[name] = callback;
        }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(RUNTIME_DEBUG_JS, 'utf8'), context,
        { filename: 'runtime-debug.js' });

    assert(typeof listeners.error === 'function',
        'runtime debug error listener did not register');
    assert(typeof listeners.unhandledrejection === 'function',
        'runtime debug rejection listener did not register');

    listeners.error({
        message: 'boom',
        filename: 'https://appassets.androidplatform.net/assets/app.js',
        lineno: 12,
        colno: 3,
        error: { stack: 'Error: boom\n at app.js:12:3' }
    });
    listeners.unhandledrejection({ reason: { stack: 'Error: async boom' } });

    assert(reports.length === 2,
        'runtime debug hook must report both unhandled failure types');
    assert(reports[0].includes('UNHANDLED JAVASCRIPT ERROR')
        && reports[0].includes('boom'),
        'JavaScript error report missing useful details');
    assert(reports[1].includes('UNHANDLED PROMISE REJECTION')
        && reports[1].includes('async boom'),
        'promise rejection report missing useful details');
}

async function main() {
    checkSourceInvariants();
    testRuntimeDebugHooks();

    const first = createEnvironment();
    assert(first.elements.mission.textContent === 'LM L99',
        'LM must be the default mission');

    first.elements.mission.listeners.click();
    assert(first.elements.mission.textContent === 'CM C55',
        'mission button must switch to CM');
    assert(first.storage.get('agcMission') === 'comanche055',
        'mission selection must persist');

    first.elements.agc.listeners.click();
    await flushAsync();
    const core = first.context.AGCDSKY.getCore();
    assert(core, 'AGC mode must create a core');
    assert(core.rope === 'Comanche055.bin',
        'CM mode must load Comanche055.bin');
    assert(first.storage.get('runMode') === 'agc',
        'AGC mode must persist');

    first.context.AGCDSKY.setAppVisible(false);
    assert(!core.running, 'hidden app must pause the AGC core');
    first.context.AGCDSKY.setAppVisible(true);
    assert(core.running, 'visible app must resume the same AGC core');

    const restored = createEnvironment({
        initialStorage: { agcMission: 'comanche055', runMode: 'agc' }
    });
    await flushAsync();
    const restoredCore = restored.context.AGCDSKY.getCore();
    assert(restored.elements.mission.textContent === 'CM C55',
        'saved mission must restore');
    assert(restoredCore, 'saved AGC run mode must re-enter AGC mode');
    assert(restoredCore.rope === 'Comanche055.bin',
        'restored AGC mode must use saved rope');

    const dream = createEnvironment({
        search: '?dream=1&clock=1&display=1',
        initialStorage: { agcMission: 'comanche055', runMode: 'agc' }
    });
    await flushAsync();
    assert(dream.context.AGCDSKY.getCore() === null,
        'DreamService page must not start yaAGC');
    assert(dream.document.body.classList.contains('dream'),
        'DreamService page must enter dream mode');

    console.log('frontend/source smoke: PASS');
}

main().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
