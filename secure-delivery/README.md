# Protected Delivery Setup (ClickBank + Cloudflare Worker)

This setup creates short-lived access links for verified buyers only.

## Architecture

1. Buyer reaches `secure-access.html` on GitHub Pages.
2. Buyer submits purchase email + receipt ID.
3. Worker checks `PURCHASES` KV for an active purchase.
4. Worker returns a short-lived tokenized `/download` link.
5. Worker streams the private WAV file from your private origin URL.

## Why this is protected

- Audio is never linked directly in public HTML.
- Access links are signed and expire quickly.
- Refunded or chargeback receipts can be revoked.
- Storage URL and bearer token are kept in Worker secrets.

## Deploy Steps

1. Create Cloudflare account and install Wrangler.
2. Create KV namespace and set the ID in `wrangler.toml`.
3. Copy `wrangler.toml.example` to `wrangler.toml` and fill values.
4. Set secrets:
   - `wrangler secret put ACCESS_TOKEN_SECRET`
   - `wrangler secret put ORIGIN_AUDIO_BEARER`
   - `wrangler secret put CLICKBANK_INS_SECRET`
5. Deploy:
   - `wrangler deploy`
6. Update `secure-access.js`:
   - Set `ACCESS_API_BASE` to your Worker URL.
7. Configure ClickBank INS/Webhook endpoint:
   - `https://YOUR_WORKER_URL/clickbank-ins`

## Deploy Without Node/Wrangler (Dashboard Method)

If Node/NPM/Wrangler is not installed on your machine, deploy via Cloudflare Dashboard:

1. Go to Cloudflare Dashboard -> Workers & Pages -> Create -> Worker.
2. Name it `harmonic-reset-access`.
3. Replace the worker code with the contents of `worker.js`.
4. In Settings -> Variables and Secrets:
    - Add plain variables:
       - `PUBLIC_BASE_URL` = your worker URL
       - `ACCESS_LINK_TTL_SECONDS` = `900`
       - `ORIGIN_AUDIO_URL` = `https://drive.usercontent.google.com/download?id=1urpPp4lY4CCXp7jrHFP4SOfpnAxC3T5k&export=download&confirm=t`
    - Add secrets:
       - `ACCESS_TOKEN_SECRET` = long random string
       - `CLICKBANK_INS_SECRET` = your ClickBank INS shared secret
5. In Storage -> KV, create namespace `PURCHASES` and bind it to your Worker as `PURCHASES`.
6. Save and Deploy.
7. Update `secure-access.js` `ACCESS_API_BASE` to your worker URL.
8. Publish your site changes.

## Required ClickBank Mapping

The worker expects webhook payload fields that include:

- Receipt: `receipt` or `receiptId`
- Buyer email: `email` or `customerEmail`
- Event: `transactionType` or `eventType`
- Shared secret: `secret` or `ins_secret`

If your ClickBank payload uses different field names, update `clickbankWebhook()` in `worker.js`.

## Event Handling Defaults

- Active access events: `SALE`, `BILL`, `TEST_SALE`
- Revoke access events: `RFND`, `CGBK`

Adjust these values if your account emits different codes.

## Security Notes

- Do not host raw audio files in public GitHub repos.
- Keep origin URL private and accessible only through the Worker flow.
- Use a long random `ACCESS_TOKEN_SECRET`.
- Keep token TTL short (default 15 minutes).

## Current Staged Product File

- Local staged file: `private-audio/harmonic_reset.wav`
- Size: `131.84 MB`
- SHA256: `F0792F30E8846E91A483903F955E52D1A708DBA60384239E50CE5B2E23FAF7B8`

This local file is intentionally excluded from git and must be uploaded to a private object store.

## Final Wiring With This File

1. Keep `private-audio/harmonic_reset.wav` local as your master WAV file.
2. Upload the same WAV to an origin URL you control (OneDrive private shared link is acceptable).
3. Set `ORIGIN_AUDIO_URL` in `wrangler.toml` to that WAV origin URL.
4. If the origin requires bearer auth, set `ORIGIN_AUDIO_BEARER` secret. If not, leave it unset.
5. Deploy Worker and update `ACCESS_API_BASE` in `secure-access.js`.
6. Test flow: valid receipt returns short-lived URL; refunded receipt is denied.

## Google Drive Origin (Your Current File)

Use this as `ORIGIN_AUDIO_URL`:

`https://drive.usercontent.google.com/download?id=1urpPp4lY4CCXp7jrHFP4SOfpnAxC3T5k&export=download&confirm=t`

Why this URL: large Drive files often show a virus-scan warning page on normal share links. The `drive.usercontent.google.com` download URL with `confirm=t` is the direct file response format needed for backend streaming.

## No MP3 Policy

- Delivery is configured for WAV only (`harmonic-reset.wav`).
- The worker forces WAV content type and WAV download filename.
