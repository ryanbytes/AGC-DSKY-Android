package org.apollo.agcdsky;

import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
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
    private final Handler webViewHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        DebugReporter.install(this);
        setInteractive(true);
        setFullscreen(true);
        setScreenBright(true);
        applyDreamOrientation();
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
                    if (message != null && message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                        String text = message.message();
                        if (text == null || !text.startsWith("[yaAGC]")) {
                            DebugReporter.appendWebError(AgcDreamService.this,
                                    message.sourceId() + ":" + message.lineNumber() + "\n" + String.valueOf(text));
                        }
                    }
                    return super.onConsoleMessage(message);
                }
            });
            setContentView(webView);
            webView.loadUrl(NetClient.ASSET_ORIGIN + NetClient.ASSET_PREFIX + "index.html?dream=1&clock=1&display=1");
        } catch (Throwable error) {
            DebugReporter.appendWebError(this, "DreamService startup failure\n" + error.toString());
            destroyWebView();
            finish();
        }
    }

    /**
     * Dream windows are not activities, so they do not inherit the activity's
     * screenOrientation manifest attribute. Leaving this unspecified lets some
     * Android/Fire OS builds reuse a stale display rotation when the dream starts.
     * FULL_SENSOR makes the dream track the physical device in all four rotations,
     * including reverse landscape/portrait, without rotating the WebView content
     * separately in CSS.
     */
    private void applyDreamOrientation() {
        Window window = getWindow();
        WindowManager.LayoutParams lp = window.getAttributes();
        lp.screenOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR;
        lp.rotationAnimation = WindowManager.LayoutParams.ROTATION_ANIMATION_SEAMLESS;
        window.setAttributes(lp);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // The DreamService window survives rotation. Re-apply immersive mode and
        // force the WebView to lay out against the new viewport instead of keeping
        // the pre-rotation dimensions.
        applyDreamOrientation();
        hideSystemBars();
        if (webView != null) {
            webView.requestLayout();
            webView.invalidate();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) hideModernSystemBars(window);
        else hideLegacySystemBars(window.getDecorView());
    }

    @SuppressWarnings("deprecation")
    private static void hideModernSystemBars(Window window) {
        window.setDecorFitsSystemWindows(false);
        WindowInsetsController controller = window.getInsetsController();
        if (controller != null) {
            controller.hide(WindowInsets.Type.systemBars());
            controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }

    @SuppressWarnings("deprecation")
    private static void hideLegacySystemBars(View decor) {
        decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    private void setWindowBrightness(float value) {
        float clamped = Math.max(0.01f, Math.min(1.0f, value));
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.screenBrightness = clamped;
        getWindow().setAttributes(lp);
    }

    private final class DreamBridge {
        @JavascriptInterface public void setBrightness(final double value) {
            if (webView != null) webViewHandler.post(() -> { if (webView != null) setWindowBrightness((float) value); });
        }
        @JavascriptInterface public void finishDream() {
            if (webView != null) webViewHandler.post(() -> { if (webView != null) AgcDreamService.this.finish(); }); else finish();
        }
    }

    private void destroyWebView() {
        WebView doomed = webView;
        webView = null;
        WebViewTeardown.destroy(doomed, "DreamBridge", "DebugBridge");
    }

    private void cleanupWebView() {
        webViewHandler.removeCallbacksAndMessages(null);
        destroyWebView();
    }

    @Override public void onDetachedFromWindow() {
        cleanupWebView();
        super.onDetachedFromWindow();
    }

    @Override public void onDestroy() {
        cleanupWebView();
        super.onDestroy();
    }
}
