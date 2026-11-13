# 号码工坊 · 静态网页版（web-static）

零构建工具的原生静态工程：只是一堆 `.html` / `.css` / `.js` 文件，改完刷新就能看到效果。
功能与 `123.py` 及 `android/` 版逐函数对齐。

## 目录

```
web-static/
├─ index.html            页面骨架（只有 #root 和一个 module script）
├─ css/
│  ├─ tokens.css         MD3 设计令牌：--md-sys-color-* / shape / motion（浅色 + 深色）
│  └─ app.css            组件样式：卡片 / 字段 / 按钮 / chip / 列表 / snackbar
├─ js/
│  ├─ main.js            入口，DOM 就绪后挂载
│  ├─ app.js             UI 层：渲染、事件、状态（原生 DOM，无框架）
│  ├─ core.js            纯逻辑：模式→正则、号段过滤、后段生成、交叉积、txt/vcf
│  ├─ api.js             抓取号段（同源代理 / file:// 直连兜底）
│  └─ io.js              下载、复制剪贴板、千分位
└─ server/
   └─ serve.mjs          本地服务：静态托管 + /api/telphone/* 代理
```

## 运行

**方式一：本地服务（推荐，抓取可用）**

```bash
node server/serve.mjs                 # → http://127.0.0.1:5186
PORT=8080 HOST=0.0.0.0 node server/serve.mjs
```

**方式二：双击 index.html（file:// 直接打开）**

界面、手动粘贴号段、生成与导出全部可用；只有"抓取号段"会失败，原因是
浏览器会因自签证书拒绝直连 `https://telphone.cn`，页面上会显示对应提示。

不需要 `npm install`，没有任何依赖。

## 为什么必须走本地服务抓取

`telphone.cn` 的三条硬规矩：

| 规矩 | 表现 |
|---|---|
| 只认 80 明文 | `https://telphone.cn/prefix/北京133/` 返回 404（443 是自签证书 + 不同路径映射） |
| 必须带 `Accept-Encoding: gzip` | 缺这个头直接 `403 Access Denied. Gzip compression is required.` |
| 号段在 `/prefix/{地区}{前3位}/` | `/prefix/133/` 只是省份索引页，不含 7 位号段 |

浏览器无法伪造这些请求头并绕过证书校验，所以 `server/serve.mjs` 用 node 转发。
实测 `http://telphone.cn/prefix/北京133/` → 405 个 7 位号段。

## 模式串语义

| 写法 | 含义 |
|---|---|
| `13xxxxxxxxx` | 前 2 位固定，其余 9 位任意 |
| `133xxxxxx33` | 前 3 位固定；中间 4 位任意；后 3 位 `33` |
| `133xxxxxxxx` | 前 3 位固定，后 8 位任意 |

`x` 可分段出现（大小写均可）。只有模式串前 7 位里含 `x` 时才过滤号段列表，
否则直接用整份号段 —— 与 `123.py` 里 `QQW(phonex[:7])` 的调用条件一致。

号码总数 = 命中号段数 × 后段组合数。

## 导出

| 文件 | 格式 |
|---|---|
| `txt.txt` | 每行一个号码，末尾换行 |
| `vcf.vcf` | VCARD 3.0，字段顺序与脚本一致：`BEGIN / VERSION / N / FN / TEL / END` |

实测（模式 `133xxxxxx33`、地区北京）：405 × 100 = 40,500 条，
`txt.txt` 486,000 字节、`vcf.vcf` 4,617,000 字节，
与 `android/` 版实机导出**字节完全一致**。

## 界面

![静态版浅色](<../docs/static-light.png>)

- 主题三态循环：跟随系统 → 浅色 → 深色（紫色 `#6750A4` 基线始终保留，不跟随壁纸）
- 输入时只重建后三张卡片，`号码模式` 卡片里的输入框不重建，焦点与光标不丢
- 响应式：≤560px 单列、≤360px 收窄内边距

## 与 web/（React 版）的区别

| | `web-static/`（本目录） | `web/` |
|---|---|---|
| 依赖 | 无 | React 18 + Vite + TypeScript |
| 构建 | 不需要，改完刷新即可 | `npm install && npm run build` |
| 体积 | index.html + 28 KB css/js | 打包后 ~163 KB 单文件 |
| 逻辑来源 | `js/core.js` | `src/core.ts` |

两个版本共用同一套 `css/tokens.css` 令牌与 `css/app.css` 组件样式，界面一致。
