import Foundation
import WebKit

final class AGCAssetSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "agcdsky"
    static let host = "app"

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

        let rawPath = url.path.removingPercentEncoding ?? url.path
        let components = rawPath.split(separator: "/", omittingEmptySubsequences: true)
        guard !components.isEmpty,
              !components.contains(where: { $0 == "." || $0 == ".." || $0.contains("\\") }) else {
            send(status: 404, body: Data("Not Found".utf8), mime: "text/plain", for: urlSchemeTask)
            return
        }

        let relativePath = components.map(String.init).joined(separator: "/")
        let candidate = resourceRoot
            .appendingPathComponent(relativePath, isDirectory: false)
            .standardizedFileURL

        let rootPath = resourceRoot.path.hasSuffix("/") ? resourceRoot.path : resourceRoot.path + "/"
        guard candidate.path.hasPrefix(rootPath) else {
            send(status: 403, body: Data("Forbidden".utf8), mime: "text/plain", for: urlSchemeTask)
            return
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
