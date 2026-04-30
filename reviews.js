// Nelson Pools ATX — Review API
// Cloudflare Pages Function backed by KV storage
// KV namespace "REVIEWS" must be bound in Cloudflare Pages project settings

const KV_KEY = 'all_reviews';

export async function onRequestGet({ env }) {
  try {
    const raw = await env.REVIEWS.get(KV_KEY);
    const reviews = raw ? JSON.parse(raw) : [];
    return new Response(JSON.stringify(reviews), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      }
    });
  } catch (e) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const review = await request.json();

    // Basic validation
    if (!review.name || !review.text) {
      return new Response(JSON.stringify({ error: 'Name and text required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Sanitize
    const clean = {
      name:     String(review.name).slice(0, 80).trim(),
      location: String(review.location || '').slice(0, 80).trim(),
      project:  String(review.project  || '').slice(0, 80).trim(),
      text:     String(review.text).slice(0, 600).trim(),
      ts:       Date.now()
    };

    // Load existing, prepend new review, cap at 50 total
    const raw = await env.REVIEWS.get(KV_KEY);
    const existing = raw ? JSON.parse(raw) : [];
    const updated = [clean, ...existing].slice(0, 50);

    await env.REVIEWS.put(KV_KEY, JSON.stringify(updated));

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
