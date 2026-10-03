package org.apollo.agcdsky;

/**
 * Removes gravity from accelerometer samples when Android's linear sensor is
 * unavailable. Kept independent of Android APIs so the fallback is host-testable.
 */
final class AccelerometerGravityFilter {
    // Preserves the former 0.92 coefficient at an assumed 20 ms interval.
    private static final float TIME_CONSTANT_SECONDS = 0.23f;

    private final float[] gravity = new float[3];
    private final float[] linearAcceleration = new float[3];
    private boolean gravityValid;
    private long lastTimestampNs;

    void reset() {
        gravityValid = false;
        lastTimestampNs = 0L;
    }

    void onGravitySample(float x, float y, float z) {
        gravity[0] = x;
        gravity[1] = y;
        gravity[2] = z;
        gravityValid = true;
    }

    /**
     * Returns corrected acceleration, or null until a registered gravity
     * sensor has supplied its first sample. In low-pass mode, the first
     * accelerometer sample initializes gravity and therefore returns zero.
     */
    float[] removeGravity(float x, float y, float z, long timestampNs,
                          boolean externalGravityRegistered) {
        if (externalGravityRegistered && !gravityValid) return null;

        if (!gravityValid) {
            gravity[0] = x;
            gravity[1] = y;
            gravity[2] = z;
            gravityValid = true;
            lastTimestampNs = timestampNs;
        } else if (!externalGravityRegistered && timestampNs > lastTimestampNs) {
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
}
