/**
 * 号码工坊 · UI 层（原生 DOM，无框架、无构建）
 * 结构对应 React 版的 App.tsx，样式沿用同一套 MD3 令牌。
 */
import {
  buildSuffixes,
  buildTxt,
  buildVcf,
  crossProduct,
  extractSegments,
  filterSegments,
  isValidPattern,
  normalizePattern,
} from './core.js';
import { fetchSegments, hasProxy } from './api.js';
import { download, copyText, fmt } from './io.js';

const PREVIEW_LIMIT = 200;
const SEGMENT_CHIP_LIMIT = 160;

const REGION_PRESETS = [
  '北京', '上海', '广东', '江苏', '浙江', '四川', '山东', '河南',
  '湖北', '陕西', '天津', '重庆', '福建', '湖南', '安徽', '辽宁',
];

const state = {
  pattern: '13xxxxxxxxx',
  region: '北京',
  segments: [],
  fetchedUrl: '',
  loading: false,
  manualOpen: false,
  manualText: '',
  theme: 'auto',
};

let root;
let snackTimer = null;
let abortCtl = null;

/* ---------------- 派生数据（与原脚本调用条件一致） ---------------- */

function derived() {
  const pattern = normalizePattern(state.pattern);
  const valid = isValidPattern(pattern);
  const prefix3 = pattern.slice(0, 3);
  const mid4 = pattern.slice(3, 7);
  const tail = pattern.slice(7);
  const p7 = pattern.slice(0, 7);
  const segmentPattern = /[xX]/.test(p7) ? p7 : '';

  const suffixes = valid ? buildSuffixes(tail) : [];
  const matched = state.segments.length
    ? filterSegments(segmentPattern, state.segments)
    : [];
  const total = matched.length * suffixes.length;
  const preview = matched.length && suffixes.length
    ? crossProduct(matched, suffixes, PREVIEW_LIMIT)
    : [];

  return {
    pattern, valid, prefix3, mid4, tail,
    segmentPattern, suffixes, matched, total, preview,
  };
}

