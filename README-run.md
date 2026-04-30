**方式一：完整本地开发（推荐）**

这种方式会同时启动前端和 Worker，模拟真实的 Cloudflare 环境：

```shell
# 1. 先构建 Dashboard 静态文件
pnpm build-dashboard

# 2. 启动 Worker 本地开发（包含前端静态资源服务）
cd packages/worker/dev && wrangler dev
```

Worker dev 配置（packages/worker/dev/wrangler.toml）会自动：

- serving Dashboard 静态文件（从 ../../dashboard/dist/spa）
- 提供 R2 bucket bindings（本地模拟）
- 运行 API 端点 (/api/*, /share/*)

**方式二：仅启动前端开发**

适合只开发前端 UI，不需要真实 R2 API：

```shell
# 1. 创建 .env 文件（从 example 复制）
cd packages/dashboard
cp .env.example .env

# 2. 编辑 .env，配置 Server URL（指向真实 API 或本地 Worker）
VUE_APP_SERVER_URL=http://localhost:8787  # 本地 Worker
# 或
VUE_APP_SERVER_URL=https://your-r2-explorer.example.com  # 真实部署

# 3. 启动前端开发服务器
pnpm --filter r2-explorer-dashboard dev
```

这会启动 Quasar dev server（默认端口 9000），自动打开浏览器。


**测试**
```shell
pnpm test:e2e
```
