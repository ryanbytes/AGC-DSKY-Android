package org.apollo.agcdsky;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.widget.Toast;

/** Tiny launcher entry that toggles the Amazon Fire boot receiver without touching AGC runtime state. */
public final class FireModeActivity extends Activity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (!FireBootReceiver.isAmazonDevice()) {
            Toast.makeText(this, "Fire Mode is only available on Amazon Fire devices.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        PackageManager pm = getPackageManager();
        ComponentName receiver = new ComponentName(this, FireBootReceiver.class);
        int current = pm.getComponentEnabledSetting(receiver);
        boolean enabled = current == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
        int next = enabled ? PackageManager.COMPONENT_ENABLED_STATE_DISABLED : PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
        pm.setComponentEnabledSetting(receiver, next, PackageManager.DONT_KILL_APP);
        Toast.makeText(this, enabled ? "AGC DSKY Fire Mode OFF" : "AGC DSKY Fire Mode ON — starts after Fire OS boot", Toast.LENGTH_LONG).show();
        if (!enabled) {
            try {
                startActivity(new Intent(this, SensorMainActivity.class)
                        .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP));
            } catch (RuntimeException ignored) { }
        }
        finish();
    }
}
