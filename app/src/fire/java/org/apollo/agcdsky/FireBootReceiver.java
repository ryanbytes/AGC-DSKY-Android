package org.apollo.agcdsky;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Best-effort boot kick; the accessibility redirect is the reliable Fire OS path. */
public final class FireBootReceiver extends BroadcastReceiver {
    static final String PREFS = "agc_fire_mode";
    static final String KEY_ENABLED = "enabled";

    static boolean isAmazonDevice() {
        String manufacturer = Build.MANUFACTURER;
        return manufacturer != null && "amazon".equalsIgnoreCase(manufacturer.trim());
    }

    static boolean isEnabled(Context context) {
        return context != null && context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getBoolean(KEY_ENABLED, false);
    }

    static Intent dskyIntent(Context context) {
        Intent launch = new Intent(Intent.ACTION_MAIN);
        // The application ID may be suffixed for an install-safe debug build,
        // but the activity's Java class name remains in this namespace.
        launch.setComponent(new ComponentName(context, SensorMainActivity.class));
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        return launch;
    }

    @Override public void onReceive(Context context, Intent intent) {
        if (context == null || !isAmazonDevice() || !isEnabled(context)) return;
        String action = intent == null ? null : intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)) return;
        try { context.startActivity(dskyIntent(context)); } catch (RuntimeException ignored) { }
    }
}
