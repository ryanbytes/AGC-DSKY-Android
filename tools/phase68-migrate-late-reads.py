#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app" / "src" / "main" / "assets"

MIGRATIONS = {
    "diagnostics.js": {
        "window.AGCDSKY_PARALLAX": "window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_PARALLAX')",
    },
    "dsky-input-runtime.js": {
        "window.AGCDSKY_INPUT": "window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_INPUT')",
    },
    "key-mechanical-spec.js": {
        "window.AGCDSKY_FLIGHT_HARDWARE_UI": "window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_FLIGHT_HARDWARE_UI')",
    },
    "optics.js": {
        "window.AGCDSKY_APOLLO_STARS": "window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_APOLLO_STARS')",
    },
    "phone-icdu.js": {
        "window.AGCDSKY_PHONE": "window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_PHONE')",
    },
    "relay-identity-audio.js": {
        "window.AGCDSKY_HARDWARE": "window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_HARDWARE')",
    },
    "relay-perceptual-personality.js": {
        "window.AGCDSKY_HARDWARE": "window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_HARDWARE')",
    },
    "relay-show.js": {
        "window.AGCDSKY_HARDWARE": "window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_HARDWARE')",
    },
    "relay-stretch-stability.js": {
        "window.AGCDSKY_HARDWARE": "window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_HARDWARE')",
    },
    "relay-visual-coupling.js": {
        "window.AGCDSKY_HARDWARE": "window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_HARDWARE')",
    },
    "runtime-transitions.js": {
        "window.AGCDSKY_RUNTIME": "window.AGCDSKY_SERVICE_REGISTRY.get('AGCDSKY_RUNTIME')",
    },
}

changed = []
for filename, replacements in MIGRATIONS.items():
    path = ASSETS / filename
    source = path.read_text()
    updated = source
    for old, new in replacements.items():
        if old not in updated:
            raise SystemExit(f"expected Phase 68 compatibility read missing: {filename}: {old}")
        updated = updated.replace(old, new)
    if updated != source:
        path.write_text(updated)
        changed.append(filename)

print(f"Phase 68 migrated {len(changed)} production consumers")
for filename in changed:
    print(f"  {filename}")
