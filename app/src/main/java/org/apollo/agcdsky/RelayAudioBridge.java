package org.apollo.agcdsky;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.SoundPool;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Process;
import android.webkit.JavascriptInterface;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

/**
 * Low-latency native relay audio for the Android DSKY.
 *
 * WebView/WebAudio can add a large, device-dependent output buffer after a
 * correctly scheduled relay event. This bridge keeps three very short relay
 * samples resident in SoundPool and lets the JavaScript hardware model schedule
 * them directly on an audio-priority Android thread. The electrical/visual
 * relay model remains in JavaScript; this class only reproduces its sound.
 */
final class RelayAudioBridge implements AutoCloseable {
    private static final int SAMPLE_RATE = 48_000;
    private static final int CHANNELS = 1;
    private static final int BITS_PER_SAMPLE = 16;
    private static final int MAX_STREAMS = 24;
    private static final long MAX_DELAY_MS = 250L;

    private final HandlerThread audioThread;
    private final Handler audioHandler;
    private final SoundPool soundPool;
    private final Set<Integer> loaded = new HashSet<>();
    private volatile boolean closed;
    private int setSample;
    private int resetSample;
    private int bounceSample;

    RelayAudioBridge(Context context) {
        Context app = context.getApplicationContext();
        audioThread = new HandlerThread("dsky-relay-audio", Process.THREAD_PRIORITY_AUDIO);
        audioThread.start();
        audioHandler = new Handler(audioThread.getLooper());

        AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setFlags(AudioAttributes.FLAG_LOW_LATENCY)
                .build();
        soundPool = new SoundPool.Builder()
                .setMaxStreams(MAX_STREAMS)
                .setAudioAttributes(attributes)
                .build();
        soundPool.setOnLoadCompleteListener((pool, sampleId, status) -> {
            if (status == 0) synchronized (loaded) { loaded.add(sampleId); }
        });

        try {
            File dir = new File(app.getCacheDir(), "relay-audio-v1");
            if (!dir.isDirectory() && !dir.mkdirs()) return;
            File set = new File(dir, "relay-set.wav");
            File reset = new File(dir, "relay-reset.wav");
            File bounce = new File(dir, "relay-bounce.wav");
            ensureSample(set, SampleKind.SET);
            ensureSample(reset, SampleKind.RESET);
            ensureSample(bounce, SampleKind.BOUNCE);
            setSample = soundPool.load(set.getAbsolutePath(), 1);
            resetSample = soundPool.load(reset.getAbsolutePath(), 1);
            bounceSample = soundPool.load(bounce.getAbsolutePath(), 1);
        } catch (IOException ignored) {
            // JavaScript automatically falls back to WebAudio until isReady().
        }
    }

    @JavascriptInterface
    public boolean isReady() {
        if (closed || setSample == 0 || resetSample == 0 || bounceSample == 0) return false;
        synchronized (loaded) {
            return loaded.contains(setSample) && loaded.contains(resetSample) && loaded.contains(bounceSample);
        }
    }

    @JavascriptInterface
    public void playRelay(String relayId, int ordinal, boolean engaging,
                          double strength, double delayMs, String bounceCsv) {
        if (!isReady()) return;
        final int impactSample = engaging ? setSample : resetSample;
        final float safeStrength = clamp((float) strength, 0f, 1.4f);
        final int fingerprint = hash32(String.valueOf(relayId) + ":" + ordinal);
        final float rate = relayRate(fingerprint, ordinal, engaging);
        final float pan = (((fingerprint >>> 8) & 0xff) / 255f - 0.5f) * 0.12f;
        final float level = safeStrength * (0.90f + ((fingerprint >>> 20) & 0x0f) / 240f);
        final float left = clamp(level * (pan > 0f ? 1f - pan : 1f), 0f, 1f);
        final float right = clamp(level * (pan < 0f ? 1f + pan : 1f), 0f, 1f);
        final long impactDelay = clampDelay(delayMs);

        audioHandler.postDelayed(() -> {
            if (!closed) soundPool.play(impactSample, left, right, 2, 0, rate);
        }, impactDelay);

        double[] bounces = parseBounceTimes(bounceCsv);
        for (int i = 0; i < bounces.length; i++) {
            final int bounceIndex = i;
            final long at = clampDelay(delayMs + bounces[i]);
            audioHandler.postDelayed(() -> {
                if (closed) return;
                float decay = (float) Math.pow(0.68, bounceIndex);
                float volume = clamp(level * 0.23f * decay, 0f, 0.42f);
                soundPool.play(bounceSample, volume, volume, 1, 0,
                        clamp(rate * 1.05f, 0.86f, 1.16f));
            }, at);
        }
    }

