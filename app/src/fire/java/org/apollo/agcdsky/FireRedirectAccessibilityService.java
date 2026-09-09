package org.apollo.agcdsky;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;

/**
 * Sideload-only Fire OS launcher redirect. The user must explicitly enable this
 * accessibility service. It observes only foreground-window package changes and
 * redirects Amazon's launcher to AGC DSKY while Fire Mode is enabled.
 */
public final class FireRedirectAccessibilityService extends AccessibilityService {
    private static final long REDIRECT_DEBOUNCE_MS = 900L;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private long lastRedirectMs;

    @Override protected void onServiceConnected() {
        super.onServiceConnected();
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                | AccessibilityEvent.TYPE_WINDOWS_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.notificationTimeout = 60L;
        info.flags = AccessibilityServiceInfo.DEFAULT;
        setServiceInfo(info);

        if (FireBootReceiver.isAmazonDevice() && FireBootReceiver.isEnabled(this)) {
            handler.postDelayed(this::redirectToDsky, 1200L);
        }
    }

    @Override public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || !FireBootReceiver.isAmazonDevice()
                || !FireBootReceiver.isEnabled(this)) return;
        CharSequence packageName = event.getPackageName();
        if (packageName == null || !isAmazonLauncherPackage(packageName.toString())) return;
        redirectToDsky();
    }

    private void redirectToDsky() {
        long now = SystemClock.elapsedRealtime();
        if (now - lastRedirectMs < REDIRECT_DEBOUNCE_MS) return;
        lastRedirectMs = now;
        try { startActivity(FireBootReceiver.dskyIntent(this)); }
        catch (RuntimeException ignored) { }
    }

    private static boolean isAmazonLauncherPackage(String packageName) {
        return "com.amazon.firelauncher".equals(packageName)
                || packageName.startsWith("com.amazon.firelauncher.")
                || "com.amazon.tv.launcher".equals(packageName);
    }

    @Override public void onInterrupt() { }

    @Override public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
