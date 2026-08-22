package org.apollo.agcdsky;

import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;

/**
 * Serves packaged assets from a synthetic HTTPS origin so WebAssembly and rope
 * images can be fetched normally from the local Android APK. Nothing under the
 * appassets host is fetched from the network.
 */
public final class NetClient extends WebViewClient {
    public static final String ASSET_ORIGIN = "https://appassets.androidplatform.net";
    public static final String ASSET_PREFIX = "/assets/";

    private final Context context;

    public NetClient(Context context) {
        this.context = context.getApplicationContext();
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!"https".equals(uri.getScheme())
                || !"appassets.androidplatform.net".equals(uri.getHost())) {
            return null;
        }

        String path = uri.getPath();
        if (path == null || !path.startsWith(ASSET_PREFIX)) {
            return notFound();
        }

        String assetPath = path.substring(ASSET_PREFIX.length());
        if (assetPath.isEmpty() || assetPath.contains("..")) {
            return notFound();
        }

        try {
            InputStream input = context.getAssets().open(assetPath);
            return new WebResourceResponse(mimeType(assetPath), encoding(assetPath), input);
        } catch (IOException ignored) {
            return notFound();
        }
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, null);
    }

    private static String encoding(String path) {
        return path.endsWith(".html") || path.endsWith(".js") || path.endsWith(".css")
                || path.endsWith(".json") || path.endsWith(".txt")
                ? "UTF-8" : null;
    }

    private static String mimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "text/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".wasm")) return "application/wasm";
        if (path.endsWith(".bin")) return "application/octet-stream";
        if (path.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }
}
