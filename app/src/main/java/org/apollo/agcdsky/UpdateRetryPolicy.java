package org.apollo.agcdsky;

import java.io.IOException;
import java.net.ConnectException;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Locale;
import java.util.Set;

/** Retry classification shared by release discovery, checksum, and APK requests. */
final class UpdateRetryPolicy {
    private static final long MAX_RATE_LIMIT_DELAY_MS = 24L * 60L * 60L * 1000L;

    private UpdateRetryPolicy() {}

    static boolean isRetryable(Throwable error) {
        Set<Throwable> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        return isRetryable(error, visited);
    }

    private static boolean isRetryable(Throwable error, Set<Throwable> visited) {
        if (error == null || !visited.add(error)) return false;
        if (error instanceof HttpStatusException && ((HttpStatusException) error).retryable) return true;
        if (error instanceof UnknownHostException
                || error instanceof ConnectException
                || error instanceof NoRouteToHostException
                || error instanceof SocketTimeoutException) return true;
        if (isRetryable(error.getCause(), visited)) return true;
        for (Throwable suppressed : error.getSuppressed()) {
            if (isRetryable(suppressed, visited)) return true;
        }
        return false;
    }

    static long retryDelayMillis(Throwable error, long minimumDelayMs) {
        Set<Throwable> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        return retryDelayMillis(error, minimumDelayMs, visited);
    }

    private static long retryDelayMillis(Throwable error, long minimumDelayMs,
                                         Set<Throwable> visited) {
        if (error == null || !visited.add(error)) return 0L;
        long delay = 0L;
        if (error instanceof HttpStatusException && ((HttpStatusException) error).retryable) {
            delay = Math.max(minimumDelayMs, ((HttpStatusException) error).retryDelayMs);
        } else if (error instanceof UnknownHostException || error instanceof ConnectException
                || error instanceof NoRouteToHostException || error instanceof SocketTimeoutException) {
            delay = minimumDelayMs;
        }
        delay = Math.max(delay, retryDelayMillis(error.getCause(), minimumDelayMs, visited));
        for (Throwable suppressed : error.getSuppressed()) {
            delay = Math.max(delay, retryDelayMillis(suppressed, minimumDelayMs, visited));
        }
        return delay;
    }

    private static long rateLimitDelayMs(String retryAfter, String remaining, String reset,
                                         String responseBody, long nowEpochMs) {
        long delay = 0L;
        Long retryAfterSeconds = positiveLong(retryAfter);
        if (retryAfterSeconds != null) delay = secondsToDelay(retryAfterSeconds);

        if (remaining != null && "0".equals(remaining.trim())) {
            Long resetEpochSeconds = positiveLong(reset);
            if (resetEpochSeconds != null) {
                long resetEpochMs = secondsToEpochMillis(resetEpochSeconds);
                if (resetEpochMs > nowEpochMs) delay = Math.max(delay, resetEpochMs - nowEpochMs);
            }
        }

        String body = responseBody == null ? "" : responseBody.toLowerCase(Locale.US);
        boolean rateLimitMessage = body.contains("secondary rate limit")
                || body.contains("api rate limit exceeded")
                || body.contains("rate limit exceeded");
        if (delay == 0L && rateLimitMessage) delay = 60_000L;
        return Math.min(delay, MAX_RATE_LIMIT_DELAY_MS);
    }

    private static Long positiveLong(String value) {
        if (value == null || !value.trim().matches("[0-9]{1,12}")) return null;
        try {
            long parsed = Long.parseLong(value.trim());
            return parsed > 0L ? parsed : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static long secondsToDelay(long seconds) {
        if (seconds >= MAX_RATE_LIMIT_DELAY_MS / 1000L) return MAX_RATE_LIMIT_DELAY_MS;
        return seconds * 1000L;
    }

    private static long secondsToEpochMillis(long seconds) {
        if (seconds > Long.MAX_VALUE / 1000L) return Long.MAX_VALUE;
        return seconds * 1000L;
    }

    static final class HttpStatusException extends IOException {
        private static final long serialVersionUID = 1L;
        final boolean retryable;
        final long retryDelayMs;

        HttpStatusException(String endpoint, int statusCode, String retryAfter,
                            String rateLimitRemaining, String rateLimitReset,
                            String responseBody, long nowEpochMs) {
            super(endpoint + " HTTP " + statusCode);
            long serverDelay = rateLimitDelayMs(retryAfter, rateLimitRemaining,
                    rateLimitReset, responseBody, nowEpochMs);
            String body = responseBody == null ? "" : responseBody.toLowerCase(Locale.US);
            boolean rateLimited403 = statusCode == 403 && (serverDelay > 0L
                    || body.contains("secondary rate limit")
                    || body.contains("api rate limit exceeded")
                    || body.contains("rate limit exceeded"));
            this.retryable = statusCode == 408 || statusCode == 429
                    || (statusCode >= 500 && statusCode <= 599) || rateLimited403;
            this.retryDelayMs = serverDelay;
        }
    }
}
