# 部署到 Cloudflare Pages

## Dashboard 方式（推荐，一次配置后自动部署）

### 1. 连接仓库

1. 打开 <https://dash.cloudflare.com/> → 左侧 **Workers & Pages**
2. **Create** → **Pages** → **Connect to Git**
3. 授权 GitHub，选择仓库 `inv0kedynamic/PhoneForge`，分支 `main`

### 2. 构建设置

| 配置项 | 填什么 |
|---|---|
| Framework preset | `None` |
| Build command | **留空**（静态工程，无需构建） |
| Build output directory | `web-static` |
| Root directory | **留空**（仓库根） |

> `functions/` 目录会被 Pages 自动识别，不需要额外配置。
> 部署后 `/api/telphone/*` 会由 `functions/api/telphone/[[...path]].js` 接管。

### 3. 部署

点 **Save and Deploy**。首次构建约 20 秒，完成后域名形如：

```
https://phoneforge.pages.dev
```

之后每次推 `main` 且 `web-static/` 或 `functions/` 有变动，都会自动重新部署。

### 4. 验证清单

部署完打开站点，逐项确认：

- [ ] 页面正常渲染，紫色 MD3 样式生效
- [ ] 输入 `133xxxxxx33`，后段组合显示 **100**
- [ ] 地区选北京，点「抓取号段」→ 提示「抓到 405 个号段」
- [ ] 号码总数显示 **40,500**
- [ ] 点「导出 txt.txt」→ 下载 486,000 字节、40,500 行
- [ ] 点「导出 vcf.vcf」→ 下载 4,617,000 字节、40,500 条 VCARD
- [ ] 右上角切换主题，浅色 / 深色 / 跟随系统三态正常

若「抓取号段」报错，先直接访问一次：

```
https://<你的域名>/api/telphone/prefix/北京133/
```

应该返回约 104 KB 的 HTML 且含大量 `133xxxxx`。返回 502 说明 Functions
出网被拦或上游站点变更。

## 命令行方式（备选）

```bash
npx wrangler login                       # 浏览器授权一次
npx wrangler pages deploy web-static --project-name=phoneforge
```

`wrangler.toml` 里已经写好 `pages_build_output_dir = "web-static"`，
所以也可以直接：

```bash
npx wrangler pages deploy
```

## GitHub Actions 方式（可选）

`.github/workflows/pages.yml` 已准备好。启用需要在仓库
**Settings → Secrets and variables → Actions** 添加：

| Secret | 获取方式 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | CF Dashboard → My Profile → API Tokens → Create Token → 模板选 **Cloudflare Pages:Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | CF Dashboard 右侧栏 Account ID，或任意 Zone 的概览页 |

加好后在 Actions 页手动 Run 一次，或推一次 `web-static/` 的改动。

## 自定义域名

1. Pages 项目 → **Custom domains** → **Set up a custom domain**
2. 输入域名（如 `pf.example.com`），按提示在 DNS 加 CNAME 指向
   `<project>.pages.dev`
3. 若域名已托管在同一个 Cloudflare 账号，会自动加记录，等证书签发（约 1 分钟）

## 已知限制

- 抓取依赖 `telphone.cn` 可达；该站点只认 80 明文、强制 gzip，Functions 已按此实现
- CF Pages Functions 单次请求免费额度充裕，但不要做高频批量抓取
- 站点是纯静态前端 + 一个代理函数，不存任何数据
