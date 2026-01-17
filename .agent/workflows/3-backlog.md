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

### v2.0 — Debt System Overhaul
- [x] Smart debt collection (over/underpayment handling)
- [x] Balance hints ("Больше на X → будет доход")
- [x] Close debt checkbox for forgiveness
- [x] Split expense with friends

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
