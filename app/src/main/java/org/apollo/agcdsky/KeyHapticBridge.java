package org.apollo.agcdsky;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import android.view.HapticFeedbackConstants;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

/**
 * Native haptic endpoint for the DSKY key mechanism.
 *
 * K-03 diagnostic path now exposes the Android state that can suppress every
 * vibration request. The app does not try to bypass a user-disabled global
 * vibration/haptics setting.
 */
final class KeyHapticBridge {
    private static final long MAKE_MS = 22L;
    private static final long RELEASE_MS = 10L;
    private static final long DIAGNOSTIC_MS = 120L;
    private static final long RELAY_MIN_MS = 2L;
    private static final long RELAY_MAX_MS = 8L;
    private static final int RELAY_MIN_AMPLITUDE = 12;
    private static final int RELAY_MAX_AMPLITUDE = 96;
    private static final int RELAY_MAX_WAVEFORM_SEGMENTS = 192;
    private static final long RELAY_MAX_WAVEFORM_MS = 750L;

    private final WebView view;
    private final Context context;
    private final Vibrator vibrator;

    KeyHapticBridge(WebView view) {
        this.view = view;
        this.context = view.getContext();
        this.view.setHapticFeedbackEnabled(true);
        this.vibrator = resolveVibrator(context);
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

    @JavascriptInterface public boolean vibratePermissionGranted() {
        return context.checkSelfPermission(Manifest.permission.VIBRATE) == PackageManager.PERMISSION_GRANTED;
    }

    @JavascriptInterface public int systemHapticFeedbackEnabled() {
        try {
            return Settings.System.getInt(
                    context.getContentResolver(),
                    Settings.System.HAPTIC_FEEDBACK_ENABLED,
                    -1);
        } catch (RuntimeException ignored) {
            return -1;
        }
    }

    @JavascriptInterface public int systemVibrateOn() {
        try {
            return Settings.System.getInt(
                    context.getContentResolver(),
                    Settings.System.VIBRATE_ON,
                    -1);
        } catch (RuntimeException ignored) {
            return -1;
        }
    }

    @JavascriptInterface public boolean powerSaveMode() {
        PowerManager pm = context.getSystemService(PowerManager.class);
        return pm != null && pm.isPowerSaveMode();
    }

    @JavascriptInterface public String platform() {
        return "android";
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

    /**
     * Relay armature cue. Duration and amplitude are supplied by the shared
     * deterministic per-relay manufacturing profile, not by random input. The
     * native bounds intentionally stay in a micro-switch range: short, low-energy
     * impulses rather than notification-like vibration.
     */
    @JavascriptInterface public boolean relayImpact(int durationMs, int amplitude) {
        long clampedDuration = Math.max(RELAY_MIN_MS, Math.min(RELAY_MAX_MS, durationMs));
        int clampedAmplitude = Math.max(RELAY_MIN_AMPLITUDE, Math.min(RELAY_MAX_AMPLITUDE, amplitude));
        return performVariableOneShot(clampedDuration, clampedAmplitude, HapticFeedbackConstants.CLOCK_TICK);
    }

    /**
     * Hardware-tuned micro-click for an individual visible relay-contact change.
     * Pixels tune PRIMITIVE_TICK to the actuator far better than a 1-4 ms custom
     * waveform can. Scale is supplied as permille so JavaScript does not depend
     * on floating-point bridge conversion. Returns false when primitives are
     * unavailable so the caller can fall back to relayImpact().
     */
    @JavascriptInterface public boolean relayPrimitiveTick(int scalePermille) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R || vibrator == null || !vibrator.hasVibrator()) {
            return false;
        }
        try {
            if (!vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_TICK)) {
                return false;
            }
            float scale = Math.max(0.08f, Math.min(0.50f, scalePermille / 1000f));
            VibrationEffect effect = VibrationEffect.startComposition()
                    .addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, scale)
                    .compose();
            vibrator.vibrate(effect);
            return true;
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    /**
     * Plays one already-composed relay-bank waveform. This avoids the Android
     * behavior where a later vibrate() call replaces an earlier relay pulse.
     * JavaScript composes all relay armature/rebound contributions for the bank
     * from the same deterministic relay profiles that drive sound/contact state.
     */
    @JavascriptInterface public boolean relayWaveform(String timingsCsv, String amplitudesCsv) {
        if (timingsCsv == null || amplitudesCsv == null) return false;
        String[] timingParts = timingsCsv.split(",");
        String[] amplitudeParts = amplitudesCsv.split(",");
        if (timingParts.length == 0 || timingParts.length != amplitudeParts.length
                || timingParts.length > RELAY_MAX_WAVEFORM_SEGMENTS) return false;

        long[] timings = new long[timingParts.length];
        int[] amplitudes = new int[amplitudeParts.length];
        long totalMs = 0L;
        boolean hasActiveSegment = false;
        try {
            for (int i = 0; i < timingParts.length; i++) {
                long duration = Math.max(0L, Math.min(80L, Long.parseLong(timingParts[i])));
                int amplitude = Math.max(0, Math.min(RELAY_MAX_AMPLITUDE, Integer.parseInt(amplitudeParts[i])));
                if (amplitude > 0) {
                    amplitude = Math.max(RELAY_MIN_AMPLITUDE, amplitude);
                    hasActiveSegment = true;
                }
                totalMs += duration;
                if (totalMs > RELAY_MAX_WAVEFORM_MS) return false;
                timings[i] = duration;
                amplitudes[i] = amplitude;
            }
        } catch (NumberFormatException ignored) {
            return false;
        }
        if (!hasActiveSegment) return false;
        return performWaveform(timings, amplitudes, HapticFeedbackConstants.CLOCK_TICK);
    }

    @JavascriptInterface public boolean testPulse() {
        return performOneShot(DIAGNOSTIC_MS, HapticFeedbackConstants.LONG_PRESS);
    }

    @JavascriptInterface public boolean openSoundSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_SOUND_SETTINGS);
            context.startActivity(intent);
            return true;
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private boolean performOneShot(long durationMs, int legacyViewEffect) {
        return performVariableOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE, legacyViewEffect);
    }

    private boolean performVariableOneShot(long durationMs, int amplitude, int legacyViewEffect) {
        if (vibrator != null && vibrator.hasVibrator()) {
            try {
                int effectAmplitude = vibrator.hasAmplitudeControl()
                        ? amplitude
                        : VibrationEffect.DEFAULT_AMPLITUDE;
                vibrator.vibrate(VibrationEffect.createOneShot(durationMs, effectAmplitude));
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

    private boolean performWaveform(long[] timings, int[] amplitudes, int legacyViewEffect) {
        if (vibrator != null && vibrator.hasVibrator()) {
            try {
                int[] effectAmplitudes = amplitudes;
                if (!vibrator.hasAmplitudeControl()) {
                    effectAmplitudes = new int[amplitudes.length];
                    for (int i = 0; i < amplitudes.length; i++) {
                        effectAmplitudes[i] = amplitudes[i] == 0 ? 0 : 255;
                    }
                }
                vibrator.vibrate(VibrationEffect.createWaveform(timings, effectAmplitudes, -1));
                return true;
            } catch (RuntimeException ignored) {
                // Fall through to a single platform haptic if waveform playback fails.
            }
        }

        final WebView target = view;
        target.post(() -> {
            if (target.isAttachedToWindow()) target.performHapticFeedback(legacyViewEffect);
        });
        return true;
    }
}
