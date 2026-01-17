---
description: Detailed project architecture and code structure
---

# Architecture

## State Management
`state.js` — централизованное хранилище:
```
accounts[]      — все счета (включая hidden)
transactions[]  — транзакции
categories[]    — категории
transactionType — текущий тип ('expense'|'income'|'transfer'|'debt')
```

## Account Types
| Type | Description | Balance |
|------|-------------|---------|
| `asset` | Обычный счёт, кредитка | +/- |
| `savings` | Депозит | + |
| `receivable` | Мне должны | + |
| `liability` | Я должен | - |

## Transaction Types
| Type | Fields |
|------|--------|
| `expense` | account_id, category_id, amount |
| `income` | account_id, category_id, amount |
| `transfer` | from_account_id, to_account_id |
| `debt_op` | from_account_id, to_account_id, is_debt=true |

## Database Triggers
Баланс счетов обновляется автоматически через триггер `update_account_balance()`:
- INSERT → добавляет amount
- UPDATE → пересчитывает разницу
- DELETE → вычитает amount

## Key Functions

### debts.js
- `lend()` — я дал в долг
- `borrow()` — я взял в долг
- `collectDebtSmart()` — мне вернули (с обработкой переплаты)
- `repayDebt()` — я вернул
- `createExpenseWithDebt()` — расход + долг друга

### components.js
- `renderAll()` — полная перерисовка UI
- `renderAccountsList()` — список счетов
- `renderTransactions()` — список транзакций
- `renderObligationCard()` — карточка долга
