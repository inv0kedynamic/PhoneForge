/**
 * 号段抓取。telphone.cn 的三条硬规矩（与 Android 端一致）：
 *   1. 只认 80 明文；443 是自签证书，且 /prefix/{地区}{前3位}/ 在 https 下 404
 *   2. 必须带 Accept-Encoding: gzip，否则 nginx 直接 403
 *      "Access Denied. Gzip compression is required."
 *   3. 号段列表在 /prefix/{地区}{前3位}/ 页面里
 *
 * 浏览器直连会被自签证书拦下，所以默认走同源代理 /api/telphone/*。
 * file:// 打开时没有同源代理，会尝试直连 http://telphone.cn 并提示失败原因。
 */
import { extractSegments, segmentPath } from './core.js';

export const PROXY_BASE = '/api/telphone';
export const UPSTREAM_ORIGIN = 'http://telphone.cn';

/** 当前是否具备同源代理（由 http(s) 托管而非 file:// 打开） */
export function hasProxy() {
  return location.protocol === 'http:' || location.protocol === 'https:';
}

/**
 * @returns {Promise<{segments: string[], url: string, status: number, via: string}>}
 */
export async function fetchSegments(region, prefix3, { signal } = {}) {
  const path = segmentPath(region, prefix3);
  const via = hasProxy() ? 'proxy' : 'direct';
  const url = hasProxy() ? PROXY_BASE + path : UPSTREAM_ORIGIN + path;

  const res = await fetch(url, {
    signal,
    headers: { Accept: 'text/html,application/xhtml+xml' },
    credentials: 'omit',
  });
  const html = await res.text();
  return {
    segments: extractSegments(html),
    url: UPSTREAM_ORIGIN + path,
    status: res.status,
    via,
  };
}
