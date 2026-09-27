package org.apollo.agcdsky;

import java.util.Locale;

/**
 * Native Block II DSKY relay model used by the Android home-screen widget.
 *
 * The widget is hosted by the launcher, so Android does not provide a reliable
 * way to repaint RemoteViews at the DSKY's sub-20-ms contact times.  This model
 * nevertheless keeps the native widget electrically honest: decimal glyphs are
 * generated from the real K1..K5 contact matrix.  The logical Channel-010
 * field remains 12 x 11, but only the 120 physically populated latching
 * positions receive physical contact models. Exact production 2004688 unit
 * timing is unresolved, so the widget uses only the explicitly documented
 * predecessor-spec presentation reference and does not invent unit-to-unit
 * travel, bounce, or pole-skew fingerprints. Callers can sample those contacts
 * inside the separate documented 20-ms drive/settle envelope. The widget face
 * publishes the settled result; it never invents a partially settled state.
 */
final class WidgetRelayModel {
    static final int BANKS = 12;
    static final int RELAYS_PER_BANK = 11;
    static final int CHARACTER_RELAYS = 5;
    static final int PHYSICAL_LATCHING_RELAYS = 120;
    static final double DRIVE_ENVELOPE_MS = 20.0;
    static final double MAX_CONTACT_STABLE_MS = DRIVE_ENVELOPE_MS;
    // Predecessor magnetic-latching SCD 1006282 specifies operate/release
    // <=3 ms. Production 2004688 exact unit timing is unresolved, so this is a
    // conservative presentation reference, not a measured production value.
    static final double LATCHING_PRESENTATION_REFERENCE_MS = 3.0;

    // Comanche RELTAB low-five-bit codes for decimal 0..9.
    private static final int[] DIGIT_RELAY = {21, 3, 25, 27, 15, 30, 28, 19, 29, 31};

    private static final Profile[][] PROFILES = new Profile[BANKS + 1][RELAYS_PER_BANK];

    static {
        int physicalOrdinal = 0;
        for (int row = 1; row <= BANKS; row++) {
            for (int bit = 0; bit < RELAYS_PER_BANK; bit++) {
                if (!isPhysicalRelay(row, bit)) continue;
                PROFILES[row][bit] = makeProfile(row, bit, physicalOrdinal++);
            }
        }
        if (physicalOrdinal != PHYSICAL_LATCHING_RELAYS) {
            throw new IllegalStateException("expected " + PHYSICAL_LATCHING_RELAYS
                    + " physical latching relays, got " + physicalOrdinal);
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
        requireLogicalPosition(row, bit);
        if (!isPhysicalRelay(row, bit)) {
            throw new IllegalArgumentException("relay position is not physically populated: row="
                    + row + " bit=" + bit);
        }
        return PROFILES[row][bit];
    }

    static boolean isPhysicalRelay(int row, int bit) {
        if (row < 1 || row > BANKS || bit < 0 || bit >= RELAYS_PER_BANK) return false;
        if (row == 3 && bit == 10) return false;
        if (row == 8 && bit >= 5) return false;
        if ((row == 9 || row == 10 || row == 11) && bit == 10) return false;
        if (row == 12 && (bit == 9 || bit == 10)) return false;
        return true;
    }

    private static void requireLogicalPosition(int row, int bit) {
        if (row < 1 || row > BANKS || bit < 0 || bit >= RELAYS_PER_BANK) {
            throw new IllegalArgumentException("relay out of range: row=" + row + " bit=" + bit);
        }
    }

    private static String bitName(int bit) {
        if (bit == 10) return "B";
        if (bit >= 5) return "C-K" + (bit - 4);
        return "D-K" + (bit + 1);
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
     * Sample one complete 11-relay row while it is changing. Bits which do not
     * change remain latched. Changed contacts use the single source-bounded
     * predecessor timing reference; no production-unit bounce or pole-skew trace
     * is claimed. The commanded word is authoritative at the 20-ms boundary.
     */
    static int low11At(int row, int priorLow11, int targetLow11, double elapsedMs) {
        requireLogicalPosition(row, 0);
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
            if (!isPhysicalRelay(row, bit)) {
                // Logical Channel-010 positions without a relay package have no
                // armature/contact delay. Keep the logical word coherent while
                // explicitly skipping the physical travel/bounce model.
                if (after) out |= mask; else out &= ~mask;
                continue;
            }
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
        requireLogicalPosition(row, 0);
        if (bitOffset != 0 && bitOffset != 5) {
            throw new IllegalArgumentException("digit relay offset must be 0 or 5");
        }
        int prior = priorCode & 0x1f;
        int target = targetCode & 0x1f;
        boolean[][] pole = new boolean[CHARACTER_RELAYS][2];
        for (int k = 0; k < CHARACTER_RELAYS; k++) {
            boolean before = (prior & (1 << k)) != 0;
            boolean after = (target & (1 << k)) != 0;
            int bit = bitOffset + k;
            if (!isPhysicalRelay(row, bit)) {
                throw new IllegalArgumentException("digit transition requested unpopulated relay: row="
                        + row + " bit=" + bit);
            }
            Profile p = profile(row, bit);
            pole[k][0] = before == after ? before : contactState(p, before, after, elapsedMs, 0);
            pole[k][1] = before == after ? before : contactState(p, before, after, elapsedMs, 1);
        }
        // K1 and K4 only need one contact in this matrix. K2/K3/K5 retain the
        // two-pole structure for electrical topology, but production pole-skew
        // measurements are unresolved and the source-bounded profile uses zero skew.
        return matrixSegments(
            pole[0][0],
            pole[1][0], pole[1][1],
            pole[2][0], pole[2][1],
            pole[3][0],
            pole[4][0], pole[4][1]
        );
    }

    static double maxStableMsForRow(int row, int priorLow11, int targetLow11) {
        requireLogicalPosition(row, 0);
        int diff = (priorLow11 ^ targetLow11) & 0x7ff;
        double max = 0;
        for (int bit = 0; bit < RELAYS_PER_BANK; bit++) {
            if ((diff & (1 << bit)) == 0 || !isPhysicalRelay(row, bit)) continue;
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

    private static Profile makeProfile(int row, int bit, int physicalOrdinal) {
        String id = String.format(Locale.US, "ROW-%02d:%s", row, bitName(bit));
        // physicalOrdinal is retained only to prove all 120 installed positions
        // receive a profile. It must not be used to invent mechanical variation.
        if (physicalOrdinal < 0 || physicalOrdinal >= PHYSICAL_LATCHING_RELAYS) {
            throw new IllegalArgumentException("invalid physical relay ordinal " + physicalOrdinal);
        }
        double travel = LATCHING_PRESENTATION_REFERENCE_MS;
        return new Profile(id, row, bit, travel, travel,
                travel, travel, new double[0], new double[0], 0);
    }

    private static double clamp(double value, double low, double high) {
        return Math.max(low, Math.min(high, value));
    }

}
