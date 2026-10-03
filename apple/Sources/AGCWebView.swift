import Foundation
import SwiftUI
import WebKit

#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif
import CoreHaptics

@MainActor
final class AGCWebViewModel: ObservableObject {
    weak var webView: WKWebView?
    private(set) var requestedVisible = true
#if os(macOS)
    private var activityToken: NSObjectProtocol?
#endif

    func attach(webView: WKWebView) {
        self.webView = webView
        applyVisibilityState()
    }

    func detach(webView: WKWebView) {
        if self.webView === webView {
            self.webView = nil
        }
#if os(iOS)
        UIApplication.shared.isIdleTimerDisabled = false
#elseif os(macOS)
        endMacActivity()
#endif
    }

    func setAppVisible(_ visible: Bool) {
        requestedVisible = visible
        applyVisibilityState()
    }

    func notifyPageReady() {
        applyVisibilityState()
    }

    private func applyVisibilityState() {
#if os(iOS)
        UIApplication.shared.isIdleTimerDisabled = requestedVisible
#elseif os(macOS)
        if requestedVisible {
            beginMacActivity()
        } else {
            endMacActivity()
        }
#endif

        guard let webView else { return }
        let js = requestedVisible
            ? "if(window.AGCDSKY&&AGCDSKY.setAppVisible){AGCDSKY.setAppVisible(false);AGCDSKY.setAppVisible(true)}"
            : "if(window.AGCDSKY&&AGCDSKY.setAppVisible){AGCDSKY.setAppVisible(false)}"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

#if os(macOS)
    private func beginMacActivity() {
        guard activityToken == nil else { return }
        activityToken = ProcessInfo.processInfo.beginActivity(
            options: [.userInitiated, .idleSystemSleepDisabled, .idleDisplaySleepDisabled],
            reason: "AGC DSKY active display"
        )
    }

    private func endMacActivity() {
        guard let activityToken else { return }
        ProcessInfo.processInfo.endActivity(activityToken)
        self.activityToken = nil
    }
#endif
}

@MainActor
final class AGCWebCoordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    let model: AGCWebViewModel
    private let assetHandler = AGCAssetSchemeHandler()
#if os(iOS)
    private let keyMakeFeedback = UIImpactFeedbackGenerator(style: .rigid)
    private let keyReleaseFeedback = UIImpactFeedbackGenerator(style: .light)
    private let keyTestFeedback = UIImpactFeedbackGenerator(style: .heavy)
#endif
    private var relayHapticEngine: CHHapticEngine?

    private var hapticBridgeAvailable: Bool {
        CHHapticEngine.capabilitiesForHardware().supportsHaptics
    }

    private var hapticPlatformName: String {
#if os(iOS)
        return "ios"
#elseif os(macOS)
        return "macos"
#endif
    }

    private var hapticBackendName: String {
#if os(iOS)
        return "UIImpactFeedbackGenerator"
#elseif os(macOS)
        return "NSHapticFeedbackManager"
#endif
    }

    init(model: AGCWebViewModel) {
        self.model = model
        super.init()
    }

