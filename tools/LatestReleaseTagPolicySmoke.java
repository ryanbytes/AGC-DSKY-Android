package org.apollo.agcdsky;

import java.io.IOException;

public final class LatestReleaseTagPolicySmoke {
    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static void rejected(String url, String message) throws Exception {
        try {
            LatestReleaseTagPolicy.versionFrom(url);
            throw new AssertionError(message);
        } catch (IOException expected) {
            // Expected rejection.
        }
    }

    public static void main(String[] args) throws Exception {
        check("1.1.64".equals(LatestReleaseTagPolicy.versionFrom(
                        "https://github.com/ryanbytes/AGC-DSKY-Android/releases/tag/v1.1.64")),
                "canonical latest release tag must be accepted");
        check("100000000000000000000.4".equals(LatestReleaseTagPolicy.versionFrom(
                        "https://github.com/ryanbytes/AGC-DSKY-Android/releases/tag/v100000000000000000000.4")),
                "large numeric version components must remain supported");

        rejected("http://github.com/ryanbytes/AGC-DSKY-Android/releases/tag/v1.1.64",
                "cleartext latest release URL was accepted");
        rejected("https://github.com.evil.example/ryanbytes/AGC-DSKY-Android/releases/tag/v1.1.64",
                "lookalike latest release host was accepted");
        rejected("https://github.com/other/repo/releases/tag/v1.1.64",
                "another repository's latest release tag was accepted");
        rejected("https://user@github.com/ryanbytes/AGC-DSKY-Android/releases/tag/v1.1.64",
                "latest release URL with userinfo was accepted");
        rejected("https://github.com/ryanbytes/AGC-DSKY-Android/releases/tag/v1.1.64?next=evil",
                "latest release URL with query was accepted");
        rejected("https://github.com/ryanbytes/AGC-DSKY-Android/releases/tag/v1.1.64#fragment",
                "latest release URL with fragment was accepted");
        rejected("https://github.com/ryanbytes/AGC-DSKY-Android/releases/tag/v1.1.64/other",
                "latest release tag with path suffix was accepted");
        rejected("https://github.com/ryanbytes/AGC-DSKY-Android/releases/tag/v1.1.64-rc1",
                "prerelease tag was accepted");
        rejected("https://github.com:444/ryanbytes/AGC-DSKY-Android/releases/tag/v1.1.64",
                "nonstandard HTTPS port was accepted");

        System.out.println("Latest release tag policy smoke: PASS");
        System.out.println("  canonical repository tag accepted; foreign, malformed, prerelease, and query-bearing redirects rejected");
    }
}
