/**
 * Cloudflare Pages Advanced-mode Worker.
 *
 * Default Pages static-asset delivery returns 200 with the full mp4 body and
 * no Accept-Ranges header. Browsers then refuse to seek (seekable: 0-0) and
 * the scroll-driven hero scrub is broken. We intercept GET/HEAD for
 * /hero-pool.mp4 and rewrap the asset with proper Range support. All other
 * requests fall straight through to env.ASSETS, so the rest of the site is
 * served by the static-asset path with no overhead.
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/hero-pool.mp4' &&
        (request.method === 'GET' || request.method === 'HEAD')) {
      return serveVideoWithRange(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

async function serveVideoWithRange(request, env) {
  const url = new URL(request.url);
  const assetReq = new Request(new URL('/hero-pool.mp4', url.origin), {
    method: 'GET',
  });
  const asset = await env.ASSETS.fetch(assetReq);
  if (!asset.ok) return asset;

  const buf = await asset.arrayBuffer();
  const total = buf.byteLength;
  const etag = asset.headers.get('etag') || `"${total}"`;
  const range = request.headers.get('Range');

  const baseHeaders = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
    'ETag': etag,
  };

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: { ...baseHeaders, 'Content-Length': String(total) },
    });
  }

  if (!range) {
    return new Response(buf, {
      status: 200,
      headers: { ...baseHeaders, 'Content-Length': String(total) },
    });
  }

  const m = /bytes=(\d+)-(\d*)/.exec(range);
  if (!m) {
    return new Response('Bad Range', {
      status: 416,
      headers: { ...baseHeaders, 'Content-Range': `bytes */${total}` },
    });
  }
  const start = parseInt(m[1], 10);
  const end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
  if (start < 0 || start > end || end >= total) {
    return new Response('Range Not Satisfiable', {
      status: 416,
      headers: { ...baseHeaders, 'Content-Range': `bytes */${total}` },
    });
  }
  const length = end - start + 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      ...baseHeaders,
      'Content-Length': String(length),
      'Content-Range': `bytes ${start}-${end}/${total}`,
    },
  });
}
