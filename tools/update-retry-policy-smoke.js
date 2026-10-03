#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'app/src/main/java/org/apollo/agcdsky/UpdateRetryPolicy.java');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agcdsky-update-retry-'));
const testSource = path.join(temp, 'UpdateRetryPolicyTest.java');
const javaTest = `package org.apollo.agcdsky;
import java.io.IOException;
import java.net.ConnectException;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
public final class UpdateRetryPolicyTest {
  private static void check(boolean condition, String message) {
    if (!condition) throw new AssertionError(message);
  }
  public static void main(String[] args) {
    for (int status : new int[]{408, 429, 500, 503, 599})
      check(UpdateRetryPolicy.isRetryable(status("test", status, null, null, null, "", 1_000_000L)),
        "HTTP " + status + " should retry");
    for (int status : new int[]{200, 301, 400, 401, 404, 499, 600})
      check(!UpdateRetryPolicy.isRetryable(status("test", status, null, null, null, "", 1_000_000L)),
        "HTTP " + status + " should not retry");

    check(!UpdateRetryPolicy.isRetryable(status("release", 403, null, null, null,
      "Resource not accessible by integration", 1_000_000L)),
      "ordinary authorization 403 must remain permanent");
    UpdateRetryPolicy.HttpStatusException reset = status("release", 403, null, "0", "1030", "", 1_000_000L);
    check(UpdateRetryPolicy.isRetryable(reset), "primary API rate-limit 403 must retry");
    check(UpdateRetryPolicy.retryDelayMillis(reset, 1_000L) == 30_000L,
      "primary rate-limit retry must wait until X-RateLimit-Reset");
    UpdateRetryPolicy.HttpStatusException secondary = status("release", 403, null, null, null,
      "You have exceeded a secondary rate limit", 1_000_000L);
    check(UpdateRetryPolicy.isRetryable(secondary), "secondary API rate-limit 403 must retry from its body");
    check(UpdateRetryPolicy.retryDelayMillis(secondary, 60_000L) == 60_000L,
      "secondary rate-limit fallback must wait at least one minute");
    UpdateRetryPolicy.HttpStatusException retryAfter = status("release", 429, "120", null, null, "", 1_000_000L);
    check(UpdateRetryPolicy.retryDelayMillis(retryAfter, 60_000L) == 120_000L,
      "Retry-After must be honored for 429");
    UpdateRetryPolicy.HttpStatusException capped = status("release", 429, "999999999999", null, null, "", 1_000_000L);
    check(UpdateRetryPolicy.retryDelayMillis(capped, 60_000L) == 86_400_000L,
      "server-provided retry delay must be capped at 24 hours");

    check(UpdateRetryPolicy.isRetryable(new UnknownHostException()), "unknown host should retry");
    check(UpdateRetryPolicy.isRetryable(new ConnectException()), "connection failure should retry");
    check(UpdateRetryPolicy.isRetryable(new NoRouteToHostException()), "no route should retry");
    check(UpdateRetryPolicy.isRetryable(new SocketTimeoutException()), "socket timeout should retry");
    check(!UpdateRetryPolicy.isRetryable(new IOException("permanent local failure")),
      "unclassified local I/O failure must not be treated as a network retry");

    IOException fallback = new IOException("fallback wrapper");
    fallback.addSuppressed(status("fallback", 503, null, null, null, "", 1_000_000L));
    IOException primary = new IOException("primary request failed");
    primary.addSuppressed(fallback);
    check(UpdateRetryPolicy.isRetryable(primary), "retryable suppressed fallback must be discovered");

    IOException cycleA = new IOException("A");
    IOException cycleB = new IOException("B");
    cycleA.addSuppressed(cycleB);
    cycleB.addSuppressed(cycleA);
    check(!UpdateRetryPolicy.isRetryable(cycleA), "cyclic permanent failures must terminate as non-retryable");
    cycleB.addSuppressed(status("nested", 429, null, null, null, "", 1_000_000L));
    check(UpdateRetryPolicy.isRetryable(cycleA), "retryable node in cyclic failure graph must be discovered");

    System.out.println("Update retry policy smoke: PASS");
    System.out.println("  production Java policy covers HTTP boundaries, GitHub 403/429 rate limits and retry timing, network failures, suppressed fallbacks, and cycles");
  }
  private static UpdateRetryPolicy.HttpStatusException status(String endpoint, int code, String retryAfter,
      String remaining, String reset, String body, long now) {
    return new UpdateRetryPolicy.HttpStatusException(endpoint, code, retryAfter, remaining, reset, body, now);
  }
}`;

try {
  fs.writeFileSync(testSource, javaTest);
  execFileSync('javac', ['-d', temp, source, testSource], {stdio: 'inherit'});
  execFileSync('java', ['-cp', temp, 'org.apollo.agcdsky.UpdateRetryPolicyTest'], {stdio: 'inherit'});
} finally {
  fs.rmSync(temp, {recursive: true, force: true});
}
