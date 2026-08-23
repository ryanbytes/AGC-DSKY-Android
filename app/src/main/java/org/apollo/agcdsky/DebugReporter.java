package org.apollo.agcdsky;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.webkit.JavascriptInterface;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Local crash recorder for prototype builds.
 *
 * No GitHub credential is embedded in the APK. Reports are stored in the app's
 * private files directory and, on the next launch, can be opened as a prefilled
 * issue in the private repository using the user's normal GitHub session.
 */
public final class DebugReporter {
    private static final String REPORT_FILE = "debug-last.txt";
    private static final String ISSUE_URL =
            "https://github.com/ryanbytes/AGC-DSKY-Android/issues/new";
    private static final int MAX_REPORT_CHARS = 12000;

    private static boolean installed;

    private DebugReporter() {}

    public static synchronized void install(Context context) {
        if (installed) return;
        installed = true;

        final Context app = context.getApplicationContext();
        final Thread.UncaughtExceptionHandler previous =
                Thread.getDefaultUncaughtExceptionHandler();

        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                writeReport(app, "NATIVE CRASH on " + thread.getName(), stackTrace(error));
            } catch (Throwable ignored) {
                // Never replace the real crash with a reporting failure.
            }
            if (previous != null) {
                previous.uncaughtException(thread, error);
            }
        });
    }

    public static boolean hasReport(Context context) {
        File file = reportFile(context);
        return file.isFile() && file.length() > 0;
    }

    /**
     * If a previous crash exists, do not start the WebView yet. This native
     * dialog remains usable even when WebView creation is the crash source.
     */
    public static boolean showPendingReport(Activity activity, Runnable continueStartup) {
        if (!hasReport(activity)) return false;

        new AlertDialog.Builder(activity)
                .setTitle("AGC DSKY DEBUG REPORT")
                .setMessage("The previous run produced a crash/error report. Report it before starting the DSKY again?")
                .setCancelable(false)
                .setPositiveButton("REPORT TO GITHUB", (dialog, which) -> openGitHubIssue(activity))
                .setNegativeButton("CONTINUE", (dialog, which) -> continueStartup.run())
                .setNeutralButton("CLEAR", (dialog, which) -> {
                    clear(activity);
                    continueStartup.run();
                })
                .show();
        return true;
    }

    public static void appendWebError(Context context, String detail) {
        if (detail == null || detail.trim().isEmpty()) return;
        writeReport(context.getApplicationContext(), "WEBVIEW/JAVASCRIPT ERROR", detail);
    }

    public static final class JsBridge {
        private final Context app;

        public JsBridge(Context context) {
            app = context.getApplicationContext();
        }

        @JavascriptInterface
        public void report(String detail) {
            appendWebError(app, detail);
        }
    }

    private static void openGitHubIssue(Activity activity) {
        String report = readReport(activity);
        if (report.length() > MAX_REPORT_CHARS) {
            report = report.substring(report.length() - MAX_REPORT_CHARS);
        }

        String title = "Android debug report - " + Build.MANUFACTURER + " " + Build.MODEL;
        String body = "Crash report from AGC DSKY prototype.\n\n```text\n"
                + report + "\n```\n";
        Uri uri = Uri.parse(ISSUE_URL + "?title=" + Uri.encode(title)
                + "&body=" + Uri.encode(body));
        activity.startActivity(new Intent(Intent.ACTION_VIEW, uri));
    }

    private static synchronized void writeReport(Context context, String source, String detail) {
        StringBuilder out = new StringBuilder();
        out.append("AGC DSKY prototype debug report\n");
        out.append("Time: ").append(new SimpleDateFormat(
                "yyyy-MM-dd HH:mm:ss Z", Locale.US).format(new Date())).append('\n');
        out.append("Source: ").append(source).append('\n');
        out.append("Android: ").append(Build.VERSION.RELEASE)
                .append(" (SDK ").append(Build.VERSION.SDK_INT).append(")\n");
        out.append("Device: ").append(Build.MANUFACTURER).append(' ')
                .append(Build.MODEL).append('\n');
        out.append("Package: ").append(context.getPackageName()).append('\n');
        out.append("Note: location coordinates are intentionally not included.\n\n");
        out.append(detail == null ? "(no detail)" : detail).append('\n');

        byte[] bytes = out.toString().getBytes(StandardCharsets.UTF_8);
        try (FileOutputStream stream = new FileOutputStream(reportFile(context), false)) {
            stream.write(bytes);
            stream.flush();
        } catch (Exception ignored) {
        }
    }

    private static String readReport(Context context) {
        File file = reportFile(context);
        if (!file.isFile()) return "(report file missing)";
        try (FileInputStream stream = new FileInputStream(file)) {
            byte[] data = new byte[(int) Math.min(file.length(), 256 * 1024)];
            int count = stream.read(data);
            return count <= 0 ? "(empty report)"
                    : new String(data, 0, count, StandardCharsets.UTF_8);
        } catch (Exception error) {
            return "Unable to read report: " + error;
        }
    }

    private static void clear(Context context) {
        File file = reportFile(context);
        if (file.exists()) file.delete();
    }

    private static File reportFile(Context context) {
        return new File(context.getFilesDir(), REPORT_FILE);
    }

    private static String stackTrace(Throwable error) {
        StringWriter buffer = new StringWriter();
        PrintWriter writer = new PrintWriter(buffer);
        error.printStackTrace(writer);
        writer.flush();
        return buffer.toString();
    }
}
