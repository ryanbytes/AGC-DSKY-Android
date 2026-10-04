package org.apollo.agcdsky;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.util.concurrent.atomic.AtomicReference;

/** Host-only deterministic protocol tests for the small native SNTP client. */
public final class NtpTimeSmoke {
    private static final long NTP_EPOCH = 2_208_988_800L;

    public static void main(String[] args) throws Exception {
        testSuccess();
        testProtocolVersions();
        testMonotonicReceiveTimestamp();
        testServerProcessingDoesNotBiasOffset();
        testWrongPeerRejected();
        testMalformedResponse();
        testNetworkFailureThenRecovery();
        testEraRollover();
        testPersistedSyncAgeAcrossBoots();
        if (args.length > 0 && "--live".equals(args[0])) testLiveCloudflare();
        System.out.println("ntp time smoke: PASS");
        System.out.println("  four-timestamp offset, reboot-aware freshness, server-processing correction, wrong-peer/malformed rejection, timeout, and recovery verified");
    }

    private static void testSuccess() throws Exception {
        try (DatagramSocket server = new DatagramSocket(0)) {
            AtomicReference<Throwable> failure = new AtomicReference<>();
            Thread responder = responder(server, false, failure); responder.start();
            SntpClient.Sample sample = SntpClient.query("127.0.0.1", server.getLocalPort(), 1_000);
            responder.join(2_000); check(failure.get() == null, "success responder failed");
            check(Math.abs(sample.offsetMs) < 250, "unexpected localhost offset " + sample.offsetMs);
            check(sample.roundTripMs >= 0, "negative round trip");
        }
    }

    private static void testMalformedResponse() throws Exception {
        try (DatagramSocket server = new DatagramSocket(0)) {
            AtomicReference<Throwable> failure = new AtomicReference<>();
            Thread responder = responder(server, true, failure); responder.start();
            boolean rejected = false;
            try { SntpClient.query("127.0.0.1", server.getLocalPort(), 1_000); }
            catch (Exception expected) { rejected = true; }
            responder.join(2_000); check(failure.get() == null, "malformed responder failed");
            check(rejected, "malformed NTP response was accepted");
        }
    }

    private static void testProtocolVersions() throws Exception {
        assertVersionAccepted(3, true);
        assertVersionAccepted(4, true);
        assertVersionAccepted(2, false);
        assertVersionAccepted(5, false);
    }

    private static void assertVersionAccepted(int version, boolean expected) throws Exception {
        try (DatagramSocket server = new DatagramSocket(0)) {
            AtomicReference<Throwable> failure = new AtomicReference<>();
            Thread responder = new Thread(() -> {
                try {
                    byte[] request = new byte[48];
                    DatagramPacket incoming = new DatagramPacket(request, request.length);
                    server.receive(incoming);
                    byte[] response = new byte[48];
                    response[0] = (byte) ((version << 3) | 4);
                    response[1] = 1;
                    System.arraycopy(request, 40, response, 24, 8);
                    writeTimestamp(response, 32, System.currentTimeMillis());
                    writeTimestamp(response, 40, System.currentTimeMillis());
                    server.send(new DatagramPacket(response, response.length,
                            incoming.getAddress(), incoming.getPort()));
                } catch (Throwable error) {
                    failure.set(error);
                }
            });
            responder.start();
            boolean accepted;
            try {
                SntpClient.query("127.0.0.1", server.getLocalPort(), 1_000);
                accepted = true;
            } catch (Exception rejected) {
                accepted = false;
            }
            responder.join(2_000);
            check(!responder.isAlive(), "version " + version + " responder did not finish");
            check(failure.get() == null, "version " + version + " responder failed");
            check(accepted == expected, "unexpected acceptance for NTP version " + version);
        }
    }

    private static void testMonotonicReceiveTimestamp() {
        long requestWallMs = 1_800_000_000_000L;
        long requestElapsedNs = 9_000_000_000_000L;
        long receiveElapsedNs = requestElapsedNs + 375_000_000L;
        check(SntpClient.receiveTimeMs(requestWallMs, requestElapsedNs, receiveElapsedNs)
                        == requestWallMs + 375L,
                "monotonic receive timestamp drifted from T1 after an in-flight wall-clock adjustment");
    }

    private static void testServerProcessingDoesNotBiasOffset() throws Exception {
        final long expectedOffsetMs = 600L;
        try (DatagramSocket server = new DatagramSocket(0)) {
            AtomicReference<Throwable> failure = new AtomicReference<>();
            Thread responder = new Thread(() -> {
                try {
                    byte[] request = new byte[48];
                    DatagramPacket incoming = new DatagramPacket(request, request.length);
                    server.receive(incoming);
                    byte[] response = new byte[48];
                    response[0] = 0x24;
                    response[1] = 1;
                    System.arraycopy(request, 40, response, 24, 8);
                    writeTimestamp(response, 32, System.currentTimeMillis() + expectedOffsetMs);
                    Thread.sleep(120L);
                    writeTimestamp(response, 40, System.currentTimeMillis() + expectedOffsetMs);
                    server.send(new DatagramPacket(response, response.length,
                            incoming.getAddress(), incoming.getPort()));
                } catch (Throwable error) {
                    failure.set(error);
                }
            });
            responder.start();
            SntpClient.Sample sample = SntpClient.query("127.0.0.1", server.getLocalPort(), 1_000);
            responder.join(2_000);
            check(!responder.isAlive(), "server-processing responder did not finish");
            check(failure.get() == null, "server-processing responder failed");
            check(Math.abs(sample.offsetMs - expectedOffsetMs) < 35L,
                    "server processing biased offset: " + sample.offsetMs + "ms");
            check(sample.roundTripMs < 100L,
                    "server processing time was counted as network delay: " + sample.roundTripMs + "ms");
        }
    }

