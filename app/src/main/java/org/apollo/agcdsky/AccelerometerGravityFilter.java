package org.apollo.agcdsky;

import java.util.ArrayList;
import java.util.List;

/**
 * Removes gravity from accelerometer samples when Android's linear sensor is
 * unavailable. Kept independent of Android APIs so the fallback is host-testable.
 */
final class AccelerometerGravityFilter {
    // Preserves the former 0.92 coefficient at an assumed 20 ms interval.
    private static final float TIME_CONSTANT_SECONDS = 0.23f;
    private static final int MAX_GRAVITY_SAMPLES = 64;
    private static final long MAX_GRAVITY_SAMPLE_AGE_NS = 100_000_000L;
    private static final long MAX_GRAVITY_INTERPOLATION_GAP_NS = 200_000_000L;

    private static final class GravitySample {
        final long timestampNs;
        final float x;
        final float y;
        final float z;

        GravitySample(float x, float y, float z, long timestampNs) {
            this.timestampNs = timestampNs;
            this.x = x;
            this.y = y;
            this.z = z;
        }
    }

    private final float[] gravity = new float[3];
    private final float[] linearAcceleration = new float[3];
    private final List<GravitySample> gravityHistory = new ArrayList<>();
    private boolean gravityValid;
    private long lastTimestampNs;

    void reset() {
        gravityValid = false;
        lastTimestampNs = 0L;
        gravityHistory.clear();
    }

    void onGravitySample(float x, float y, float z, long timestampNs) {
        if (timestampNs < 0L) return;
        GravitySample sample = new GravitySample(x, y, z, timestampNs);
        int index = 0;
        while (index < gravityHistory.size()
                && gravityHistory.get(index).timestampNs < timestampNs) index++;
        if (index < gravityHistory.size()
                && gravityHistory.get(index).timestampNs == timestampNs) {
            gravityHistory.set(index, sample);
        } else {
            gravityHistory.add(index, sample);
        }
        while (gravityHistory.size() > MAX_GRAVITY_SAMPLES) gravityHistory.remove(0);
    }

    /**
     * Returns corrected acceleration, or null until a usable gravity estimate
     * is available. External gravity samples are interpolated at the
     * accelerometer event timestamp; low-pass mode initializes gravity from
     * its first accelerometer event and therefore returns zero.
     */
    float[] removeGravity(float x, float y, float z, long timestampNs,
                          boolean externalGravityRegistered) {
        if (externalGravityRegistered) {
            if (!gravityAt(timestampNs)) return null;
        } else if (!gravityValid) {
            gravity[0] = x;
            gravity[1] = y;
            gravity[2] = z;
            gravityValid = true;
            lastTimestampNs = timestampNs;
        } else if (timestampNs > lastTimestampNs) {
            float elapsedSeconds = (timestampNs - lastTimestampNs) * 1.0e-9f;
            float alpha = TIME_CONSTANT_SECONDS / (TIME_CONSTANT_SECONDS + elapsedSeconds);
            gravity[0] = alpha * gravity[0] + (1.0f - alpha) * x;
            gravity[1] = alpha * gravity[1] + (1.0f - alpha) * y;
            gravity[2] = alpha * gravity[2] + (1.0f - alpha) * z;
            lastTimestampNs = timestampNs;
        }

        linearAcceleration[0] = x - gravity[0];
        linearAcceleration[1] = y - gravity[1];
        linearAcceleration[2] = z - gravity[2];
        return linearAcceleration;
    }

    private boolean gravityAt(long timestampNs) {
        if (timestampNs < 0L || gravityHistory.isEmpty()) return false;
        int upper = 0;
        while (upper < gravityHistory.size()
                && gravityHistory.get(upper).timestampNs < timestampNs) upper++;
        if (upper == 0) {
            GravitySample sample = gravityHistory.get(0);
            if (sample.timestampNs - timestampNs > MAX_GRAVITY_SAMPLE_AGE_NS) return false;
            copyGravity(sample);
            return true;
        }
        if (upper == gravityHistory.size()) {
            GravitySample sample = gravityHistory.get(gravityHistory.size() - 1);
            if (timestampNs - sample.timestampNs > MAX_GRAVITY_SAMPLE_AGE_NS) return false;
            copyGravity(sample);
            return true;
        }

        GravitySample before = gravityHistory.get(upper - 1);
        GravitySample after = gravityHistory.get(upper);
        long span = after.timestampNs - before.timestampNs;
        if (span <= 0L || span > MAX_GRAVITY_INTERPOLATION_GAP_NS) {
            GravitySample nearest = timestampNs - before.timestampNs
                    <= after.timestampNs - timestampNs ? before : after;
            if (Math.abs(nearest.timestampNs - timestampNs) > MAX_GRAVITY_SAMPLE_AGE_NS) return false;
            copyGravity(nearest);
            return true;
        }

        float fraction = (float) (timestampNs - before.timestampNs) / (float) span;
        gravity[0] = before.x + fraction * (after.x - before.x);
        gravity[1] = before.y + fraction * (after.y - before.y);
        gravity[2] = before.z + fraction * (after.z - before.z);
        return true;
    }

    private void copyGravity(GravitySample sample) {
        gravity[0] = sample.x;
        gravity[1] = sample.y;
        gravity[2] = sample.z;
    }
}
