/**
 * PhoneForge Worker
 *
 * 一个 Worker 同时负责两件事：
 *   1. /api/telphone/*  →  代理 http://telphone.cn/*（号段抓取）
 *   2. 其余路径          →  交给静态资产（[assets] 绑定 ASSETS）
 *
 * 为什么需要代理：telphone.cn 只认 80 明文、强制 Accept-Encoding: gzip，
 * 且 443 挂的是自签证书，浏览器直连必被拦。
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/telphone/')) {
      return handleTelphone(request, url);
    }

    // 静态资产：web-static/ 下的一切
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('ASSETS binding missing（检查 wrangler 配置里的 [assets]）', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

async function handleTelphone(request, url) {
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

  // /api/telphone/prefix/xxx/  →  /prefix/xxx/
  const upstreamPath = url.pathname.replace(/^\/api\/telphone/, '') + url.search;

  try {
    const upstream = await fetch('http://telphone.cn' + upstreamPath, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Referer: 'http://telphone.cn/',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        // 站点强制要求；缺这个头直接 403
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    // Workers 的 fetch 已自动解压，直接透传文本
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
    return new Response(
      JSON.stringify({ error: String(err && err.message ? err.message : err) }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