/* ---------------- 渲染 ---------------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function themeIcon(theme) {
  return theme === 'auto' ? '◐' : theme === 'light' ? '☀' : '☾';
}

function themeLabel(theme) {
  return theme === 'auto' ? '跟随系统' : theme === 'light' ? '浅色' : '深色';
}

function sectionPattern(d) {
  return `
  <section class="card">
    <div class="card__header">
      <h2 class="card__title">号码模式</h2>
      <span class="badge">x = 任意数字</span>
    </div>
    <p class="card__desc">
      例：<span class="mono">133xxxxxx33</span> → 前 3 位固定，中间 4–6 位任意，后 3 位固定。
    </p>

    <div class="field">
      <div class="field__box${d.valid ? ' filled' : ' invalid'}">
        <input id="f-pattern" value="${esc(state.pattern)}" spellcheck="false"
               autocomplete="off" inputmode="text" aria-label="模式串">
      </div>
      <label class="field__label" for="f-pattern">模式串</label>
      <div class="field__support${d.valid ? '' : ' error'}">
        ${d.valid
          ? `前 3 位 ${esc(d.prefix3 || '—')} · 中段 ${esc(d.mid4 || '（空）')} · 后段 ${esc(d.tail || '（空）')}`
          : '只允许数字与 x（x 可分段出现，如 133xxxxxx33）'}
      </div>
    </div>

    <div class="field">
      <div class="field__box${state.region ? ' filled' : ''}">
        <input id="f-region" value="${esc(state.region)}" spellcheck="false"
               autocomplete="off" aria-label="地区">
      </div>
      <label class="field__label" for="f-region">地区（号段页路径里的省份名）</label>
      <div class="field__support">
        ${d.prefix3
          ? `将请求 telphone.cn/prefix/${esc(state.region + d.prefix3)}/`
          : '填好模式串前 3 位后自动拼出请求地址'}
      </div>
    </div>

    <div class="chip-set">
      ${REGION_PRESETS.map((r) => `
        <button class="chip${state.region === r ? ' active' : ''}" data-region="${esc(r)}">${esc(r)}</button>
      `).join('')}
    </div>

    <div class="actions">
      <button class="btn btn--filled" id="btn-fetch" ${state.loading ? 'disabled' : ''}>
        ${state.loading ? '抓取中…' : '抓取号段'}
      </button>
      <button class="btn btn--outlined" id="btn-manual">
        ${state.manualOpen ? '收起手动输入' : '手动粘贴号段'}
      </button>
      <div class="spacer"></div>
      <button class="btn btn--text" id="btn-reset">重置</button>
    </div>

    ${state.loading ? '<div class="linear"><div class="linear__bar"></div></div>' : ''}

    ${state.manualOpen ? `
      <div class="divider"></div>
      <textarea class="raw" id="f-manual"
        placeholder="粘贴号段页 HTML，或直接粘 7 位号段列表（每行一个 / 空格分隔）">${esc(state.manualText)}</textarea>
      <div class="actions">
        <button class="btn btn--tonal" id="btn-apply-manual">从粘贴内容解析</button>
      </div>
    ` : ''}
  </section>`;
}

function sectionOverview(d) {
  const noProxy = !hasProxy();
  return `
  <section class="card card--filled">
    <div class="card__header">
      <h2 class="card__title">结果概览</h2>
      ${state.fetchedUrl ? `<span class="badge mono" title="${esc(state.fetchedUrl)}">${esc(
        state.fetchedUrl.length > 44 ? state.fetchedUrl.slice(0, 44) + '…' : state.fetchedUrl
      )}</span>` : ''}
    </div>

    <div class="stat-grid">
      <div class="stat"><span class="stat__value">${fmt(state.segments.length)}</span><span class="stat__label">抓到的号段</span></div>
      <div class="stat"><span class="stat__value">${fmt(d.matched.length)}</span><span class="stat__label">模式命中号段</span></div>
      <div class="stat"><span class="stat__value">${fmt(d.suffixes.length)}</span><span class="stat__label">后段组合</span></div>
      <div class="stat stat--accent"><span class="stat__value">${fmt(d.total)}</span><span class="stat__label">号码总数（交叉积）</span></div>
    </div>

    <div class="actions">
      <button class="btn btn--filled" id="btn-txt" ${d.total ? '' : 'disabled'}>导出 txt.txt</button>
      <button class="btn btn--elevated" id="btn-vcf" ${d.total ? '' : 'disabled'}>导出 vcf.vcf</button>
      <div class="spacer"></div>
      <button class="btn btn--text" id="btn-copy" ${d.matched.length ? '' : 'disabled'}>复制号段</button>
    </div>

    ${noProxy ? `<div class="hint">当前以 <span class="mono">file://</span> 打开，抓取会因自签证书失败；需要抓号段请用 <span class="mono">node server/serve.mjs</span> 起本地服务。</div>` : ''}
  </section>`;
}

function sectionSegments(d) {
  const list = d.matched.slice(0, SEGMENT_CHIP_LIMIT);
  const more = d.matched.length - list.length;
  return `
  <section class="card card--filled">
    <div class="card__header">
      <h2 class="card__title">命中号段</h2>
      <span class="badge">${d.matched.length}</span>
    </div>
    ${d.matched.length ? `
      <div class="chip-set chip-set--scroll">
        ${list.map((s) => `<span class="chip mono">${esc(s)}</span>`).join('')}
        ${more > 0 ? `<span class="chip">+${more}</span>` : ''}
      </div>
    ` : '<div class="result-empty">还没有命中号段。先抓取号段，或把手里的号段粘进来。</div>'}
  </section>`;
}

function sectionPreview(d) {
  return `
  <section class="card">
    <div class="card__header">
      <h2 class="card__title">号码预览</h2>
      <span class="badge">前 ${Math.min(PREVIEW_LIMIT, d.total)} / ${fmt(d.total)}</span>
    </div>
    ${d.preview.length ? `
      <div class="result-list">
        ${d.preview.map((n, i) => `
          <div class="result-row">
            <span class="result-row__idx">${i + 1}</span>
            <span class="result-row__num mono">${esc(n)}</span>
          </div>
        `).join('')}
      </div>
    ` : '<div class="result-empty">导出前这里会显示生成的号码。</div>'}
    <div class="hint">
      导出文件与脚本行为一致：<span class="mono">txt.txt</span> 每行一个号码；
      <span class="mono">vcf.vcf</span> 为 VCARD 3.0 条目。
    </div>
  </section>`;
}

function render() {
  const d = derived();
  root.innerHTML = `
    <div class="app">
      <header class="top-app-bar${window.scrollY > 4 ? ' scrolled' : ''}">
        <div class="top-app-bar__leading">号</div>
        <div class="top-app-bar__title">
          号码工坊
          <span class="top-app-bar__subtitle">号段解析 · 模式补全 · txt / vcf 导出</span>
        </div>
        <button class="icon-btn" id="btn-theme" title="主题：${themeLabel(state.theme)}" aria-label="切换主题">
          ${themeIcon(state.theme)}
        </button>
      </header>

      <main class="page">
        ${sectionPattern(d)}
        ${sectionOverview(d)}
        ${sectionSegments(d)}
        ${sectionPreview(d)}
      </main>

      <div class="snackbar" id="snackbar" role="status" aria-live="polite"></div>
    </div>`;
}

/* ---------------- 局部更新：避免整页重绘吃掉输入焦点 ---------------- */

