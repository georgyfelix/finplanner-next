# FinPlanner - Personal Finance Management Application

**FinPlanner** is a comprehensive personal finance management and planning application built with modern web technologies. It enables users to track bank accounts, plan monthly income/expenses, record transactions, manage budgets, and project financial outcomes with sophisticated cross-month transaction handling.

## 🎯 Key Features

- **📊 Dashboard:** Real-time financial snapshot with account balances and monthly projections
- **📅 Monthly Planning:** Detailed month-by-month planning with planned vs actual comparisons
- **💳 Account Management:** Multiple accounts with visibility controls (can exclude from dashboard)
- **📝 Transaction Management:** Track actual and planned transactions with dual-date system
- **🔄 Recurring Transactions:** Copy planned transactions across multiple months (1-60 months)
- **💰 Budget Tracking:** Set and monitor spending limits per category per month
- **🏷️ Categories:** Pre-configured categories (income, expense, saving) with custom add support
- **📱 Responsive UI:** Beautiful, intuitive interface with Tailwind CSS
- **🔒 Authentication:** Secure multi-user support with Clerk
- **🌐 Localization:** Support for multiple locales and currencies (INR, USD, EUR, etc.)

## 💡 Core Concepts

### Planned vs Actual Transactions

- **Planned:** Forecasted transactions created during month planning (settable later)
- **Actual:** Realized transactions recorded with account and final amount
- Planned transactions show in both planned month AND settlement month (cross-month visibility)

### Account Visibility

- Hide accounts from dashboard calculations while keeping them visible on Accounts page
- Useful for old accounts, loans, or accounts managed separately
- Dashboard always shows only visible account totals

### Month-Based Filtering

- Transactions associated with a month via `plannedDate` (original plan) or `date` (settlement)
- Salary credited in April but planned for May appears in both months
- Enables accurate cross-month financial planning

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Next.js 16 (Turbopack), TypeScript 5 |
| **Styling** | Tailwind CSS 4 |
| **Backend** | Next.js API Routes, Node.js |
| **Database** | PostgreSQL (Neon) with Drizzle ORM 0.45 |
| **Auth** | Clerk (managed authentication) |
| **Deployment** | Vercel (recommended) |

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Neon recommended)
- Clerk account for authentication
- Git

## 🚀 Quick Start

### 1. Clone & Install Dependencies

```bash
cd finplanner-next
npm install
```

### 2. Set Up Environment Variables

Create `.env.local` with:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host/database
```

Get these from:
- **Clerk:** https://dashboard.clerk.com
- **Neon:** https://console.neon.tech

### 3. Set Up Database

```bash
# Push schema to database
npm run db:push

# (Optional) Browse database in Drizzle Studio
npm run db:studio
```

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
src/
├── app/
│   ├── api/                    # Backend API routes
│   │   ├── transactions/       # Transaction CRUD + copy
│   │   ├── accounts/           # Account management
│   │   ├── categories/         # Category management
│   │   ├── budgets/            # Budget management
│   │   └── monthly-account-balances/  # Monthly snapshots
│   ├── components/             # Reusable components
│   │   ├── ConfirmModal.tsx    # Confirmation dialogs
│   │   └── GlobalLoaderProvider.tsx # Global loading state
│   ├── dashboard/              # Dashboard pages
│   │   ├── page.tsx            # Main dashboard
│   │   ├── accounts/           # Account management
│   │   ├── transactions/       # Transaction list
│   │   ├── categories/         # Category management
│   │   ├── budgets/            # Budget management
│   │   └── plan/               # Monthly planning
│   ├── layout.tsx              # Root layout with GlobalLoader
│   └── page.tsx                # Home/login page
├── lib/
│   ├── db/                     # Database connection & schema
│   ├── useCategories.tsx       # Categories hook
│   ├── useUserSettings.tsx     # Settings hook
│   ├── userSettings.ts         # Settings server functions
│   ├── currency.ts             # Currency formatting
│   └── defaultCategories.ts    # Seed data
└── [...]
```

## 🎮 Main Pages

### Dashboard (`/dashboard`)
Real-time financial overview for current month:
- Account balance summary
- Monthly opening/closing balances
- Planned vs actual income/expenses
- Projected closing balance
- Recent transactions

