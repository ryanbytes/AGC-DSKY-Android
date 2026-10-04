package org.apollo.agcdsky;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;

/** Accepts only the canonical GitHub latest-release tag redirect for this repository. */
final class LatestReleaseTagPolicy {
    private static final String HOST = "github.com";
    private static final String PATH_PREFIX = "/ryanbytes/AGC-DSKY-Android/releases/tag/v";

    private LatestReleaseTagPolicy() {}

    static String versionFrom(String rawUrl) throws IOException {
        if (rawUrl == null) throw new IOException("missing latest release URL");

        final URI uri;
        try {
            uri = new URI(rawUrl);
        } catch (URISyntaxException error) {
            throw new IOException("invalid latest release URL", error);
        }

        if (!"https".equalsIgnoreCase(uri.getScheme())
                || !HOST.equalsIgnoreCase(uri.getHost())
                || (uri.getPort() != -1 && uri.getPort() != 443)
                || uri.getRawUserInfo() != null
                || uri.getRawQuery() != null
                || uri.getRawFragment() != null
                || uri.getRawPath() == null
                || !uri.getRawPath().startsWith(PATH_PREFIX)) {
            throw new IOException("untrusted latest release URL");
        }

        String version = uri.getRawPath().substring(PATH_PREFIX.length());
        if (!version.matches("[0-9]+(?:\\.[0-9]+){1,3}")
                || !version.equals(ReleaseVersionPolicy.normalize(version))) {
            throw new IOException("invalid latest release tag");
        }
        return version;
    }
}