function refreshDerivedOnly() {
  // 只重建后三张卡片；"号码模式"卡片里的输入框保持原节点，焦点不丢
  const page = root.querySelector('.page');
  if (!page) {
    render();
    bindAll();
    return;
  }
  const d = derived();
  const cards = page.querySelectorAll(':scope > section.card');
  if (cards.length !== 4) {
    render();
    bindAll();
    return;
  }
  cards[1].outerHTML = sectionOverview(d);
  cards[2].outerHTML = sectionSegments(d);
  cards[3].outerHTML = sectionPreview(d);
  // 输入框没被重建，只需重挂卡片里的按钮
  bindDynamic();
}

/* ---------------- 交互 ---------------- */

function toast(text, isError = false) {
  const el = root.querySelector('#snackbar');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  if (snackTimer) clearTimeout(snackTimer);
  snackTimer = setTimeout(() => el.classList.remove('show'), 3600);
}

function applyTheme() {
  const html = document.documentElement;
  if (state.theme === 'auto') html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', state.theme);
}

function syncPatternField() {
  const d = derived();
  const box = root.querySelector('.field__box');
  const support = root.querySelector('.field__support');
  if (box) {
    box.classList.toggle('invalid', !d.valid);
    box.classList.toggle('filled', d.valid);
  }
  if (support) {
    support.classList.toggle('error', !d.valid);
    support.textContent = d.valid
      ? `前 3 位 ${d.prefix3 || '—'} · 中段 ${d.mid4 || '（空）'} · 后段 ${d.tail || '（空）'}`
      : '只允许数字与 x（x 可分段出现，如 133xxxxxx33）';
  }
  const regionSupport = root.querySelectorAll('.field__support')[1];
  if (regionSupport) {
    regionSupport.textContent = d.prefix3
      ? `将请求 telphone.cn/prefix/${state.region}${d.prefix3}/`
      : '填好模式串前 3 位后自动拼出请求地址';
  }
}

async function doFetch() {
  const d = derived();
  if (!d.valid) return toast('模式串格式不对：只允许数字与 x', true);
  if (!d.prefix3) return toast('前 3 位不能为空', true);

  if (abortCtl) abortCtl.abort();
  abortCtl = new AbortController();
  state.loading = true;
  render();
  bindAll();

  try {
    const r = await fetchSegments(state.region, d.prefix3, { signal: abortCtl.signal });
    state.segments = r.segments;
    state.fetchedUrl = r.url;
    state.loading = false;
    render();
    bindAll();
    if (!r.segments.length) {
      toast(`页面返回 ${r.status}，没解析到 7 位号段，可换地区或手动粘贴`, true);
    } else {
      toast(`抓到 ${r.segments.length} 个号段`);
    }
  } catch (e) {
    state.loading = false;
    state.segments = [];
    render();
    bindAll();
    const msg = e && e.name === 'AbortError' ? '抓取已取消' : '抓取失败：' + (e.message || e);
    toast(msg, true);
  }
}

