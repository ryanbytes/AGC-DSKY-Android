package org.apollo.agcdsky;

import android.Manifest;
import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.Surface;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

import java.util.Locale;

/**
 * Sensor-enabled DSKY activity. The WebView remains network-isolated while
 * native Android sensors/camera/location are exposed only to the packaged app origin.
 */
public final class SensorMainActivity extends Activity implements SensorEventListener {
    private static final int GEO_PERMISSION_REQUEST = 41;
    private static final int CAMERA_PERMISSION_REQUEST = 42;
    private static final int CM_PANEL_COLOR = 0xFF6F7571;
    private static final long SENSOR_PUSH_INTERVAL_NS = 9_000_000L;
    private static final long MAGNETIC_PUSH_INTERVAL_NS = 18_000_000L;
    private static final String JS_APP_HIDDEN =
            "if(window.AGCDSKY&&AGCDSKY.setAppVisible){AGCDSKY.setAppVisible(false)}";
    private static final String JS_APP_VISIBLE =
            "if(window.AGCDSKY&&AGCDSKY.setAppVisible){"
                    + "AGCDSKY.setAppVisible(false);AGCDSKY.setAppVisible(true)}";
    private static final Uri LOCAL_ASSET_ORIGIN = Uri.parse(NetClient.ASSET_ORIGIN);

    private WebView webView;
    private Bundle pendingWebViewState;
    private String pendingGeoOrigin;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private PermissionRequest pendingCameraRequest;

    private SensorManager sensorManager;
    private Sensor attitudeSensor;
    private Sensor magneticAttitudeSensor;
    private Sensor linearAccelerationSensor;
    private Sensor accelerometerSensor;
    private Sensor gravitySensor;
    private String sensorName = "none";
    private String magneticSensorName = "none";
    private int magneticAccuracy;
    private String accelerationSensorName = "none";
    private final float[] gravityEstimate = {0f, 0f, 0f};
    private boolean gravityValid;
    private boolean sensorRegistered;
    private long lastSensorPushNs;
    private long lastMagneticPushNs;
    private long lastAccelerationPushNs;

    private volatile float magneticDeclinationDeg;
    private volatile boolean skyLocationKnown;
    private volatile double skyLatitudeDeg = Double.NaN;
    private volatile double skyLongitudeDeg = Double.NaN;
    private volatile double skyAltitudeM;

    private final class SkyBridge {
        @JavascriptInterface
        public void setLocation(double latitudeDeg, double longitudeDeg, double altitudeM) {
            if (!Double.isFinite(latitudeDeg) || !Double.isFinite(longitudeDeg)) return;
            skyLatitudeDeg = latitudeDeg;
            skyLongitudeDeg = longitudeDeg;
            skyAltitudeM = Double.isFinite(altitudeM) ? altitudeM : 0.0;
            try {
                GeomagneticField field = new GeomagneticField(
                        (float) skyLatitudeDeg,
                        (float) skyLongitudeDeg,
                        (float) skyAltitudeM,
                        System.currentTimeMillis());
                magneticDeclinationDeg = field.getDeclination();
                skyLocationKnown = true;
            } catch (RuntimeException ignored) {
                magneticDeclinationDeg = 0f;
                skyLocationKnown = true;
            }
        }
    }

    @Override
    protected void onCreate(Bundle state) {
        DebugReporter.install(this);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        super.onCreate(state);
        pendingWebViewState = state;
        configureWindow();
        configureSensors();
        if (!DebugReporter.showPendingReport(this, this::startDsky)) {
            startDsky();
        }
    }

    private void configureSensors() {
        sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
        if (sensorManager == null) return;

        attitudeSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR);
        if (attitudeSensor != null) {
            sensorName = "game_rotation_vector";
        } else {
            attitudeSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
            if (attitudeSensor != null) sensorName = "rotation_vector";
        }

        magneticAttitudeSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        if (magneticAttitudeSensor != null) {
            magneticSensorName = magneticAttitudeSensor != attitudeSensor
                    ? "rotation_vector_primary" : "rotation_vector_reference";
        }

        linearAccelerationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION);
        if (linearAccelerationSensor != null) {
            accelerationSensorName = "linear_acceleration";
        } else {
            accelerometerSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            gravitySensor = sensorManager.getDefaultSensor(Sensor.TYPE_GRAVITY);
            if (accelerometerSensor != null) {
                accelerationSensorName = gravitySensor != null
                        ? "accelerometer_minus_gravity" : "accelerometer_lowpass";
            }
        }
    }

    private void configureWindow() {
        Window window = getWindow();
        window.addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                        | WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams params = window.getAttributes();
            params.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(params);
        }
        View decor = window.getDecorView();
        decor.setBackgroundColor(CM_PANEL_COLOR);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            configureModernSystemBars(window);
        } else {
            configureLegacySystemBars(window, decor);
        }
    }

    @SuppressWarnings("deprecation")
    private static void configureModernSystemBars(Window window) {
        window.setDecorFitsSystemWindows(false);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            window.setStatusBarColor(CM_PANEL_COLOR);
            window.setNavigationBarColor(CM_PANEL_COLOR);
        }
        WindowInsetsController controller = window.getInsetsController();
        if (controller != null) {
            controller.hide(WindowInsets.Type.systemBars());
            controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }

    @SuppressWarnings("deprecation")
    private static void configureLegacySystemBars(Window window, View decor) {
        window.setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        window.setStatusBarColor(CM_PANEL_COLOR);
        window.setNavigationBarColor(CM_PANEL_COLOR);
        decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    private int displayAngleDegrees() {
        Display display = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? getDisplay() : legacyDefaultDisplay();
        if (display == null) return 0;
        switch (display.getRotation()) {
            case Surface.ROTATION_90: return 90;
            case Surface.ROTATION_180: return 180;
            case Surface.ROTATION_270: return 270;
            default: return 0;
        }
    }

    @SuppressWarnings("deprecation")
    private Display legacyDefaultDisplay() {
        return getWindowManager().getDefaultDisplay();
    }

    private boolean hasCameraPermission() {
        return checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
                        == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                        == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isLocalAssetOrigin(String origin) {
        if (origin == null) return false;
        try {
            Uri candidate = Uri.parse(origin);
            int port = candidate.getPort();
            return "https".equalsIgnoreCase(candidate.getScheme())
                    && LOCAL_ASSET_ORIGIN.getHost() != null
                    && LOCAL_ASSET_ORIGIN.getHost().equalsIgnoreCase(candidate.getHost())
                    && (port == -1 || port == 443);
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    void startDsky() {
        if (webView != null) return;
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        webView = new WebView(this);
        webView.setBackgroundColor(CM_PANEL_COLOR);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBlockNetworkLoads(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        webView.addJavascriptInterface(new DebugReporter.JsBridge(this), "DebugBridge");
        webView.addJavascriptInterface(new SkyBridge(), "SkyBridge");
        webView.setWebViewClient(new NetClient(this));
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(
                    String origin, GeolocationPermissions.Callback callback) {
                if (!isLocalAssetOrigin(origin)) {
                    callback.invoke(origin, false, false);
                    return;
                }
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false);
                    return;
                }
                pendingGeoOrigin = origin;
                pendingGeoCallback = callback;
                requestPermissions(new String[]{
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                        Manifest.permission.ACCESS_FINE_LOCATION
                }, GEO_PERMISSION_REQUEST);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                if (request == null || request.getOrigin() == null
                        || !isLocalAssetOrigin(request.getOrigin().toString())) {
                    if (request != null) request.deny();
                    return;
                }
                boolean asksForVideo = false;
                for (String resource : request.getResources()) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                        asksForVideo = true;
                        break;
                    }
                }
                if (!asksForVideo) {
                    request.deny();
                    return;
                }
                if (hasCameraPermission()) {
                    request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    return;
                }
                if (pendingCameraRequest != null) pendingCameraRequest.deny();
                pendingCameraRequest = request;
                requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                if (message != null
                        && message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                    String text = message.message();
                    if (text == null || !text.startsWith("[yaAGC]")) {
                        DebugReporter.appendWebError(SensorMainActivity.this,
                                message.sourceId() + ":" + message.lineNumber()
                                        + "\n" + String.valueOf(text));
                    }
                }
                return super.onConsoleMessage(message);
            }
        });
        setContentView(webView);

        boolean restored = false;
        if (pendingWebViewState != null) {
            try {
                restored = webView.restoreState(pendingWebViewState) != null;
            } catch (RuntimeException ignored) {
                // Fall through to the packaged start page.
            }
            pendingWebViewState = null;
        }
        if (!restored) {
            webView.loadUrl(NetClient.ASSET_ORIGIN + NetClient.ASSET_PREFIX + "index.html");
        }
        pushSensorAvailability();
    }

    private void pushSensorAvailability() {
        if (webView == null) return;
        webView.postDelayed(() -> {
            if (webView == null) return;
            String safeAttitude = sensorName.replace("'", "");
            String safeMagnetic = magneticSensorName.replace("'", "");
            String safeAcceleration = accelerationSensorName.replace("'", "");
            String js = String.format(Locale.US,
                    "if(window.AGCDSKY){"
                            + "if(AGCDSKY.nativePhoneSensorStatus){AGCDSKY.nativePhoneSensorStatus('%s',%s)}"
                            + "if(AGCDSKY.nativeMagneticSensorStatus){AGCDSKY.nativeMagneticSensorStatus('%s',%s,%s)}"
                            + "if(AGCDSKY.nativePipaSensorStatus){AGCDSKY.nativePipaSensorStatus('%s',%s)}"
                            + "}",
                    safeAttitude, attitudeSensor != null,
                    safeMagnetic, magneticAttitudeSensor != null,
                    magneticAttitudeSensor != null && magneticAttitudeSensor != attitudeSensor,
                    safeAcceleration, linearAccelerationSensor != null || accelerometerSensor != null);
            webView.evaluateJavascript(js, null);
        }, 350L);
    }

    private void registerSensors() {
        if (sensorManager == null || sensorRegistered) return;
        boolean registered = false;
        if (attitudeSensor != null) {
            registered |= sensorManager.registerListener(
                    this, attitudeSensor, SensorManager.SENSOR_DELAY_GAME);
        }
        if (magneticAttitudeSensor != null && magneticAttitudeSensor != attitudeSensor) {
            registered |= sensorManager.registerListener(
                    this, magneticAttitudeSensor, SensorManager.SENSOR_DELAY_UI);
        }
        if (linearAccelerationSensor != null) {
            registered |= sensorManager.registerListener(
                    this, linearAccelerationSensor, SensorManager.SENSOR_DELAY_GAME);
        } else {
            if (gravitySensor != null) {
                registered |= sensorManager.registerListener(
                        this, gravitySensor, SensorManager.SENSOR_DELAY_GAME);
            }
            if (accelerometerSensor != null) {
                registered |= sensorManager.registerListener(
                        this, accelerometerSensor, SensorManager.SENSOR_DELAY_GAME);
            }
        }
        sensorRegistered = registered;
    }

    private void unregisterSensors() {
        if (sensorManager != null && sensorRegistered) sensorManager.unregisterListener(this);
        sensorRegistered = false;
        gravityValid = false;
        lastSensorPushNs = 0L;
        lastMagneticPushNs = 0L;
        lastAccelerationPushNs = 0L;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event == null || webView == null) return;

        if (event.sensor == attitudeSensor) {
            if (lastSensorPushNs != 0L
                    && event.timestamp - lastSensorPushNs < SENSOR_PUSH_INTERVAL_NS) return;
            lastSensorPushNs = event.timestamp;
            try {
                float[] q = new float[4];
                SensorManager.getQuaternionFromVector(q, event.values);
                int angle = displayAngleDegrees();
                String js = String.format(Locale.US,
                        "if(window.AGCDSKY&&AGCDSKY.nativePhoneQuaternion){"
                                + "AGCDSKY.nativePhoneQuaternion(%.9f,%.9f,%.9f,%.9f,%d)}",
                        q[0], q[1], q[2], q[3], angle);
                webView.post(() -> {
                    if (webView != null) webView.evaluateJavascript(js, null);
                });
                if (event.sensor == magneticAttitudeSensor) {
                    pushMagneticQuaternion(q, angle);
                    pushSkyPointing(event.values);
                }
            } catch (RuntimeException ignored) {
                // Bad/short vendor sensor vectors are dropped rather than crashing the UI.
            }
            return;
        }

        if (event.sensor == magneticAttitudeSensor) {
            if (lastMagneticPushNs != 0L
                    && event.timestamp - lastMagneticPushNs < MAGNETIC_PUSH_INTERVAL_NS) return;
            lastMagneticPushNs = event.timestamp;
            try {
                float[] q = new float[4];
                SensorManager.getQuaternionFromVector(q, event.values);
                int angle = displayAngleDegrees();
                pushMagneticQuaternion(q, angle);
                pushSkyPointing(event.values);
            } catch (RuntimeException ignored) {
                // Drop malformed sensor vectors.
            }
            return;
        }

        if (event.sensor == gravitySensor) {
            gravityEstimate[0] = event.values[0];
            gravityEstimate[1] = event.values[1];
            gravityEstimate[2] = event.values[2];
            gravityValid = true;
            return;
        }

        if (event.sensor != linearAccelerationSensor && event.sensor != accelerometerSensor) return;
        if (lastAccelerationPushNs != 0L
                && event.timestamp - lastAccelerationPushNs < SENSOR_PUSH_INTERVAL_NS) return;
        lastAccelerationPushNs = event.timestamp;

        float x = event.values[0];
        float y = event.values[1];
        float z = event.values[2];
        if (event.sensor == accelerometerSensor) {
            if (gravitySensor == null) {
                if (!gravityValid) {
                    gravityEstimate[0] = x;
                    gravityEstimate[1] = y;
                    gravityEstimate[2] = z;
                    gravityValid = true;
                } else {
                    gravityEstimate[0] = gravityEstimate[0] * 0.92f + x * 0.08f;
                    gravityEstimate[1] = gravityEstimate[1] * 0.92f + y * 0.08f;
                    gravityEstimate[2] = gravityEstimate[2] * 0.92f + z * 0.08f;
                }
            }
            if (gravityValid) {
                x -= gravityEstimate[0];
                y -= gravityEstimate[1];
                z -= gravityEstimate[2];
            }
        }
        pushLinearAcceleration(x, y, z, event.timestamp);
    }

    private void pushLinearAcceleration(float x, float y, float z, long timestampNs) {
        if (webView == null) return;
        double seconds = timestampNs * 1.0e-9;
        int angle = displayAngleDegrees();
        String js = String.format(Locale.US,
                "if(window.AGCDSKY&&AGCDSKY.nativePhoneLinearAcceleration){"
                        + "AGCDSKY.nativePhoneLinearAcceleration(%.8f,%.8f,%.8f,%.8f,%d)}",
                x, y, z, seconds, angle);
        webView.post(() -> {
            if (webView != null) webView.evaluateJavascript(js, null);
        });
    }

    private void pushMagneticQuaternion(float[] q, int displayAngle) {
        if (webView == null || q == null || q.length < 4) return;
        String js = String.format(Locale.US,
                "if(window.AGCDSKY&&AGCDSKY.nativeMagneticQuaternion){"
                        + "AGCDSKY.nativeMagneticQuaternion(%.9f,%.9f,%.9f,%.9f,%d,%d)}",
                q[0], q[1], q[2], q[3], displayAngle, magneticAccuracy);
        webView.post(() -> {
            if (webView != null) webView.evaluateJavascript(js, null);
        });
    }

    private void pushSkyPointing(float[] rotationVector) {
        if (webView == null || rotationVector == null || rotationVector.length < 3) return;
        float[] matrix = new float[9];
        try {
            SensorManager.getRotationMatrixFromVector(matrix, rotationVector);
        } catch (RuntimeException ignored) {
            return;
        }
        double east = -matrix[2];
        double north = -matrix[5];
        double up = -matrix[8];
        double horizontal = Math.hypot(east, north);
        if (horizontal <= 1.0e-6 && Math.abs(up) < 1.0e-6) return;

        double azimuth = Math.toDegrees(Math.atan2(east, north));
        if (azimuth < 0.0) azimuth += 360.0;
        double declination = skyLocationKnown ? magneticDeclinationDeg : 0.0;
        azimuth = (azimuth + declination) % 360.0;
        if (azimuth < 0.0) azimuth += 360.0;
        double altitude = Math.toDegrees(Math.atan2(up, horizontal));
        String js = String.format(Locale.US,
                "if(window.AGCDSKY&&AGCDSKY.nativeSkyPointing){"
                        + "AGCDSKY.nativeSkyPointing(%.5f,%.5f,%d,%.4f)}",
                azimuth, altitude, magneticAccuracy, declination);
        webView.post(() -> {
            if (webView != null) webView.evaluateJavascript(js, null);
        });
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        if (sensor == magneticAttitudeSensor) magneticAccuracy = accuracy;
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == GEO_PERMISSION_REQUEST && pendingGeoCallback != null) {
            boolean grant = isLocalAssetOrigin(pendingGeoOrigin) && hasLocationPermission();
            pendingGeoCallback.invoke(pendingGeoOrigin, grant, false);
            pendingGeoOrigin = null;
            pendingGeoCallback = null;
            return;
        }
        if (requestCode == CAMERA_PERMISSION_REQUEST && pendingCameraRequest != null) {
            PermissionRequest request = pendingCameraRequest;
            pendingCameraRequest = null;
            if (hasCameraPermission() && request.getOrigin() != null
                    && isLocalAssetOrigin(request.getOrigin().toString())) {
                request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else {
                request.deny();
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        configureWindow();
        registerSensors();
        if (webView != null) {
            webView.onResume();
            webView.evaluateJavascript(JS_APP_VISIBLE, null);
            pushSensorAvailability();
        }
    }

    @Override
    protected void onPause() {
        unregisterSensors();
        if (webView != null) {
            webView.evaluateJavascript(JS_APP_HIDDEN, null);
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        unregisterSensors();
        pendingGeoOrigin = null;
        pendingGeoCallback = null;
        if (pendingCameraRequest != null) {
            pendingCameraRequest.deny();
            pendingCameraRequest = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
