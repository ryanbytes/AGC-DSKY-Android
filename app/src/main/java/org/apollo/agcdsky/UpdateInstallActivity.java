package org.apollo.agcdsky;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;
import android.os.Bundle;

import java.io.File;

public final class UpdateInstallActivity extends Activity {
    static final String ACTION_INSTALL_STATUS = "org.apollo.agcdsky.UPDATE_INSTALL_STATUS";

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        handle(getIntent());
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handle(intent);
    }

    private void handle(Intent intent) {
        if (intent == null || !ACTION_INSTALL_STATUS.equals(intent.getAction())) {
            finish();
            return;
        }
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = confirmationIntent(intent);
            if (confirm == null) {
                DebugReporter.appendNativeError(this, "Updater install failed: missing confirmation intent");
                finish();
                return;
            }
            try {
                startActivity(confirm);
            } catch (RuntimeException error) {
                DebugReporter.appendNativeError(this, "Updater confirmation failed: " + error);
            }
            finish();
            return;
        }
        if (status == PackageInstaller.STATUS_SUCCESS) {
            AppUpdater.clearPending(this, pendingFile(this));
            finish();
            return;
        }
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
        DebugReporter.appendNativeError(this, "Updater install failed: status=" + status + " " + String.valueOf(message));
        AppUpdater.clearPending(this, pendingFile(this));
        finish();
    }

    @SuppressWarnings("deprecation")
    private static Intent confirmationIntent(Intent intent) {
        if (Build.VERSION.SDK_INT >= 33) return intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
        return intent.getParcelableExtra(Intent.EXTRA_INTENT);
    }

    private static File pendingFile(Context context) {
        String name = "fire".equals(BuildConfig.FLAVOR) ? "app-fire-release.apk" : "app-regular-release.apk";
        return new File(new File(context.getFilesDir(), "updates"), name);
    }
}