### Plan (`/dashboard/plan`)
Month-by-month financial planning:
- Select any month to plan
- Create planned transactions
- Settle planned items with actual details
- View projections
- Copy recurring transactions

### Transactions (`/dashboard/transactions`)
Complete transaction management:
- Month-based filtering
- Add actual or planned transactions
- Settle pending planned items
- Copy recurring across months
- Budget category quick-add

### Accounts (`/dashboard/accounts`)
Account management with balance tracking:
- Create/edit/delete accounts
- View monthly opening/closing per account
- Toggle account visibility from dashboard
- Monthly balance breakdown

### Budgets (`/dashboard/budgets`)
Spending limit management:
- Set budget per category per month
- Track budget vs actual spending
- Progress bars with visual feedback
- Warning indicators for overages

### Categories (`/dashboard/categories`)
Transaction category management:
- Create custom categories
- View defaults (pre-configured)
- Bulk add suggested categories
- Organize by type (income/expense/saving)

## 📡 API Endpoints Overview

| Method | Endpoint | Purpose |
|--------|----------|---------|
| **Transactions** | | |
| GET | `/api/transactions?month=M&year=Y` | Fetch transactions for month |
| POST | `/api/transactions` | Create transaction |
| PATCH | `/api/transactions/[id]` | Update transaction |
| DELETE | `/api/transactions` | Delete transaction |
| POST | `/api/transactions/copy` | Copy across months |
| **Accounts** | | |
| GET | `/api/accounts` | List all accounts |
| POST | `/api/accounts` | Create account |
| PATCH | `/api/accounts/[id]` | Update account |
| DELETE | `/api/accounts` | Delete account |
| **Categories** | | |
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create category |
| DELETE | `/api/categories` | Delete category |
| **Budgets** | | |
| GET | `/api/budgets?month=M&year=Y` | Get budgets for month |
| POST | `/api/budgets` | Create/update budget |
| DELETE | `/api/budgets` | Delete budget |
| **Monthly Balances** | | |
| GET | `/api/monthly-account-balances?month=M&year=Y` | Get monthly snapshots |

