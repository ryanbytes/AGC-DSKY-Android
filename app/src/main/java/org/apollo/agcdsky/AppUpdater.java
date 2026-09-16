package org.apollo.agcdsky;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

final class AppUpdater {
    private static final String RELEASE_API = "https://api.github.com/repos/ryanbytes/AGC-DSKY-Android/releases/latest";
    private static final long CHECK_INTERVAL_MS = 12L * 60L * 60L * 1000L;
    private static final long RETRY_INTERVAL_MS = 30L * 60L * 1000L;
    private static final String PREFS = "self_update";
    private static final String PREF_LAST_CHECK = "last_check_ms";
    private static final String PREF_LAST_ATTEMPT = "last_attempt_ms";
    private static final String PREF_PENDING = "pending_apk";
    private static final String PREF_PENDING_SHA256 = "pending_sha256";
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean RUNNING = new AtomicBoolean(false);
    private static final AtomicBoolean PERMISSION_POLLING = new AtomicBoolean(false);

    private AppUpdater() {}

    static void check(Context source) {
        Context context = source.getApplicationContext();
        if (BuildConfig.DEBUG || (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) return;
        if (!RUNNING.compareAndSet(false, true)) return;
        EXECUTOR.execute(() -> {
            try {
                if (resumePendingInstall(context)) return;
                SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                long now = System.currentTimeMillis();
                if (now - prefs.getLong(PREF_LAST_CHECK, 0L) < CHECK_INTERVAL_MS) return;
                if (now - prefs.getLong(PREF_LAST_ATTEMPT, 0L) < RETRY_INTERVAL_MS) return;
                prefs.edit().putLong(PREF_LAST_ATTEMPT, now).apply();
                Release release = fetchLatestRelease();
                prefs.edit().putLong(PREF_LAST_CHECK, System.currentTimeMillis()).remove(PREF_LAST_ATTEMPT).apply();
                cancelRetry(context);
                if (release == null || compareVersion(release.version, BuildConfig.VERSION_NAME) <= 0) return;
                String apkName = "fire".equals(BuildConfig.FLAVOR) ? "app-fire-release.apk" : "app-regular-release.apk";
                Asset apk = release.find(apkName);
                if (apk == null) return;
                String expectedSha256 = release.sha256For(apkName, apk.digest);
                if (expectedSha256 == null) return;
                File updateDir = new File(context.getFilesDir(), "updates");
                if (!updateDir.isDirectory() && !updateDir.mkdirs()) return;
                File candidate = new File(updateDir, apkName);
                downloadToFile(apk.url, candidate);
                String actualSha256 = sha256(candidate);
                if (!expectedSha256.equalsIgnoreCase(actualSha256)) {
                    candidate.delete();
                    return;
                }
                if (!verifyApkIdentity(context, candidate)) {
                    candidate.delete();
                    return;
                }
                prefs.edit().putString(PREF_PENDING, candidate.getAbsolutePath()).putString(PREF_PENDING_SHA256, expectedSha256).apply();
                requestInstallPermissionOrInstall(context, candidate);
            } catch (Exception error) {
                if (isTransientNetworkFailure(error)) scheduleRetry(context);
                else DebugReporter.appendNativeError(context, "Updater: " + error);
            } finally {
                RUNNING.set(false);
            }
        });
    }

    private static boolean isTransientNetworkFailure(Throwable error) {
        for (Throwable current = error; current != null; current = current.getCause()) {
            if (current instanceof UnknownHostException
                    || current instanceof ConnectException
                    || current instanceof NoRouteToHostException
                    || current instanceof SocketTimeoutException) return true;
        }
        return false;
    }

    private static PendingIntent retryIntent(Context context) {
        Intent intent = new Intent(context, UpdateCheckReceiver.class).setAction(UpdateCheckReceiver.ACTION_CHECK);
        return PendingIntent.getBroadcast(context, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void scheduleRetry(Context context) {
        AlarmManager alarm = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarm == null) return;
        long when = SystemClock.elapsedRealtime() + RETRY_INTERVAL_MS;
        PendingIntent pending = retryIntent(context);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            alarm.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME, when, pending);
        else alarm.set(AlarmManager.ELAPSED_REALTIME, when, pending);
    }

    private static void cancelRetry(Context context) {
        AlarmManager alarm = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarm != null) alarm.cancel(retryIntent(context));
    }

