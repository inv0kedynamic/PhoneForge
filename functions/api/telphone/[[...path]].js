/**
 * Cloudflare Pages Functions：号段抓取代理。
 * 路径 /api/telphone/*  →  http://telphone.cn/*
 *
 * 为什么放 Functions 而不是纯静态：telphone.cn 只认 80 明文、强制
 * Accept-Encoding: gzip，且 443 是自签证书；浏览器直连必被拦。
 */
export async function onRequest(context) {
  const { request, params } = context;
  const url = new URL(request.url);

  // /api/telphone/prefix/xxx/  →  /prefix/xxx/
  const upstreamPath = url.pathname.replace(/^\/api\/telphone/, '') + url.search;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'GET') {
    return new Response('method not allowed', { status: 405 });
  }

  try {
    const upstream = await fetch('http://telphone.cn' + upstreamPath, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        Referer: 'http://telphone.cn/',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        // 站点强制要求；缺这个头直接 403
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      cf: { cacheTtl: 0 },
    });

    // fetch 已自动解压，直接透传文本
    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err && err.message ? err.message : err) }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
