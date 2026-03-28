const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5MB

interface Env {
  STRIPS: R2Bucket
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return corsResponse(new Response(null, { status: 204 }))
    }

    // POST /upload — receive PNG blob, store in R2, return shareable URL
    if (req.method === 'POST' && url.pathname === '/upload') {
      const contentType = req.headers.get('content-type') ?? ''
      if (!contentType.startsWith('image/')) {
        return corsResponse(new Response(JSON.stringify({ error: 'Expected image content-type' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }))
      }

      const body = await req.arrayBuffer()
      if (body.byteLength > MAX_UPLOAD_BYTES) {
        return corsResponse(new Response(JSON.stringify({ error: 'Image too large (max 5MB)' }), {
          status: 413,
          headers: { 'content-type': 'application/json' },
        }))
      }

      const slug = crypto.randomUUID().slice(0, 8)
      const expiresAt = Date.now() + THIRTY_DAYS_MS

      await env.STRIPS.put(slug, body, {
        httpMetadata: { contentType: contentType.split(';')[0].trim() },
        customMetadata: { expiresAt: String(expiresAt) },
      })

      const shareUrl = `${url.origin}/s/${slug}`
      return corsResponse(Response.json({ url: shareUrl }))
    }

    // GET /s/:slug — serve stored image
    if (req.method === 'GET' && url.pathname.startsWith('/s/')) {
      const slug = url.pathname.slice(3)
      if (!slug || slug.length !== 8) {
        return corsResponse(new Response('Not found', { status: 404 }))
      }

      const obj = await env.STRIPS.get(slug)
      if (!obj) {
        return corsResponse(new Response('Not found', { status: 404 }))
      }

      // Honour soft TTL (R2 doesn't auto-expire — delete and return 404)
      const expiresAt = Number(obj.customMetadata?.expiresAt ?? 0)
      if (expiresAt && Date.now() > expiresAt) {
        await env.STRIPS.delete(slug)
        return corsResponse(new Response('Strip has expired', { status: 410 }))
      }

      const contentType = obj.httpMetadata?.contentType ?? 'image/png'
      return corsResponse(new Response(obj.body, {
        headers: {
          'content-type': contentType,
          'cache-control': 'public, max-age=2592000',
        },
      }))
    }

    return corsResponse(new Response('Not found', { status: 404 }))
  },
}

function corsResponse(res: Response): Response {
  const headers = new Headers(res.headers)
  headers.set('access-control-allow-origin', '*')
  headers.set('access-control-allow-methods', 'GET, POST, OPTIONS')
  headers.set('access-control-allow-headers', 'content-type')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}