For detailed API documentation, see [FUNCTIONAL_SPEC.md](.github/FUNCTIONAL_SPEC.md#10-api-endpoints-overview).

## 🔄 Transaction Lifecycle

### Planned Transaction Flow
```
1. Created as PLANNED (isPlanned=true)
   ↓
2. Visible in "Pending Planned Items"
   ↓
3. User clicks "Settle" with actual details
   ↓
4. Converted to ACTUAL (isPlanned=false)
   ↓
5. Appears in "Actual Transactions"
   ↓
6. Visible in BOTH planned month AND settlement month
```

### Key Rule: `plannedDate` Preservation
- When settling a planned transaction, `plannedDate` is NEVER overwritten
- Ensures transaction belongs to original planned month
- Critical for cross-month salary crediting scenarios

### Recurring Transaction Setup
```
1. Create planned transaction
2. Click "📋 Copy"
3. Select number of months (1-60)
4. System creates independent copies for each month
5. Each copy:
   - Gets unique plannedDate for its target month
   - Can be settled independently
   - Doesn't affect other copies
```

## 💾 Database Schema

**Key Tables:**
- `accounts` - User's financial accounts
- `transactions` - All financial movements (planned + actual)
- `categories` - Transaction classifications
- `budgets` - Monthly spending limits
- `monthlyAccountBalances` - Cached monthly snapshots
- `userSettings` - Locale & currency preferences

**Key Fields:**
- `transaction.plannedDate` - Original planned month anchor (nullable)
- `transaction.origin` - 'planned' | 'manual' (where created)
- `account.hiddenFromDashboard` - Exclude from dashboard calculations

For complete schema, see [ARCHITECTURE.md](.github/ARCHITECTURE.md).

## 🧮 Calculations

### Monthly Opening Balance
```
Opening[month] = Closing[month-1] + PlannedIncome[month]
```

### Monthly Closing Projection
```
ProjectedClosing = Opening + PlannedIncome - (PlannedExpenses + PlannedSavings)
```

### Unaccounted Amount
```
Unaccounted = CurrentBalance - ProjectedClosing
```

For all calculation details, see [FUNCTIONAL_SPEC.md](.github/FUNCTIONAL_SPEC.md#5-calculations--financial-formulas).

## 📚 Documentation

Complete documentation available in `.github/`:

| File | Content |
|------|---------|
| [**copilot-instructions.md**](copilot-instructions.md) | Development patterns & conventions |
| [**FUNCTIONAL_SPEC.md**](.github/FUNCTIONAL_SPEC.md) | Complete functional specification (16 sections) |
| [**ARCHITECTURE.md**](.github/ARCHITECTURE.md) | Technical architecture & database design |
| [**FEATURES_WORKFLOWS.md**](.github/FEATURES_WORKFLOWS.md) | Detailed feature descriptions & workflows |

Start with **FUNCTIONAL_SPEC.md** for feature overview, then **ARCHITECTURE.md** for implementation details.

## 🔧 Development

### Build for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

### Database Operations

```bash
# Push schema changes
npm run db:push

# Open interactive database browser
npm run db:studio
```

## 🎨 Styling & UI

- **Framework:** Tailwind CSS 4 (PostCSS-based)
- **Icons:** Emojis (✔, 🗑, 📋, ✎, 🙈, 👁, ⚠, etc.)
- **Colors:** Indigo (primary), Red (danger), Green (success)
- **Components:** ConfirmModal, GlobalLoaderProvider
- **Responsive:** Mobile-first design with Tailwind

## 🔒 Security & Authentication

- **Clerk:** Multi-tenant authentication service
- **Data Isolation:** Every query scoped to `userId`
- **API Security:** 401 check on all endpoints
- **Session Management:** Automatic via Clerk

## 🚀 Deployment

### Recommended: Vercel

```bash
# Connect to Vercel and deploy
vercel
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`

### Alternative: Self-Hosted

```bash
npm run build
npm start
```

## 🤝 Contributing

1. Follow patterns in [copilot-instructions.md](copilot-instructions.md)
2. Ensure no TypeScript errors: `npm run lint`
3. Test transaction calculations for edge cases
4. Preserve `plannedDate` during settlement updates
5. Update documentation for new features

## 📝 Key Development Patterns

### Always Check Auth
```typescript
const { userId } = await auth();
if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

### Filter Visible Accounts
```typescript
const visibleAccounts = accounts.filter(a => !a.hiddenFromDashboard);
```

### Preserve plannedDate
```typescript
// Comment in code: "Never overwrite plannedDate — it anchors the transaction to its original planned month."
// Only update other fields during settlement
```

### Handle Empty JSON
```typescript
async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
```

## 📊 Performance Features

- **GlobalLoaderProvider:** Unified loading feedback for all API calls
- **Monthly Snapshots:** Pre-calculated balances cached in database
- **Bulk Operations:** Support for batch inserts (categories, transaction copies)
- **Server-side Filtering:** Month filtering applied in API before returning
- **Map Lookups:** O(1) category type lookups with Map structure

## 🐛 Common Issues & Solutions

### Missing Categories
- **Issue:** "No categories — add some in Categories"
- **Fix:** Categories auto-initialize on first dashboard load

### Empty JSON Responses
- **Issue:** "Unexpected end of JSON input"
- **Fix:** Use `readJsonOrThrow()` helper for safe parsing

### Transactions Not Appearing
- **Issue:** "Expected to see May transactions but only see April"
- **Fix:** Check `plannedDate` vs `date` — planned transactions appear in both months

### Hidden Accounts Still in Total
- **Issue:** Excluded accounts still counted in dashboard
- **Fix:** Verify `hiddenFromDashboard=true` is persisted in database

## 📞 Support

For issues or questions:
1. Check documentation in `.github/`
2. Review [FUNCTIONAL_SPEC.md](.github/FUNCTIONAL_SPEC.md#15-error-handling) for error handling
3. Check [ARCHITECTURE.md](.github/ARCHITECTURE.md#10-technology-stack) for tech stack details

## 📄 License

MIT

---

**Version:** 1.0  
**Last Updated:** May 25, 2026  
**Status:** Active Development
