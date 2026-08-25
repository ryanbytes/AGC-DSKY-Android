package org.apollo.agcdsky;

import android.content.pm.ApplicationInfo;
import android.service.dreams.DreamService;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

/** Charging/idle Android screen saver with display-only DSKY clock modes. */
public final class AgcDreamService extends DreamService {
    private WebView webView;

    @Override
    public void onAttachedToWindow() {
        DebugReporter.install(this);
        super.onAttachedToWindow();
        setInteractive(false);
        setFullscreen(true);
        setScreenBright(true);

        setWindowBrightness(0.06f);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        webView = new WebView(this);
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
                    DebugReporter.appendWebError(AgcDreamService.this,
                            message.sourceId() + ":" + message.lineNumber()
                                    + "\n" + message.message());
                }
                return super.onConsoleMessage(message);
            }
        });
        setContentView(webView);
        webView.loadUrl(NetClient.ASSET_ORIGIN + NetClient.ASSET_PREFIX
                + "index.html?dream=1&clock=1&display=1");
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
    }

    @Override
    public void onDetachedFromWindow() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDetachedFromWindow();
    }
}
