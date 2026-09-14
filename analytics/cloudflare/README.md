# AGC DSKY anonymous usage analytics

This optional backend counts PWA usage without collecting AGC inputs, simulator state, camera data, sensor data, location, names, email addresses, or account information.

The PWA sends only:

- `launch` or `install` event
- a random installation ID generated and stored locally by the browser
- whether the PWA is running in standalone/Home Screen mode
- coarse device class (`iphone`, `ipad`, `android`, `mac`, `windows`, `linux`, `other`)
- app build identifier

The Worker HMAC-hashes the random installation ID with a server secret before D1 storage. The raw installation ID is not stored by the backend. The Worker does not read or store the request IP address. Aggregate stats are public at the Worker's root URL and `/v1/stats`; raw identifiers are never returned.

Do Not Track is honored by the PWA. Users can also disable telemetry by opening the PWA once with `?telemetry=off`; `?telemetry=on` re-enables it.

## Deploy

From the repository root on a machine with Node.js installed:

```sh
chmod +x analytics/cloudflare/deploy.sh
./analytics/cloudflare/deploy.sh
```

The script uses current Wrangler, opens Cloudflare login if necessary, creates or reuses the `agc-dsky-analytics` D1 database, applies migrations, deploys the Worker, creates a persistent `ANALYTICS_SECRET` if one does not already exist, and prints the public dashboard URL.

If GitHub CLI (`gh`) is installed and authenticated, the script also sets repository variable `AGC_ANALYTICS_ENDPOINT` and requests a PWA Pages rebuild. Otherwise it prints the two commands needed to do that manually.

Cloudflare's Wrangler configuration supports D1 bindings, and D1 migrations are versioned SQL files under `migrations/`.

Do not rotate `ANALYTICS_SECRET` casually. Changing it changes the HMAC of every installation identifier, causing returning installations to be counted as new users.
