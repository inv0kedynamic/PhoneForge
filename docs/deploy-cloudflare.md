# 部署到 Cloudflare

仓库目前是 **Worker + 静态资产** 模型，对应 Workers Builds 默认的
`npx wrangler deploy`。这也是你在 Cloudflare 上已经配置好的部署命令，
不需要改 Dashboard 的 Deploy command。

## 为什么之前会失败

```
Executing user deploy command: npx wrangler deploy
✘ [ERROR] Missing entry-point to Worker script or to assets directory
```

因为当时仓库里的 `wrangler.toml` 是 **Pages** 配置（`pages_build_output_dir`），
而 `wrangler deploy` 是 **Workers** 的部署命令。Workers 需要两样东西之一：

- `main = "入口文件"`（Worker 脚本）
- `[assets] directory = "..."`（静态资产目录）

两者都没有，于是报 `Missing entry-point`。

## 现在的配置

`wrangler.toml`：

```toml
name = "phoneforge"
main = "src/index.js"

[assets]
directory = "./web-static"
binding = "ASSETS"
not_found_handling = "single-page-application"
```

`src/index.js` 同时承担两件事：

| 路径 | 处理 |
|---|---|
| `/api/telphone/*` | 代理到 `http://telphone.cn/*`（带 gzip 头，80 明文） |
| 其余 | 交给 `env.ASSETS.fetch(request)`，即 `web-static/` 静态文件 |

## Dashboard 设置（确认这三项）

| 配置项 | 值 |
|---|---|
| Build command | 留空 |
| Deploy command | `npx wrangler deploy`（默认，保持不变） |
| Root directory | 仓库根（留空） |

推 `main` 就会自动部署。Worker 名称来自 `wrangler.toml` 的 `name = "phoneforge"`，
最终域名形如 `https://phoneforge.<你的子域>.workers.dev`。

> 如果项目名和 `wrangler.toml` 里的 `name` 不一致，wrangler 会提示；
> 以配置文件为准，或把配置里的 name 改成 Dashboard 上那个。

## 本地验证

```bash
npx wrangler dev          # → http://localhost:8787
```

实测（本机）：

| 请求 | 结果 |
|---|---|
| `GET /` | 200，1584 B |
| `GET /css/app.css` | 200，12,382 B |
| `GET /js/app.js` | 200，15,994 B |
| `GET /api/telphone/prefix/北京133/` | 200，103,981 B，405 个号段 |

浏览器端完整链路：输入 `133xxxxxx33` → 抓取 → 405 / 405 / 100 / **40,500**，
导出按钮可用。

## 部署后验证清单

- [ ] 首页正常渲染，紫色 MD3 样式生效
- [ ] 输入 `133xxxxxx33`，后段组合显示 **100**
- [ ] 地区北京，点「抓取号段」→ 提示「抓到 405 个号段」
- [ ] 号码总数 **40,500**
- [ ] 「导出 txt.txt」→ 486,000 B / 40,500 行
- [ ] 「导出 vcf.vcf」→ 4,617,000 B / 40,500 条 VCARD
- [ ] 主题三态切换正常

若抓取失败，先直接访问：

```
https://<你的域名>/api/telphone/prefix/北京133/
```

应返回约 104 KB HTML 且含大量 `133xxxxx`。

## 备选：改用 Pages 部署

如果更想用 Pages，需要把 Dashboard 的 Deploy command 改成：

```bash
npx wrangler pages deploy web-static --project-name=phoneforge
```

同时把 `wrangler.toml` 换回 Pages 形态（`pages_build_output_dir = "web-static"`），
并把抓取代理放回 `functions/api/telphone/_middleware.js`。
**注意**：方括号文件名 `[[...path]].js` 在 Windows 下的 wrangler 会构建失败，
必须用 `_middleware.js`。

两套模型不要混用 —— 混用就会出现这次 `Missing entry-point` 的错误。

## 命令行手动部署

```bash
npx wrangler login
npx wrangler deploy
```

## 自定义域名

Workers 项目 → **Settings → Domains & Routes** → **Add custom domain**。
若域名托管在同一 Cloudflare 账号，会自动加 DNS 记录，证书约 1 分钟签发。
