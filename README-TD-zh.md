# R2-Explorer 技术设计文档

## 1. 系统概述

R2-Explorer 是一个类似 Google Drive 的 Cloudflare R2 存储桶管理界面。它由两个主要组件构成：

- **Worker（后端）**：Cloudflare Worker 提供 R2 操作的 REST API
- **Dashboard（前端）**：Vue 3 + Quasar SPA 提供文件管理 UI

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Cloudflare Edge                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Worker (Hono 框架)                        ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ ││
│  │  │   API 路由      │  │  认证中间件     │  │  Dashboard   │ ││
│  │  │  (OpenAPI/REST) │  │  (Basic/CF Acc) │  │  (静态资源)  │ ││
│  │  └─────────────────┘  └─────────────────┘  └──────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      R2 存储桶                               ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   ││
│  │  │  文件        │  │  元数据      │  │  分享链接        │   ││
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 2. 技术栈

### 前端 (Dashboard)

| 技术 | 版本 | 用途 |
|------------|---------|---------|
| Vue 3 | ^3.5.13 | 核心框架 |
| Quasar | ^2.17.5 | UI 组件库 |
| Pinia | ^2.2.8 | 状态管理 |
| Vue Router | ^4.2.5 | 路由 |
| vue-i18n | ^11.4.0 | 国际化 |
| Axios | ^1.2.1 | HTTP 客户端 |
| Vitest | ^3.2.4 | 单元测试 |
| Playwright | ^1.58.2 | E2E 测试 |

### 后端 (Worker)

| 技术 | 版本 | 用途 |
|------------|---------|---------|
| Hono | - | Web 框架 |
| chanfana | - | OpenAPI 集成 |
| Zod | - | Schema 验证 |
| Wrangler | ^4.20.1 | Cloudflare CLI |

## 3. 项目结构

```
jc-r2-explorer/
├── packages/
│   ├── dashboard/          # Vue 前端 SPA
│   │   ├── src/
│   │   │   ├── boot/       # Quasar 启动文件 (axios, auth, bus, i18n)
│   │   │   ├── components/ # Vue 组件
│   │   │   │   ├── files/  # 文件操作 (Create, Share, Options)
│   │   │   │   ├── main/   # 布局 (Topbar, LeftSidebar)
│   │   │   │   ├── preview/# 文件预览组件
│   │   │   │   └── utils/  # 工具组件 (DragAndDrop)
│   │   │   ├── locales/    # i18n 翻译文件 (en.json, zh.json)
│   │   │   ├── pages/      # 路由页面
│   │   │   │   ├── auth/   # 登录页
│   │   │   │   ├── email/  # 邮件路由页面
│   │   │   │   └── files/  # 文件浏览页面
│   │   │   ├── stores/     # Pinia 状态管理 (auth, main)
│   │   │   ├── router/     # Vue 路由配置
│   │   │   └── appUtils.js # API 处理工具
│   │   ├── tests/          # 单元/组件测试
│   │   ├── e2e/            # Playwright E2E 测试
│   │   └── quasar.config.js
│   │
│   ├── worker/             # Cloudflare Worker 后端
│   │   ├── src/
│   │   │   ├── index.ts    # 主入口点 (R2Explorer 工厂函数)
│   │   │   ├── types.d.ts  # TypeScript 类型定义
│   │   │   ├── foundation/ # 核心基础设施
│   │   │   │   ├── middleware/ # 认证、只读中间件
│   │   │   │   └── settings/    # 配置
│   │   │   └── modules/    # 功能模块
│   │   │       ├── buckets/ # R2 操作 (CRUD, 分享, 分片上传)
│   │   │       ├── emails/  # 邮件路由处理
│   │   │       ├── server/  # 服务信息 API
│   │   │       └── dashboard/# Dashboard 服务
│   │   ├── tests/          # 集成测试
│   │   └── dev/            # 本地开发配置
│   │
│   ├── docs/               # 文档站点
│   └── github-action/      # CI/CD 部署 Action
│
├── template/               # 自托管模板
│   ├── src/index.ts        # 用户配置入口
│   ├── wrangler.toml       # Cloudflare 配置
│   └── .dev.vars           # 本地开发密钥
│
└── pnpm-workspace.yaml     # Monorepo 配置
```