    func makeWebView() -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.setURLSchemeHandler(assetHandler, forURLScheme: AGCAssetSchemeHandler.scheme)
        configuration.userContentController.add(self, name: "PrintBridge")
        configuration.userContentController.add(self, name: "HapticBridge")
#if DEBUG
        configuration.userContentController.add(self, name: "DebugBridge")
        let debugScript = """
        (() => {
          const report = (type, detail) => {
            try {
              window.webkit.messageHandlers.DebugBridge.postMessage({
                type: String(type).slice(0, 32),
                detail: String(detail == null ? '' : detail).slice(0, 2048)
              });
            } catch (_) {}
          };
          window.DebugBridge = Object.freeze({
            ready: detail => report('ready', detail),
            report: detail => report('report', detail)
          });
          window.addEventListener('error', event => {
            const target = event.target;
            const detail = target && (target.src || target.href)
              ? `resource load failed: ${target.src || target.href}`
              : `${event.message || 'JavaScript error'} @${event.filename || ''}:${event.lineno || 0}:${event.colno || 0}`;
            report('error', detail);
          }, true);
          window.addEventListener('unhandledrejection', event => {
            const reason = event.reason;
            report('unhandledrejection', reason && (reason.stack || reason.message) || reason);
          });
          window.addEventListener('securitypolicyviolation', event => {
            report('csp', `${event.violatedDirective} blocked ${event.blockedURI || 'inline content'}`);
          });
          report('report', 'debug bridge installed at document start');
        })();
        """
        configuration.userContentController.addUserScript(
            WKUserScript(source: debugScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
#endif
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: "window.PrintBridge=Object.freeze({printChecklist:function(){window.webkit.messageHandlers.PrintBridge.postMessage('print')}});",
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        let hapticAvailable = hapticBridgeAvailable ? "true" : "false"
        let hapticScript = """
        window.HapticBridge=Object.freeze({
          available:function(){return \(hapticAvailable);},
          platform:function(){return '\(hapticPlatformName)';},
          backend:function(){return '\(hapticBackendName)';},
          amplitudeControl:function(){return false;},
          keyMake:function(){window.webkit.messageHandlers.HapticBridge.postMessage('make');return true;},
          keyRelease:function(){window.webkit.messageHandlers.HapticBridge.postMessage('release');return true;},
          testPulse:function(){window.webkit.messageHandlers.HapticBridge.postMessage('test');return true;},
          relayImpact:function(durationMs,amplitude){window.webkit.messageHandlers.HapticBridge.postMessage({type:'relayImpact',durationMs:durationMs,amplitude:amplitude});return true;},
          relayWaveform:function(timings,amplitudes){window.webkit.messageHandlers.HapticBridge.postMessage({type:'relayWaveform',timings:timings,amplitudes:amplitudes});return true;}
        });
        """
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: hapticScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )

#if os(iOS)
        configuration.allowsInlineMediaPlayback = true
        configuration.allowsAirPlayForMediaPlayback = false
#endif

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false

#if DEBUG
        if #available(iOS 16.4, macOS 13.3, *) {
            webView.isInspectable = true
        }
#endif

#if os(iOS)
        webView.isOpaque = false
        webView.backgroundColor = UIColor.black
        webView.scrollView.backgroundColor = UIColor.black
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 15.0, *) {
            webView.underPageBackgroundColor = UIColor.black
        }
#elseif os(macOS)
        webView.allowsMagnification = true
        if #available(macOS 12.0, *) {
            webView.underPageBackgroundColor = NSColor.black
        }
#endif

        model.attach(webView: webView)
        loadStartPage(in: webView)
        return webView
    }

    func dismantle(_ webView: WKWebView) {
        webView.stopLoading()
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "PrintBridge")
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "HapticBridge")
#if DEBUG
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "DebugBridge")
#endif
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        model.detach(webView: webView)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
#if DEBUG
        if message.name == "DebugBridge" {
            NSLog("[AGC DSKY DEBUG] bridge origin: main=%@ scheme=%@ host=%@",
                  message.frameInfo.isMainFrame ? "yes" : "no",
                  origin.protocol as NSString,
                  origin.host as NSString)
        }
#endif
        guard message.frameInfo.isMainFrame,
              origin.protocol.lowercased() == AGCAssetSchemeHandler.scheme,
              origin.host.lowercased() == AGCAssetSchemeHandler.host else { return }

#if DEBUG
        if message.name == "DebugBridge",
           let payload = message.body as? [String: String],
           let type = payload["type"],
           ["ready", "report", "error", "unhandledrejection", "csp"].contains(type) {
            NSLog("[AGC DSKY DEBUG] %@: %@", type as NSString, (payload["detail"] ?? "").prefix(2048) as NSString)
            return
        }
