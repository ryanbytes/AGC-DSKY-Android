package org.apollo.agcdsky;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.util.concurrent.atomic.AtomicReference;

/** Host-only deterministic protocol tests for the small native SNTP client. */
public final class NtpTimeSmoke {
    private static final long NTP_EPOCH = 2_208_988_800L;

    public static void main(String[] args) throws Exception {
        testSuccess();
        testMalformedResponse();
        testNetworkFailureThenRecovery();
        if (args.length > 0 && "--live".equals(args[0])) testLiveCloudflare();
        System.out.println("ntp time smoke: PASS");
        System.out.println("  local SNTP success, malformed packet rejection, timeout, and recovery verified");
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

    private static void testNetworkFailureThenRecovery() throws Exception {
        try (DatagramSocket unused = new DatagramSocket(0)) {
            boolean timedOut = false;
            try { SntpClient.query("127.0.0.1", unused.getLocalPort(), 80); }
            catch (Exception expected) { timedOut = true; }
            check(timedOut, "unreachable NTP endpoint did not fail");
        }
        testSuccess();
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
                if (!malformed) { response[0] = 0x24; response[1] = 1; System.arraycopy(request, 40, response, 24, 8); writeTimestamp(response, 40, System.currentTimeMillis()); }
                server.send(new DatagramPacket(response, response.length, incoming.getAddress(), incoming.getPort()));
            } catch (Throwable error) { failure.set(error); }
        });
    }

    private static void writeTimestamp(byte[] buffer, int offset, long timeMs) {
        long seconds = timeMs / 1_000L + NTP_EPOCH, fraction = ((timeMs % 1_000L) << 32) / 1_000L;
        for (int i = 3; i >= 0; i--) { buffer[offset + i] = (byte) seconds; seconds >>>= 8; buffer[offset + 4 + i] = (byte) fraction; fraction >>>= 8; }
    }
    private static void check(boolean ok, String message) { if (!ok) throw new AssertionError(message); }
}
