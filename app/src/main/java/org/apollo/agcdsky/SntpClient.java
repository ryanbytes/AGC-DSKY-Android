package org.apollo.agcdsky;

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;

/** Small RFC 5905 SNTP client. It reports time; it never changes the device clock. */
final class SntpClient {
    private static final int NTP_PORT = 123;
    private static final int PACKET_SIZE = 48;
    private static final long OFFSET_1900_TO_1970 = 2_208_988_800L;
    private static final long ERA_SECONDS = 1L << 32;

    static final class Sample {
        final long offsetMs;
        final long roundTripMs;
        final long serverTimeMs;
        Sample(long offsetMs, long roundTripMs, long serverTimeMs) {
            this.offsetMs = offsetMs;
            this.roundTripMs = roundTripMs;
            this.serverTimeMs = serverTimeMs;
        }
    }

    private SntpClient() {}

    static Sample query(String host, int timeoutMs) throws IOException {
        return query(host, NTP_PORT, timeoutMs);
    }

    static Sample query(String host, int port, int timeoutMs) throws IOException {
        InetAddress address = InetAddress.getByName(host);
        byte[] request = new byte[PACKET_SIZE];
        request[0] = 0x23; // LI=0, VN=4, client mode=3.
        try (DatagramSocket socket = new DatagramSocket()) {
            socket.setSoTimeout(timeoutMs);
            long requestWallMs = System.currentTimeMillis();
            long requestElapsedNs = System.nanoTime();
            writeTimestamp(request, 40, requestWallMs);
            socket.send(new DatagramPacket(request, request.length, address, port));
            byte[] response = new byte[PACKET_SIZE];
            DatagramPacket packet = new DatagramPacket(response, response.length);
            socket.receive(packet);
            long receiveElapsedNs = System.nanoTime();
            long rttMs = Math.max(0L, (receiveElapsedNs - requestElapsedNs) / 1_000_000L);
            if (!address.equals(packet.getAddress()) || packet.getPort() != port) {
                throw new IOException("unexpected NTP response source");
            }
            if (packet.getLength() < PACKET_SIZE) throw new IOException("short NTP response");
            for (int i = 0; i < 8; i++) if (response[24 + i] != request[40 + i]) {
                throw new IOException("NTP originate timestamp mismatch");
            }
            int leap = (response[0] >> 6) & 0x3;
            int version = (response[0] >> 3) & 0x7;
            int mode = response[0] & 0x7;
            int stratum = response[1] & 0xff;
            if (leap == 3 || version < 3 || version > 4
                    || (mode != 4 && mode != 5) || stratum == 0 || stratum > 15) {
                throw new IOException("invalid NTP response");
            }
            // Use monotonic elapsed time for T4 so a wall-clock adjustment while
            // the request is in flight cannot corrupt the four-timestamp offset.
            long receiveWallMs = receiveTimeMs(requestWallMs, requestElapsedNs, receiveElapsedNs);
            long serverReceiveMs = readTimestamp(response, 32, receiveWallMs);
            long serverTransmitMs = readTimestamp(response, 40, receiveWallMs);
            if (serverReceiveMs <= 0L || serverTransmitMs <= 0L) {
                throw new IOException("missing NTP server timestamp");
            }
            long serverProcessingMs = serverTransmitMs - serverReceiveMs;
            if (serverProcessingMs < 0L) throw new IOException("invalid NTP server timestamp order");
            long networkDelayMs = Math.max(0L, rttMs - serverProcessingMs);
            // RFC 5905 section 8: theta = ((T2 - T1) + (T3 - T4)) / 2.
            long offsetMs = ((serverReceiveMs - requestWallMs)
                    + (serverTransmitMs - receiveWallMs)) / 2L;
            return new Sample(offsetMs, networkDelayMs, serverTransmitMs);
        }
    }

    static long readTimestamp(byte[] buffer, int offset) throws IOException {
        return readTimestamp(buffer, offset, System.currentTimeMillis());
    }

    static long receiveTimeMs(long requestWallMs, long requestElapsedNs, long receiveElapsedNs) {
        return requestWallMs + (receiveElapsedNs - requestElapsedNs) / 1_000_000L;
    }

    static long readTimestamp(byte[] buffer, int offset, long referenceTimeMs) throws IOException {
        if (buffer == null || offset < 0 || buffer.length - offset < 8) throw new IOException("malformed NTP timestamp");
        long seconds = readUnsignedInt(buffer, offset);
        long fraction = readUnsignedInt(buffer, offset + 4);
        if (seconds == 0L && fraction == 0L) return 0L;
        long unixSeconds = seconds - OFFSET_1900_TO_1970;
        long referenceSeconds = Math.floorDiv(referenceTimeMs, 1000L);
        long era = Math.floorDiv(referenceSeconds - unixSeconds + ERA_SECONDS / 2L, ERA_SECONDS);
        unixSeconds += era * ERA_SECONDS;
        return unixSeconds * 1000L + ((fraction * 1000L) >>> 32);
    }

    private static void writeTimestamp(byte[] buffer, int offset, long timeMs) {
        long seconds = timeMs / 1000L + OFFSET_1900_TO_1970;
        long fraction = ((timeMs % 1000L) << 32) / 1000L;
        writeUnsignedInt(buffer, offset, seconds);
        writeUnsignedInt(buffer, offset + 4, fraction);
    }

    private static long readUnsignedInt(byte[] buffer, int offset) {
        return ((long) (buffer[offset] & 0xff) << 24)
                | ((long) (buffer[offset + 1] & 0xff) << 16)
                | ((long) (buffer[offset + 2] & 0xff) << 8)
                | (long) (buffer[offset + 3] & 0xff);
    }

    private static void writeUnsignedInt(byte[] buffer, int offset, long value) {
        buffer[offset] = (byte) (value >>> 24);
        buffer[offset + 1] = (byte) (value >>> 16);
        buffer[offset + 2] = (byte) (value >>> 8);
        buffer[offset + 3] = (byte) value;
    }
}
