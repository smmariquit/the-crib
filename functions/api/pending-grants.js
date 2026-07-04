// functions/api/pending-grants.js
//
// Polled by the CribVip Minecraft plugin. Asks PayMongo for recent PAID
// payments that carry a `minecraft_username` (i.e. VIP rank purchases — kape
// donations don't set that metadata) and returns them. No database needed:
// PayMongo is the source of truth, and the plugin dedupes locally by payment id.
//
// GET /api/pending-grants
// Header: x-poll-secret: <POLL_SECRET>
//
// Ported 1:1 from the Vercel handler at api/pending-grants.js. Response
// shape, status codes, and auth header name are unchanged so the live
// Minecraft plugin needs no reconfiguration beyond DNS pointing here.
//
// ponytail: Node's crypto.timingSafeEqual needs the `nodejs_compat` flag on
// Workers; instead this hand-rolls a fixed-time XOR compare over Web-standard
// TextEncoder output, so no compat flag is required. Upgrade to
// crypto.timingSafeEqual via nodejs_compat only if this ever needs to match
// Node's exact behavior for other reasons.

const LOOKBACK_DAYS = 14;
const MAX_PAGES = 5;          // up to 500 payments scanned per poll
const PAGE_SIZE = 100;

function safeEqual(a, b) {
    const enc = new TextEncoder();
    const ab = enc.encode(String(a));
    const bb = enc.encode(String(b));
    const len = Math.max(ab.length, bb.length, 1);
    let diff = ab.length ^ bb.length;
    for (let i = 0; i < len; i++) {
        diff |= (ab[i] || 0) ^ (bb[i] || 0);
    }
    return diff === 0;
}

function json(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function onRequest({ request, env }) {
    if (request.method !== 'GET') {
        return json(405, { error: 'Method not allowed' });
    }

    const expected = env.POLL_SECRET;
    if (!expected) {
        return json(500, { error: 'POLL_SECRET not configured' });
    }
    const provided = request.headers.get('x-poll-secret');
    if (!provided || !safeEqual(provided, expected)) {
        return json(401, { error: 'unauthorized' });
    }

    const secretKey = env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
        return json(500, { error: 'PayMongo secret key not configured' });
    }

    const auth = `Basic ${btoa(secretKey + ':')}`;
    const cutoff = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 86400;

    const grants = [];
    let after = null;

    try {
        for (let page = 0; page < MAX_PAGES; page++) {
            const url = new URL('https://api.paymongo.com/v1/payments');
            url.searchParams.set('limit', String(PAGE_SIZE));
            if (after) url.searchParams.set('after', after);

            const r = await fetch(url, { headers: { Accept: 'application/json', Authorization: auth } });
            const body = await r.json();
            if (!r.ok) {
                console.error('PayMongo list error:', JSON.stringify(body));
                return json(502, { error: 'Failed to list payments' });
            }

            const data = Array.isArray(body.data) ? body.data : [];
            if (data.length === 0) break;

            let reachedCutoff = false;
            for (const p of data) {
                const a = p.attributes || {};
                const paidAt = a.paid_at || a.created_at || 0;
                if (paidAt && paidAt < cutoff) {
                    reachedCutoff = true;
                    continue;
                }
                const username = a.metadata && a.metadata.minecraft_username;
                if (a.status === 'paid' && username) {
                    grants.push({
                        id: p.id,
                        username: String(username),
                        amount: a.amount,
                        currency: a.currency,
                        paid_at: paidAt
                    });
                }
            }

            if (reachedCutoff || !body.has_more) break;
            after = data[data.length - 1].id;
        }

        return json(200, { grants });
    } catch (err) {
        console.error('pending-grants error:', err);
        return json(500, { error: 'Internal server error' });
    }
}
