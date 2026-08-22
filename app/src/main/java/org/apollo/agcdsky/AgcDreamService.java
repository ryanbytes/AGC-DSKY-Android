package org.apollo.agcdsky;

import android.service.dreams.DreamService;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

/** Charging/idle Android screen saver that starts directly in display-only clock + dim mode. */
public final class AgcDreamService extends DreamService {
    private WebView webView;

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(false);
        setFullscreen(true);
        setScreenBright(true);

        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.screenBrightness = 0.06f;
        getWindow().setAttributes(lp);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new NetClient(this));
        setContentView(webView);
        webView.loadUrl(NetClient.ASSET_ORIGIN + NetClient.ASSET_PREFIX
                + "index.html?dream=1&clock=1&dim=1&display=1");
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
