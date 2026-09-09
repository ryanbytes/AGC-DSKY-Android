package org.apollo.agcdsky;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Optional Fire OS boot relaunch path. Component is disabled until the user enables Fire Mode. */
public final class FireBootReceiver extends BroadcastReceiver {
    static boolean isAmazonDevice() {
        String manufacturer = Build.MANUFACTURER;
        return manufacturer != null && "amazon".equalsIgnoreCase(manufacturer.trim());
    }

    @Override public void onReceive(Context context, Intent intent) {
        if (context == null || !isAmazonDevice()) return;
        String action = intent == null ? null : intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)) return;
        Intent launch = new Intent(context, SensorMainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        try { context.startActivity(launch); } catch (RuntimeException ignored) { }
    }
}
