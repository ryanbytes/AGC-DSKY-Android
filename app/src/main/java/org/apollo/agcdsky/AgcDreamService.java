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

/** Charging/idle Android screen saver with the borderless DSKY wall-clock display. */
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
            // The Android DreamService is intentionally the DSKY wall clock.
            // AGC mode remains available only in the interactive app.
            webView.loadUrl(NetClient.ASSET_ORIGIN + NetClient.ASSET_PREFIX + "index.html?dream=1&clock=1&display=1");
        } catch (Throwable error) {
            DebugReporter.appendWebError(this, "DreamService startup failure\n" + error.toString());
            destroyWebView();
            finish();
        }
    }

    /**
     * DreamService can receive configuration callbacks before its dream window is
     * attached. getWindow() is therefore legitimately null during early startup.
     * Once attached, FULL_SENSOR lets the dream follow the physical device in all
     * four rotations, including reverse landscape/portrait, without rotating the
     * WebView content separately in CSS.
     */
    private void applyDreamOrientation() {
        Window window = getWindow();
        if (window == null) return;
        WindowManager.LayoutParams lp = window.getAttributes();
        if (lp == null) return;
        if (lp.screenOrientation == ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
                && lp.rotationAnimation == WindowManager.LayoutParams.ROTATION_ANIMATION_SEAMLESS) {
            return;
        }
        lp.screenOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR;
        lp.rotationAnimation = WindowManager.LayoutParams.ROTATION_ANIMATION_SEAMLESS;
        window.setAttributes(lp);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Android 17 can deliver this callback while DreamService is still being
        // launched, before getWindow() exists. All helpers below are intentionally
        // safe no-ops until onAttachedToWindow supplies the real dream window.
        applyDreamOrientation();
        hideSystemBars();
        WebView current = webView;
        if (current != null) {
            current.requestLayout();
            current.invalidate();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        Window window = getWindow();
        if (window == null) return;
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
        if (decor == null) return;
        decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    private void setWindowBrightness(float value) {
        Window window = getWindow();
        if (window == null) return;
        WindowManager.LayoutParams lp = window.getAttributes();
        if (lp == null) return;
        float clamped = Math.max(0.01f, Math.min(1.0f, value));
        lp.screenBrightness = clamped;
        window.setAttributes(lp);
    }

    private final class DreamBridge {
        @JavascriptInterface public void setBrightness(final double value) {
            if (webView != null) webViewHandler.post(() -> {
                if (webView != null) setWindowBrightness((float) value);
            });
        }
        @JavascriptInterface public void finishDream() {
            if (webView != null) webViewHandler.post(() -> {
                if (webView != null) AgcDreamService.this.finish();
            }); else finish();
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
