package org.apollo.agcdsky;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Optional native ambient-light controller for the interactive DSKY Activity.
 * It changes only Android window luminance; it never changes AGC/DSKY state.
 */
final class AmbientBrightnessController implements SensorEventListener {
    private static final String PREFS_NAME = "ambient_brightness";
    private static final String PREF_ENABLED = "enabled";
    private static final boolean DEFAULT_ENABLED = true;
    private static final float MIN_BRIGHTNESS = 0.20f;
    private static final float FACTOR_KEEP = 0.72f;
    private static final float FACTOR_NEW = 0.28f;
    private static final float APPLY_EPSILON = 0.015f;
    private static final long STATUS_PUSH_INTERVAL_MS = 250L;

    private final Activity activity;
    private final SharedPreferences preferences;
    private final SensorManager sensorManager;
    private final Sensor lightSensor;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private volatile boolean enabled;
    private volatile boolean resumed;
    private volatile boolean registered;
    private volatile float ambientLux = Float.NaN;
    private volatile float filteredFactor = Float.NaN;
    private volatile float appliedBrightness = Float.NaN;
    private volatile long lastStatusPushMs;
    private volatile WebView webView;

    AmbientBrightnessController(Activity activity) {
        this.activity = activity;
        preferences = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        enabled = preferences.getBoolean(PREF_ENABLED, DEFAULT_ENABLED);
        sensorManager = (SensorManager) activity.getSystemService(Context.SENSOR_SERVICE);
        lightSensor = sensorManager == null ? null : sensorManager.getDefaultSensor(Sensor.TYPE_LIGHT);
    }

    @JavascriptInterface
    public String getStatus() {
        return statusJson();
    }

    @JavascriptInterface
    public void setEnabled(boolean requested) {
        mainHandler.post(() -> setEnabledOnMain(requested));
    }

    void attach(WebView view) {
        webView = view;
        if (enabled && resumed) registerLightSensor();
    }

    void detach(WebView view) {
        if (webView == view) webView = null;
    }

    void pushStatusDelayed(long delayMs) {
        mainHandler.postDelayed(this::pushStatus, Math.max(0L, delayMs));
    }

    void onResume() {
        resumed = true;
        if (enabled) registerLightSensor();
        else restoreSystemBrightness();
        pushStatus();
    }

    void onPause() {
        resumed = false;
        unregisterLightSensor();
        restoreSystemBrightness();
        pushStatus();
    }

    void destroy() {
        resumed = false;
        unregisterLightSensor();
        restoreSystemBrightness();
        webView = null;
        mainHandler.removeCallbacksAndMessages(null);
    }

    private void setEnabledOnMain(boolean requested) {
        if (enabled == requested) {
            if (requested) registerLightSensor();
            else restoreSystemBrightness();
            pushStatus();
            return;
        }
        enabled = requested;
        preferences.edit().putBoolean(PREF_ENABLED, enabled).apply();
        ambientLux = Float.NaN;
        filteredFactor = Float.NaN;
        appliedBrightness = Float.NaN;
        if (enabled) registerLightSensor();
        else {
            unregisterLightSensor();
            restoreSystemBrightness();
        }
        pushStatus();
    }

    private void registerLightSensor() {
        if (!enabled || !resumed || webView == null || registered || sensorManager == null || lightSensor == null) return;
        registered = sensorManager.registerListener(this, lightSensor, SensorManager.SENSOR_DELAY_NORMAL);
    }

    private void unregisterLightSensor() {
        if (sensorManager != null && registered) sensorManager.unregisterListener(this, lightSensor);
        registered = false;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!enabled || !resumed || event == null || event.sensor != lightSensor || event.values.length == 0) return;
        float lux = event.values[0];
        if (!Float.isFinite(lux) || lux < 0.0f) return;

        ambientLux = lux;
        float nextFactor = luxToFactor(lux);
        filteredFactor = Float.isFinite(filteredFactor)
                ? filteredFactor * FACTOR_KEEP + nextFactor * FACTOR_NEW
                : nextFactor;
        float brightness = MIN_BRIGHTNESS + (1.0f - MIN_BRIGHTNESS) * filteredFactor;

        if (!Float.isFinite(appliedBrightness) || Math.abs(brightness - appliedBrightness) >= APPLY_EPSILON) {
            applyWindowBrightness(brightness);
        }
        pushStatusRateLimited();
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // TYPE_LIGHT accuracy changes do not need separate handling.
    }

    static float luxToBrightness(float lux) {
        float factor = luxToFactor(lux);
        return MIN_BRIGHTNESS + (1.0f - MIN_BRIGHTNESS) * factor;
    }

    private static float luxToFactor(float lux) {
        double clampedLux = Math.max(0.0, lux);
        double factor = Math.log10(clampedLux + 1.0) / Math.log10(1001.0);
        return (float) Math.max(0.0, Math.min(1.0, factor));
    }

    private void applyWindowBrightness(float brightness) {
        float clamped = Math.max(MIN_BRIGHTNESS, Math.min(1.0f, brightness));
        WindowManager.LayoutParams params = activity.getWindow().getAttributes();
        params.screenBrightness = clamped;
        activity.getWindow().setAttributes(params);
        appliedBrightness = clamped;
    }

    private void restoreSystemBrightness() {
        WindowManager.LayoutParams params = activity.getWindow().getAttributes();
        if (params.screenBrightness != -1.0f) {
            params.screenBrightness = -1.0f;
            activity.getWindow().setAttributes(params);
        }
        appliedBrightness = Float.NaN;
        filteredFactor = Float.NaN;
    }

    private void pushStatusRateLimited() {
        long now = SystemClock.uptimeMillis();
        if (now - lastStatusPushMs < STATUS_PUSH_INTERVAL_MS) return;
        lastStatusPushMs = now;
        pushStatus();
    }

    private void pushStatus() {
        WebView target = webView;
        if (target == null) return;
        String json = statusJson();
        target.evaluateJavascript(
                "if(window.AGCDSKY&&AGCDSKY.nativeAmbientBrightnessStatus){AGCDSKY.nativeAmbientBrightnessStatus(" + json + ")}",
                null);
    }

    private String statusJson() {
        JSONObject status = new JSONObject();
        try {
            status.put("supported", lightSensor != null);
            status.put("enabled", enabled);
            status.put("active", enabled && resumed && registered);
            status.put("source", lightSensor != null ? "ambient-light" : "system");
            status.put("lux", Float.isFinite(ambientLux) ? ambientLux : JSONObject.NULL);
            status.put("brightness", Float.isFinite(appliedBrightness) ? appliedBrightness : JSONObject.NULL);
        } catch (JSONException ignored) {
        }
        return status.toString();
    }
}