## 4. 核心组件设计

### 4.1 Worker API 架构

Worker 使用 Hono 框架配合 OpenAPI (chanfana) 提供结构化的 REST API：

```typescript
// 入口工厂模式 (packages/worker/src/index.ts:41-169)
export function R2Explorer(config?: R2ExplorerConfig) {
  const app = new Hono<{ Bindings: AppEnv; Variables: AppVariables }>();
  
  // 中间件链
  app.use("*", configMiddleware);
  app.use("/api/*", corsMiddleware);      // 可选 CORS
  app.use("/api/*", readonlyMiddleware);   // 可选只读
  app.use("/api/*", authMiddleware);       // Basic Auth 或 CF Access
  
  // API 路由 (OpenAPI 文档化)
  openapi.get("/api/buckets/:bucket", ListObjects);
  openapi.post("/api/buckets/:bucket/upload", PutObject);
  openapi.post("/api/buckets/:bucket/delete", DeleteObject);
  // ... 更多路由
  
  return { fetch, email };
}
```

### 4.2 认证流程

支持两种认证方式：

**1. Basic 认证** (`packages/worker/src/index.ts:91-119`)
```typescript
app.use("/api/*", basicAuth({
  verifyUser: (username, password, c) => {
    const users = c.get("config").basicAuth;
    return users.some(u => u.username === username && u.password === password);
  }
}));
```

**2. Cloudflare Access** (`packages/worker/src/index.ts:82-89`)
```typescript
app.use("/api/*", cloudflareAccess(config.cfAccessTeamName));
app.use("/api/*", (c, next) => {
  c.set("authentication_type", "cloudflare-access");
  c.set("authentication_username", c.get("accessPayload").email);
  await next();
});
```

### 4.3 R2 存储桶操作

| 操作 | 端点 | 方法 | 描述 |
|-----------|----------|--------|-------------|
| 列出对象 | `/api/buckets/:bucket` | GET | 分页列出文件/文件夹 |
| 上传文件 | `/api/buckets/:bucket/upload` | POST | 单文件上传 |
| 分片上传 | `/api/buckets/:bucket/multipart/*` | POST | 大文件分块上传 |
| 删除对象 | `/api/buckets/:bucket/delete` | POST | 删除文件/文件夹 |
| 移动对象 | `/api/buckets/:bucket/move` | POST | 重命名/移动文件 |
| 复制对象 | `/api/buckets/:bucket/copy` | POST | 复制文件 |
| 创建文件夹 | `/api/buckets/:bucket/folder` | POST | 创建目录 |
| 获取对象 | `/api/buckets/:bucket/:key` | GET | 下载文件 |
| 更新元数据 | `/api/buckets/:bucket/:key` | POST | 编辑 HTTP/自定义元数据 |

### 4.4 分享链接系统

分享链接提供公开访问文件的能力，可选安全保护：

```typescript
// packages/worker/src/types.d.ts:28-37
interface ShareMetadata {
  bucket: string;        // 源存储桶
  key: string;           // 对象键名
  expiresAt?: number;    // 过期时间戳
  passwordHash?: string; // 可选密码保护
  maxDownloads?: number; // 下载次数限制
  currentDownloads: number;
  createdBy: string;     // 认证用户
  createdAt: number;     // 创建时间戳
}
```

| 操作 | 端点 | 需认证 |
|-----------|----------|---------------|
| 创建分享 | `/api/buckets/:bucket/:key/share` | 是 |
| 列出分享 | `/api/buckets/:bucket/shares` | 是 |
| 删除分享 | `/api/buckets/:bucket/share/:shareId` | 是 |
| 访问分享 | `/share/:shareId` | 否 (公开) |

### 4.5 邮件路由集成

Cloudflare Email Routing 将邮件发送到 Worker (`packages/worker/src/index.ts:158-164`)：

```typescript
async email(event, env, context) {
  await receiveEmail(event, env, context, config);
}
```

邮件存储在配置的 R2 存储桶中，附带元数据。

## 5. 前端架构

### 5.1 状态管理 (Pinia)

