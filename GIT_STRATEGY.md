# Git Workflow для Ghost Budget

## 📋 Стратегия ветвления

Используется **упрощенный Git Flow** с двумя основными ветками:

```
main (production на Railway)
  └── develop (staging/testing)
       ├── feature/*
       ├── refactor/*
       └── hotfix/*
```

---

## 🌳 Описание веток

| Ветка | Назначение | Защищена | Деплой |
|-------|-----------|----------|--------|
| `main` | Production код | ✅ Да | Railway автодеплой |
| `develop` | Интеграция и тестирование | ⚠️ Частично | Локальное тестирование |
| `feature/*` | Новые фичи | ❌ Нет | Не деплоится |
| `refactor/*` | Рефакторинг | ❌ Нет | Не деплоится |
| `hotfix/*` | Срочные фиксы | ❌ Нет | Не деплоится |

---

## ✅ Правильный Workflow

### 1. Новая фича или рефакторинг

```bash
# Обновить develop
git checkout develop
git pull origin develop

# Создать новую ветку
git checkout -b feature/edit-transactions
# или
git checkout -b refactor/vite-setup
```

**Naming convention:**
- `feature/` — новая функциональность
- `refactor/` — улучшение существующего кода
- `hotfix/` — срочное исправление бага

### 2. Разработка

```bash
# Работаешь, коммитишь
git add .
git commit -m "feat: add edit transaction button"

# Ещё коммиты...
git commit -m "refactor: extract validation logic"
```

### 3. Готово → слияние в develop

```bash
# Переключиться на develop
git checkout develop

# Влить feature ветку
git merge feature/edit-transactions
# или rebase для чистой истории
git rebase feature/edit-transactions

# Запушить develop
git push origin develop
```

### 4. Тестирование на develop

```bash
# Запустить локально
npm run dev

# Проверить:
# - Авторизация работает
# - Новая фича работает
# - Ничего не сломалось
```

### 5. Стабильно → слияние в main

```bash
# Переключиться на main
git checkout main

# Влить develop
git merge develop
# или fast-forward (если develop впереди)
git merge --ff-only develop

# Запушить main → автодеплой на Railway
git push origin main
```

### 6. Очистка

```bash
# Удалить feature ветку (опционально)
git branch -d feature/edit-transactions

# Удалить на remote (опционально)
git push origin --delete feature/edit-transactions
```

---

## ❌ Что НЕ надо делать

### ⛔ Коммитить напрямую в develop/main

```bash
# ❌ НЕПРАВИЛЬНО
git checkout develop
git add .
git commit -m "quick fix"
```

**Почему плохо:**
- Нарушается изоляция изменений
- Сложно откатить
- Невозможно сделать code review

**✅ ПРАВИЛЬНО:**
```bash
git checkout -b hotfix/quick-fix
git add .
git commit -m "fix: validation error"
git checkout develop
git merge hotfix/quick-fix
```

### ⛔ Пушить в main без тестирования

```bash
# ❌ НЕПРАВИЛЬНО
git checkout main
git merge feature/something
git push origin main  # <- без теста на develop!
```

**✅ ПРАВИЛЬНО:**
```bash
# 1. feature → develop
git checkout develop
git merge feature/something

# 2. Тест локально на develop
npm run dev

# 3. Только потом develop → main
git checkout main
git merge develop
git push origin main
```

---

## 📝 Commit Message Convention

Используем **Conventional Commits**:

```
<type>(<scope>): <subject>

<body>
```

### Types:
- `feat:` — новая фича
- `fix:` — исправление бага
- `refactor:` — рефакторинг кода
- `docs:` — документация
- `style:` — форматирование (не CSS!)
- `test:` — тесты
- `chore:` — настройка, зависимости

### Примеры:

```bash
feat: add edit transaction functionality
fix: validation error on empty category
refactor: extract form handlers to separate module
docs: update Git workflow guide
```

---

## 🚀 Примеры полных workflow

### Пример 1: Новая фича

```bash
# 1. Создать ветку
git checkout develop
git checkout -b feature/export-excel

# 2. Разработка
git add .
git commit -m "feat: add Excel export button"
git commit -m "feat: implement export logic"

# 3. Слить в develop
git checkout develop
git merge feature/export-excel
git push origin develop

# 4. Тест
npm run dev
# ... проверка ...

# 5. Слить в main
git checkout main
git merge develop
git push origin main

# 6. Очистка
git branch -d feature/export-excel
```

### Пример 2: Рефакторинг

```bash
# 1. Создать ветку
git checkout develop
git checkout -b refactor/vite-migration

# 2. Рефакторинг
git add .
git commit -m "refactor: setup Vite config"
git commit -m "refactor: migrate to .env"

# 3. Слить в develop
git checkout develop
git merge refactor/vite-migration

# 4. Тест (важно!)
npm run dev
# ... проверка что ничего не сломалось ...

# 5. Слить в main
git checkout main
git merge develop
git push origin main
```

### Пример 3: Срочный hotfix

```bash
# 1. От main (если баг на проде)
git checkout main
git checkout -b hotfix/auth-crash

# 2. Фикс
git add .
git commit -m "fix: auth crash on empty email"

# 3. Слить в main
git checkout main
git merge hotfix/auth-crash
git push origin main  # <- быстрый деплой

# 4. Слить в develop тоже
git checkout develop
git merge hotfix/auth-crash
git push origin develop
```

---

## 🔍 Полезные команды

### Посмотреть состояние веток
```bash
git log --oneline --graph --all --decorate -10
```

### Проверить, что в develop есть, а в main нет
```bash
git log --oneline main..develop
```

### Проверить, что в main есть, а в develop нет
```bash
git log --oneline develop..main
```

### Удалить все merged ветки
```bash
git branch --merged | grep -v "\*\|main\|develop" | xargs -n 1 git branch -d
```

---

## 🎯 Чеклист перед деплоем (main)

Перед `git push origin main`:

- [ ] Код работает локально на `develop`
- [ ] Нет console.error в браузере
- [ ] Авторизация работает
- [ ] CRUD операции работают
- [ ] Аналитика отображается
- [ ] Mobile responsive работает
- [ ] Service Worker обновлён (если менял файлы)
- [ ] Supabase миграции выполнены (если есть)

---

## 📚 Ресурсы

- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow)
- [Conventional Commits](https://www.conventionalcommits.org/)
