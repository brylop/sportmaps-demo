---
description: Git branching strategy for maintaining demo while developing MVP
---

# Git Branching Strategy — SportMaps

## Branch Structure

| Branch | Purpose | Vercel Deploy |
|--------|---------|---------------|
| `main` | 🟢 Demo estable — NO tocar | `sportmaps-demo.vercel.app` |
| `develop` | 🔵 MVP en progreso — Todos los cambios van aquí | (configurar preview) |
| `feature/*` | 🟡 Features individuales — Se fusionan a `develop` | Auto preview deploys |

## Daily Workflow

### Starting a new feature
// turbo
1. Make sure you're on develop: `git checkout develop`
// turbo
2. Pull latest: `git pull origin develop`
// turbo
3. Create feature branch: `git checkout -b feature/<sprint>-<descripcion>`
   Examples:
   - `feature/s1-consolidate-schema`
   - `feature/s1-remove-mongodb`
   - `feature/s2-multitenancy-rls`
   - `feature/s2-school-context`

### Working on a feature
4. Make your code changes
5. Commit frequently with conventional commits:
   - `git add .`
   - `git commit -m "feat: description"` for new features
   - `git commit -m "fix: description"` for bug fixes
   - `git commit -m "refactor: description"` for refactoring
   - `git commit -m "chore: description"` for maintenance

### Finishing a feature
6. Push feature branch: `git push origin feature/<branch-name>`
7. Create Pull Request on GitHub: `feature/<branch> → develop`
8. Review, test, and merge

### When develop is stable enough for demo update
9. Create PR: `develop → main`
10. Review thoroughly — this updates the live demo
11. Merge only when confident nothing breaks

## Quick Reference Commands

```bash
# See which branch you're on
git branch

# Switch to develop to start working
git checkout develop

# Switch to main to see the demo code
git checkout main

# See all branches
git branch -a

# Merge a feature into develop (after PR or locally)
git checkout develop
git merge feature/<branch-name>
git push origin develop

# EMERGENCY: Revert main if demo breaks
git checkout main
git revert HEAD
git push origin main
```

## Rules
- **NEVER** commit directly to `main` (except docs)
- **ALWAYS** branch from `develop` for new features
- **ALWAYS** test on `develop` before merging to `main`
- Feature branches should be small and focused (1-3 days max)
