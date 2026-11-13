/**
 * 号码工坊 · 核心逻辑（浏览器原生 ES 模块，无需编译）
 *
 * 与 123.py 一一对应：
 *   GET_QQW(region, prefix) → segmentPath() + extractSegments()
 *   QQW(pattern, list)      → filterSegments()
 *   HSW(pattern)            → buildSuffixes()
 *   main() 的交叉积          → crossProduct() / buildTxt() / buildVcf()
 */

/** 把含 x 的模式转成等长正则；非数字字符按字面量转义 */
export function patternToRegex(pattern) {
  let out = '';
  for (const ch of pattern) {
    if (ch === 'x' || ch === 'X') out += '\\d';
    else if (ch >= '0' && ch <= '9') out += ch;
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + out + '$');
}

/** 对应 HSW：0000-9999 全量生成后按模式过滤 */
export function buildSuffixes(pattern) {
  if (!pattern) {
    const all = new Array(10000);
    for (let i = 0; i < 10000; i++) all[i] = String(i).padStart(4, '0');
    return all;
  }
  const re = patternToRegex(pattern);
  const res = [];
  for (let i = 0; i < 10000; i++) {
    const s = String(i).padStart(4, '0');
    if (re.test(s)) res.push(s);
  }
  return res;
}

/** 对应 QQW：对号段列表按模式过滤 */
export function filterSegments(pattern, segments) {
  if (!pattern) return segments.slice();
  const re = patternToRegex(pattern);
  return segments.filter((s) => re.test(s));
}

/** 从号段页 HTML 抽出 7 位号段（对应 GET_QQW 的 findall） */
export function extractSegments(html) {
  const nums = new Set();
  let m;
  const linkRe = /<a href="\/prefix\/(\d{7})\/">/g;
  while ((m = linkRe.exec(html))) nums.add(m[1]);
  if (nums.size === 0) {
    // 兼容纯文本 / 其它 HTML 形态
    const bareRe = /\b(\d{7})\b/g;
    while ((m = bareRe.exec(html))) nums.add(m[1]);
  }
  return Array.from(nums).sort();
}

/** 交叉积，与脚本里双层 for 一致；返回 Iterator 以便大集合惰性取用 */
export function* iterateNumbers(segments, suffixes) {
  for (const seg of segments) {
    for (const suf of suffixes) yield seg + suf;
  }
}

/** 交叉积，直接返回数组（小规模预览用） */
export function crossProduct(segments, suffixes, limit = Infinity) {
  const out = [];
  outer: for (const seg of segments) {
    for (const suf of suffixes) {
      out.push(seg + suf);
      if (out.length >= limit) break outer;
    }
  }
  return out;
}

/** 对应 txt.txt：每行一个号码 */
export function buildTxt(segments, suffixes) {
  if (!segments.length || !suffixes.length) return '';
  const parts = [];
  for (const seg of segments) for (const suf of suffixes) parts.push(seg + suf);
  return parts.join('\n') + '\n';
}

/** 对应 vcf.vcf：VCARD 3.0 条目 */
export function buildVcf(segments, suffixes) {
  if (!segments.length || !suffixes.length) return '';
  const parts = [];
  for (const seg of segments) {
    for (const suf of suffixes) {
      const phone = seg + suf;
      parts.push(
        'BEGIN:VCARD\n' +
          'VERSION:3.0\n' +
          'N:;' + phone + ';;;\n' +
          'FN:' + phone + '\n' +
          'TEL;type=CELL;type=VOICE;type=pref:' + phone + '\n' +
          'END:VCARD\n'
      );
    }
  }
  return parts.join('');
}

/** 号段页路径：/prefix/{地区}{前3位}/ */
export function segmentPath(region, prefix3, encoded = true) {
  const key = region + prefix3;
  return '/prefix/' + (encoded ? encodeURIComponent(key) : key) + '/';
}

/** 模式串合法性：只允许数字与 x */
export function isValidPattern(pattern) {
  if (!pattern) return false;
  return /^[0-9xX]+$/.test(pattern);
}

/** 去掉用户可能带进来的空白与连字符 */
export function normalizePattern(raw) {
  return String(raw || '').replace(/[\s\u3000-]/g, '').trim();
}
