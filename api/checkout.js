// api/checkout.js
//
// Vercel Serverless Function — creates a PayMongo Checkout Session for a
// "The Crib" VIP rank purchase. The buyer's Minecraft username is attached as
// metadata so the CribVip plugin can grant the rank when PayMongo fires the
// `checkout_session.payment.paid` webhook.
//
// POST /api/checkout
// Body: { username: string, amount?: number (pesos, for testing only) }

const VIP_PRICE_PESOS = 250;
const TEST_MIN_PESOS = 1;
const USERNAME_RE = /^[A-Za-z0-9_]{1,16}$/;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
        return res.status(500).json({ error: 'PayMongo secret key not configured' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const username = (body.username || '').trim();

        if (!USERNAME_RE.test(username)) {
            return res.status(400).json({
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
                'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`
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
            return res.status(response.status).json({ error: errMsg });
        }

        return res.status(200).json({ checkout_url: data.data.attributes.checkout_url });
    } catch (err) {
        console.error('Checkout error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
