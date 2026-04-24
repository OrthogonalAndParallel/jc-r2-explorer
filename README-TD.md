# R2-Explorer Technical Design Document

## 1. System Overview

R2-Explorer is a Google Drive-like interface for Cloudflare R2 storage buckets. It consists of two main components:

- **Worker (Backend)**: Cloudflare Worker providing REST API for R2 operations
- **Dashboard (Frontend)**: Vue 3 + Quasar SPA for file management UI

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Cloudflare Edge                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Worker (Hono Framework)                   ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ ││
│  │  │   API Routes    │  │  Auth Middleware│  │  Dashboard   │ ││
│  │  │  (OpenAPI/REST) │  │  (Basic/CF Acc) │  │  (Static)    │ ││
│  │  └─────────────────┘  └─────────────────┘  └──────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                      R2 Buckets                              ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   ││
│  │  │  Files       │  │  Metadata    │  │  Share Links     │   ││
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 2. Technology Stack

### Frontend (Dashboard)

| Technology | Version | Purpose |
|------------|---------|---------|
| Vue 3 | ^3.5.13 | Core framework |
| Quasar | ^2.17.5 | UI component library |
| Pinia | ^2.2.8 | State management |
| Vue Router | ^4.2.5 | Routing |
| vue-i18n | ^11.4.0 | Internationalization |
| Axios | ^1.2.1 | HTTP client |
| Vitest | ^3.2.4 | Unit testing |
| Playwright | ^1.58.2 | E2E testing |

### Backend (Worker)

| Technology | Version | Purpose |
|------------|---------|---------|
| Hono | - | Web framework |
| chanfana | - | OpenAPI integration |
| Zod | - | Schema validation |
| Wrangler | ^4.20.1 | Cloudflare CLI |

## 3. Project Structure

```
jc-r2-explorer/
├── packages/
│   ├── dashboard/          # Vue frontend SPA
│   │   ├── src/
│   │   │   ├── boot/       # Quasar boot files (axios, auth, bus, i18n)
│   │   │   ├── components/ # Vue components
│   │   │   │   ├── files/  # File operations (Create, Share, Options)
│   │   │   │   ├── main/   # Layout (Topbar, LeftSidebar)
│   │   │   │   ├── preview/# File preview components
│   │   │   │   └── utils/  # Utilities (DragAndDrop)
│   │   │   ├── locales/    # i18n translations (en.json, zh.json)
│   │   │   ├── pages/      # Route pages
│   │   │   │   ├── auth/   # Login page
│   │   │   │   ├── email/  # Email routing pages
│   │   │   │   └── files/  # File browsing pages
│   │   │   ├── stores/     # Pinia stores (auth, main)
│   │   │   ├── router/     # Vue router configuration
│   │   │   └── appUtils.js # API handler utilities
│   │   ├── tests/          # Unit/component tests
│   │   ├── e2e/            # Playwright E2E tests
│   │   └── quasar.config.js
│   │
│   ├── worker/             # Cloudflare Worker backend
│   │   ├── src/
│   │   │   ├── index.ts    # Main entry point (R2Explorer factory)
│   │   │   ├── types.d.ts  # TypeScript definitions
│   │   │   ├── foundation/ # Core infrastructure
│   │   │   │   ├── middleware/ # Auth, readonly middleware
│   │   │   │   └── settings/    # Configuration
│   │   │   └── modules/    # Feature modules
│   │   │       ├── buckets/ # R2 operations (CRUD, share, multipart)
│   │   │       ├── emails/  # Email routing handlers
│   │   │       ├── server/  # Server info API
│   │   │       └── dashboard/# Dashboard serving
│   │   ├── tests/          # Integration tests
│   │   └── dev/            # Local development setup
│   │
│   ├── docs/               # Documentation site
│   └── github-action/      # CI/CD deployment action
│
├── template/               # Self-hosting template
│   ├── src/index.ts        # User configuration entry
│   ├── wrangler.toml       # Cloudflare config
│   └── .dev.vars           # Local dev secrets
│
└── pnpm-workspace.yaml     # Monorepo configuration
```

## 4. Core Components Design

### 4.1 Worker API Architecture

The Worker uses Hono framework with OpenAPI (chanfana) for structured REST API:

