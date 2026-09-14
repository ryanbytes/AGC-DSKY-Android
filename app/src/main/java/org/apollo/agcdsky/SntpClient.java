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
        long requestWallMs = System.currentTimeMillis();
        writeTimestamp(request, 40, requestWallMs);
        long startedNs = System.nanoTime();
        try (DatagramSocket socket = new DatagramSocket()) {
            socket.setSoTimeout(timeoutMs);
            socket.send(new DatagramPacket(request, request.length, address, port));
            byte[] response = new byte[PACKET_SIZE];
            DatagramPacket packet = new DatagramPacket(response, response.length);
            socket.receive(packet);
            long receivedWallMs = System.currentTimeMillis();
            long rttMs = Math.max(0L, (System.nanoTime() - startedNs) / 1_000_000L);
            if (packet.getLength() < PACKET_SIZE) throw new IOException("short NTP response");
            for (int i = 0; i < 8; i++) if (response[24 + i] != request[40 + i]) {
                throw new IOException("NTP originate timestamp mismatch");
            }
            int leap = (response[0] >> 6) & 0x3;
            int mode = response[0] & 0x7;
            int stratum = response[1] & 0xff;
            if (leap == 3 || (mode != 4 && mode != 5) || stratum == 0 || stratum > 15) {
                throw new IOException("invalid NTP response");
            }
            long serverMs = readTimestamp(response, 40);
            if (serverMs <= 0) throw new IOException("missing NTP transmit timestamp");
            // SNTP's usual half-round-trip correction avoids treating receive time as server time.
            long offsetMs = serverMs + (rttMs / 2L) - receivedWallMs;
            return new Sample(offsetMs, rttMs, serverMs);
        }
    }

    static long readTimestamp(byte[] buffer, int offset) throws IOException {
        if (buffer == null || offset < 0 || buffer.length - offset < 8) throw new IOException("malformed NTP timestamp");
        long seconds = readUnsignedInt(buffer, offset);
        long fraction = readUnsignedInt(buffer, offset + 4);
        if (seconds == 0L && fraction == 0L) return 0L;
        return (seconds - OFFSET_1900_TO_1970) * 1000L + ((fraction * 1000L) >>> 32);
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