    static boolean resumePendingInstall(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String path = prefs.getString(PREF_PENDING, null);
        String expected = prefs.getString(PREF_PENDING_SHA256, null);
        if (path == null || expected == null) return false;
        File file = new File(path);
        try {
            if (!file.isFile() || !expected.equalsIgnoreCase(sha256(file)) || !verifyApkIdentity(context, file)) {
                clearPending(context, file);
                return false;
            }
            requestInstallPermissionOrInstall(context, file);
            return true;
        } catch (Exception error) {
            clearPending(context, file);
            return false;
        }
    }

    private static void requestInstallPermissionOrInstall(Context context, File candidate) throws Exception {
        PackageManager pm = context.getPackageManager();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !pm.canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(settings);
            pollInstallPermission(context, candidate);
            return;
        }
        installPackage(context, candidate);
    }

    private static void pollInstallPermission(Context context, File candidate) {
        if (!PERMISSION_POLLING.compareAndSet(false, true)) return;
        Handler handler = new Handler(Looper.getMainLooper());
        final int[] remaining = {120};
        Runnable poll = new Runnable() {
            @Override public void run() {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.getPackageManager().canRequestPackageInstalls()) {
                    PERMISSION_POLLING.set(false);
                    EXECUTOR.execute(() -> {
                        try { if (candidate.isFile() && verifyApkIdentity(context, candidate)) installPackage(context, candidate); }
                        catch (Exception error) { DebugReporter.appendNativeError(context, "Updater install: " + error); }
                    });
                    return;
                }
                if (--remaining[0] <= 0) { PERMISSION_POLLING.set(false); return; }
                handler.postDelayed(this, 1000L);
            }
        };
        handler.postDelayed(poll, 1000L);
    }

    private static void installPackage(Context context, File apk) throws Exception {
        PackageInstaller installer = context.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        int sessionId = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(sessionId);
             FileInputStream input = new FileInputStream(apk);
             java.io.OutputStream output = session.openWrite("base.apk", 0, apk.length())) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            session.fsync(output);
            Intent callback = new Intent(context, UpdateInstallReceiver.class).setAction(UpdateInstallReceiver.ACTION_INSTALL_STATUS);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
            PendingIntent pending = PendingIntent.getBroadcast(context, sessionId, callback, flags);
            session.commit(pending.getIntentSender());
        } catch (Exception error) {
            try { installer.abandonSession(sessionId); } catch (Exception ignored) {}
            throw error;
        }
    }

    static void clearPending(Context context, File file) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(PREF_PENDING).remove(PREF_PENDING_SHA256).apply();
        if (file != null && file.isFile()) file.delete();
    }

    private static Release fetchLatestRelease() throws Exception {
        HttpURLConnection connection = open(RELEASE_API);
        int status = connection.getResponseCode();
        if (status == 404) { connection.disconnect(); return null; }
        if (status != 200) throw new IllegalStateException("release HTTP " + status);
        String json = readAll(connection.getInputStream(), 2_000_000);
        connection.disconnect();
        JSONObject root = new JSONObject(json);
        if (root.optBoolean("draft", false) || root.optBoolean("prerelease", false)) return null;
        String version = normalizeVersion(root.optString("tag_name", ""));
        if (version == null) return null;
        JSONArray assetsJson = root.optJSONArray("assets");
        if (assetsJson == null) return null;
        Asset[] assets = new Asset[assetsJson.length()];
        for (int i = 0; i < assetsJson.length(); i++) {
            JSONObject item = assetsJson.getJSONObject(i);
            assets[i] = new Asset(item.optString("name", ""), item.optString("browser_download_url", ""), item.optString("digest", ""));
        }
        return new Release(version, assets);
    }

    private static HttpURLConnection open(String url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(30_000);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        connection.setRequestProperty("User-Agent", "AGC-DSKY-Android/" + BuildConfig.VERSION_NAME);
        return connection;
    }

    private static void downloadToFile(String url, File destination) throws Exception {
        File temporary = new File(destination.getParentFile(), destination.getName() + ".part");
        HttpURLConnection connection = open(url);
        if (connection.getResponseCode() != 200) throw new IllegalStateException("APK HTTP " + connection.getResponseCode());
        try (InputStream input = new BufferedInputStream(connection.getInputStream()); FileOutputStream output = new FileOutputStream(temporary)) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            output.getFD().sync();
        } finally { connection.disconnect(); }
        if (destination.exists() && !destination.delete()) throw new IllegalStateException("cannot replace updater APK");
        if (!temporary.renameTo(destination)) throw new IllegalStateException("cannot finalize updater APK");
    }

    private static String downloadText(String url) throws Exception {
        HttpURLConnection connection = open(url);
        if (connection.getResponseCode() != 200) throw new IllegalStateException("digest HTTP " + connection.getResponseCode());
        try { return readAll(connection.getInputStream(), 16_384); }
        finally { connection.disconnect(); }
    }

    private static String readAll(InputStream input, int maxBytes) throws Exception {
        StringBuilder out = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            char[] buffer = new char[4096];
            int count, total = 0;
            while ((count = reader.read(buffer)) != -1) {
                total += count;
                if (total > maxBytes) throw new IllegalStateException("response too large");
                out.append(buffer, 0, count);
            }
        }
        return out.toString();
    }

    private static String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new BufferedInputStream(new FileInputStream(file))) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        return hex(digest.digest());
    }

    private static boolean verifyApkIdentity(Context context, File apk) throws Exception {
        PackageManager pm = context.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        PackageInfo current = pm.getPackageInfo(context.getPackageName(), flags);
        if (archive == null || !context.getPackageName().equals(archive.packageName)) return false;
        if (versionCode(archive) <= versionCode(current)) return false;
        return signerDigests(archive).equals(signerDigests(current));
    }

    private static long versionCode(PackageInfo info) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
    }

    private static Set<String> signerDigests(PackageInfo info) throws Exception {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (info.signingInfo == null) return java.util.Collections.emptySet();
            signatures = info.signingInfo.hasMultipleSigners() ? info.signingInfo.getApkContentsSigners() : info.signingInfo.getSigningCertificateHistory();
        } else signatures = info.signatures;
        Set<String> out = new HashSet<>();
        if (signatures != null) for (Signature signature : signatures) out.add(hex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())));
        return out;
    }

    private static String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) out.append(String.format(Locale.US, "%02x", value & 0xff));
        return out.toString();
    }

    private static String normalizeVersion(String raw) {
        if (raw == null) return null;
        String value = raw.trim();
        if (value.startsWith("v") || value.startsWith("V")) value = value.substring(1);
        int suffix = value.indexOf('-');
        if (suffix >= 0) value = value.substring(0, suffix);
        return value.matches("[0-9]+(?:\\.[0-9]+){1,3}") ? value : null;
    }

    private static int compareVersion(String left, String right) {
        String a = normalizeVersion(left), b = normalizeVersion(right);
        if (a == null || b == null) return 0;
        String[] aa = a.split("\\."), bb = b.split("\\.");
        for (int i = 0; i < Math.max(aa.length, bb.length); i++) {
            int av = i < aa.length ? Integer.parseInt(aa[i]) : 0;
            int bv = i < bb.length ? Integer.parseInt(bb[i]) : 0;
            if (av != bv) return Integer.compare(av, bv);
        }
        return 0;
    }

    private static String parseSha256(String text) {
        if (text == null) return null;
        String value = text.trim().toLowerCase(Locale.US);
        if (value.startsWith("sha256:")) value = value.substring(7).trim();
        if (value.length() >= 64) value = value.substring(0, 64);
        return value.matches("[0-9a-f]{64}") ? value : null;
    }

    private static final class Asset {
        final String name;
        final String url;
        final String digest;
        Asset(String name, String url, String digest) { this.name = name; this.url = url; this.digest = digest; }
    }

    private static final class Release {
        final String version;
        final Asset[] assets;
        Release(String version, Asset[] assets) { this.version = version; this.assets = assets; }
        Asset find(String name) { for (Asset asset : assets) if (name.equals(asset.name)) return asset; return null; }
        String sha256For(String apkName, String digest) throws Exception {
            String direct = parseSha256(digest);
            if (direct != null) return direct;
            Asset sidecar = find(apkName + ".sha256");
            return sidecar == null ? null : parseSha256(downloadText(sidecar.url));
        }
    }
}