```
stores/
├── auth-store.js    # 认证状态 (loggedIn, user)
└── main-store.js    # 应用状态 (buckets, currentPath, selectedFiles)
```

### 5.2 组件层级

```
App.vue
├── layouts/
│   └── MainLayout.vue
│       ├── Topbar.vue          # 顶部栏（存储桶选择器、语言切换）
│       └── LeftSidebar.vue     # 导航菜单
│
├── pages/
│   ├── FilesFolderPage.vue     # 文件浏览器（表格视图）
│   ├── FileContextMenu.vue     # 右键菜单操作
│   ├── EmailFolderPage.vue     # 邮件列表
│   └── LoginPage.vue           # 认证页面
│
└── components/
    ├── files/
    │   ├── CreateFolder.vue    # 创建文件夹对话框
    │   ├── CreateFile.vue      # 创建文件对话框
    │   ├── FileOptions.vue     # 删除/重命名/元数据对话框
    │   └── ShareFile.vue       # 分享链接创建
    ├── preview/
    │   └── FilePreview.vue     # 文件查看器 (PDF, 图片, 文本)
    └── utils/
        └── DragAndDrop.vue     # 上传覆盖层
```

### 5.3 API 处理器 (`packages/dashboard/src/appUtils.js`)

集中式 API 通信，带认证：

```javascript
export const apiHandler = {
  // 存储桶操作
  listObjects: (bucket, prefix) => 
    axios.get(`/api/buckets/${bucket}`, { params: { prefix } }),
  
  uploadObject: (bucket, key, file) => 
    axios.post(`/api/buckets/${bucket}/upload`, formData),
  
  deleteObject: (bucket, key) => 
    axios.post(`/api/buckets/${bucket}/delete`, { keys: [key] }),
  
  // 分享操作
  createShare: (bucket, key, options) => 
    axios.post(`/api/buckets/${bucket}/${key}/share`, options),
  
  // 服务信息
  getServerConfig: () => axios.get('/api/server/config'),
};
```

### 5.4 国际化 (vue-i18n)

语言文件位于 `packages/dashboard/src/locales/`：

```json
// en.json
{
  "app.title": "R2 Explorer",
  "sidebar.files": "Files",
  "files.emptyFolder": "This folder is empty",
  "notifications.fileRenamed": "File renamed successfully"
}

// zh.json
{
  "app.title": "R2 浏览器",
  "sidebar.files": "文件",
  "files.emptyFolder": "此文件夹为空",
  "notifications.fileRenamed": "文件重命名成功"
}
```

## 6. 配置选项

### R2ExplorerConfig Schema (`packages/worker/src/types.d.ts:13-26`)

```typescript
interface R2ExplorerConfig {
  readonly?: boolean;           // 默认: true (禁用写操作)
  cors?: boolean;               // 启用 API 路由 CORS
  cfAccessTeamName?: string;    // Cloudflare Access 团队名
  dashboardUrl?: string;        // 自定义 Dashboard URL
  emailRouting?: {              // 邮件路由配置
    targetBucket: string;       // 邮件存储的 R2 存储桶
  } | false;
  showHiddenFiles?: boolean;    // 显示以 . 开头的文件
  basicAuth?: {                 // Basic 认证
    username: string;
    password: string;
  } | Array<{ username, password }>;
  buckets?: Record<string, {    // 单存储桶配置
    publicUrl?: string;         // 自定义公开 URL
  }>;
}
```

### 配置示例 (`template/src/index.ts`)

```typescript
export default R2Explorer({
  readonly: false,
  cors: true,
  showHiddenFiles: true,
  emailRouting: {
    targetBucket: "email-bucket"
  },
  basicAuth: {
    username: "jc",
    password: "secure-password"
  }
});
```

## 7. 部署架构

### 7.1 GitHub Action 部署 (`.github/workflows/deploy.yml`)

