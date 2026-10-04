package org.apollo.agcdsky;

public final class ReleaseVersionPolicySmoke {
    private static void require(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        require(ReleaseVersionPolicy.compare("1.1.65", "1.1.64") > 0,
                "current release ordering changed");
        require(ReleaseVersionPolicy.compare("1.10.0", "1.9.99") > 0,
                "version components must compare numerically");
        require(ReleaseVersionPolicy.compare("1.2.0", "1.2.0.0") == 0,
                "missing trailing components must remain zero");
        require(ReleaseVersionPolicy.compare("01.002.0003", "1.2.3") == 0,
                "leading zero components must compare equally");
        require(ReleaseVersionPolicy.compare("1.2147483648", "1.2147483647") > 0,
                "component comparison overflowed 32-bit integers");
        require(ReleaseVersionPolicy.compare("1.9999999999999999999999999999999999999999",
                "1.1000000000000000000000000000000000000000") > 0,
                "large version components must compare without parsing overflow");
        require("1.2.3".equals(ReleaseVersionPolicy.normalize("v1.2.3-rc1")),
                "existing prefix/suffix normalization changed");
        require(ReleaseVersionPolicy.compare("invalid", "1.2.3") == 0,
                "invalid versions must retain neutral ordering");
        System.out.println("release version policy smoke: PASS");
        System.out.println("  numeric ordering, trailing zeros, prefixes, suffixes, and unbounded components verified");
    }
}
