package org.apollo.agcdsky;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class UpdateCheckReceiver extends BroadcastReceiver {
    static final String ACTION_CHECK = "org.apollo.agcdsky.UPDATE_CHECK";
    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_CHECK.equals(intent.getAction())) return;
        AppUpdater.check(context);
    }
}
