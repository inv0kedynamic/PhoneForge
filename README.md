# 号码工坊 · PhoneForge

`123.py` 的多端实现：Android（Kotlin + Jetpack Compose Material3）+ 静态网页（原生 JS/CSS）+ React 网页。
功能与脚本一一对应：抓号段页 → 按号码模式过滤 → 交叉生成 → 导出 `txt.txt` / `vcf.vcf`。

- Android 包名：`dev.yuxing.software`
- 网页部署：Cloudflare Workers（Worker + `web-static/` 静态资产）
- 仓库：<https://github.com/inv0kedynamic/PhoneForge>
- 安装包：<https://github.com/inv0kedynamic/PhoneForge/releases/tag/v1.0>

部署步骤见 [`docs/deploy-cloudflare.md`](docs/deploy-cloudflare.md)。

## 目录

```
PhoneForge/
├─ web-static/              ★ 网页主版本：零依赖、零构建，纯 js/css
│  ├─ index.html
│  ├─ css/tokens.css        MD3 紫色令牌（浅 / 深两套）
│  ├─ css/app.css           组件样式
│  ├─ js/core.js            核心逻辑，与 123.py 逐函数对应
│  ├─ js/api.js             抓取（同源代理 / file:// 兜底）
│  ├─ js/io.js              下载、剪贴板、格式化
│  ├─ js/app.js             UI 渲染 + 事件
│  ├─ js/main.js            入口
│  └─ server/serve.mjs      本地服务（静态 + 号段代理）
├─ src/index.js             Cloudflare Worker 入口：/api/telphone/* 代理
├─ web/                     React 18 + Vite + TS 版（可选，需 npm install）
├─ android/                 Android 版
│  └─ app/src/main/java/dev/yuxing/software/
│     ├─ core/ForgeCore.kt  与 js/core.js 同一套逻辑
│     ├─ core/Exporter.kt   MediaStore 写「下载」目录
│     ├─ data/SegmentApi.kt HttpURLConnection + gzip 解压
│     ├─ ui/ForgeViewModel.kt
│     ├─ ui/ForgeScreen.kt  Compose Material3 页面
│     └─ ui/theme/Theme.kt  紫色 lightColorScheme / darkColorScheme
├─ docs/                    截图与样例产物
├─ wrangler.toml            Cloudflare Workers 配置（Worker + 静态资产）
└─ dist/                    已构建的 APK 与单文件网页
```

## 抓取源的三条硬规矩（所有端一致）

1. **只走 80 明文**。`https://telphone.cn` 是自签证书，且 `/prefix/{地区}{前3位}/` 在 https 下返回 404。
2. **必须带 `Accept-Encoding: gzip`**，否则 nginx 直接 `403 Access Denied. Gzip compression is required.`
3. 号段列表在 `/prefix/{地区}{前3位}/` 页面里；`/prefix/133/` 只是省份索引页。

实测：`http://telphone.cn/prefix/北京133/` → 405 个 7 位号段。

## 网页（静态版，推荐）

```bash
cd web-static
node server/serve.mjs        # → http://127.0.0.1:5186
```

零依赖，不需要 `npm install`。双击 `index.html` 也能用（界面 / 手动粘贴 / 生成 / 导出），
只有抓取会因自签证书失败并给出提示。

## 网页（React 版，可选）

```bash
cd web
npm install                  # 本机 F: 是 exFAT，不可用 pnpm（symlink 会失败）
npm run build                # tsc -b && vite build
node server/proxy.mjs        # http://127.0.0.1:5185
npm run build:single         # 单文件版 → dist-single/index.html
```

## 部署到 Cloudflare Workers

仓库是 **Worker + 静态资产** 模型，对应 Workers Builds 默认的 `npx wrangler deploy`。

| 路径 | 处理 |
|---|---|
| `/api/telphone/*` | `src/index.js` 代理到 `http://telphone.cn/*`（gzip + 80 明文） |
| 其余 | `env.ASSETS` → `web-static/` 静态文件 |

Dashboard 只需三项：

| 配置项 | 值 |
|---|---|
| Build command | 留空 |
| Deploy command | `npx wrangler deploy`（默认） |
| Root directory | 仓库根 |

本地验证：`npx wrangler dev` → http://localhost:8787

完整说明（含之前 `Missing entry-point` 失败的原因）见
[`docs/deploy-cloudflare.md`](docs/deploy-cloudflare.md)。

## Android

```bash
cd android
gradle :app:assembleRelease    # 本机中文路径下 gradlew.bat 无法定位 wrapper jar
```

产物：`android/app/build/outputs/apk/release/app-release.apk`

- 包名 `dev.yuxing.software`，minSdk 24，targetSdk 35
- 签名密钥在 `android/app/keystore/phoneforge.jks`（已 gitignore，口令 `phoneforge`）
- 本机环境注意：`gradle.properties` 必须保留 `android.overridePathCheck=true`；
  `local.properties` 的 `sdk.dir` 需转义反斜杠

### 导出位置

- Android 10+：`下载/txt.txt`、`下载/vcf.vcf`（MediaStore，无需存储权限）
- Android 7–9：应用外部私有目录，路径在 snackbar 里提示

## 模式串语义

| 写法 | 含义 |
|---|---|
| `13xxxxxxxxx` | 前 2 位固定，其余 9 位任意 |
| `133xxxxxx33` | 前 3 位固定；中间 4 位任意；后 3 位 `33` |
| `133xxxxxxxx` | 前 3 位固定，后 8 位任意 |

`x` 可分段出现（大小写均可）。只有前 7 位里含 `x` 时才过滤号段列表，否则直接用整份号段
—— 与 `123.py` 里 `QQW(phonex[:7])` 的调用条件一致。

号码总数 = 命中号段数 × 后段组合数。

## 验证数据

模式 `133xxxxxx33` + 地区「北京」，在 Android（Pixel 6 / API 35 模拟器）与网页两端实测：

| 项 | 值 |
|---|---|
| 抓到号段 | 405 |
| 命中号段 | 405 |
| 后段组合 | 100 |
| 号码总数 | 40,500 |
| `txt.txt` | 486,000 B / 40,500 行 |
| `vcf.vcf` | 4,617,000 B / 40,500 条 VCARD |

两端导出的 `txt.txt` 与 `vcf.vcf` **字节完全一致**。核心逻辑 11 项单元测试通过。

## 主题

![静态版浅色](<docs/static-light.png>)
![Web 浅色](<docs/web-light.png>)
![Android 浅色](<docs/android-home.png>)

紫色基线 seed `#6750A4`（Material Theme Builder 默认紫）。

- Compose：`PhoneForgeTheme(useDynamicColor = false)` —— 默认关动态取色，否则壁纸会把紫色冲掉
- Web：`:root` 全部 `--md-sys-color-*`，深色走 `[data-theme='dark']` 与 `prefers-color-scheme`
- 各端同一套 tonal palette，浅 / 深 / 跟随系统行为一致
