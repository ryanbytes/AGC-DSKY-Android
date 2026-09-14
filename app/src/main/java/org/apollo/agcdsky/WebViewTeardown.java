package org.apollo.agcdsky;

import android.view.ViewGroup;
import android.view.ViewParent;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Best-effort WebView teardown that severs owner references before Chromium destruction. */
final class WebViewTeardown {
    private WebViewTeardown() {}

    static void destroy(WebView view, String... javascriptInterfaces) {
        if (view == null) return;

        try {
            view.stopLoading();
        } catch (RuntimeException ignored) {
        }

        if (javascriptInterfaces != null) {
            for (String name : javascriptInterfaces) {
                if (name == null || name.isEmpty()) continue;
                try {
                    view.removeJavascriptInterface(name);
                } catch (RuntimeException ignored) {
                }
            }
        }

        // The anonymous WebChromeClients capture their Activity/DreamService owner.
        // Drop them before destroy so Chromium cannot retain those owners while it
        // drains callbacks from the old page.
        try {
            view.setWebChromeClient(null);
        } catch (RuntimeException ignored) {
        }
        try {
            view.setWebViewClient(new WebViewClient());
        } catch (RuntimeException ignored) {
        }

        try {
            ViewParent parent = view.getParent();
            if (parent instanceof ViewGroup) {
                ((ViewGroup) parent).removeView(view);
            }
        } catch (RuntimeException ignored) {
        }

        try {
            view.clearHistory();
        } catch (RuntimeException ignored) {
        }
        try {
            view.removeAllViews();
        } catch (RuntimeException ignored) {
        }
        try {
            view.destroy();
        } catch (RuntimeException ignored) {
        }
    }
}
