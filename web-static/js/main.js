/**
 * 入口：等 DOM 就绪后挂载。
 * 直接用 <script type="module"> 引入，无需打包。
 */
import { mount } from './app.js';

function boot() {
  const root = document.getElementById('root');
  if (!root) {
    console.error('[PhoneForge] 缺少 #root 容器');
    return;
  }
  mount(root);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
