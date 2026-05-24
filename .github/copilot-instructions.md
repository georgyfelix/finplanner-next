# FinPlanner Next.js Application - Copilot Instructions

## Project Overview

**FinPlanner** is a personal finance management application built with:
- **Framework:** Next.js 16.2.6 (Turbopack) with React 19
- **Language:** TypeScript 5 with strict type checking
- **Database:** PostgreSQL (Neon) via Drizzle ORM
- **Auth:** Clerk (server-side authentication)
- **Styling:** Tailwind CSS 4
- **State:** React hooks (useState, useEffect, useCallback)

## Architecture

### Directory Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout with GlobalLoaderProvider
│   ├── page.tsx                # Home page
│   ├── loading.tsx             # Route transition loader
│   ├── api/                    # API routes (Next.js App Router)
│   │   ├── transactions/       # Transaction CRUD, settle, copy
│   │   ├── accounts/           # Account management
│   │   ├── categories/         # Category CRUD
│   │   ├── budgets/            # Budget management
│   │   ├── monthly-account-balances/  # Monthly account state
│   │   └── monthly-profile/    # Historical monthly data
│   ├── components/             # Shared client components
│   │   ├── ConfirmModal.tsx    # Modal confirmation dialogs
│   │   └── GlobalLoaderProvider.tsx  # Global loading state
│   └── dashboard/              # Dashboard pages
│       ├── page.tsx            # Main dashboard
│       ├── accounts/           # Account management
│       ├── transactions/       # Transaction list
│       ├── categories/         # Category management
│       ├── budgets/            # Budget management
│       └── plan/               # Monthly planning
├── lib/
│   ├── db/                     # Database connection & schema
│   ├── useCategories.tsx       # Category hook & select component
│   ├── useUserSettings.tsx     # User settings hook
│   ├── userSettings.ts         # Settings server functions
│   ├── currency.ts             # Currency formatting utilities
│   └── defaultCategories.ts    # Seed category data
```

### Page Structure

**Client Pages** (`'use client'` directive):
- All dashboard pages are client components
- Use React hooks for state management
- Fetch data on mount and when dependencies change
- Handle loading/error states locally

**API Routes** (server-side):
- Authentication via Clerk `auth()` function
- Always check `userId` first and return 401 if unauthorized
- Use Drizzle ORM for database queries
- Return `NextResponse.json()` with appropriate status codes

## Key Patterns

### 1. Transaction Handling

Transactions have a complex lifecycle with planned-vs-actual and cross-month settlement:

```typescript
type Transaction = {
  id: string;
  userId: string;
  accountId: string | null;
  amount: string;           // Stored as normalized string
  category: string;
  date: string;             // Settlement/actual date (YYYY-MM-DD)
  plannedDate: string | null;  // Original planned month anchor
  isPlanned: boolean;       // Pending vs settled status
  origin: 'planned' | 'manual';  // Created as plan or actual
};
```

**Key Rules:**
- For planned-origin transactions: Use `plannedDate ?? date` as month anchor
- This allows salary credited on last day of April to still belong to May
- When settling a planned transaction: **Always preserve `plannedDate`** (add comment: "Never overwrite plannedDate — it anchors the transaction to its original planned month.")
- Settled planned transactions appear in BOTH planned month AND settlement month
- Manual (non-planned) transactions use only `date` for month filtering

**Month Filtering Logic:**
```typescript
// For planned-origin transactions
if (row.origin === 'planned' && row.plannedDate) {
  const plannedDate = new Date(row.plannedDate);
  const settlementDate = new Date(row.date);
  const plannedMonthMatch = plannedDate.getMonth() + 1 === month && plannedDate.getFullYear() === year;
  const settlementMonthMatch = settlementDate.getMonth() + 1 === month && settlementDate.getFullYear() === year;
  return plannedMonthMatch || settlementMonthMatch;
}

