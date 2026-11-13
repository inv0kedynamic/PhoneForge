/**
 * 号码工坊 · 共享核心逻辑（与 123.py 一一对应）
 *
 * 原脚本三步：
 *   1. GET_QQW(region, prefix)  → 抓 https://telphone.cn/prefix/{region}{prefix}/ 页面里的 7 位号段
 *   2. QQW(pattern, list)       → 把模式里的 x 换成 \d，fullmatch 过滤 7 位号段
 *   3. HSW(pattern)             → 0000-9999 里按后段模式 fullmatch 过滤
 * 产物：txt.txt（每行一个号码）+ vcf.vcf（VCARD 3.0）
 */

export interface ForgeResult {
  segments: string[];      // 命中的 7 位号段
  suffixes: string[];      // 命中的后段
  total: number;           // 全排列总数
}

const XLOWER = 'x';
const XUPPER = 'X';

/** 把含 x 的模式转成等长正则；非 [0-9xX] 字符按字面量转义 */
export function patternToRegex(pattern: string): RegExp {
  let out = '';
  for (const ch of pattern) {
    if (ch === XLOWER || ch === XUPPER) out += '\\d';
    else if (/[0-9]/.test(ch)) out += ch;
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

/** 对应 123.py HSW：0000-9999 全量生成后按模式过滤 */
export function buildSuffixes(pattern: string): string[] {
  const re = patternToRegex(pattern);
  const res: string[] = [];
  for (let i = 0; i < 10000; i++) {
    const s = String(i).padStart(4, '0');
    if (re.test(s)) res.push(s);
  }
  return res;
}

/** 对应 123.py QQW：对抓到的 7 位号段按模式过滤 */
export function filterSegments(pattern: string, segments: string[]): string[] {
  if (!pattern) return segments.slice();
  const re = patternToRegex(pattern);
  return segments.filter((s) => re.test(s));
}

/** 从 telphone.cn 号段页 HTML 抽出 7 位号段（对应 GET_QQW 的 findall） */
export function extractSegments(html: string): string[] {
  const re = /<a href="\/prefix\/(\d{7})\/">([\d]+)/g;
  const nums = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) nums.add(m[1]);
  // 兼容部分页面把号段直接放在链接文本或纯文本里的情况
  const re2 = /\/prefix\/(\d{7})\//g;
  while ((m = re2.exec(html))) nums.add(m[1]);
  return Array.from(nums).sort();
}

/** 号码全排列，惰性迭代，避免大集合一次性吃满内存 */
export function* iterateNumbers(segments: string[], suffixes: string[]): Generator<string> {
  for (const seg of segments) {
    for (const suf of suffixes) yield seg + suf;
  }
}

/** 对应 123.py 的 txt.txt 内容 */
export function buildTxt(segments: string[], suffixes: string[]): string {
  const parts: string[] = [];
  for (const seg of segments) {
    for (const suf of suffixes) parts.push(seg + suf);
  }
  return parts.length ? parts.join('\n') + '\n' : '';
}

/** 对应 123.py 的 vcf.vcf 内容（VCARD 3.0） */
export function buildVcf(segments: string[], suffixes: string[]): string {
  const parts: string[] = [];
  for (const seg of segments) {
    for (const suf of suffixes) {
      const phone = seg + suf;
      parts.push(
        'BEGIN:VCARD\n' +
          'VERSION:3.0\n' +
          `N:;${phone};;;\n` +
          `FN:${phone}\n` +
          `TEL;type=CELL;type=VOICE;type=pref:${phone}\n` +
          'END:VCARD\n'
      );
    }
  }
  return parts.join('');
}

/** 号段页地址构造：/prefix/{省份}{前3位}/ */
export function segmentPageUrl(region: string, prefix3: string): string {
  return `/prefix/${encodeURIComponent(region + prefix3)}/`;
}