```typescript
// Entry point factory pattern (packages/worker/src/index.ts:41-169)
export function R2Explorer(config?: R2ExplorerConfig) {
  const app = new Hono<{ Bindings: AppEnv; Variables: AppVariables }>();
  
  // Middleware chain
  app.use("*", configMiddleware);
  app.use("/api/*", corsMiddleware);      // Optional CORS
  app.use("/api/*", readonlyMiddleware);   // Optional readonly
  app.use("/api/*", authMiddleware);       // Basic Auth or CF Access
  
  // API routes (OpenAPI documented)
  openapi.get("/api/buckets/:bucket", ListObjects);
  openapi.post("/api/buckets/:bucket/upload", PutObject);
  openapi.post("/api/buckets/:bucket/delete", DeleteObject);
  // ... more routes
  
  return { fetch, email };
}
```

### 4.2 Authentication Flow

Two authentication methods supported:

**1. Basic Authentication** (`packages/worker/src/index.ts:91-119`)
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

### 4.3 R2 Bucket Operations

| Operation | Endpoint | Method | Description |
|-----------|----------|--------|-------------|
| List Objects | `/api/buckets/:bucket` | GET | List files/folders with pagination |
| Upload File | `/api/buckets/:bucket/upload` | POST | Single file upload |
| Multipart Upload | `/api/buckets/:bucket/multipart/*` | POST | Large file chunked upload |
| Delete Object | `/api/buckets/:bucket/delete` | POST | Delete file/folder |
| Move Object | `/api/buckets/:bucket/move` | POST | Rename/move file |
| Copy Object | `/api/buckets/:bucket/copy` | POST | Duplicate file |
| Create Folder | `/api/buckets/:bucket/folder` | POST | Create directory |
| Get Object | `/api/buckets/:bucket/:key` | GET | Download file |
| Update Metadata | `/api/buckets/:bucket/:key` | POST | Edit HTTP/custom metadata |

### 4.4 Share Links System

Share links provide public access to files with optional security:

```typescript
// packages/worker/src/types.d.ts:28-37
interface ShareMetadata {
  bucket: string;        // Source bucket
  key: string;           // Object key
  expiresAt?: number;    // Expiration timestamp
  passwordHash?: string; // Optional password protection
  maxDownloads?: number; // Download limit
  currentDownloads: number;
  createdBy: string;     // Authenticated user
  createdAt: number;     // Creation timestamp
}
```

| Operation | Endpoint | Auth Required |
|-----------|----------|---------------|
| Create Share | `/api/buckets/:bucket/:key/share` | Yes |
| List Shares | `/api/buckets/:bucket/shares` | Yes |
| Delete Share | `/api/buckets/:bucket/share/:shareId` | Yes |
| Access Share | `/share/:shareId` | No (public) |

### 4.5 Email Routing Integration

Cloudflare Email Routing sends emails to the Worker (`packages/worker/src/index.ts:158-164`):

```typescript
async email(event, env, context) {
  await receiveEmail(event, env, context, config);
}
```

Emails are stored in configured R2 bucket with metadata.

## 5. Frontend Architecture

### 5.1 State Management (Pinia)

```
stores/
├── auth-store.js    # Authentication state (loggedIn, user)
└── main-store.js    # App state (buckets, currentPath, selectedFiles)
```

### 5.2 Component Hierarchy

```
App.vue
├── layouts/
│   └── MainLayout.vue
│       ├── Topbar.vue          # Header with bucket selector, language switch
│       └── LeftSidebar.vue     # Navigation menu
│
├── pages/
│   ├── FilesFolderPage.vue     # File browser (table view)
│   ├── FileContextMenu.vue     # Right-click actions
│   ├── EmailFolderPage.vue     # Email list
│   └── LoginPage.vue           # Authentication
│
└── components/
    ├── files/
    │   ├── CreateFolder.vue    # Folder creation dialog
    │   ├── CreateFile.vue      # File creation dialog
    │   ├── FileOptions.vue     # Delete/rename/metadata dialogs
    │   └── ShareFile.vue       # Share link creation
    ├── preview/
    │   └── FilePreview.vue     # File viewer (PDF, image, text)
    └── utils/
        └── DragAndDrop.vue     # Upload overlay
```

### 5.3 API Handler (`packages/dashboard/src/appUtils.js`)

Centralized API communication with authentication:

```javascript
export const apiHandler = {
  // Bucket operations
  listObjects: (bucket, prefix) => 
    axios.get(`/api/buckets/${bucket}`, { params: { prefix } }),
  
  uploadObject: (bucket, key, file) => 
    axios.post(`/api/buckets/${bucket}/upload`, formData),
  
  deleteObject: (bucket, key) => 
    axios.post(`/api/buckets/${bucket}/delete`, { keys: [key] }),
  
  // Share operations
  createShare: (bucket, key, options) => 
    axios.post(`/api/buckets/${bucket}/${key}/share`, options),
  
  // Server info
  getServerConfig: () => axios.get('/api/server/config'),
};
```

