package org.apollo.agcdsky;

/** Parses and compares numeric release versions without fixed-width overflow. */
final class ReleaseVersionPolicy {
    private ReleaseVersionPolicy() {}

    static String normalize(String raw) {
        if (raw == null) return null;
        String value = raw.trim();
        if (value.startsWith("v") || value.startsWith("V")) value = value.substring(1);
        int suffix = value.indexOf('-');
        if (suffix >= 0) value = value.substring(0, suffix);
        return value.matches("[0-9]+(?:\\.[0-9]+){1,3}") ? value : null;
    }

    static int compare(String left, String right) {
        String a = normalize(left), b = normalize(right);
        if (a == null || b == null) return 0;
        String[] aa = a.split("\\."), bb = b.split("\\.");
        for (int i = 0; i < Math.max(aa.length, bb.length); i++) {
            String av = canonicalComponent(i < aa.length ? aa[i] : "0");
            String bv = canonicalComponent(i < bb.length ? bb[i] : "0");
            if (av.length() != bv.length()) return Integer.compare(av.length(), bv.length());
            int order = av.compareTo(bv);
            if (order != 0) return order;
        }
        return 0;
    }

    static boolean matchesRelease(String releaseVersion, String apkVersionName) {
        String expected = normalize(releaseVersion);
        String actual = normalize(apkVersionName);
        return expected != null && actual != null && compare(expected, actual) == 0;
    }

    private static String canonicalComponent(String value) {
        int first = 0;
        while (first < value.length() - 1 && value.charAt(first) == '0') first++;
        return value.substring(first);
    }
}
