package org.apollo.agcdsky;

import java.util.Locale;

/**
 * Native Block II DSKY relay model used by the Android home-screen widget.
 *
 * The widget is hosted by the launcher, so Android does not provide a reliable
 * way to repaint RemoteViews at the DSKY's sub-20-ms contact times.  This model
 * nevertheless keeps the native widget electrically honest: decimal glyphs are
 * generated from the real K1..K5 contact matrix, every one of the 12 x 11
 * latching relays has a stable manufacturing fingerprint, and callers can
 * sample the modeled set/reset travel, DPST pole skew and contact bounce at any
 * instant inside the documented 20-ms drive/settle envelope.  The widget face
 * publishes the settled result; it never invents a partially settled state.
 */
final class WidgetRelayModel {
    static final int BANKS = 12;
    static final int RELAYS_PER_BANK = 11;
    static final int CHARACTER_RELAYS = 5;
    static final double DRIVE_ENVELOPE_MS = 20.0;
    static final double CONTACT_GUARD_MS = 0.35;
    static final double MAX_CONTACT_STABLE_MS = DRIVE_ENVELOPE_MS - CONTACT_GUARD_MS;

    private static final double SET_TRAVEL_MIN_MS = 5.1;
    private static final double SET_TRAVEL_MAX_MS = 13.6;
    private static final double RESET_TRAVEL_MIN_MS = 4.7;
    private static final double RESET_TRAVEL_MAX_MS = 12.8;

    // Comanche RELTAB low-five-bit codes for decimal 0..9.
    private static final int[] DIGIT_RELAY = {21, 3, 25, 27, 15, 30, 28, 19, 29, 31};

    private static final Profile[][] PROFILES = new Profile[BANKS + 1][RELAYS_PER_BANK];

    static {
        for (int row = 1; row <= BANKS; row++) {
            for (int bit = 0; bit < RELAYS_PER_BANK; bit++) {
                PROFILES[row][bit] = makeProfile(row, bit);
            }
        }
    }

    private WidgetRelayModel() {}

    static final class Profile {
        final String id;
        final int row;
        final int bit;
        final double setTravelMs;
        final double resetTravelMs;
        final double setStableMs;
        final double resetStableMs;
        final double[] setBounceTimesMs;
        final double[] resetBounceTimesMs;
        final int poleSkewUs;

        Profile(String id, int row, int bit,
                double setTravelMs, double resetTravelMs,
                double setStableMs, double resetStableMs,
                double[] setBounceTimesMs, double[] resetBounceTimesMs,
                int poleSkewUs) {
            this.id = id;
            this.row = row;
            this.bit = bit;
            this.setTravelMs = setTravelMs;
            this.resetTravelMs = resetTravelMs;
            this.setStableMs = setStableMs;
            this.resetStableMs = resetStableMs;
            this.setBounceTimesMs = setBounceTimesMs.clone();
            this.resetBounceTimesMs = resetBounceTimesMs.clone();
            this.poleSkewUs = poleSkewUs;
        }
    }

    static Profile profile(int row, int bit) {
        if (row < 1 || row > BANKS || bit < 0 || bit >= RELAYS_PER_BANK) {
            throw new IllegalArgumentException("relay out of range: row=" + row + " bit=" + bit);
        }
        return PROFILES[row][bit];
    }

    static int relayCodeForDigit(char ch) {
        if (ch < '0' || ch > '9') return 0;
        return DIGIT_RELAY[ch - '0'];
    }

    static String segmentsForDigit(char ch) {
        return segmentsForRelayCode(relayCodeForDigit(ch));
    }

    /** Final settled K1..K5 contact-matrix decode. */
    static String segmentsForRelayCode(int value) {
        int code = value & 0x1f;
        boolean k1 = (code & 0x01) != 0;
        boolean k2 = (code & 0x02) != 0;
        boolean k3 = (code & 0x04) != 0;
        boolean k4 = (code & 0x08) != 0;
        boolean k5 = (code & 0x10) != 0;
        return matrixSegments(k1, k2, k2, k3, k3, k4, k5, k5);
    }

