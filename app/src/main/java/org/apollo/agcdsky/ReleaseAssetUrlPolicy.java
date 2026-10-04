package org.apollo.agcdsky;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;

/** Restricts updater asset requests to this repository's HTTPS GitHub release paths. */
final class ReleaseAssetUrlPolicy {
    private static final String HOST = "github.com";
    private static final String PATH_PREFIX = "/ryanbytes/AGC-DSKY-Android/releases/download/v";

    private ReleaseAssetUrlPolicy() {}

    static String requireTrusted(String rawUrl, String version, String assetName) throws IOException {
        if (rawUrl == null || version == null || assetName == null
                || !version.matches("[0-9]+(?:\\.[0-9]+){1,3}")
                || !assetName.matches("app-(?:regular|fire)-release\\.apk(?:\\.sha256)?")) {
            throw new IOException("invalid GitHub release asset identity");
        }

        final URI uri;
        try {
            uri = new URI(rawUrl);
        } catch (URISyntaxException error) {
            throw new IOException("invalid GitHub release asset URL", error);
        }

        String expectedPath = PATH_PREFIX + version + "/" + assetName;
        if (!"https".equalsIgnoreCase(uri.getScheme())
                || !HOST.equalsIgnoreCase(uri.getHost())
                || (uri.getPort() != -1 && uri.getPort() != 443)
                || uri.getRawUserInfo() != null
                || uri.getRawQuery() != null
                || uri.getRawFragment() != null
                || !expectedPath.equals(uri.getRawPath())) {
            throw new IOException("untrusted GitHub release asset URL");
        }
        return uri.toASCIIString();
    }
}
