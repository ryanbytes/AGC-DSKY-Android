package org.apollo.agcdsky;

import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;

/**
 * Serves packaged assets from a synthetic HTTPS origin so WebAssembly and rope
 * images can be fetched normally from the local Android APK. Nothing under the
 * appassets host is fetched from the network, and top-level navigation is kept
 * on the packaged asset origin.
 */
public final class NetClient extends WebViewClient {
    public static final String ASSET_ORIGIN = "https://appassets.androidplatform.net";
    public static final String ASSET_PREFIX = "/assets/";
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String ASSET_ROOT_SEGMENT = "assets";

    private final Context context;

    public NetClient(Context context) {
        this.context = context.getApplicationContext();
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (request == null) return true;
        Uri uri = request.getUrl();
        return !isPackagedAssetUri(uri);
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (request == null) return null;

        Uri uri = request.getUrl();
        if (!isAssetOrigin(uri)) return null;

        // Parse by URI path segments rather than by substring arithmetic. This
        // avoids the negative/out-of-range index crash seen in the old
        // diagnostic APK and also gives us one place to reject traversal or
        // encoded separator tricks before opening an AssetManager path.
        List<String> segments = uri.getPathSegments();
        if (segments == null
                || segments.size() < 2
                || !ASSET_ROOT_SEGMENT.equals(segments.get(0))) {
            return notFound();
        }

        StringBuilder assetPath = new StringBuilder();
        for (int i = 1; i < segments.size(); i++) {
            String segment = segments.get(i);
            if (segment == null
                    || segment.isEmpty()
                    || ".".equals(segment)
                    || "..".equals(segment)
                    || segment.indexOf('/') >= 0
                    || segment.indexOf('\\') >= 0) {
                return notFound();
            }
            if (assetPath.length() > 0) assetPath.append('/');
            assetPath.append(segment);
        }

        if (assetPath.length() == 0) return notFound();
        String path = assetPath.toString();

        try {
            InputStream input = context.getAssets().open(path);
            return new WebResourceResponse(mimeType(path), encoding(path), input);
        } catch (IOException ignored) {
            return notFound();
        }
    }

    private static boolean isAssetOrigin(Uri uri) {
        if (uri == null
                || !"https".equalsIgnoreCase(uri.getScheme())
                || !ASSET_HOST.equalsIgnoreCase(uri.getHost())) {
            return false;
        }
        int port = uri.getPort();
        return port == -1 || port == 443;
    }

    private static boolean isPackagedAssetUri(Uri uri) {
        if (!isAssetOrigin(uri)) return false;
        List<String> segments = uri.getPathSegments();
        return segments != null
                && segments.size() >= 2
                && ASSET_ROOT_SEGMENT.equals(segments.get(0));
    }

    private static WebResourceResponse notFound() {
        byte[] body = "Not Found".getBytes(StandardCharsets.UTF_8);
        return new WebResourceResponse(
                "text/plain",
                "UTF-8",
                404,
                "Not Found",
                Collections.emptyMap(),
                new ByteArrayInputStream(body));
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