    private static void testWrongPeerRejected() throws Exception {
        try (DatagramSocket server = new DatagramSocket(0);
             DatagramSocket unexpectedPeer = new DatagramSocket(0)) {
            AtomicReference<Throwable> failure = new AtomicReference<>();
            Thread responder = new Thread(() -> {
                try {
                    byte[] request = new byte[48];
                    DatagramPacket incoming = new DatagramPacket(request, request.length);
                    server.receive(incoming);
                    byte[] response = new byte[48];
                    response[0] = 0x24;
                    response[1] = 1;
                    System.arraycopy(request, 40, response, 24, 8);
                    writeTimestamp(response, 40, System.currentTimeMillis() + 60_000L);
                    unexpectedPeer.send(new DatagramPacket(response, response.length,
                            incoming.getAddress(), incoming.getPort()));
                } catch (Throwable error) {
                    failure.set(error);
                }
            });
            responder.start();
            boolean rejected = false;
            try { SntpClient.query("127.0.0.1", server.getLocalPort(), 1_000); }
            catch (Exception expected) {
                rejected = "unexpected NTP response source".equals(expected.getMessage());
            }
            responder.join(2_000);
            check(!responder.isAlive(), "unexpected-peer responder did not finish");
            check(failure.get() == null, "unexpected-peer responder failed");
            check(rejected, "NTP response from an unexpected UDP port was accepted");
        }
    }

    private static void testNetworkFailureThenRecovery() throws Exception {
        try (DatagramSocket unused = new DatagramSocket(0)) {
            boolean timedOut = false;
            try { SntpClient.query("127.0.0.1", unused.getLocalPort(), 80); }
            catch (Exception expected) { timedOut = true; }
            check(timedOut, "unreachable NTP endpoint did not fail");
        }
        testSuccess();
    }

    private static void testEraRollover() throws Exception {
        long rolloverUnixSeconds = (1L << 32) - NTP_EPOCH;
        long expected = (rolloverUnixSeconds + 16L) * 1_000L;
        byte[] timestamp = new byte[8];
        writeUnsignedInt(timestamp, 0, 16L);
        long decoded = SntpClient.readTimestamp(timestamp, 0, expected);
        check(decoded == expected, "NTP era-1 timestamp decoded as " + decoded + " instead of " + expected);
    }

    private static void testPersistedSyncAgeAcrossBoots() {
        long syncUtc = 1_800_000_000_000L;
        check(NtpSyncAge.ageMs(syncUtc, 400L, 20_000L, 80_000L, 12, 12,
                syncUtc - 400L) == 60_000L,
                "same-boot freshness did not use monotonic elapsed time");
        check(NtpSyncAge.ageMs(syncUtc, 400L, 500_000_000L, 520_000_000L, 12, 13,
                syncUtc - 400L + 3_600_000L) == 3_600_000L,
                "post-reboot freshness reused the prior boot's uptime");
        check(NtpSyncAge.ageMs(syncUtc, 400L, 500_000_000L, 520_000_000L, -1, -1,
                syncUtc - 400L + 3_600_000L) == 3_600_000L,
                "legacy sync record did not use corrected wall time");
        check(NtpSyncAge.ageMs(0L, 0L, 0L, 0L, -1, -1, 0L) == -1L,
                "missing sync was not reported as unavailable");
    }

    private static void testLiveCloudflare() throws Exception {
        SntpClient.Sample sample = SntpClient.query("time.cloudflare.com", 3_000);
        check(sample.roundTripMs >= 0, "live Cloudflare response has invalid RTT");
        System.out.println("  live time.cloudflare.com SNTP response: offset=" + sample.offsetMs + "ms rtt=" + sample.roundTripMs + "ms");
    }

    private static Thread responder(DatagramSocket server, boolean malformed, AtomicReference<Throwable> failure) {
        return new Thread(() -> {
            try {
                byte[] request = new byte[48]; DatagramPacket incoming = new DatagramPacket(request, request.length);
                server.receive(incoming); byte[] response = new byte[malformed ? 12 : 48];
                if (!malformed) { response[0] = 0x24; response[1] = 1; System.arraycopy(request, 40, response, 24, 8); writeTimestamp(response, 32, System.currentTimeMillis()); writeTimestamp(response, 40, System.currentTimeMillis()); }
                server.send(new DatagramPacket(response, response.length, incoming.getAddress(), incoming.getPort()));
            } catch (Throwable error) { failure.set(error); }
        });
    }

    private static void writeTimestamp(byte[] buffer, int offset, long timeMs) {
        long seconds = timeMs / 1_000L + NTP_EPOCH, fraction = ((timeMs % 1_000L) << 32) / 1_000L;
        for (int i = 3; i >= 0; i--) { buffer[offset + i] = (byte) seconds; seconds >>>= 8; buffer[offset + 4 + i] = (byte) fraction; fraction >>>= 8; }
    }
    private static void writeUnsignedInt(byte[] buffer, int offset, long value) {
        for (int i = 3; i >= 0; i--) { buffer[offset + i] = (byte) value; value >>>= 8; }
    }
    private static void check(boolean ok, String message) { if (!ok) throw new AssertionError(message); }
}