// For other transactions
const date = new Date(row.date);
return date.getMonth() + 1 === month && date.getFullYear() === year;
```

### 2. Account Visibility

Accounts can be hidden from dashboard calculations but remain visible on the Accounts page:

```typescript
type Account = {
  // ... fields ...
  hiddenFromDashboard: boolean;
};
```

**Pattern:**
- Dashboard: `userAccounts.filter(acc => !acc.hiddenFromDashboard)`
- Plan: Use visible accounts only for projections
- Accounts page: Show all accounts with toggle UI ("🙈 Exclude from dashboards" / "👁 Include in dashboards")
- Monthly balances: Filter to visible accounts only

### 3. Amount Normalization

Amounts are normalized based on category type:

```typescript
const normalizeAmount = (tx: Transaction) => {
  const raw = Number(tx.amount);
  const type = categoryTypeByName.get(tx.category);
  if (type === 'income') return Math.abs(raw);
  if (type === 'expense' || type === 'saving') return -Math.abs(raw);
  return raw;
};
```

- **Income:** Always positive
- **Expense/Saving:** Always negative
- Store actual category mapping in a Map for O(1) lookups

### 4. Hooks Pattern

**Custom Hooks** (`lib/use*.tsx`):
```typescript
import { useState, useEffect } from 'react';

export function useMyData() {
  const [data, setData] = useState<Type[]>([]);

  useEffect(() => {
    fetch('/api/endpoint').then(r => r.json()).then(setData);
  }, []);

  return data;
}
```

- Fetch on first mount only (empty dependency array)
- Component-specific state stays in components, not in separate hooks
- For complex selectors, compute them in the component using the hook data

### 5. Modal & Form Patterns

**ConfirmModal** for destructive actions:
```typescript
import ConfirmModal from '@/app/components/ConfirmModal';

// In component state:
const [deleteId, setDeleteId] = useState<string | null>(null);

// In JSX:
<ConfirmModal
  isOpen={!!deleteId}
  title="Delete item?"
  message="This will be permanently removed."
  confirmLabel="Delete"
  tone="danger"
  onCancel={() => setDeleteId(null)}
  onConfirm={() => deleteId && handleDelete(deleteId)}
