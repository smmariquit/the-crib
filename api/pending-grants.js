// api/pending-grants.js
//
// Polled by the CribVip Minecraft plugin. Asks PayMongo for recent PAID
// payments that carry a `minecraft_username` (i.e. VIP rank purchases — kape
// donations don't set that metadata) and returns them. No database needed:
// PayMongo is the source of truth, and the plugin dedupes locally by payment id.
//
// GET /api/pending-grants
// Header: x-poll-secret: <POLL_SECRET>

import crypto from 'crypto';

const LOOKBACK_DAYS = 14;
const MAX_PAGES = 5;          // up to 500 payments scanned per poll
const PAGE_SIZE = 100;

function safeEqual(a, b) {
    const ab = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const expected = process.env.POLL_SECRET;
    if (!expected) {
        return res.status(500).json({ error: 'POLL_SECRET not configured' });
    }
    const provided = req.headers['x-poll-secret'];
    if (!provided || !safeEqual(provided, expected)) {
        return res.status(401).json({ error: 'unauthorized' });
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
        return res.status(500).json({ error: 'PayMongo secret key not configured' });
    }

    const auth = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;
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
                return res.status(502).json({ error: 'Failed to list payments' });
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

        return res.status(200).json({ grants });
    } catch (err) {
        console.error('pending-grants error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
