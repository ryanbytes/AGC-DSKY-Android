#!/usr/bin/env bash
set -euo pipefail

# Local-only Gradle bootstrap for hosts that do not already have a compatible
# Gradle installed. This is not remote build infrastructure: it downloads the
# official Gradle distribution, verifies the pinned SHA-256, caches it under
# GRADLE_USER_HOME, and executes Gradle locally.

GRADLE_VERSION=9.5.1
GRADLE_SHA256=bafc141b619ad6350fd975fc903156dd5c151998cc8b058e8c1044ab5f7b031f
GRADLE_URL="https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip"
CACHE_ROOT="${GRADLE_USER_HOME:-${HOME:?HOME is required}/.gradle}/agc-bootstrap"
INSTALL_DIR="$CACHE_ROOT/gradle-$GRADLE_VERSION"
GRADLE_BIN="$INSTALL_DIR/bin/gradle"

fail() {
  printf 'GRADLE BOOTSTRAP FAIL: %s\n' "$*" >&2
  exit 1
}

sha256_file() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
    return
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
    return
  fi
  fail "sha256sum or shasum is required to verify the Gradle distribution"
}

download_file() {
  local url="$1" out="$2"
  if command -v curl >/dev/null 2>&1; then
    curl --fail --location --silent --show-error \
      --connect-timeout 20 --retry 2 --retry-delay 1 \
      --output "$out" "$url"
    return
  fi
  if command -v wget >/dev/null 2>&1; then
    wget --quiet --timeout=20 --tries=3 --output-document="$out" "$url"
    return
  fi
  fail "curl or wget is required to download Gradle $GRADLE_VERSION"
}

if [[ ! -x "$GRADLE_BIN" ]]; then
  command -v unzip >/dev/null 2>&1 || fail "unzip is required to install Gradle"
  mkdir -p "$CACHE_ROOT"

  ZIP="$CACHE_ROOT/.gradle-${GRADLE_VERSION}.$$.zip"
  STAGE="$CACHE_ROOT/.gradle-${GRADLE_VERSION}.$$.stage"
  cleanup() {
    rm -f "$ZIP"
    rm -rf "$STAGE"
  }
  trap cleanup EXIT INT TERM

  printf 'Downloading Gradle %s from %s\n' "$GRADLE_VERSION" "$GRADLE_URL" >&2
  download_file "$GRADLE_URL" "$ZIP" \
    || fail "could not download Gradle $GRADLE_VERSION"

  ACTUAL_SHA256="$(sha256_file "$ZIP")"
  [[ "$ACTUAL_SHA256" == "$GRADLE_SHA256" ]] \
    || fail "Gradle $GRADLE_VERSION SHA-256 $ACTUAL_SHA256; expected $GRADLE_SHA256"

  mkdir -p "$STAGE"
  unzip -q "$ZIP" -d "$STAGE" \
    || fail "could not extract Gradle $GRADLE_VERSION"
  [[ -x "$STAGE/gradle-$GRADLE_VERSION/bin/gradle" ]] \
    || fail "Gradle archive did not contain the expected executable"

  rm -rf "$INSTALL_DIR"
  mv "$STAGE/gradle-$GRADLE_VERSION" "$INSTALL_DIR"
  rm -f "$ZIP"
  rm -rf "$STAGE"
  trap - EXIT INT TERM
fi

exec "$GRADLE_BIN" "$@"
