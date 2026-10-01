#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/publish-release.yml'), 'utf8');
function need(ok, message) { if (!ok) throw new Error(message); }

need(/^\s+workflow_dispatch:/m.test(workflow), 'release publishing must require manual dispatch');
need(!/^\s+push:/m.test(workflow), 'untrusted payload branch pushes must not run privileged workflow YAML');
need(/if:\s*github\.ref\s*==\s*'refs\/heads\/main'/.test(workflow), 'publisher job must be restricted to main workflow code');
need(/ref:\s*main[\s\S]*?persist-credentials:\s*false/.test(workflow), 'checkout must use main and avoid persisted write credentials');
need(/git fetch --no-tags origin "refs\/heads\/\$\{PAYLOAD_BRANCH\}"/.test(workflow), 'payload branch must be fetched as data');
need(/git archive "\$PAYLOAD_COMMIT" "release-payload\/v\$\{VERSION_NAME\}"/.test(workflow), 'publisher must archive only the payload directory');
need(workflow.includes('echo "PAYLOAD_DIR=${PAYLOAD_DIR}"')
    && workflow.includes('} >> "$GITHUB_ENV"')
    && workflow.includes('TAG="v${VERSION_NAME}"')
    && workflow.includes('NOTES="${PAYLOAD_DIR}/RELEASE_NOTES.txt"'), 'publish step must use the verified payload directory from the fetch step');
need(!/PAYLOAD_DIR="release-payload\/\$\{TAG\}"/.test(workflow), 'publish step must not point back into the trusted main checkout for payload assets');
need(/sha256sum -c app-regular-release\.apk\.sha256/.test(workflow)
    && /sha256sum -c app-fire-release\.apk\.sha256/.test(workflow), 'both APK sidecars must be checked');
need(!/\b(?:gradlew|build-local\.sh|aapt2|d8|apksigner|zipalign)\b/.test(workflow), 'publisher must not build or sign APKs');
console.log('Release publication policy smoke: PASS');
