import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildSuffixes,
  buildTxt,
  buildVcf,
  extractSegments,
  filterSegments,
  iterateNumbers,
} from './core';

type Snack = { text: string; error?: boolean } | null;

const PREVIEW_LIMIT = 200;

/** 地区快捷选项（与 telphone.cn 的 /prefix/{地区}{前3位}/ 路径对齐） */
const REGION_PRESETS = [
  '北京',
  '上海',
  '广东',
  '江苏',
  '浙江',
  '四川',
  '山东',
  '河南',
  '湖北',
  '陕西',
  '天津',
  '重庆',
  '福建',
  '湖南',
  '安徽',
  '辽宁',
];

const XLOWER = 'x';
const XUPPER = 'X';

function normalizePattern(raw: string): string {
  return raw.replace(/[\s\u3000-]/g, '').trim();
}

function isValidPattern(p: string): boolean {
  if (!p) return false;
  if (!/^[0-9xX]+$/.test(p)) return false;
  // x 只能是连续的一段（原脚本按位置切片：前3位 / 3-7位 / 7位之后）
  if (!/^[0-9]*[xX]*[0-9]*$/.test(p)) return false;
  return true;
}

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function App() {
  const [pattern, setPattern] = useState('13xxxxxxxxx');
  const [region, setRegion] = useState('北京');
  const [loading, setLoading] = useState(false);
  const [segments, setSegments] = useState<string[]>([]);
  const [fetchedUrl, setFetchedUrl] = useState('');
  const [snack, setSnack] = useState<Snack>(null);
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const [scrolled, setScrolled] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const snackTimer = useRef<number | null>(null);

  const toast = useCallback((text: string, error = false) => {
    setSnack({ text, error });
    if (snackTimer.current) window.clearTimeout(snackTimer.current);
    snackTimer.current = window.setTimeout(() => setSnack(null), 3600);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const cleanPattern = normalizePattern(pattern);
  const patternOk = isValidPattern(cleanPattern);
  const prefix3 = cleanPattern.slice(0, 3);
  const mid4 = cleanPattern.slice(3, 7);
  const tail = cleanPattern.slice(7);

  /** 号段侧模式：前 7 位里带 x 的部分 */
  const segmentPattern = useMemo(() => {
    const p7 = cleanPattern.slice(0, 7);
    return /[xX]/.test(p7) ? p7 : '';
  }, [cleanPattern]);

  const suffixes = useMemo(() => {
    if (!patternOk) return [] as string[];
    try {
      return buildSuffixes(tail);
    } catch {
      return [] as string[];
    }
  }, [tail, patternOk]);

  const matchedSegments = useMemo(() => {
    if (!segments.length) return [] as string[];
    try {
      return filterSegments(segmentPattern, segments);
    } catch {
      return [] as string[];
    }
  }, [segments, segmentPattern]);

  const total = matchedSegments.length * suffixes.length;

  const preview = useMemo(() => {
    const out: string[] = [];
    if (!matchedSegments.length || !suffixes.length) return out;
    for (const n of iterateNumbers(matchedSegments, suffixes)) {
      out.push(n);
      if (out.length >= PREVIEW_LIMIT) break;
    }
    return out;
  }, [matchedSegments, suffixes]);

  const fetchSegments = useCallback(async () => {
    if (!patternOk) {
      toast('模式串格式不对：只允许数字与 x，且 x 之后不能再跟数字', true);
      return;
    }
    if (!prefix3) {
      toast('前 3 位不能为空', true);
      return;
    }
    const path = `/api/telphone/prefix/${encodeURIComponent(region + prefix3)}/`;
    setLoading(true);
    setFetchedUrl(`http://telphone.cn/prefix/${region}${prefix3}/`);
    try {
      const res = await fetch(path, { headers: { Accept: 'text/html' } });
      const html = await res.text();
      const found = extractSegments(html);
      setSegments(found);
      if (!found.length) {
        toast(`页面返回 ${res.status}，没解析到 7 位号段，可试试换地区或手动粘贴`, true);
      } else {
        toast(`抓到 ${found.length} 个号段`);
      }
    } catch (e) {
      setSegments([]);
      toast(`抓取失败：${(e as Error).message}`, true);
    } finally {
      setLoading(false);
    }
  }, [patternOk, prefix3, region, toast]);

  const applyManual = useCallback(() => {
    const found = extractSegments(manualText);
    if (found.length) {
      setSegments(found);
      setFetchedUrl('手动粘贴');
      setManualOpen(false);
      toast(`从粘贴内容解析到 ${found.length} 个号段`);
      return;
    }
    // 也接受纯 7 位号码列表
    const lines = manualText
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d{7}$/.test(s));
    if (lines.length) {
      setSegments(Array.from(new Set(lines)).sort());
      setFetchedUrl('手动粘贴');
      setManualOpen(false);
      toast(`识别到 ${lines.length} 行 7 位号段`);
      return;
    }
    toast('粘贴内容里没找到 7 位号段', true);
  }, [manualText, toast]);

  const exportTxt = useCallback(() => {
    if (!total) {
      toast('没有可导出的号码', true);
      return;
    }
    download('txt.txt', buildTxt(matchedSegments, suffixes), 'text/plain');
    toast(`已导出 txt.txt（${total} 条）`);
  }, [matchedSegments, suffixes, total, toast]);

  const exportVcf = useCallback(() => {
    if (!total) {
      toast('没有可导出的号码', true);
      return;
    }
    download('vcf.vcf', buildVcf(matchedSegments, suffixes), 'text/vcard');
    toast(`已导出 vcf.vcf（${total} 条）`);
  }, [matchedSegments, suffixes, total, toast]);

  const fmt = (n: number) => n.toLocaleString('en-US');

  return (
    <div className="app">
      <header className={`top-app-bar${scrolled ? ' scrolled' : ''}`}>
        <div className="top-app-bar__leading">号</div>
        <div className="top-app-bar__title">
          号码工坊
          <span className="top-app-bar__subtitle">号段解析 · 模式补全 · txt / vcf 导出</span>
        </div>
        <button
          className="icon-btn"
          title={`主题：${theme === 'auto' ? '跟随系统' : theme === 'light' ? '浅色' : '深色'}`}
          onClick={() =>
            setTheme(theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto')
          }
        >
          {theme === 'auto' ? '◐' : theme === 'light' ? '☀' : '☾'}
        </button>
      </header>

      <main className="page">
        {/* 1. 模式 */}
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">号码模式</h2>
            <span className="badge">x = 任意数字</span>
          </div>
          <p className="card__desc">
            例：<span className="mono">133xxxxxx33</span> → 前 3 位固定，中间 4–6 位任意，后 3 位固定。
          </p>

          <div className="field">
            <div className={`field__box${patternOk ? ' filled' : ' invalid'}`}>
              <input
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                inputMode="text"
              />
            </div>
            <label className="field__label">模式串</label>
            <div className={`field__support${patternOk ? '' : ' error'}`}>
              {patternOk
                ? `前 3 位 ${prefix3 || '—'} · 中段 ${mid4 || '（空）'} · 后段 ${
                    tail || '（空）'
                  }`
                : '只允许数字与 x（x 可分段出现，如 133xxxxxx33 → 前 3 位固定 / 中段任意 / 后 3 位固定）'}
            </div>
          </div>

          <div className="field">
            <div className={`field__box${region ? ' filled' : ''}`}>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value.trim())}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <label className="field__label">地区（号段页路径里的省份名）</label>
            <div className="field__support">
              {prefix3
                ? `将请求 telphone.cn/prefix/${region}${prefix3}/`
                : '填好模式串前 3 位后自动拼出请求地址'}
            </div>
          </div>

          <div className="chip-set">
            {REGION_PRESETS.map((r) => (
              <button
                key={r}
                className={`chip${region === r ? ' active' : ''}`}
                onClick={() => setRegion(r)}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="actions">
            <button className="btn btn--filled" onClick={fetchSegments} disabled={loading}>
              {loading ? '抓取中…' : '抓取号段'}
            </button>
            <button className="btn btn--outlined" onClick={() => setManualOpen((v) => !v)}>
              {manualOpen ? '收起手动输入' : '手动粘贴号段'}
            </button>
            <div className="spacer" />
            <button
              className="btn btn--text"
              onClick={() => {
                setPattern('13xxxxxxxxx');
                setRegion('北京');
                setSegments([]);
                setFetchedUrl('');
              }}
            >
              重置
            </button>
          </div>

          {loading && (
            <div className="linear">
              <div className="linear__bar" />
            </div>
          )}

          {manualOpen && (
            <>
              <div className="divider" />
              <textarea
                className="raw"
                placeholder="粘贴号段页 HTML，或直接粘 7 位号段列表（每行一个 / 空格分隔）"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
              />
              <div className="actions">
                <button className="btn btn--tonal" onClick={applyManual}>
                  从粘贴内容解析
                </button>
              </div>
            </>
          )}
        </section>

        {/* 2. 结果概览 */}
        <section className="card card--filled">
          <div className="card__header">
            <h2 className="card__title">结果概览</h2>
            {fetchedUrl && (
              <span className="badge mono" title={fetchedUrl}>
                {fetchedUrl.length > 44 ? `${fetchedUrl.slice(0, 44)}…` : fetchedUrl}
              </span>
            )}
          </div>

          <div className="stat-grid">
            <div className="stat">
              <span className="stat__value">{fmt(segments.length)}</span>
              <span className="stat__label">抓到的号段</span>
            </div>
            <div className="stat">
              <span className="stat__value">{fmt(matchedSegments.length)}</span>
              <span className="stat__label">模式命中号段</span>
            </div>
            <div className="stat">
              <span className="stat__value">{fmt(suffixes.length)}</span>
              <span className="stat__label">后段组合</span>
            </div>
            <div className="stat stat--accent">
              <span className="stat__value">{fmt(total)}</span>
              <span className="stat__label">号码总数（交叉积）</span>
            </div>
          </div>

          <div className="actions">
            <button className="btn btn--filled" onClick={exportTxt} disabled={!total}>
              导出 txt.txt
            </button>
            <button className="btn btn--elevated" onClick={exportVcf} disabled={!total}>
              导出 vcf.vcf
            </button>
            <div className="spacer" />
            <button
              className="btn btn--text"
              onClick={() => {
                const all = matchedSegments.join('\n');
                navigator.clipboard?.writeText(all).then(
                  () => toast(`已复制 ${matchedSegments.length} 个号段`),
                  () => toast('复制失败，浏览器未授权剪贴板', true)
                );
              }}
              disabled={!matchedSegments.length}
            >
              复制号段
            </button>
          </div>
        </section>

        {/* 3. 号段明细 */}
        <section className="card card--filled">
          <div className="card__header">
            <h2 className="card__title">命中号段</h2>
            <span className="badge">{matchedSegments.length}</span>
          </div>
          {matchedSegments.length ? (
            <div className="chip-set" style={{ maxHeight: 180, overflow: 'auto' }}>
              {matchedSegments.slice(0, 160).map((s) => (
                <span key={s} className="chip mono">
                  {s}
                </span>
              ))}
              {matchedSegments.length > 160 && (
                <span className="chip">+{matchedSegments.length - 160}</span>
              )}
            </div>
          ) : (
            <div className="result-empty">
              还没有命中号段。先抓取号段，或把手里的号段粘进来。
            </div>
          )}
        </section>

        {/* 4. 预览 */}
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">号码预览</h2>
            <span className="badge">
              前 {Math.min(PREVIEW_LIMIT, total)} / {fmt(total)}
            </span>
          </div>
          {preview.length ? (
            <div className="result-list">
              {preview.map((n, i) => (
                <div className="result-row" key={n}>
                  <span className="result-row__idx">{i + 1}</span>
                  <span className="result-row__num mono">{n}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="result-empty">导出前这里会显示生成的号码。</div>
          )}
          <div className="hint">
            导出文件与脚本行为一致：<span className="mono">txt.txt</span> 每行一个号码；
            <span className="mono"> vcf.vcf</span> 为 VCARD 3.0 条目。
          </div>
        </section>
      </main>

      <div className={`snackbar${snack ? ' show' : ''}${snack?.error ? ' error' : ''}`}>
        {snack?.text}
      </div>
    </div>
  );
}
