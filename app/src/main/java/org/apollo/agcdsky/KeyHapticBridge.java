package org.apollo.agcdsky;

import android.os.Build;
import android.view.HapticFeedbackConstants;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

/**
 * Native haptic endpoint for the DSKY key mechanism.
 *
 * Android's View haptic constants are used instead of raw vibrator amplitudes:
 * VIRTUAL_KEY represents key contact and VIRTUAL_KEY_RELEASE represents release.
 * This keeps the phone's own actuator calibration and the user's system haptic
 * setting authoritative. No VIBRATE permission is required.
 */
final class KeyHapticBridge {
    private final WebView view;

    KeyHapticBridge(WebView view) {
        this.view = view;
        // Enable haptic feedback for this app view while still respecting the
        // platform-wide touch-feedback setting used by performHapticFeedback().
        this.view.setHapticFeedbackEnabled(true);
    }

    @JavascriptInterface public boolean available() {
        return true;
    }

    @JavascriptInterface public void keyMake() {
        perform(HapticFeedbackConstants.VIRTUAL_KEY);
    }

    @JavascriptInterface public void keyRelease() {
        final int effect = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1
                ? HapticFeedbackConstants.VIRTUAL_KEY_RELEASE
                : HapticFeedbackConstants.KEYBOARD_TAP;
        perform(effect);
    }

    private void perform(int effect) {
        final WebView target = view;
        target.post(() -> {
            if (target.isAttachedToWindow()) target.performHapticFeedback(effect);
        });
    }
}
