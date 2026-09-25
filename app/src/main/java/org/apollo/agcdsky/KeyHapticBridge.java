package org.apollo.agcdsky;

import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.HapticFeedbackConstants;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

/**
 * Native haptic endpoint for the DSKY key mechanism.
 *
 * K-03 uses Android's device-tuned predefined VibrationEffect primitives:
 * EFFECT_CLICK at contact/make and the lighter EFFECT_TICK at release.
 * No Apollo force value is converted to a vibration amplitude.
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

    @JavascriptInterface public String backend() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) return "VibrationEffect.createPredefined";
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

    private boolean perform(int predefinedEffect, int legacyViewEffect) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                && vibrator != null
                && vibrator.hasVibrator()) {
            try {
                VibrationEffect effect = VibrationEffect.createPredefined(predefinedEffect);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    vibrator.vibrate(effect,
                            VibrationAttributes.createForUsage(VibrationAttributes.USAGE_TOUCH));
                } else {
                    vibrator.vibrate(effect);
                }
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
