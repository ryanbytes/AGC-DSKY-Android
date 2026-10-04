import Foundation

@main
struct AssetSchemePathSmoke {
    static func main() throws {
        let fileManager = FileManager.default
        let temporaryRoot = fileManager.temporaryDirectory
            .appendingPathComponent("agc-asset-scheme-smoke-\(UUID().uuidString)", isDirectory: true)
        defer { try? fileManager.removeItem(at: temporaryRoot) }

        let resources = temporaryRoot.appendingPathComponent("Resources", isDirectory: true)
        let root = resources.appendingPathComponent("WebAssets", isDirectory: true)
        let outside = resources.appendingPathComponent("private.txt")
        try fileManager.createDirectory(at: root, withIntermediateDirectories: true)
        try Data("public asset".utf8).write(to: root.appendingPathComponent("index.html"))
        try Data("private sentinel".utf8).write(to: outside)
        try fileManager.createSymbolicLink(
            at: root.appendingPathComponent("escape.txt"),
            withDestinationURL: outside)
        try fileManager.createSymbolicLink(
            at: root.appendingPathComponent("inside-alias.html"),
            withDestinationURL: root.appendingPathComponent("index.html"))

        func resolve(_ path: String, under resourceRoot: URL = root) -> AGCAssetSchemeHandler.AssetURLResolution {
            let url = URL(string: "agcdsky://app/\(path)")!
            return AGCAssetSchemeHandler.resolveAssetURL(url, under: resourceRoot)
        }

        guard case .asset(let indexURL) = resolve("index.html"),
              indexURL.path == root.appendingPathComponent("index.html").path,
              try Data(contentsOf: indexURL) == Data("public asset".utf8) else {
            fatalError("regular in-root asset did not resolve")
        }

        guard case .asset(let aliasURL) = resolve("inside-alias.html"),
              aliasURL.path == root.appendingPathComponent("index.html").path else {
            fatalError("in-root symlink did not resolve to its contained target")
        }

        guard case .outsideResourceRoot = resolve("escape.txt") else {
            fatalError("symlink to a sibling bundle resource escaped WebAssets")
        }

        guard case .invalidPath = resolve("%2e%2e/private.txt") else {
            fatalError("percent-encoded parent traversal was not rejected")
        }
        guard case .invalidPath = resolve("folder%2f..%2fprivate.txt") else {
            fatalError("percent-encoded separator traversal was not rejected")
        }
        guard case .invalidPath = resolve("..%5cprivate.txt") else {
            fatalError("percent-encoded backslash traversal was not rejected")
        }

        let alternateRoot = resources.appendingPathComponent("AlternateAssets", isDirectory: true)
        try fileManager.createDirectory(at: alternateRoot, withIntermediateDirectories: true)
        let rootSymlink = resources.appendingPathComponent("WebAssetsAlias", isDirectory: true)
        try fileManager.createSymbolicLink(at: rootSymlink, withDestinationURL: alternateRoot)
        guard case .outsideResourceRoot = resolve("index.html", under: rootSymlink) else {
            fatalError("symlinked WebAssets root was accepted")
        }

        print("Apple asset scheme path smoke: PASS")
        print("  decoded traversal rejected; in-root assets resolve; file and root symlinks cannot escape WebAssets")
    }
}
