package org.apollo.agcdsky;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;

import java.io.File;

public final class UpdateInstallReceiver extends BroadcastReceiver {
    static final String ACTION_INSTALL_STATUS = "org.apollo.agcdsky.UPDATE_INSTALL_STATUS";

    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_INSTALL_STATUS.equals(intent.getAction())) return;
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm;
            if (Build.VERSION.SDK_INT >= 33) confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
            else confirm = legacyIntent(intent);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(confirm);
            }
            return;
        }
        if (status == PackageInstaller.STATUS_SUCCESS) {
            AppUpdater.clearPending(context, pendingFile(context));
            return;
        }
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
        DebugReporter.appendNativeError(context, "Updater install failed: status=" + status + " " + String.valueOf(message));
        AppUpdater.clearPending(context, pendingFile(context));
    }

    @SuppressWarnings("deprecation")
    private static Intent legacyIntent(Intent intent) { return intent.getParcelableExtra(Intent.EXTRA_INTENT); }

    private static File pendingFile(Context context) {
        String name = "fire".equals(BuildConfig.FLAVOR) ? "app-fire-release.apk" : "app-regular-release.apk";
        return new File(new File(context.getFilesDir(), "updates"), name);
    }
}