#endif

        if message.name == "HapticBridge" {
            if let command = message.body as? String {
                performKeyHaptic(command)
            } else if let payload = message.body as? [String: Any] {
                performRelayHaptic(payload)
            }
            return
        }
        guard message.name == "PrintBridge", (message.body as? String) == "print", let webView = model.webView else { return }
        printChecklist(from: webView)
    }

    private func performKeyHaptic(_ command: String) {
        guard hapticBridgeAvailable else { return }
#if os(iOS)
        switch command {
        case "make":
            keyMakeFeedback.impactOccurred()
            keyMakeFeedback.prepare()
        case "release":
            keyReleaseFeedback.impactOccurred()
            keyReleaseFeedback.prepare()
        case "test":
            keyTestFeedback.impactOccurred()
            keyTestFeedback.prepare()
        default:
            break
        }
#elseif os(macOS)
        let performer = NSHapticFeedbackManager.defaultPerformer
        switch command {
        case "make":
            performer.perform(.alignment, performanceTime: .now)
        case "release":
            performer.perform(.levelChange, performanceTime: .now)
        case "test":
            performer.perform(.generic, performanceTime: .now)
        default:
            break
        }
#endif
    }

    private func performRelayHaptic(_ payload: [String: Any]) {
        guard hapticBridgeAvailable,
              let type = payload["type"] as? String else { return }

        if type == "relayImpact" {
            guard let duration = payload["durationMs"] as? NSNumber,
                  let amplitude = payload["amplitude"] as? NSNumber,
                  duration.doubleValue == 1,
                  (1...3).contains(amplitude.intValue),
                  amplitude.doubleValue == Double(amplitude.intValue) else { return }
            playRelayHapticEvents([relayHapticEvent(amplitude: amplitude.intValue, at: 0)])
            return
        }

        guard type == "relayWaveform",
              let timings = payload["timings"] as? String,
              let amplitudes = payload["amplitudes"] as? String else { return }
        playRelayWaveform(timings: timings, amplitudes: amplitudes)
    }

    private func playRelayWaveform(timings: String, amplitudes: String) {
        guard timings.utf8.count <= 1024,
              amplitudes.utf8.count <= 1024 else { return }
        let timingParts = timings.split(separator: ",", omittingEmptySubsequences: false)
        let amplitudeParts = amplitudes.split(separator: ",", omittingEmptySubsequences: false)
        guard !timingParts.isEmpty,
              timingParts.count == amplitudeParts.count,
              timingParts.count <= 192 else { return }

        var elapsedMs = 0
        var events: [CHHapticEvent] = []
        for (timingPart, amplitudePart) in zip(timingParts, amplitudeParts) {
            guard let durationMs = Int(timingPart),
                  let amplitude = Int(amplitudePart),
                  (0...80).contains(durationMs),
                  (0...3).contains(amplitude) else { return }
            if amplitude > 0 {
                guard durationMs > 0 else { return }
                events.append(relayHapticEvent(amplitude: amplitude, at: Double(elapsedMs) / 1000))
            }
            elapsedMs += durationMs
            guard elapsedMs <= 750 else { return }
        }
        guard !events.isEmpty else { return }
        playRelayHapticEvents(events)
    }

    private func relayHapticEvent(amplitude: Int, at time: TimeInterval) -> CHHapticEvent {
        // Preserve the shared 0..255 cue value numerically; this is not a claim
        // that Apple and Android hardware produce equal perceived intensity.
        CHHapticEvent(
            eventType: .hapticTransient,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: Float(amplitude) / 255)
            ],
            relativeTime: time
        )
    }

    private func playRelayHapticEvents(_ events: [CHHapticEvent]) {
        guard !events.isEmpty else { return }
        do {
            let engine: CHHapticEngine
            if let relayHapticEngine {
                engine = relayHapticEngine
            } else {
                engine = try CHHapticEngine()
                engine.isAutoShutdownEnabled = true
                relayHapticEngine = engine
            }
            try engine.start()
            let pattern = try CHHapticPattern(events: events, parameters: [])
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            relayHapticEngine = nil
        }
    }

    private func printChecklist(from webView: WKWebView) {
#if os(iOS)
        let controller = UIPrintInteractionController.shared
        let printInfo = UIPrintInfo(dictionary: nil)
        printInfo.outputType = .general
        printInfo.jobName = "Apollo DSKY Checklist"
        printInfo.orientation = .landscape

        let renderer = UIPrintPageRenderer()
        let paper = CGRect(x: 0, y: 0, width: 11.0 * 72.0, height: 8.5 * 72.0)
        renderer.setValue(NSValue(cgRect: paper), forKey: "paperRect")
        renderer.setValue(NSValue(cgRect: paper), forKey: "printableRect")
        renderer.addPrintFormatter(webView.viewPrintFormatter(), startingAtPageAt: 0)

        controller.printInfo = printInfo
        controller.printPageRenderer = renderer
        controller.present(animated: true, completionHandler: nil)
#elseif os(macOS)
        let printInfo = NSPrintInfo.shared.copy() as! NSPrintInfo
        printInfo.paperSize = NSSize(width: 8.5 * 72.0, height: 11.0 * 72.0)
        printInfo.orientation = .landscape
        printInfo.topMargin = 0
        printInfo.bottomMargin = 0
        printInfo.leftMargin = 0
        printInfo.rightMargin = 0
        printInfo.isHorizontallyCentered = false
        printInfo.isVerticallyCentered = false

        let operation = NSPrintOperation(view: webView, printInfo: printInfo)
        operation.jobTitle = "Apollo DSKY Checklist"
        operation.run()
#endif
    }

    private func loadStartPage(in webView: WKWebView) {
        guard let url = URL(string: "\(AGCAssetSchemeHandler.scheme)://\(AGCAssetSchemeHandler.host)/index.html") else {
            assertionFailure("Invalid AGC DSKY start URL")
            return
        }
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        model.notifyPageReady()
#if os(macOS)
        DispatchQueue.main.async {
            webView.window?.makeFirstResponder(webView)
        }
#endif
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loadStartPage(in: webView)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        let scheme = url.scheme?.lowercased()
        if scheme == AGCAssetSchemeHandler.scheme || scheme == "about" || scheme == "blob" {
            decisionHandler(.allow)
            return
        }

        if scheme == "http" || scheme == "https" {
#if os(iOS)
            UIApplication.shared.open(url)
#elseif os(macOS)
            NSWorkspace.shared.open(url)
#endif
        }
        decisionHandler(.cancel)
    }

    @available(iOS 15.0, macOS 12.0, *)
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        if origin.protocol.lowercased() == AGCAssetSchemeHandler.scheme,
           origin.host.lowercased() == AGCAssetSchemeHandler.host,
           frame.isMainFrame,
           type == .camera {
            decisionHandler(.grant)
        } else {
            decisionHandler(.deny)
        }
    }
}

#if os(iOS)
struct AGCWebView: UIViewRepresentable {
    let model: AGCWebViewModel

    func makeCoordinator() -> AGCWebCoordinator {
        AGCWebCoordinator(model: model)
    }

    func makeUIView(context: Context) -> WKWebView {
        context.coordinator.makeWebView()
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    static func dismantleUIView(_ uiView: WKWebView, coordinator: AGCWebCoordinator) {
        coordinator.dismantle(uiView)
    }
}
#elseif os(macOS)
struct AGCWebView: NSViewRepresentable {
    let model: AGCWebViewModel

    func makeCoordinator() -> AGCWebCoordinator {
        AGCWebCoordinator(model: model)
    }

    func makeNSView(context: Context) -> WKWebView {
        context.coordinator.makeWebView()
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

    static func dismantleNSView(_ nsView: WKWebView, coordinator: AGCWebCoordinator) {
        coordinator.dismantle(nsView)
    }
}
#endif
