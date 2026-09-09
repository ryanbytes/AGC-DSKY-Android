package org.apollo.agcdsky;

import android.content.pm.ApplicationInfo;
import android.os.Build;
import android.service.dreams.DreamService;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

/** Charging/idle Android screen saver with borderless DSKY clock modes. */
public final class AgcDreamService extends DreamService {
    private WebView webView;

    @Override
    public void onAttachedToWindow() {
        // Complete the DreamService/window attach before installing diagnostics
        // or touching the Window/WebView. This keeps startup lifecycle-safe.
        super.onAttachedToWindow();
        DebugReporter.install(this);

        // Interactive mode lets the borderless EL view handle a short tap as an
        // EL on/off toggle. A long hold calls DreamBridge.finishDream().
        setInteractive(true);
        setFullscreen(true);
        setScreenBright(true);

        setWindowBrightness(0.06f);
        hideSystemBars();

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        try {
            webView = new WebView(this);
            webView.setBackgroundColor(0xFF000000);
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setBlockNetworkLoads(true);
            settings.setAllowFileAccess(false);
            settings.setAllowContentAccess(false);
            webView.addJavascriptInterface(new DreamBridge(), "DreamBridge");
            webView.addJavascriptInterface(new DebugReporter.JsBridge(this), "DebugBridge");
            webView.setWebViewClient(new NetClient(this));
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onConsoleMessage(ConsoleMessage message) {
                    if (message != null
                            && message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                        String text = message.message();
                        if (text == null || !text.startsWith("[yaAGC]")) {
                            DebugReporter.appendWebError(AgcDreamService.this,
                                    message.sourceId() + ":" + message.lineNumber()
                                            + "\n" + String.valueOf(text));
                        }
                    }
                    return super.onConsoleMessage(message);
                }
            });
            setContentView(webView);
            webView.loadUrl(NetClient.ASSET_ORIGIN + NetClient.ASSET_PREFIX
                    + "index.html?dream=1&clock=1&display=1");
        } catch (Throwable error) {
            DebugReporter.appendWebError(this,
                    "DreamService startup failure\n" + error.toString());
            destroyWebView();
            finish();
        }
    }

    private void hideSystemBars() {
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            hideModernSystemBars(window);
        } else {
            hideLegacySystemBars(window.getDecorView());
        }
    }

    @SuppressWarnings("deprecation")
    private static void hideModernSystemBars(Window window) {
        window.setDecorFitsSystemWindows(false);
        WindowInsetsController controller = window.getInsetsController();
        if (controller != null) {
            controller.hide(WindowInsets.Type.systemBars());
            controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }

    @SuppressWarnings("deprecation")
    private static void hideLegacySystemBars(View decor) {
        decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    private void setWindowBrightness(float value) {
        float clamped = Math.max(0.01f, Math.min(1.0f, value));
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.screenBrightness = clamped;
        getWindow().setAttributes(lp);
    }

    private final class DreamBridge {
        @JavascriptInterface
        public void setBrightness(final double value) {
            // JavascriptInterface calls are not guaranteed to run on the UI
            // thread. Post through the WebView before touching Window state.
            if (webView != null) {
                webView.post(() -> setWindowBrightness((float) value));
            }
        }

        @JavascriptInterface
        public void finishDream() {
            if (webView != null) {
                webView.post(AgcDreamService.this::finish);
            } else {
                finish();
            }
        }
    }

    private void destroyWebView() {
        WebView doomed = webView;
        webView = null;
        WebViewTeardown.destroy(doomed, "DreamBridge", "DebugBridge");
    }

    @Override
    public void onDetachedFromWindow() {
        destroyWebView();
        super.onDetachedFromWindow();
    }
}
