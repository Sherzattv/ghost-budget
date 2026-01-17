---
description: Quick start guide for new agents joining this project
---

# Ghost Budget — Quick Start

## Project Overview
**Ghost Budget** — PWA-приложение для личных финансов на Vanilla JS + Supabase.

## Tech Stack
- **Frontend:** HTML, CSS, Vanilla JavaScript (ES Modules)
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Server:** Node.js Express (static file server)

## Key Commands
```bash
# Start development server
npm start                    # http://localhost:3000

# Database
# Migrations are in /supabase/migrations/
```

## Project Structure
```
wallet/
├── public/
│   ├── index.html          # Single page app
│   ├── style.css           # All styles
│   └── js/
│       ├── main.js         # Entry point, event listeners
│       ├── state.js        # Global state management
│       ├── utils.js        # Utility functions
│       ├── supabase/       # API layer
│       │   ├── client.js   # Supabase client
│       │   ├── accounts.js # Account CRUD
│       │   ├── transactions.js
│       │   ├── debts.js    # Debt operations
│       │   └── categories.js
│       └── ui/
│           ├── components.js # Render functions
│           └── forms/      # Form handlers
├── supabase/migrations/    # SQL migrations
└── server.js               # Express server
```

## Current Branch
`feature/debts-management`

## Environment
Copy `.env.example` to `.env` and fill Supabase credentials.
