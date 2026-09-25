package org.apollo.agcdsky;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.HapticFeedbackConstants;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

/**
 * Native haptic endpoint for the DSKY key mechanism.
 *
 * K-03 v4 deliberately avoids Android's predefined-effect path because the
 * target Pixel 9a rendered EFFECT_CLICK, EFFECT_TICK, and EFFECT_HEAVY_CLICK
 * as no perceptible vibration despite a live bridge and vibrator capability.
 *
 * API 31+ obtains the hardware through VibratorManager.getDefaultVibrator().
 * Pulses use VibrationEffect.createOneShot(..., DEFAULT_AMPLITUDE), so Android
 * selects the actuator amplitude. Pulse duration is presentation timing only;
 * it is never derived from Apollo spring or switch force.
 */
final class KeyHapticBridge {
    private static final long MAKE_MS = 22L;
    private static final long RELEASE_MS = 10L;
    private static final long DIAGNOSTIC_MS = 120L;

    private final WebView view;
    private final Vibrator vibrator;

    KeyHapticBridge(WebView view) {
        this.view = view;
        this.view.setHapticFeedbackEnabled(true);
        this.vibrator = resolveVibrator(view.getContext());
    }

    private static Vibrator resolveVibrator(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = context.getSystemService(VibratorManager.class);
            if (manager != null) return manager.getDefaultVibrator();
        }
        return context.getSystemService(Vibrator.class);
    }

    @JavascriptInterface public boolean available() {
        return vibrator != null && vibrator.hasVibrator();
    }

    @JavascriptInterface public boolean amplitudeControl() {
        return vibrator != null && vibrator.hasAmplitudeControl();
    }

    @JavascriptInterface public String backend() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return "VibratorManager.default-one-shot";
        }
        return "Vibrator.one-shot";
    }

    @JavascriptInterface public int makeDurationMs() {
        return (int) MAKE_MS;
    }

    @JavascriptInterface public int releaseDurationMs() {
        return (int) RELEASE_MS;
    }

    @JavascriptInterface public boolean keyMake() {
        return performOneShot(MAKE_MS, HapticFeedbackConstants.VIRTUAL_KEY);
    }

    @JavascriptInterface public boolean keyRelease() {
        return performOneShot(RELEASE_MS,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1
                        ? HapticFeedbackConstants.VIRTUAL_KEY_RELEASE
                        : HapticFeedbackConstants.KEYBOARD_TAP);
    }

    /** Diagnostic-only unmistakable pulse to prove the native vibrator path. */
    @JavascriptInterface public boolean testPulse() {
        return performOneShot(DIAGNOSTIC_MS, HapticFeedbackConstants.LONG_PRESS);
    }

    private boolean performOneShot(long durationMs, int legacyViewEffect) {
        if (vibrator != null && vibrator.hasVibrator()) {
            try {
                vibrator.vibrate(VibrationEffect.createOneShot(
                        durationMs, VibrationEffect.DEFAULT_AMPLITUDE));
                return true;
            } catch (RuntimeException ignored) {
                // Fall through to View feedback only if direct vibration fails.
            }
        }

        final WebView target = view;
        target.post(() -> {
            if (target.isAttachedToWindow()) target.performHapticFeedback(legacyViewEffect);
        });
        return true;
    }
}
