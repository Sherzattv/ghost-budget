# Git Workflow — Ghost Budget

Стратегия работы с ветками для проекта **Ghost Budget**.

## 🌿 Структура веток

```
main           ← Production (стабильная версия)
  ↑
develop        ← Development (активная разработка)
  ↑
feature/имя    ← Новые фичи (временные)
fix/имя        ← Баг-фиксы (временные)
```

---

## 📋 Основные ветки

### `main`
- **Назначение:** Продакшн-версия, готовая к деплою
- **Защита:** Только через merge из `develop`
- **Правило:** Всегда стабильна и работает

### `develop`
- **Назначение:** Интеграционная ветка для всех фич
- **Работа:** Все новые фичи мержатся сюда
- **Правило:** Может содержать экспериментальный код

---

## 🔧 Временные ветки

### `feature/название`
- **Для чего:** Разработка новой функциональности
- **Примеры:**
  - `feature/accounts-edit`
  - `feature/analytics-charts`
  - `feature/dark-mode`
- **Lifecycle:** Создать → Разработать → Merge в `develop` → Удалить

### `fix/название`
- **Для чего:** Исправление багов
- **Примеры:**
  - `fix/transfer-validation`
  - `fix/balance-calculation`
  - `fix/render-debts`
- **Lifecycle:** Создать → Исправить → Merge в `develop` → Удалить

---

## 📖 Workflow — Пошаговый процесс

### 1️⃣ Начало работы над новой фичей

```bash
# Убедись что на develop
git checkout develop
git pull origin develop

# Создай ветку под фичу
git checkout -b feature/account-export
```

### 2️⃣ Разработка

```bash
# Делай коммиты по мере разработки
git add .
git commit -m "feat: add CSV export for accounts"

# Периодически синхронизируй с develop
git checkout develop
git pull origin develop
git checkout feature/account-export
git merge develop
```

### 3️⃣ Завершение фичи

```bash
# Переключись на develop
git checkout develop
git pull origin develop

# Смержи фичу
git merge feature/account-export

# Запуш develop
git push origin develop

# Удали фичу-ветку
git branch -d feature/account-export
```

### 4️⃣ Релиз в production

```bash
# Когда develop стабилен и готов к релизу
git checkout main
git pull origin main

# Смержи develop в main
git merge develop

# Запуш в production
git push origin main

# Опционально: создай тег версии
git tag -a v1.2.0 -m "Release v1.2.0: Account export feature"
git push origin v1.2.0
```

---

## 🐛 Hotfix (срочный баг в production)

Если нужно срочно исправить баг в `main`:

```bash
# Создай hotfix от main
git checkout main
git checkout -b fix/critical-balance-bug

# Исправь баг
git add .
git commit -m "fix: correct balance calculation overflow"

# Merge в main
git checkout main
git merge fix/critical-balance-bug
git push origin main

# Merge в develop тоже!
git checkout develop
git merge fix/critical-balance-bug
git push origin develop

# Удали hotfix
git branch -d fix/critical-balance-bug
```

---

## 📝 Naming Conventions

### Коммиты (Conventional Commits)

```
feat: добавление новой функциональности
fix: исправление бага
refactor: рефакторинг без изменения функциональности
docs: обновление документации
style: форматирование, отступы (не CSS)
test: добавление тестов
chore: обновление зависимостей, конфигов
```

**Примеры:**
- `feat: add account balance editing with validation`
- `fix: prevent transfer to same account`
- `refactor: extract accounts module to separate file`
- `docs: update README with installation steps`

### Ветки

```
feature/короткое-описание    # новая фича
fix/короткое-описание        # баг-фикс
```

**Правила:**
- Только маленькие буквы
- Слова через дефис `-`
- Название должно быть понятным

---

## 🧹 Очистка веток

### Локальные ветки

```bash
# Список всех веток
git branch

# Удалить смерженную ветку
git branch -d feature/old-feature

# Принудительно удалить (если не смержена)
git branch -D feature/old-feature
```

### Удалённые ветки

```bash
# Удалить ветку на GitHub
git push origin --delete feature/old-feature

# Очистить локальные ссылки на удалённые ветки
git fetch --prune
```

---

## ⚡ Полезные команды

```bash
# Просмотр всех веток (локальных и удалённых)
git branch -a

# Текущая ветка
git branch --show-current

# Переключение без создания
git checkout develop

# Создание и переключение
git checkout -b feature/new-thing

# История коммитов
git log --oneline --graph --all --decorate

# Отменить последний коммит (сохранив изменения)
git reset --soft HEAD~1

# Синхронизация с remote
git fetch --all
git pull origin develop
```

---

## 🎯 Чеклист перед коммитом

- [ ] Код работает локально
- [ ] Нет console.log / debugger
- [ ] Осмысленное сообщение коммита
- [ ] Изменения касаются только текущей фичи
- [ ] Если баг-фикс — добавь описание в коммит

---

## 🚀 Чеклист перед merge в main

- [ ] Все фичи работают
- [ ] Нет критичных багов
- [ ] Код протестирован вручную
- [ ] README актуален
- [ ] Версия обновлена (если нужно)

---

## 📚 Полезные ссылки

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flow Cheatsheet](https://danielkummer.github.io/git-flow-cheatsheet/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
