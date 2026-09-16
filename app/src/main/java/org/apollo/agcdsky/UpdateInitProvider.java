package org.apollo.agcdsky;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.SystemClock;

public final class UpdateInitProvider extends ContentProvider {
    private static final long CHECK_INTERVAL_MS = 12L * 60L * 60L * 1000L;

    @Override public boolean onCreate() {
        Context context = getContext();
        if (context != null) {
            AppUpdater.check(context);
            schedule(context.getApplicationContext());
        }
        return true;
    }

    private static void schedule(Context context) {
        AlarmManager alarm = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarm == null) return;
        Intent intent = new Intent(context, UpdateCheckReceiver.class).setAction(UpdateCheckReceiver.ACTION_CHECK);
        PendingIntent pending = PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        long first = SystemClock.elapsedRealtime() + CHECK_INTERVAL_MS;
        alarm.setInexactRepeating(AlarmManager.ELAPSED_REALTIME, first, CHECK_INTERVAL_MS, pending);
    }

    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) { return null; }
    @Override public String getType(Uri uri) { return null; }
    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String selection, String[] selectionArgs) { return 0; }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) { return 0; }
}