### 5.4 Internationalization (vue-i18n)

Language files in `packages/dashboard/src/locales/`:

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

## 6. Configuration Options

### R2ExplorerConfig Schema (`packages/worker/src/types.d.ts:13-26`)

```typescript
interface R2ExplorerConfig {
  readonly?: boolean;           // Default: true (disable write operations)
  cors?: boolean;               // Enable CORS for API routes
  cfAccessTeamName?: string;    // Cloudflare Access team name
  dashboardUrl?: string;        // Custom dashboard URL
  emailRouting?: {              // Email routing configuration
    targetBucket: string;       // R2 bucket for email storage
  } | false;
  showHiddenFiles?: boolean;    // Show files starting with .
  basicAuth?: {                 // Basic authentication
    username: string;
    password: string;
  } | Array<{ username, password }>;
  buckets?: Record<string, {    // Per-bucket configuration
    publicUrl?: string;         // Custom public URL
  }>;
}
```

### Example Configuration (`template/src/index.ts`)

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

## 7. Deployment Architecture

### 7.1 GitHub Action Deployment (`.github/workflows/deploy.yml`)

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

### 7.2 Dynamic Configuration Generation (`packages/github-action/prepareDeploy.js`)

```javascript
// Generates wrangler.toml and src/index.ts from environment variables

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

## 8. Testing Strategy

See [README-TDD.md](./README-TDD.md) for detailed testing documentation.

### Test Coverage Requirements

| Component | Minimum Coverage |
|-----------|-----------------|
| Worker API endpoints | 90% |
| Vue components | 80% |
| Utilities | 80% |

### Test Types

1. **Unit Tests** (Vitest + happy-dom)
   - Dashboard components and stores
   
2. **Integration Tests** (vitest-pool-workers)
   - Worker API with real R2 bindings
   
3. **E2E Tests** (Playwright)
   - Critical user flows (upload, delete, share)

## 9. Security Considerations

### 9.1 Authentication

- **Basic Auth**: Username/password verification
- **Cloudflare Access**: Enterprise SSO integration
- **Public Routes**: Share links are public (no auth required)

### 9.2 Authorization

- **Readonly Mode**: Disables write operations via middleware (`packages/worker/src/foundation/middlewares/readonly.ts`)
- **Per-bucket Access**: Same authentication applies to all buckets

### 9.3 Data Protection

- **Share Links**: Optional password (hashed) and expiration
- **Download Limits**: Track and enforce max downloads
- **Metadata**: HTTP headers and custom metadata editable

## 10. Performance Optimization

### 10.1 Worker Edge Execution

- Runs on Cloudflare edge (low latency)
- R2 bindings directly accessible (no network overhead)
- Asset serving via ASSETS binding (SPA cached)

### 10.2 Frontend Optimization

- Quasar component lazy loading
- Asset caching (`cacheAssets` config)
- Multipart upload for large files

### 10.3 R2 Best Practices

- Use `list()` pagination for large buckets
- Multipart upload for files > 100MB
- Cache frequently accessed metadata

## 11. Development Workflow

### Local Development

```bash
# Start worker + dashboard locally
pnpm build-dashboard
cd packages/worker/dev && wrangler dev

# Dashboard only (with external API)
cd packages/dashboard && pnpm dev
```

### Testing Commands

```bash
pnpm test           # All unit + integration tests
pnpm test:e2e       # Playwright E2E tests
pnpm lint           # Biome linting
```

### Deployment

```bash
# Via GitHub Action (recommended)
git push origin main

# Manual deployment
pnpm build && wrangler deploy
```

## 12. Future Enhancements (Roadmap)

### File Management
- [ ] Support bucket names with spaces
- [ ] File search functionality
- [ ] Folder renaming capability
- [ ] Image thumbnails generation

### AI Integration
- [ ] Object detection using workers-ai

### User Experience
- [ ] Enhanced timestamp tooltips
- [ ] Email response capabilities
- [ ] Advanced file type-specific editing

## 13. Known Issues

1. Basic authentication breaks email inline images/assets loading
2. Large directory listing may be slow (no pagination UI yet)

## 14. References

- [R2 Explorer Documentation](https://r2explorer.com)
- [Cloudflare R2 API](https://developers.cloudflare.com/r2/)
- [Hono Framework](https://hono.dev/)
- [Quasar Framework](https://quasar.dev/)