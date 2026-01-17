---
description: Current backlog and completed features
---

# Backlog

## ✅ Completed

### v1.0 — Core Features
- [x] Account CRUD (asset, savings, receivable, liability)
- [x] Transaction CRUD (expense, income, transfer)
- [x] Category management with autocomplete
- [x] Balance calculation via DB triggers
- [x] PWA support (manifest, service worker)

### v1.1 — Archive Feature
- [x] Account archiving/unarchiving
- [x] Tabs in accounts modal (Active/Archived)
- [x] Hidden accounts excluded from totals

### v1.2 — Transaction Edit
- [x] Edit amount, date, category, note
- [x] Optimistic locking (created_at check)
- [x] UPDATE trigger for balance recalculation

### v2.0 — Debt System Overhaul (Jan 2026)

#### Problem Solved
Ранее при возврате суммы больше долга срабатывал DB constraint и операция блокировалась.

#### Smart Debt Collection
**Файл:** `public/js/supabase/debts.js` → `collectDebtSmart()`

| Сценарий | Что происходит |
|----------|----------------|
| Переплата (amount > balance) | Закрывает долг + создаёт `income` на разницу |
| Недоплата + closeDebt | Частичный возврат + `expense` (списание остатка) |
| Точная сумма | Стандартный `debt_op` |

**UI изменения:**
- Подсказка `#hint-debt-balance` — "Больше на ₸X → будет доход"
- Чекбокс `#input-close-debt` — "Закрыть и простить ₸X"

#### Split Expense with Friends
**Файл:** `public/js/supabase/debts.js` → `createExpenseWithDebt()`

Позволяет создать расход + долг друга одной кнопкой.
Пример: Оплатил кафе 10000₸, друг должен 5000₸.

**UI изменения:**
- Чекбокс `#input-split-expense` — "Часть оплатят друзья"
- Поля `#input-split-who` (Кто) и `#input-split-amount` (Сколько)

#### Files Changed
```
public/js/supabase/debts.js      +245 lines
public/js/ui/forms/debt-form.js  +90 lines (setupBalanceHint)
public/js/ui/forms/transaction-form.js +30 lines
public/index.html                 +25 lines (checkboxes, hints)
public/style.css                  +35 lines (hint, split-row)
```

---

## 🔜 Planned

### Next Up
- [ ] Recurring transactions (subscriptions)
- [ ] Budget limits per category
- [ ] Monthly reports/analytics
- [ ] Data export (CSV/JSON)

### Nice to Have
- [ ] Multi-currency support
- [ ] Dark/Light theme toggle
- [ ] Push notifications for debt reminders
- [ ] Shared expenses with friends

---

## 🐛 Known Issues
- Minor 406 errors on category lookup (non-blocking)
- Credit card grace period not implemented yet
