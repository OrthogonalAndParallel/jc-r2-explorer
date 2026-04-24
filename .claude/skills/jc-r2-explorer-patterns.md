---
name: jc-r2-explorer-patterns
description: Coding patterns extracted from jc-r2-explorer repository
version: 1.0.0
source: local-git-analysis
analyzed_commits: 200
---

# jc-r2-explorer Patterns

## Commit Conventions

This project uses **conventional commits** with PR references:

- `feat:` - New features (e.g., `feat: add file and folder duplicate/copy operation (#152)`)
- `fix:` - Bug fixes (e.g., `fix: ensure API routes bypass SPA fallback (#126)`)
- `chore:` - Maintenance tasks (e.g., `chore: version packages (#150)`)
- `ci:` - CI/CD changes (e.g., `ci: add changeset check workflow (#129)`)
- `test:` - Test additions (e.e., `test: add dashboard UI testing infrastructure (#133)`)

**PR References**: Always include the PR number in parentheses: `type: description (#XXX)`

**Chinese format**: Occasionally uses `【修改】` for local modifications.

## Code Architecture

Monorepo structure using pnpm workspaces:

```
packages/
├── worker/           # Cloudflare Worker backend (TypeScript)
│   ├── src/          # Source code
│   ├── src/modules/  # Feature modules (buckets, etc.)
│   ├── src/foundation/ # Core infrastructure (middlewares)
│   └── tests/        # Integration tests
├── dashboard/        # Vue 3 + Quasar frontend
│   ├── src/          # Vue components and pages
│   ├── e2e/          # Playwright E2E tests
│   └── tests/        # Vitest unit/component tests
├── dashboard-v2/     # Alternative Vue frontend
├── github-action/    # Deployment GitHub Action
└── docs/             # Documentation package

.changeset/           # Changeset files for version management
.github/workflows/    # CI/CD workflows
template/             # Template package for new deployments
```

## Workflows

### Adding a New Feature

1. Create feature branch from main
2. Implement changes in relevant package
3. Add tests (unit + integration/E2E for UI)
4. Run `pnpm lint` and fix errors
5. Create changeset: `pnpm changeset`
6. Push and create PR with conventional commit format

### Changeset Workflow

Every PR must include a changeset:

```bash
# For user-facing changes
pnpm changeset
# Write description in the prompt

# For internal-only changes (refactoring, CI, docs)
pnpm changeset --empty
```

### Release Workflow

```bash
pnpm build
pnpm --filter r2-explorer publint
changeset publish
```

### Running Tests

```bash
# All tests (worker + dashboard)
pnpm test

# E2E tests only (requires dashboard build first)
pnpm test:e2e

# Worker integration tests
pnpm --filter r2-explorer test

# Dashboard unit tests
pnpm --filter r2-explorer-dashboard test
```

## Testing Patterns

### Test File Locations

| Type | Location | Naming |
|------|----------|--------|
| Integration | `packages/worker/tests/integration/*.test.ts` | `.test.ts` |
| E2E | `packages/dashboard/e2e/*.spec.ts` | `.spec.ts` |
| Component | `packages/dashboard/tests/**/*.test.ts` | `.test.ts` |

### Test Frameworks

- **Worker**: Vitest with `@cloudflare/vitest-pool-workers`
- **Dashboard**: Vitest + Vue Test Utils + happy-dom
- **E2E**: Playwright

### Coverage Requirement

Target: Comprehensive test coverage for UI changes. E2E tests required for any UI modifications.

## Code Quality

### Linting

```bash
# Run lint (auto-fix on failure)
pnpm lint
```

Uses **Biome** for linting (not ESLint).

### TypeScript

- Strict mode enabled
- Type definitions in `*.d.ts` files
- Module files: `camelCase.ts`

### Vue Conventions

- Components: `PascalCase.vue`
- Pages: `PascalCase.vue` in `pages/` directory
- Store: Pinia for state management

## Hot Files (Most Frequently Changed)

Based on commit analysis:

| File | Changes | Purpose |
|------|---------|---------|
| `packages/worker/package.json` | 34 | Version bumps |
| `pnpm-lock.yaml` | 21 | Dependency updates |
| `README.md` | 21 | Documentation |
| `.github/workflows/publish.yml` | 16 | CI/CD |
| `packages/dashboard/src/appUtils.js` | 11 | Utility functions |
| `packages/dashboard/src/pages/files/*.vue` | 14+ | File management UI |

## Key Commands

```bash
# Development
pnpm build-dashboard        # Build Vue frontend
pnpm build-worker           # Build Worker
pnpm build                  # Build all

# Deployment
pnpm deploy-dashboard       # Deploy to Cloudflare Pages
pnpm deploy-dev-worker      # Deploy worker dev branch

# Quality
pnpm lint                   # Lint all code
pnpm test                   # Run all tests
pnpm test:e2e               # Run E2E tests

# Release
pnpm changeset              # Create changeset
pnpm release                # Build, validate, publish
```

## PR Checklist

Before merging:

- [ ] Branch created from main (never commit directly to main)
- [ ] `pnpm lint` passes with no errors
- [ ] Tests added for new functionality
- [ ] E2E tests added for UI changes
- [ ] Changeset created (`pnpm changeset`)
- [ ] Conventional commit format used
- [ ] PR number included in commit message