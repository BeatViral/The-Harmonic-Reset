# Protected Delivery Setup (ClickBank + Cloudflare Worker)

This setup creates short-lived access links for verified buyers only.

## Architecture

1. Buyer reaches `secure-access.html` on GitHub Pages.
2. Buyer submits purchase email + receipt ID.
3. Worker checks `PURCHASES` KV for an active purchase.
4. Worker returns a short-lived tokenized `/download` link.
5. Worker streams the private audio from protected storage.

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
- Keep storage private and accessible only via Worker authorization headers.
- Use a long random `ACCESS_TOKEN_SECRET`.
- Keep token TTL short (default 15 minutes).