    /**
     * Sample one complete 11-relay row while it is changing.  Bits which do not
     * change remain latched.  Changed contacts follow their relay's fixed
     * set/reset travel and bounce trace and are forced to the commanded state at
     * the 20-ms settled boundary.
     */
    static int low11At(int row, int priorLow11, int targetLow11, double elapsedMs) {
        int prior = priorLow11 & 0x7ff;
        int target = targetLow11 & 0x7ff;
        if (elapsedMs >= DRIVE_ENVELOPE_MS) return target;
        if (elapsedMs <= 0) return prior;

        int out = prior;
        for (int bit = 0; bit < RELAYS_PER_BANK; bit++) {
            int mask = 1 << bit;
            boolean before = (prior & mask) != 0;
            boolean after = (target & mask) != 0;
            if (before == after) continue;
            boolean state = contactState(profile(row, bit), before, after, elapsedMs, -1);
            if (state) out |= mask; else out &= ~mask;
        }
        return out & 0x7ff;
    }

    /**
     * Contact-matrix decode during a five-relay character transition. bitOffset
     * is 0 for the D digit and 5 for the C digit within a relay row.
     */
    static String segmentsDuringDigitTransition(int row, int bitOffset,
                                                int priorCode, int targetCode,
                                                double elapsedMs) {
        if (bitOffset != 0 && bitOffset != 5) {
            throw new IllegalArgumentException("digit relay offset must be 0 or 5");
        }
        int prior = priorCode & 0x1f;
        int target = targetCode & 0x1f;
        boolean[][] pole = new boolean[CHARACTER_RELAYS][2];
        for (int k = 0; k < CHARACTER_RELAYS; k++) {
            boolean before = (prior & (1 << k)) != 0;
            boolean after = (target & (1 << k)) != 0;
            Profile p = profile(row, bitOffset + k);
            pole[k][0] = before == after ? before : contactState(p, before, after, elapsedMs, 0);
            pole[k][1] = before == after ? before : contactState(p, before, after, elapsedMs, 1);
        }
        // K1 and K4 only need one contact in this matrix. K2/K3/K5 use their
        // two mechanically linked poles separately, so manufacturing pole skew
        // can affect the sub-20-ms intermediate pattern without affecting the
        // settled decimal result.
        return matrixSegments(
            pole[0][0],
            pole[1][0], pole[1][1],
            pole[2][0], pole[2][1],
            pole[3][0],
            pole[4][0], pole[4][1]
        );
    }

    static double maxStableMsForRow(int row, int priorLow11, int targetLow11) {
        int diff = (priorLow11 ^ targetLow11) & 0x7ff;
        double max = 0;
        for (int bit = 0; bit < RELAYS_PER_BANK; bit++) {
            if ((diff & (1 << bit)) == 0) continue;
            boolean engaging = (targetLow11 & (1 << bit)) != 0;
            Profile p = profile(row, bit);
            max = Math.max(max, engaging ? p.setStableMs : p.resetStableMs);
        }
        return Math.min(MAX_CONTACT_STABLE_MS, max);
    }

    private static boolean contactState(Profile p, boolean before, boolean after,
                                        double elapsedMs, int pole) {
        if (before == after) return before;
        boolean engaging = after;
        double travel = engaging ? p.setTravelMs : p.resetTravelMs;
        double stable = engaging ? p.setStableMs : p.resetStableMs;
        double[] bounce = engaging ? p.setBounceTimesMs : p.resetBounceTimesMs;

        // Positive pole skew means the second pole makes later than the first.
        if (pole >= 0) {
            double halfSkewMs = p.poleSkewUs / 2000.0;
            double offset = pole == 0 ? -halfSkewMs : halfSkewMs;
            travel += offset;
            stable += offset;
        }
        travel = clamp(travel, 0.05, MAX_CONTACT_STABLE_MS);
        stable = clamp(stable, travel, MAX_CONTACT_STABLE_MS);

        if (elapsedMs < travel) return before;
        if (elapsedMs >= stable) return after;

        boolean state = after;
        for (double bounceMs : bounce) {
            double eventAt = travel + bounceMs;
            if (eventAt >= stable || elapsedMs < eventAt) break;
            state = !state;
        }
        return state;
    }

    // Schematic E,F,H,J,K,M,N -> conventional a,b,c,d,e,f,g.
    private static String matrixSegments(boolean k1,
                                         boolean k2Left, boolean k2Right,
                                         boolean k3Left, boolean k3Right,
                                         boolean k4,
                                         boolean k5Left, boolean k5Right) {
        boolean eTop = k5Left;                 // E -> a
        boolean fUpperLeft = k3Left;           // F -> f
        boolean hUpperRight = k1;              // H -> b
        boolean jMiddle = k4;                  // J -> g
        boolean kLowerLeft = !k2Right && eTop; // K -> e
        boolean mLowerRight = !k2Left ? fUpperLeft : true; // M -> c
        boolean internal = !k3Right ? jMiddle : true;
        boolean nBottom = k5Right && internal; // N -> d

        StringBuilder out = new StringBuilder(7);
        if (eTop) out.append('a');
        if (hUpperRight) out.append('b');
        if (mLowerRight) out.append('c');
        if (nBottom) out.append('d');
        if (kLowerLeft) out.append('e');
        if (fUpperLeft) out.append('f');
        if (jMiddle) out.append('g');
        return out.toString();
    }

