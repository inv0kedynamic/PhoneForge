/**
 * 单文件版服务端：托管 dist-single/index.html，并转发 /api/telphone/*。
 * 与 server/proxy.mjs 逻辑一致，只多支持 dist 不存在时回退。
 */
import http from 'node:http';
import zlib from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PORT = Number(process.env.PORT || 5185);
const HOST = process.env.HOST || '127.0.0.1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

function decompress(buf, enc) {
  const e = String(enc || '').toLowerCase();
  try {
    if (e.includes('br')) return zlib.brotliDecompressSync(buf);
    if (e.includes('deflate')) return zlib.inflateSync(buf);
    if (e.includes('gzip')) return zlib.gunzipSync(buf);
  } catch {
    /* 原样返回 */
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
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
    return;
  }

  for (const candidate of ['dist-single/index.html', 'dist/index.html']) {
    try {
      const buf = await readFile(join(ROOT, candidate));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(buf);
      return;
    } catch {
      /* 试下一个 */
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('未构建：npm run build 或 npm run build:single');
});

server.listen(PORT, HOST, () => {
  console.log(`PhoneForge web → http://${HOST}:${PORT}`);
});
