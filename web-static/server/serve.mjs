/**
 * web-static 的本地服务：静态托管 + 号段抓取代理。
 *
 *   node server/serve.mjs            → http://127.0.0.1:5186
 *   PORT=8080 HOST=0.0.0.0 node server/serve.mjs
 *
 * 为什么需要它：telphone.cn 只认 80 明文、强制 Accept-Encoding: gzip，
 * 且 443 挂的是自签证书；浏览器直连会被拦，交给 node 转发。
 */
import http from 'node:http';
import zlib from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PORT = Number(process.env.PORT || 5186);
const HOST = process.env.HOST || '127.0.0.1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function decompress(buf, enc) {
  const e = String(enc || '').toLowerCase();
  try {
    if (e.includes('br')) return zlib.brotliDecompressSync(buf);
    if (e.includes('deflate')) return zlib.inflateSync(buf);
    if (e.includes('gzip')) return zlib.gunzipSync(buf);
  } catch {
    /* 原始数据返回 */
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

/** 把 URL 路径解析成 ROOT 内的真实文件，拒绝穿越 */
function resolveStatic(pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const target = normalize(join(ROOT, rel));
  if (!target.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) return null;
  return target;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname.startsWith('/api/telphone/')) {
    try {
      const r = await fetchUpstream(
        url.pathname.replace(/^\/api\/telphone/, '') + url.search
      );
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

  const file = resolveStatic(url.pathname);
  if (!file) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('forbidden');
    return;
  }

  try {
    const info = await stat(file);
    if (info.isDirectory()) throw new Error('is directory');
    const buf = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`号码工坊（静态版） → http://${HOST}:${PORT}`);
  console.log('抓取代理：/api/telphone/*  →  http://telphone.cn/*  （gzip）');
});
