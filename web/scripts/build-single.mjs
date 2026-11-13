// 单文件构建：设置 SINGLE_FILE 后再调 vite build（跨平台，无需 cross-env）
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));

const child = spawn(process.execPath, [vite, 'build'], {
  stdio: 'inherit',
  env: { ...process.env, SINGLE_FILE: '1' },
  cwd: fileURLToPath(new URL('..', import.meta.url)),
});

child.on('exit', (code) => process.exit(code ?? 0));
