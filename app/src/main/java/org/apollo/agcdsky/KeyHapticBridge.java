package org.apollo.agcdsky;

import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.HapticFeedbackConstants;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

/**
 * Native haptic endpoint for the DSKY key mechanism.
 *
 * K-03 uses Android's device-tuned predefined effects. These calls intentionally
 * use Vibrator.vibrate(VibrationEffect) without USAGE_TOUCH classification:
 * the prior Pixel candidate proved that touch-class feedback can be completely
 * suppressed by the system touch-feedback setting. This app-specific DSKY
 * mechanism is enabled explicitly by installing/running the app and requires
 * the normal VIBRATE permission.
 *
 * No Apollo force value is converted to vibration amplitude.
 */
final class KeyHapticBridge {
    private final WebView view;
    private final Vibrator vibrator;

    KeyHapticBridge(WebView view) {
        this.view = view;
        this.view.setHapticFeedbackEnabled(true);
        this.vibrator = view.getContext().getSystemService(Vibrator.class);
    }

    @JavascriptInterface public boolean available() {
        return vibrator != null && vibrator.hasVibrator();
    }

    @JavascriptInterface public boolean amplitudeControl() {
        return vibrator != null && vibrator.hasAmplitudeControl();
    }

    @JavascriptInterface public String backend() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) return "Vibrator.predefined-unclassified";
        return "View.performHapticFeedback fallback";
    }

    @JavascriptInterface public boolean keyMake() {
        return perform(VibrationEffect.EFFECT_CLICK, HapticFeedbackConstants.VIRTUAL_KEY);
    }

    @JavascriptInterface public boolean keyRelease() {
        return perform(VibrationEffect.EFFECT_TICK,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1
                        ? HapticFeedbackConstants.VIRTUAL_KEY_RELEASE
                        : HapticFeedbackConstants.KEYBOARD_TAP);
    }

    /** Diagnostic-only stronger pulse to prove the native bridge/vibrator path. */
    @JavascriptInterface public boolean testPulse() {
        return perform(VibrationEffect.EFFECT_HEAVY_CLICK, HapticFeedbackConstants.LONG_PRESS);
    }

    private boolean perform(int predefinedEffect, int legacyViewEffect) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                && vibrator != null
                && vibrator.hasVibrator()) {
            try {
                vibrator.vibrate(VibrationEffect.createPredefined(predefinedEffect));
                return true;
            } catch (RuntimeException ignored) {
                // Fall through to the View path rather than losing feedback.
            }
        }

        final WebView target = view;
        target.post(() -> {
            if (target.isAttachedToWindow()) target.performHapticFeedback(legacyViewEffect);
        });
        return true;
    }
}
