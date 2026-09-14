package org.apollo.agcdsky;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Toast;

/** Toggle for the sideload-only Amazon Fire launcher redirect. */
public final class FireModeActivity extends Activity {
    public static final String ACTION_ENABLE = "org.apollo.agcdsky.FIRE_ENABLE";
    public static final String ACTION_DISABLE = "org.apollo.agcdsky.FIRE_DISABLE";

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (!FireBootReceiver.isAmazonDevice()) {
            Toast.makeText(this, "Fire Mode is only available on Amazon Fire devices.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        boolean enabled = FireBootReceiver.isEnabled(this);
        String action = getIntent() == null ? null : getIntent().getAction();
        boolean next;
        if (ACTION_ENABLE.equals(action)) next = true;
        else if (ACTION_DISABLE.equals(action)) next = false;
        else next = !enabled;

        getSharedPreferences(FireBootReceiver.PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean(FireBootReceiver.KEY_ENABLED, next).apply();

        PackageManager pm = getPackageManager();
        ComponentName receiver = new ComponentName(this, FireBootReceiver.class);
        pm.setComponentEnabledSetting(receiver,
                next ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                        : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP);

        if (!next) {
            Toast.makeText(this,
                    "AGC DSKY Fire Mode OFF. The accessibility service is idle until Fire Mode is enabled again.",
                    Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        if (isRedirectServiceEnabled()) {
            Toast.makeText(this, "AGC DSKY Fire Mode ON", Toast.LENGTH_LONG).show();
            try { startActivity(FireBootReceiver.dskyIntent(this)); } catch (RuntimeException ignored) { }
            finish();
            return;
        }

        Toast.makeText(this,
                "Fire Mode ON. In Accessibility, enable AGC DSKY Fire Redirect, then reboot.",
                Toast.LENGTH_LONG).show();
        try { startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)); }
        catch (RuntimeException ignored) { }
        finish();
    }

    private boolean isRedirectServiceEnabled() {
        String enabled = Settings.Secure.getString(getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (enabled == null || enabled.isEmpty()) return false;
        String full = getPackageName() + "/" + FireRedirectAccessibilityService.class.getName();
        String shortName = getPackageName() + "/.FireRedirectAccessibilityService";
        for (String item : enabled.split(":")) {
            if (full.equalsIgnoreCase(item) || shortName.equalsIgnoreCase(item)) return true;
        }
        return false;
    }
}