    private static Profile makeProfile(int row, int bit) {
        String id = String.format(Locale.US, "ROW-%02d:%s", row, bitName(bit));
        int ordinal = (row - 1) * RELAYS_PER_BANK + bit;
        XorShift32 rnd = new XorShift32(hash32(id + ":manufacture"));
        double positionPhase = ((ordinal * 73 + 17) % (BANKS * RELAYS_PER_BANK)) /
                (double)(BANKS * RELAYS_PER_BANK - 1);

        double setTravel = clamp(
            SET_TRAVEL_MIN_MS + (SET_TRAVEL_MAX_MS - SET_TRAVEL_MIN_MS) *
                clamp(0.58 * positionPhase + 0.42 * rnd.next(), 0, 1),
            SET_TRAVEL_MIN_MS, SET_TRAVEL_MAX_MS);
        double resetTravel = clamp(
            RESET_TRAVEL_MIN_MS + (RESET_TRAVEL_MAX_MS - RESET_TRAVEL_MIN_MS) *
                clamp(0.52 * (1 - positionPhase) + 0.48 * rnd.next(), 0, 1),
            RESET_TRAVEL_MIN_MS, RESET_TRAVEL_MAX_MS);

        int poleSkewUs = (int)Math.round((rnd.next() * 2 - 1) * 185.0);
        int setBounceCount = 2 + (int)Math.floor(rnd.next() * 5.0);
        int resetBounceCount = 1 + (int)Math.floor(rnd.next() * 4.0);
        double setBounceWindow = 0.55 + rnd.next() * 2.35;
        double resetBounceWindow = 0.35 + rnd.next() * 1.85;
        double[] setBounce = bouncePattern(rnd, setBounceCount, setBounceWindow);
        double[] resetBounce = bouncePattern(rnd, resetBounceCount, resetBounceWindow);
        double setTail = 0.12 + rnd.next() * 0.34;
        double resetTail = 0.10 + rnd.next() * 0.28;

        double setLast = setBounce.length == 0 ? 0 : setBounce[setBounce.length - 1];
        double resetLast = resetBounce.length == 0 ? 0 : resetBounce[resetBounce.length - 1];
        double setStable = Math.min(MAX_CONTACT_STABLE_MS, setTravel + setLast + setTail);
        double resetStable = Math.min(MAX_CONTACT_STABLE_MS, resetTravel + resetLast + resetTail);

        return new Profile(id, row, bit, setTravel, resetTravel,
                setStable, resetStable, setBounce, resetBounce, poleSkewUs);
    }

    private static double[] bouncePattern(XorShift32 rnd, int count, double windowMs) {
        if (count <= 0 || windowMs <= 0) return new double[0];
        double[] out = new double[count];
        double slot = windowMs / (count + 1.0);
        for (int i = 1; i <= count; i++) {
            double jitter = (rnd.next() * 2 - 1) * slot * 0.24;
            out[i - 1] = clamp(i * slot + jitter, 0.05, windowMs - 0.03);
        }
        java.util.Arrays.sort(out);
        return out;
    }

    private static String bitName(int bit) {
        if (bit == 10) return "B";
        if (bit >= 5) return "C-K" + (bit - 4);
        return "D-K" + (bit + 1);
    }

    private static long hash32(String text) {
        int h = 0x811c9dc5;
        for (int i = 0; i < text.length(); i++) {
            h ^= text.charAt(i);
            h *= 0x01000193;
        }
        h ^= h >>> 16;
        h *= 0x7feb352d;
        h ^= h >>> 15;
        h *= 0x846ca68b;
        h ^= h >>> 16;
        return Integer.toUnsignedLong(h);
    }

    private static double clamp(double value, double low, double high) {
        return Math.max(low, Math.min(high, value));
    }

    private static final class XorShift32 {
        private int state;
        XorShift32(long seed) { state = (int)(seed == 0 ? 1 : seed); }
        double next() {
            int x = state;
            x ^= x << 13;
            x ^= x >>> 17;
            x ^= x << 5;
            state = x;
            return Integer.toUnsignedLong(x) / 4294967296.0;
        }
    }
}