    @JavascriptInterface
    public String backend() {
        return isReady() ? "android-soundpool-low-latency" : "web-audio-fallback";
    }

    @JavascriptInterface
    public void stopAll() {
        if (closed) return;
        audioHandler.removeCallbacksAndMessages(null);
        soundPool.autoPause();
        soundPool.autoResume();
    }

    @Override
    public void close() {
        if (closed) return;
        closed = true;
        audioHandler.removeCallbacksAndMessages(null);
        soundPool.release();
        audioThread.quitSafely();
    }

    private static float relayRate(int fingerprint, int ordinal, boolean engaging) {
        float identity = ((fingerprint & 0xffff) / 65535f - 0.5f) * 0.052f;
        float installedPosition = ((ordinal % 132) - 65.5f) * 0.00034f;
        float setReset = engaging ? 1.006f : 0.988f;
        return clamp((1f + identity + installedPosition) * setReset, 0.90f, 1.10f);
    }

    private static long clampDelay(double delayMs) {
        if (!Double.isFinite(delayMs)) return 0L;
        return Math.max(0L, Math.min(MAX_DELAY_MS, Math.round(delayMs)));
    }

    private static double[] parseBounceTimes(String csv) {
        if (csv == null || csv.isEmpty()) return new double[0];
        String[] fields = csv.split(",");
        int count = Math.min(fields.length, 8);
        double[] temp = new double[count];
        int used = 0;
        for (int i = 0; i < count; i++) {
            try {
                double value = Double.parseDouble(fields[i]);
                if (Double.isFinite(value) && value >= 0.0 && value <= 6.0) temp[used++] = value;
            } catch (NumberFormatException ignored) {}
        }
        if (used == temp.length) return temp;
        double[] out = new double[used];
        System.arraycopy(temp, 0, out, 0, used);
        return out;
    }

    private enum SampleKind { SET, RESET, BOUNCE }

    private static void ensureSample(File file, SampleKind kind) throws IOException {
        if (file.isFile() && file.length() > 128) return;
        short[] pcm = synthesize(kind);
        try (FileOutputStream out = new FileOutputStream(file)) {
            writeWavHeader(out, pcm.length);
            for (short sample : pcm) {
                out.write(sample & 0xff);
                out.write((sample >>> 8) & 0xff);
            }
            out.flush();
        }
    }

