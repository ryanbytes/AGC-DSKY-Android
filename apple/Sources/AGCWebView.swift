import Foundation
import SwiftUI
import WebKit

#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

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
final class AGCWebCoordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
    let model: AGCWebViewModel
    private let assetHandler = AGCAssetSchemeHandler()

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
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
        model.detach(webView: webView)
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
           type == .camera || type == .cameraAndMicrophone {
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
