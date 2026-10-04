package org.apollo.agcdsky;

/** Computes persisted SNTP freshness without treating a prior boot's uptime as current. */
final class NtpSyncAge {
    private NtpSyncAge() {}

    static long ageMs(long syncUtcMs, long offsetMs, long elapsedAtSyncMs, long elapsedNowMs,
                      int bootCountAtSync, int bootCountNow, long wallNowMs) {
        if (syncUtcMs == 0L) return -1L;
        if (bootCountAtSync >= 0 && bootCountNow == bootCountAtSync
                && elapsedAtSyncMs > 0L && elapsedNowMs >= elapsedAtSyncMs) {
            return elapsedNowMs - elapsedAtSyncMs;
        }
        return Math.max(0L, wallNowMs + offsetMs - syncUtcMs);
    }

    static long networkTimeMs(long syncUtcMs, long ageMs, long wallNowMs) {
        return syncUtcMs != 0L && ageMs >= 0L ? syncUtcMs + ageMs : wallNowMs;
    }
}