    private static short[] synthesize(SampleKind kind) {
        final double duration = kind == SampleKind.BOUNCE ? 0.0022 :
                (kind == SampleKind.SET ? 0.0108 : 0.0100);
        int n = Math.max(64, (int) Math.ceil(SAMPLE_RATE * duration));
        short[] out = new short[n];
        long noiseState = kind == SampleKind.SET ? 0x4d595df4L :
                (kind == SampleKind.RESET ? 0x72b6f913L : 0x2a9d31c7L);
        double peak = 0.0;
        double[] tmp = new double[n];
        double previousNoise = 0.0;
        double previousDiff = 0.0;
        for (int i = 0; i < n; i++) {
            double t = i / (double) SAMPLE_RATE;
            noiseState ^= noiseState << 13;
            noiseState ^= noiseState >>> 17;
            noiseState ^= noiseState << 5;
            double noise = ((noiseState & 0xffffffffL) / 2147483648.0) - 1.0;
            double diff = noise - previousNoise;
            double high = diff - previousDiff;
            previousNoise = noise;
            previousDiff = diff;

            double value;
            if (kind == SampleKind.BOUNCE) {
                double env = Math.exp(-t / 0.00024);
                value = (high * 0.70 + Math.sin(2.0 * Math.PI * 13700.0 * t) * 0.30) * env;
            } else {
                double resetScale = kind == SampleKind.SET ? 1.0 : 0.93;
                double decayScale = kind == SampleKind.SET ? 1.0 : 0.90;
                double strike = high * Math.exp(-t / 0.00033) * 0.14 * resetScale;
                double ring =
                        Math.sin(2.0 * Math.PI * 5600.0 * t + 0.3) * Math.exp(-t / (0.00155 * decayScale)) * 0.24 +
                        Math.sin(2.0 * Math.PI * 8300.0 * t + 1.7) * Math.exp(-t / (0.00185 * decayScale)) * 0.34 +
                        Math.sin(2.0 * Math.PI * 11600.0 * t + 3.1) * Math.exp(-t / (0.00135 * decayScale)) * 0.25 +
                        Math.sin(2.0 * Math.PI * 14200.0 * t + 4.2) * Math.exp(-t / (0.00095 * decayScale)) * 0.13;
                double attack = Math.min(1.0, t / 0.00009);
                value = (strike + ring) * attack;
            }
            tmp[i] = value;
            peak = Math.max(peak, Math.abs(value));
        }
        double scale = peak > 0.0 ? 0.82 * 32767.0 / peak : 0.0;
        for (int i = 0; i < n; i++) out[i] = (short) Math.round(clamp(tmp[i] * scale, -32767.0, 32767.0));
        return out;
    }

    private static void writeWavHeader(FileOutputStream out, int sampleCount) throws IOException {
        int dataBytes = sampleCount * CHANNELS * (BITS_PER_SAMPLE / 8);
        writeAscii(out, "RIFF");
        writeLe32(out, 36 + dataBytes);
        writeAscii(out, "WAVEfmt ");
        writeLe32(out, 16);
        writeLe16(out, 1);
        writeLe16(out, CHANNELS);
        writeLe32(out, SAMPLE_RATE);
        writeLe32(out, SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8));
        writeLe16(out, CHANNELS * (BITS_PER_SAMPLE / 8));
        writeLe16(out, BITS_PER_SAMPLE);
        writeAscii(out, "data");
        writeLe32(out, dataBytes);
    }

    private static void writeAscii(FileOutputStream out, String text) throws IOException {
        for (int i = 0; i < text.length(); i++) out.write((byte) text.charAt(i));
    }

    private static void writeLe16(FileOutputStream out, int value) throws IOException {
        out.write(value & 0xff); out.write((value >>> 8) & 0xff);
    }

    private static void writeLe32(FileOutputStream out, int value) throws IOException {
        out.write(value & 0xff); out.write((value >>> 8) & 0xff);
        out.write((value >>> 16) & 0xff); out.write((value >>> 24) & 0xff);
    }

    private static int hash32(String text) {
        int h = 0x811c9dc5;
        for (int i = 0; i < text.length(); i++) {
            h ^= text.charAt(i);
            h *= 0x01000193;
        }
        h ^= h >>> 16; h *= 0x7feb352d;
        h ^= h >>> 15; h *= 0x846ca68b;
        h ^= h >>> 16;
        return h;
    }

    private static float clamp(float value, float low, float high) {
        return Math.max(low, Math.min(high, value));
    }

    private static double clamp(double value, double low, double high) {
        return Math.max(low, Math.min(high, value));
    }
}
