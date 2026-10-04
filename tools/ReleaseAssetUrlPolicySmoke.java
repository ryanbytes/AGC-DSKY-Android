package org.apollo.agcdsky;

import java.io.IOException;

public final class ReleaseAssetUrlPolicySmoke {
    private static final String VERSION = "1.1.64";

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static void rejected(String url, String version, String name, String message) throws Exception {
        try {
            ReleaseAssetUrlPolicy.requireTrusted(url, version, name);
            throw new AssertionError(message);
        } catch (IOException expected) {
            // Expected rejection.
        }
    }

    public static void main(String[] args) throws Exception {
        String apk = "https://github.com/ryanbytes/AGC-DSKY-Android/releases/download/v1.1.64/app-regular-release.apk";
        check(apk.equals(ReleaseAssetUrlPolicy.requireTrusted(apk, VERSION, "app-regular-release.apk")),
                "exact regular APK URL must be accepted");
        String sidecar = "https://github.com/ryanbytes/AGC-DSKY-Android/releases/download/v1.1.64/app-fire-release.apk.sha256";
        check(sidecar.equals(ReleaseAssetUrlPolicy.requireTrusted(sidecar, VERSION, "app-fire-release.apk.sha256")),
                "exact Fire checksum URL must be accepted");
        String explicitDefaultPort = apk.replace("https://github.com/", "https://github.com:443/");
        check(explicitDefaultPort.equals(ReleaseAssetUrlPolicy.requireTrusted(
                        explicitDefaultPort, VERSION, "app-regular-release.apk")),
                "explicit HTTPS default port must be accepted");

        rejected("http://github.com/ryanbytes/AGC-DSKY-Android/releases/download/v1.1.64/app-regular-release.apk",
                VERSION, "app-regular-release.apk", "cleartext asset URL was accepted");
        rejected("https://github.com.evil.example/ryanbytes/AGC-DSKY-Android/releases/download/v1.1.64/app-regular-release.apk",
                VERSION, "app-regular-release.apk", "lookalike asset host was accepted");
        rejected("https://evil.example/asset.apk", VERSION, "app-regular-release.apk", "external asset host was accepted");
        rejected("https://github.com:444/ryanbytes/AGC-DSKY-Android/releases/download/v1.1.64/app-regular-release.apk",
                VERSION, "app-regular-release.apk", "nonstandard HTTPS port was accepted");
        rejected("https://user@github.com/ryanbytes/AGC-DSKY-Android/releases/download/v1.1.64/app-regular-release.apk",
                VERSION, "app-regular-release.apk", "userinfo in asset URL was accepted");
        rejected("https://github.com/other/repo/releases/download/v1.1.64/app-regular-release.apk",
                VERSION, "app-regular-release.apk", "other repository path was accepted");
        rejected("https://github.com/ryanbytes/AGC-DSKY-Android/releases/download/v1.1.63/app-regular-release.apk",
                VERSION, "app-regular-release.apk", "other version path was accepted");
        rejected(apk + "?redirect=https://evil.example", VERSION, "app-regular-release.apk",
                "query-bearing asset URL was accepted");
        rejected(apk + "#fragment", VERSION, "app-regular-release.apk", "fragment-bearing asset URL was accepted");
        rejected("https://github.com/ryanbytes/AGC-DSKY-Android/releases/download/v1.1.64/%2e%2e/app.apk",
                VERSION, "app-regular-release.apk", "traversal asset path was accepted");
        rejected(apk, VERSION, "unexpected.apk", "unexpected asset name was accepted");
        rejected(apk, "1.1.64/other", "app-regular-release.apk", "version with a path suffix was accepted");

        System.out.println("Release asset URL policy smoke: PASS");
        System.out.println("  exact HTTPS repository/version/asset paths accepted; external hosts, query data, and path substitutions rejected");
    }
}