function applyManual() {
  const ta = root.querySelector('#f-manual');
  const text = ta ? ta.value : state.manualText;
  state.manualText = text;

  const fromHtml = extractSegments(text);
  if (fromHtml.length) {
    state.segments = fromHtml;
    state.fetchedUrl = '手动粘贴';
    state.manualOpen = false;
    render();
    bindAll();
    return toast(`从粘贴内容解析到 ${fromHtml.length} 个号段`);
  }

  const lines = text.split(/[\s,;]+/).map((s) => s.trim()).filter((s) => /^\d{7}$/.test(s));
  const uniq = Array.from(new Set(lines)).sort();
  if (uniq.length) {
    state.segments = uniq;
    state.fetchedUrl = '手动粘贴';
    state.manualOpen = false;
    render();
    bindAll();
    return toast(`识别到 ${uniq.length} 个 7 位号段`);
  }
  toast('粘贴内容里没找到 7 位号段', true);
}

function exportFile(kind) {
  const d = derived();
  if (!d.total) return toast('没有可导出的号码', true);

  // 大集合会让主线程卡顿，先给出反馈再算
  toast(kind === 'txt' ? '正在生成 txt…' : '正在生成 vcf…');
  setTimeout(() => {
    const content = kind === 'txt'
      ? buildTxt(d.matched, d.suffixes)
      : buildVcf(d.matched, d.suffixes);
    const name = kind === 'txt' ? 'txt.txt' : 'vcf.vcf';
    const mime = kind === 'txt' ? 'text/plain' : 'text/vcard';
    download(name, content, mime);
    toast(`已导出 ${name}（${fmt(d.total)} 条）`);
  }, 30);
}

/** 每次整页重绘后重新挂监听 */
function bindDynamic() {
  const on = (sel, ev, fn) => {
    const el = root.querySelector(sel);
    if (el) el.addEventListener(ev, fn);
  };

  on('#btn-fetch', 'click', doFetch);
  on('#btn-manual', 'click', () => {
    state.manualOpen = !state.manualOpen;
    render(); bindAll();
  });
  on('#btn-reset', 'click', () => {
    Object.assign(state, {
      pattern: '13xxxxxxxxx', region: '北京', segments: [],
      fetchedUrl: '', manualOpen: false, manualText: '',
    });
    render(); bindAll();
  });
  on('#btn-apply-manual', 'click', applyManual);
  on('#btn-txt', 'click', () => exportFile('txt'));
  on('#btn-vcf', 'click', () => exportFile('vcf'));
  on('#btn-copy', 'click', async () => {
    const d = derived();
    const ok = await copyText(d.matched.join('\n'));
    toast(ok ? `已复制 ${d.matched.length} 个号段` : '复制失败，浏览器未授权剪贴板', !ok);
  });
  on('#btn-theme', 'click', () => {
    state.theme = state.theme === 'auto' ? 'light' : state.theme === 'light' ? 'dark' : 'auto';
    applyTheme();
    render(); bindAll();
  });

  root.querySelectorAll('[data-region]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.region = btn.getAttribute('data-region');
      render(); bindAll();
    });
  });
}

/** 输入框监听：每次整页重绘后都要重挂（render 会重建 input 节点） */
function bindInputs() {
  const patternInput = root.querySelector('#f-pattern');
  if (patternInput) {
    patternInput.addEventListener('input', (e) => {
      state.pattern = e.target.value;
      syncPatternField();
      refreshDerivedOnly();
    });
  }

  const regionInput = root.querySelector('#f-region');
  if (regionInput) {
    regionInput.addEventListener('input', (e) => {
      state.region = e.target.value.trim();
      syncPatternField();
      refreshDerivedOnly();
    });
  }

  const manual = root.querySelector('#f-manual');
  if (manual) manual.addEventListener('input', (e) => { state.manualText = e.target.value; });
}

/** 一次重绘后统一重绑（按钮 + 输入框） */
function bindAll() {
  bindDynamic();
  bindInputs();
}

let scrollBound = false;

export function mount(el) {
  root = el;
  applyTheme();

  // scroll 只在文档级挂一次，避免每次重绘重复注册
  if (!scrollBound) {
    scrollBound = true;
    window.addEventListener('scroll', () => {
      const bar = root.querySelector('.top-app-bar');
      if (bar) bar.classList.toggle('scrolled', window.scrollY > 4);
    }, { passive: true });
  }

  render();
  bindAll();
}
