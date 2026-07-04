// functions/api/checkout.js
//
// Cloudflare Pages Function (Web-standard Request/Response) — creates a
// PayMongo Checkout Session for a "The Crib" VIP rank purchase. The buyer's
// Minecraft username is attached as metadata so the CribVip plugin can grant
// the rank (via api/pending-grants.js polling). Ported 1:1 from the Vercel
// handler at api/checkout.js; behavior, status codes, and JSON shapes,
// success/cancel URLs, and reference numbers are unchanged.
//
// POST /api/checkout
// Body: { username: string, amount?: number (pesos, for testing only) }

const VIP_PRICE_PESOS = 250;
const TEST_MIN_PESOS = 1;
const USERNAME_RE = /^[A-Za-z0-9_]{1,16}$/;

function json(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function onRequest({ request, env }) {
    if (request.method !== 'POST') {
        return json(405, { error: 'Method not allowed' });
    }

    const secretKey = env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
        return json(500, { error: 'PayMongo secret key not configured' });
    }

    try {
        let body;
        try {
            body = await request.json();
        } catch {
            body = {};
        }
        const username = (body.username || '').trim();

        if (!USERNAME_RE.test(username)) {
            return json(400, {
                error: 'Enter a valid Minecraft username (letters, numbers, underscore; up to 16 chars).'
            });
        }

        // Default to the real VIP price. An optional `amount` (>= ₱20 and < ₱250)
        // is allowed only so you can run a cheap end-to-end test. The plugin's
        // `require-amount-match` guard prevents test amounts from granting VIP in
        // production.
        let pesoAmount = VIP_PRICE_PESOS;
        if (body.amount !== undefined) {
            const requested = parseInt(body.amount, 10);
            if (Number.isInteger(requested) && requested >= TEST_MIN_PESOS && requested <= VIP_PRICE_PESOS) {
                pesoAmount = requested;
            }
        }
        const centavoAmount = pesoAmount * 100;
        const isTest = pesoAmount !== VIP_PRICE_PESOS;

        const itemName = isTest
            ? `The Crib VIP (TEST ₱${pesoAmount})`
            : 'The Crib — VIP Rank';
        const description = `The Crib VIP rank for ${username}`;

        const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Basic ${btoa(secretKey + ':')}`
            },
            body: JSON.stringify({
                data: {
                    attributes: {
                        send_email_receipt: true,
                        show_description: true,
                        show_line_items: true,
                        description: description,
                        line_items: [
                            {
                                currency: 'PHP',
                                amount: centavoAmount,
                                name: itemName,
                                quantity: 1,
                                description: description
                            }
                        ],
                        // Add 'gcash', 'paymaya', 'card' etc. once enabled on your
                        // PayMongo account. 'qrph' works for any bank/e-wallet QR.
                        payment_method_types: ['qrph'],
                        reference_number: `vip-${username}`.slice(0, 32),
                        metadata: {
                            minecraft_username: username
                        },
                        success_url: `https://crib.stimmie.dev/success.html?u=${encodeURIComponent(username)}`,
                        cancel_url: 'https://crib.stimmie.dev/?cancelled=true'
                    }
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('PayMongo error:', JSON.stringify(data));
            const errMsg = data.errors?.[0]?.detail || 'Failed to create checkout session';
            return json(response.status, { error: errMsg });
        }

        return json(200, { checkout_url: data.data.attributes.checkout_url });
    } catch (err) {
        console.error('Checkout error:', err);
        return json(500, { error: 'Internal server error' });
    }
}
