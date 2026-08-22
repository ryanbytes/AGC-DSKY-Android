package org.apollo.agcdsky;

import android.net.TrafficStats;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Bridge used by the local HTML face to sample aggregate device network bytes.
 * It exposes only RX+TX byte totals. No packet, host, UID, or application data
 * is inspected.
 */
public final class NetClient extends WebViewClient {
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        if (url != null && url.startsWith("agcnet://poll")) {
            long rx = TrafficStats.getTotalRxBytes();
            long tx = TrafficStats.getTotalTxBytes();
            if (rx != TrafficStats.UNSUPPORTED && tx != TrafficStats.UNSUPPORTED) {
                long total = rx + tx;
                view.loadUrl("javascript:window.AGCDSKY&&window.AGCDSKY.phoneTraffic(" + total + ")");
            }
            return true;
        }
        return false;
    }
}
