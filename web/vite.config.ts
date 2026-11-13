import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 抓取源的三条硬规矩：只认 80 明文、必须带 Accept-Encoding: gzip、号段在 /prefix/{地区}{前3位}/
const upstreamProxy = {
  '/api/telphone': {
    target: 'http://telphone.cn',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api\/telphone/, ''),
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      Referer: 'http://telphone.cn/',
      // 站点强制要求，缺则 403
      'Accept-Encoding': 'gzip, deflate',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  },
} as const;

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(process.env.SINGLE_FILE ? [viteSingleFile()] : [])],
  server: { port: 5183, host: '127.0.0.1', proxy: upstreamProxy },
  preview: { port: 5184, host: '127.0.0.1', proxy: upstreamProxy },
  base: './',
  build: {
    outDir: process.env.SINGLE_FILE ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 1600,
  },
}));
