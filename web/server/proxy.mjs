/**
 * 独立代理 + 静态站托管。
 *
 * telphone.cn 的三条硬规矩：
 *   1. 只认 80 明文（443 是自签证书 + 不同路径映射，/prefix/北京133/ 在 https 下 404）
 *   2. 必须带 Accept-Encoding: gzip，否则 nginx 直接 403 "Access Denied. Gzip compression is required."
 *   3. 号段列表在 /prefix/{地区}{前3位}/ 页面里
 *
 *   node server/proxy.mjs      → http://127.0.0.1:5185
 */
import http from 'node:http';
import zlib from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const PORT = Number(process.env.PORT || 5185);
const HOST = process.env.HOST || '127.0.0.1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function decompress(buf, encoding) {
  const enc = String(encoding || '').toLowerCase();
  try {
    if (enc.includes('br')) return zlib.brotliDecompressSync(buf);
    if (enc.includes('deflate')) return zlib.inflateSync(buf);
    if (enc.includes('gzip')) return zlib.gunzipSync(buf);
  } catch {
    /* 返回原始 buffer */
  }
  return buf;
}

function fetchUpstream(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: 'telphone.cn',
        port: 80,
        path,
        method: 'GET',
        headers: {
          'User-Agent': UA,
          Referer: 'http://telphone.cn/',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          // 站点强制要求；缺这个头直接 403
          'Accept-Encoding': 'gzip, deflate',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          Connection: 'close',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode || 502,
            encoding: res.headers['content-encoding'],
            body: decompress(Buffer.concat(chunks), res.headers['content-encoding']),
          })
        );
      }
    );
    req.on('error', reject);
    req.setTimeout(25000, () => req.destroy(new Error('upstream timeout')));
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname.startsWith('/api/telphone/')) {
    const upstreamPath = url.pathname.replace(/^\/api\/telphone/, '') + url.search;
    try {
      const r = await fetchUpstream(upstreamPath);
      res.writeHead(r.status, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      });
      res.end(r.body);
    } catch (e) {
      res.writeHead(502, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = join(DIST, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  try {
    const buf = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
    });
    res.end(buf);
  } catch {
    try {
      const buf = await readFile(join(DIST, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(buf);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('dist 未构建：先在 web/ 下执行 npm run build');
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`PhoneForge web → http://${HOST}:${PORT}`);
  console.log('代理：/api/telphone/*  →  http://telphone.cn/*  (gzip)');
});
