export default {
	async fetch(request, env) {
		if (request.method === "OPTIONS") {
			return cors(new Response(null, { status: 204 }));
		}

		const url = new URL(request.url);

		if (url.pathname === "/request-access" && request.method === "POST") {
			return cors(await requestAccess(request, env));
		}

		if (url.pathname === "/download" && request.method === "GET") {
			return downloadAudio(request, env);
		}

		if (url.pathname === "/clickbank-ins" && request.method === "POST") {
			return await clickbankWebhook(request, env);
		}

		return cors(json({ message: "Not found" }, 404));
	},
};

async function requestAccess(request, env) {
	const body = await request.json().catch(() => null);
	if (!body || !body.email || !body.receipt) {
		return json({ message: "Email and receipt are required." }, 400);
	}

	const email = String(body.email).trim().toLowerCase();
	const receipt = String(body.receipt).trim();
	const key = `purchase:${receipt}:${email}`;
	const recordRaw = await env.PURCHASES.get(key);

	if (!recordRaw) {
		return json({ message: "Purchase not found yet. Please verify details or try again in a few minutes." }, 403);
	}

	const record = JSON.parse(recordRaw);
	if (record.status !== "active") {
		return json({ message: "This purchase is not currently eligible for access." }, 403);
	}

	const expiresInSeconds = Number(env.ACCESS_LINK_TTL_SECONDS || "900");
	const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
	const tokenPayload = `${receipt}|${email}|${expiresAt}`;
	const signature = await hmacHex(tokenPayload, env.ACCESS_TOKEN_SECRET);
	const token = btoa(`${tokenPayload}|${signature}`);

	const accessUrl = `${env.PUBLIC_BASE_URL}/download?token=${encodeURIComponent(token)}`;
	return json({ accessUrl, expiresAt: new Date(expiresAt * 1000).toISOString() }, 200);
}

async function downloadAudio(request, env) {
	const url = new URL(request.url);
	const token = url.searchParams.get("token");
	if (!token) {
		return new Response("Missing token", { status: 400 });
	}

	let decoded;
	try {
		decoded = atob(token);
	} catch {
		return new Response("Invalid token", { status: 401 });
	}

	const [receipt, email, expiresAtRaw, signature] = decoded.split("|");
	const expiresAt = Number(expiresAtRaw);
	if (!receipt || !email || !expiresAt || !signature) {
		return new Response("Invalid token", { status: 401 });
	}

	if (Math.floor(Date.now() / 1000) > expiresAt) {
		return new Response("Token expired", { status: 401 });
	}

	const tokenPayload = `${receipt}|${email}|${expiresAt}`;
	const expectedSig = await hmacHex(tokenPayload, env.ACCESS_TOKEN_SECRET);
	if (signature !== expectedSig) {
		return new Response("Invalid signature", { status: 401 });
	}

	const originHeaders = new Headers();
	if (env.ORIGIN_AUDIO_BEARER) {
		originHeaders.set("Authorization", `Bearer ${env.ORIGIN_AUDIO_BEARER}`);
	}

	const originRequest = new Request(env.ORIGIN_AUDIO_URL, {
		method: "GET",
		headers: originHeaders,
	});

	const originResponse = await fetch(originRequest);
	if (!originResponse.ok) {
		return new Response("Audio source unavailable", { status: 502 });
	}

	const responseHeaders = new Headers(originResponse.headers);
	responseHeaders.set("Cache-Control", "private, no-store, max-age=0");
	responseHeaders.set("Content-Disposition", 'attachment; filename="harmonic-reset.wav"');
	responseHeaders.set("Content-Type", "audio/wav");
	responseHeaders.set("X-Robots-Tag", "noindex, nofollow");

	return new Response(originResponse.body, {
		status: 200,
		headers: responseHeaders,
	});
}

async function clickbankWebhook(request, env) {
	const raw = await request.text();
	const contentType = request.headers.get("content-type") || "";
	let payload = {};

	if (contentType.includes("application/json")) {
		payload = JSON.parse(raw || "{}");
	} else {
		const params = new URLSearchParams(raw);
		for (const [k, v] of params.entries()) {
			payload[k] = v;
		}
	}

	const sharedSecret = String(payload.secret || payload.ins_secret || "");
	if (!sharedSecret || sharedSecret !== env.CLICKBANK_INS_SECRET) {
		return new Response("Unauthorized", { status: 401 });
	}

	const receipt = String(payload.receipt || payload.receiptId || "").trim();
	const email = String(payload.email || payload.customerEmail || "").trim().toLowerCase();
	const eventType = String(payload.transactionType || payload.eventType || "").toUpperCase();

	if (!receipt || !email || !eventType) {
		return new Response("Bad payload", { status: 400 });
	}

	const key = `purchase:${receipt}:${email}`;
	const isActive = eventType === "SALE" || eventType === "BILL" || eventType === "TEST_SALE";
	const isRevoked = eventType === "RFND" || eventType === "CGBK";

	if (isActive) {
		await env.PURCHASES.put(
			key,
			JSON.stringify({ status: "active", receipt, email, eventType, updatedAt: new Date().toISOString() }),
			{ expirationTtl: 60 * 60 * 24 * 400 }
		);
	}

	if (isRevoked) {
		await env.PURCHASES.put(
			key,
			JSON.stringify({ status: "revoked", receipt, email, eventType, updatedAt: new Date().toISOString() }),
			{ expirationTtl: 60 * 60 * 24 * 400 }
		);
	}

	return new Response("OK", { status: 200 });
}

function json(payload, status = 200) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

function cors(response) {
	const headers = new Headers(response.headers);
	headers.set("Access-Control-Allow-Origin", "https://beatviral.github.io");
	headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
	headers.set("Access-Control-Allow-Headers", "Content-Type");
	return new Response(response.body, {
		status: response.status,
		headers,
	});
}

async function hmacHex(message, secret) {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"]
	);
	const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(message));
	const sigBytes = new Uint8Array(sigBuffer);
	return Array.from(sigBytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
