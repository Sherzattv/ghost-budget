---
description: Git workflow and commit conventions
---

# Git Workflow

## Current Branch
`feature/debts-management`

## Commit Convention
```
<type>: <short description>

<optional body with details>
```

### Types
- `feat:` — новая фича
- `fix:` — исправление бага
- `refactor:` — рефакторинг без изменения поведения
- `style:` — CSS/форматирование
- `docs:` — документация
- `chore:` — конфиг, зависимости

## Recent Commits
```
6ebdd61 fix: remove auto-archiving on debt closure
4cc85d5 fix: clear balance hint after debt operation
850a013 feat: add split expense with friends feature
71092c7 feat: implement smart debt collection with overpayment handling
```

## Branching Strategy
- `main` — production-ready code
- `feature/*` — feature branches
- `fix/*` — hotfix branches

## Before Merging
1. Test in browser
2. Check console for errors
3. Verify all edge cases
4. Squash commits if needed