/>
```

**Modal Dialogs** for multi-step interactions:
```typescript
{modal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <button
      type="button"
      aria-label="Close"
      className="absolute inset-0 bg-black/40"
      onClick={() => setModal(null)}
    />
    <div className="relative w-full max-w-md bg-white rounded-2xl border shadow-2xl p-6 space-y-4">
      {/* Modal content */}
    </div>
  </div>
)}
```

### 6. API Endpoint Pattern

```typescript
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tableName } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Handle query params for filtering
  const { searchParams } = new URL(req.url);
  const param = searchParams.get('param');

  const rows = await db.select().from(tableName).where(eq(tableName.userId, userId));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.required) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Insert logic with error handling
  try {
    const [result] = await db.insert(tableName).values({
      userId,
      ...body,
    }).returning();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
```

### 7. Global Loading State

**GlobalLoaderProvider** wraps the root layout:
```typescript
// src/app/layout.tsx
<GlobalLoaderProvider>{children}</GlobalLoaderProvider>
```

- Automatically tracks all `window.fetch` calls
- Shows modal overlay during route transitions
- 120ms debounce to prevent flicker on quick operations
- Components don't need to manage loader state for API calls

### 8. JSON Response Handling

For API calls that might return empty bodies, use the `readJsonOrThrow` helper pattern:

```typescript
async function readJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
```

### 9. Bulk Copy Pattern

For recurring transactions, implement copy endpoints:

```typescript
// POST /api/transactions/copy
// Body: { transactionId: string, numMonths: number (1-60) }
// Creates copies for future months only (skips past dates)
```

- Uses `plannedDate` as anchor
- Handles month-end edge cases (Feb 30 → Feb 28/29)
- Validates `numMonths` range
- Returns count of copies created

## Common Patterns to Follow

### ✅ DO

- **Type first:** Define all types at component top before logic
- **Use Drizzle:** `db.select().from(table).where(...)`
- **Preserve transaction anchors:** Never overwrite `plannedDate`
- **Filter hidden accounts:** Dashboard queries must exclude `hiddenFromDashboard`
- **Normalize amounts:** Convert to ±value based on category type
- **Use ConfirmModal:** For all delete/destructive operations
- **Fetch on mount:** Load data in `useEffect(..., [])`
- **Handle 401:** Always check auth before database operations
- **Use Map for lookups:** For category type mapping, category names, etc.
- **Validate query params:** Always parse and validate `searchParams`
- **Use `and(...conditions)`:** For multiple WHERE conditions
- **Return appropriate HTTP status:** 400 (bad input), 401 (auth), 404 (not found), 500 (server error)

### ❌ DON'T

- **Mutate state directly:** Always use setState
- **Forget userId:** Every DB query must be scoped to `userId`
- **Store sync state:** Use hooks, not separate state files
- **Hard-code strings:** Use constants, enums, or maps
- **Fetch without auth check:** 401 check must come first
- **Use native confirm/alert:** Use ConfirmModal component
- **Overwrite plannedDate:** Preserve it during settlement
- **Count hidden accounts:** Filter them from dashboard totals
- **Ignore empty JSON responses:** Handle empty bodies gracefully
- **Create past-dated copies:** Skip dates before today in copy operations

## Styling Conventions

- **Tailwind 4:** PostCSS-based, no utility prefix needed
- **Color scheme:** Indigo (primary), red (danger), green (success), blue (info)
- **Spacing:** `gap-`, `p-`, `mb-` for consistent spacing
- **Interactive states:** `hover:` and `active:scale-[0.99]` for feedback
- **Icons:** Use emojis for quick visual cues (✔, 🗑, 📋, ✎, 🙈, 👁, ⚠, etc.)
- **Modals:** Dark overlay `bg-black/40`, white card with shadow-2xl
- **Empty states:** Use gray-500/gray-400 for secondary text

## Testing & Validation

- **No TypeScript errors:** Run `npm run lint` and fix all diagnostics
- **Transaction month logic:** Test cross-month settlement scenarios
- **Account visibility:** Verify hidden accounts don't appear in dashboard
- **Amount signs:** Verify income is positive, expenses are negative
- **Auth check:** Ensure all endpoints return 401 for unauthorized requests
- **Month filtering:** Test boundary cases (month-end, year-end transitions)

## Clerk Authentication

- Always import: `import { auth } from '@clerk/nextjs/server'`
- Only available in server-side context (API routes, server components)
- Always check for userId before proceeding: `if (!userId) return 401`
- User ID is globally unique per Clerk tenant

## Database Schema Reference

Key fields to remember:
- `transactions.plannedDate`: Nullable string, anchors transaction to intended month
- `transactions.origin`: 'planned' | 'manual'
- `transactions.isPlanned`: Boolean, indicates settlement status
- `accounts.hiddenFromDashboard`: Boolean, excluded from dashboard totals
- `monthlyAccountBalances`: Cached monthly state (opening/closing balances)
- All tables: `userId` for multi-tenancy, `createdAt` for audit trail

## Performance Considerations

- **Fetch on mount only:** Use empty dependency array `[]` to prevent re-fetches
- **Memoize callbacks:** Use `useCallback` for handlers passed to child components
- **Map lookups:** Create Maps once for O(1) category type lookups
- **Bulk operations:** Support batch inserts in POST endpoints (e.g., categories, transaction copies)
- **Filter server-side:** Apply month/account filtering in API before returning
- **Cache calculations:** Store monthly balances in `monthlyAccountBalances` table

## Recent Implementations

### Transaction Copy Feature
- Endpoint: `POST /api/transactions/copy`
- Creates recurring transaction copies across multiple months
- Only for `origin === 'planned'` transactions
- Skips past/today dates automatically
- Each copy gets unique `plannedDate` for its target month

### Month-Based Transaction Filtering
- Transactions API accepts `?month=M&year=Y` params
- Planned transactions appear in both planned AND settlement months
- Manual transactions use only settlement date
- Applied consistently in Dashboard, Plan, and Transactions pages

### Account Visibility System
- Added `hiddenFromDashboard` boolean to accounts table
- Dashboard/Plan queries filter visible accounts only
- Accounts page shows all with toggle UI
- Hidden accounts remain counted in Accounts-specific calculations

### Global Loader Provider
- Wraps entire app at root layout
- Auto-tracks all fetch calls and route transitions
- 120ms debounce to prevent flash on quick operations
- No per-page configuration needed

---

**Last Updated:** May 25, 2026
