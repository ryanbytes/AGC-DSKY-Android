import Foundation
import WebKit

final class AGCAssetSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "agcdsky"
    static let host = "app"

    enum AssetURLResolution {
        case invalidPath
        case outsideResourceRoot
        case asset(URL)
    }

    static func resolveAssetURL(_ url: URL, under resourceRoot: URL) -> AssetURLResolution {
        let rawPath = url.path.removingPercentEncoding ?? url.path
        let components = rawPath.split(separator: "/", omittingEmptySubsequences: true)
        guard !components.isEmpty,
              !components.contains(where: { $0 == "." || $0 == ".." || $0.contains("\\") }) else {
            return .invalidPath
        }

        let relativePath = components.map(String.init).joined(separator: "/")
        let resourceParent = resourceRoot.deletingLastPathComponent()
            .resolvingSymlinksInPath()
            .standardizedFileURL
        let expectedRoot = resourceParent
            .appendingPathComponent(resourceRoot.lastPathComponent, isDirectory: true)
            .standardizedFileURL
        let resolvedRoot = resourceRoot.resolvingSymlinksInPath().standardizedFileURL
        guard resolvedRoot.path == expectedRoot.path else { return .outsideResourceRoot }

        let candidate = resourceRoot
            .appendingPathComponent(relativePath, isDirectory: false)
            .resolvingSymlinksInPath()
            .standardizedFileURL
        let rootPath = resolvedRoot.path.hasSuffix("/") ? resolvedRoot.path : resolvedRoot.path + "/"
        guard candidate.path.hasPrefix(rootPath) else { return .outsideResourceRoot }
        return .asset(candidate)
    }

    private let resourceRoot: URL?

    override init() {
        self.resourceRoot = Bundle.main.resourceURL?
            .appendingPathComponent("WebAssets", isDirectory: true)
            .standardizedFileURL
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              url.scheme?.lowercased() == Self.scheme,
              url.host?.lowercased() == Self.host,
              let resourceRoot else {
            send(status: 404, body: Data("Not Found".utf8), mime: "text/plain", for: urlSchemeTask)
            return
        }

        let candidate: URL
        switch Self.resolveAssetURL(url, under: resourceRoot) {
        case .invalidPath:
            send(status: 404, body: Data("Not Found".utf8), mime: "text/plain", for: urlSchemeTask)
            return
        case .outsideResourceRoot:
            send(status: 403, body: Data("Forbidden".utf8), mime: "text/plain", for: urlSchemeTask)
            return
        case .asset(let resolvedURL):
            candidate = resolvedURL
        }

        do {
            let data = try Data(contentsOf: candidate, options: [.mappedIfSafe])
            send(status: 200, body: data, mime: Self.mimeType(for: candidate), for: urlSchemeTask)
        } catch {
            send(status: 404, body: Data("Not Found".utf8), mime: "text/plain", for: urlSchemeTask)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func send(status: Int, body: Data, mime: String, for task: WKURLSchemeTask) {
        guard let url = task.request.url,
              let response = HTTPURLResponse(
                url: url,
                statusCode: status,
                httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Type": mime,
                    "Cache-Control": "no-store",
                    "X-Content-Type-Options": "nosniff"
                ]) else {
            task.didFailWithError(URLError(.badServerResponse))
            return
        }

        task.didReceive(response)
        task.didReceive(body)
        task.didFinish()
    }

    private static func mimeType(for url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "txt", "md": return "text/plain; charset=utf-8"
        case "wasm": return "application/wasm"
        case "bin": return "application/octet-stream"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "wav": return "audio/wav"
        case "mp3": return "audio/mpeg"
        default: return "application/octet-stream"
        }
    }
}