```yaml
jobs:
  deploy:
    steps:
      - name: Setup R2-Explorer
        env:
          R2EXPLORER_WORKER_NAME: ${{ vars.R2EXPLORER_WORKER_NAME }}
          R2EXPLORER_CONFIG: ${{ vars.R2EXPLORER_CONFIG }}
          R2EXPLORER_BUCKETS: ${{ vars.R2EXPLORER_BUCKETS }}
          CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
        run: node packages/github-action/prepareDeploy.js
      
      - name: Deploy
        uses: cloudflare/wrangler-action@v3
```

### 7.2 动态配置生成 (`packages/github-action/prepareDeploy.js`)

```javascript
// 从环境变量生成 wrangler.toml 和 src/index.ts

const wranglerConfig = `
name = "${R2EXPLORER_WORKER_NAME}"
compatibility_date = "2024-11-06"
main = "src/index.ts"
assets = { directory = "node_modules/r2-explorer/dashboard", ... }

[[r2_buckets]]
binding = '${alias}'
bucket_name = '${bucketName}'
`;

const indexContent = `
import { R2Explorer } from "r2-explorer";
export default R2Explorer(${R2EXPLORER_CONFIG});
`;
```

## 8. 测试策略

详见 [README-TDD-zh.md](./README-TDD-zh.md) 测试文档。

### 测试覆盖率要求

| 组件 | 最低覆盖率 |
|-----------|-----------------|
| Worker API 端点 | 90% |
| Vue 组件 | 80% |
| 工具函数 | 80% |

### 测试类型

1. **单元测试** (Vitest + happy-dom)
   - Dashboard 组件和状态管理
   
2. **集成测试** (vitest-pool-workers)
   - Worker API 与真实 R2 bindings
   
3. **E2E 测试** (Playwright)
   - 关键用户流程（上传、删除、分享）

## 9. 安全考量

### 9.1 认证

- **Basic Auth**：用户名/密码验证
- **Cloudflare Access**：企业 SSO 集成
- **公开路由**：分享链接公开访问（无需认证）

### 9.2 授权

- **只读模式**：通过中间件禁用写操作 (`packages/worker/src/foundation/middlewares/readonly.ts`)
- **存储桶访问**：同一认证适用于所有存储桶

### 9.3 数据保护

- **分享链接**：可选密码（哈希）和过期时间
- **下载限制**：追踪并执行最大下载次数
- **元数据**：HTTP 头和自定义元数据可编辑

## 10. 性能优化

### 10.1 Worker Edge 执行

- 运行在 Cloudflare edge（低延迟）
- R2 bindings 直接访问（无网络开销）
- 资源通过 ASSETS binding 服务（SPA 缓存）

### 10.2 前端优化

- Quasar 组件懒加载
- 资源缓存 (`cacheAssets` 配置)
- 大文件分片上传

### 10.3 R2 最佳实践

- 大存储桶使用 `list()` 分页
- 文件 > 100MB 使用分片上传
- 缓存频繁访问的元数据

## 11. 开发工作流

### 本地开发

```bash
# 本地启动 Worker + Dashboard
pnpm build-dashboard
cd packages/worker/dev && wrangler dev

# 仅 Dashboard（使用外部 API）
cd packages/dashboard && pnpm dev
```

### 测试命令

```bash
pnpm test           # 所有单元 + 集成测试
pnpm test:e2e       # Playwright E2E 测试
pnpm lint           # Biome 代码检查
```

### 部署

```bash
# 通过 GitHub Action（推荐）
git push origin main

# 手动部署
pnpm build && wrangler deploy
```

## 12. 未来增强 (Roadmap)

### 文件管理
- [ ] 支持带空格的存储桶名
- [ ] 文件搜索功能
- [ ] 文件夹重命名能力
- [ ] 图片缩略图生成

### AI 集成
- [ ] 使用 workers-ai 进行对象检测

### 用户体验
- [ ] 增强时间戳提示
- [ ] 邮件回复能力
- [ ] 高级文件类型特定编辑

## 13. 已知问题

1. Basic 认证会导致邮件内联图片/资源加载失败
2. 大目录列表可能较慢（暂无分页 UI）

## 14. 参考资料

- [R2 Explorer 文档](https://r2explorer.com)
- [Cloudflare R2 API](https://developers.cloudflare.com/r2/)
- [Hono 框架](https://hono.dev/)
- [Quasar 框架](https://quasar.dev/)