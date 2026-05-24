# FinPlanner - Database & Architecture Details

## 1. Entity Relationship Diagram

```
┌─────────────────────┐
│   User (Clerk)      │
│  (External Auth)    │
└──────────┬──────────┘
           │ userId
           │
    ┌──────┴────────┬─────────┬──────────┬──────────────┬──────────────┐
    │               │         │          │              │              │
    ▼               ▼         ▼          ▼              ▼              ▼
┌────────┐  ┌──────────┐  ┌──────────┐ ┌───────────┐  ┌──────────┐  ┌─────────┐
│Accounts│  │Categories│  │Budgets   │ │Transactions  │Transactions  │Settings│
│        │  │          │  │          │ │(Planned)     │(Copy)        │        │
├────────┤  ├──────────┤  ├──────────┤ └──────────────┘              ├─────────┤
│id(PK)  │  │id(PK)    │  │id(PK)    │       ↑                       │userId(PK)
│userId  │  │userId    │  │userId    │       │ plannedDate anchor    │locale   │
│name    │  │name(U)   │  │category  │       └──────────────────┐   │currency │
│initial │  │type      │  │limit     │                          │   └─────────┘
│balance │  │created   │  │month     │                  ┌───────┴────────┐
│hidden* │  └──────────┘  │year      │                  │                │
│created │                │created   │        ┌─────────▼────────┐      │
└────────┘                └──────────┘        │  Transactions    │      │
    ▲                                         │  (All)           │      │
    │ accountId (FK)                          ├──────────────────┤      │
    │ (nullable)                              │id(PK)            │      │
    │                                         │userId            │      │
    └─────────────────────────┬───────────────│accountId(FK)*    │      │
                              │               │amount            │      │
                              │               │category          │      │
                  ┌───────────┘               │date              │      │
                  │                           │plannedDate*      │      │
                  │                           │isPlanned         │      │
                  │                           │origin            │      │
                  │                           │created           │      │
                  │                           └──────────────────┘      │
                  │                                   ▲                 │
                  │                                   │                 │
                  │                    ┌──────────────┘                 │
                  │                    │                               │
┌─────────────────┴────────────────────┴───────────────────┐          │
│                                                          │          │
│      Monthly Account Balances                           │          │
│      (Cached Monthly Snapshots)                         │          │
├──────────────────────────────────────────────────────────┤          │
│ id(PK)                                                   │          │
│ userId (FK) ───────────────────────────────────────────│──────────┘
│ accountId (FK) ──────────────────┐                      │
│ month (1-12)                     │                      │
│ year (YYYY)                      │                      │
│ openingBalance (Closing[n-1] +   │                      │
│   PlannedIncome[n])              │                      │
│ closingBalance (Opening +        │                      │
│   PlannedIncome - PlannedOutflow) │                      │
│ created/updated                  │                      │
│ unique(userId,accountId,m,y)     │                      │
└──────────────────────────────────┼──────────────────────┘
                                   │
                  ┌────────────────┘
                  │
                  ▼
            ┌────────────────────────┐
            │  Accounts              │
            │  (Links opening balance│
            │   to account)          │
            └────────────────────────┘
```

## 2. Data Flow Architecture

### 2.1 Transaction Creation & Settlement

```
User Interface (Client)
    ↓
Form Input (amount, category, date, account?)
    ↓
POST /api/transactions
    ↓
API Validation
├─ Check userId auth
├─ Validate category exists
├─ Validate account (if provided)
└─ Validate amount > 0
    ↓
DB Insertion
├─ If isPlanned=true: accountId=null, plannedDate=date or null
├─ If isPlanned=false: accountId=required
└─ origin='planned' or 'manual'
    ↓
Response (Created Transaction)
    ↓
Component Refresh (loadAll)
    ↓
UI Update (Transaction list, Dashboard totals)
```

### 2.2 Transaction Settlement Flow

```
User Clicks "Settle" on Planned Transaction
    ↓
Modal Opens with Pre-fill
├─ accountId (default to first)
├─ amount (pre-filled from planned)
├─ category (same)
└─ date (actual settlement date)
    ↓
User Reviews/Modifies Fields
    ↓
PATCH /api/transactions/[id]
    ↓
API Updates
├─ isPlanned=false
├─ accountId=user-selected
├─ amount=actual (may differ)
├─ date=settlement date
└─ plannedDate=PRESERVED (unchanged)
    ↓
DB Update (preserves plannedDate)
    ↓
Monthly Account Balances Invalidated
    ↓
Next fetch recalculates with new data
```

### 2.3 Recurring Transaction Copy Flow

```
User Clicks "📋 Copy" on Planned Transaction
    ↓
Modal: "How many months ahead?"
    ↓
User Selects Range (1-60)
    ↓
POST /api/transactions/copy
    ↓
API Processing
├─ Validate transactionId exists
├─ Validate origin='planned'
├─ Fetch original transaction
├─ For each month (1 to N):
│  ├─ Calculate target date (handle month-end)
│  ├─ Skip if past or today
│  └─ Create copy with unique plannedDate
└─ Bulk insert all copies
    ↓
Return { copied: number }
    ↓
Component Refresh
    ↓
List Shows New Pending Items
```

### 2.4 Dashboard Calculation Flow

```
Dashboard Mounted
    ↓
loadAll() Parallel Fetches:
├─ /api/accounts → filter hiddenFromDashboard
├─ /api/categories → build typeByName map
├─ /api/transactions → all transactions
├─ /api/monthly-account-balances?month=NOW&year=NOW
└─ /api/budgets?month=NOW&year=NOW
    ↓
Local Calculations
├─ Filter visible accounts
├─ Build category type map
├─ Filter planned-origin for month
├─ Calculate:
│  ├─ Opening = SUM(monthlyAccountBalances.opening)
│  ├─ Planned Income = SUM(income transactions for month)
│  ├─ Planned Outflow = SUM(expense+saving for month)
│  ├─ Projected Closing = Opening + Income - Outflow
│  ├─ Actual Transactions (this month)
│  ├─ Unplanned Expenses
│  └─ Unaccounted = (Current Balance) - (Projected)
    ↓
UI Render with Calculated Values
```

### 2.5 Monthly Account Balance Roll-Forward

```
GET /api/monthly-account-balances?month=M&year=Y
    ↓
Check if Monthly Balances Exist for (month, year, accountId)
    ↓
If Missing:
├─ Fetch all user accounts
├─ Fetch previous month's closing balances
├─ Fetch all transactions (user)
├─ Fetch all categories (user)
    ↓
For Each Account:
├─ GetPreviousClosing(account, month-1)
├─ If month=1: year=currentYear-1, month=12
│  └─ else: month-=1, year=currentYear
├─ Calculate IncomeRollforward
│  ├─ Filter: origin='planned', category.type='income'
│  ├─ Filter: plannedDate in [month, year] OR date in [month, year]
│  ├─ SUM(amounts)
├─ If account=primary:
│  └─ opening = closingPrev + incomeRollforward
│  else:
│  └─ opening = closingPrev
├─ closing = opening (no change unless transactions)
└─ INSERT monthlyAccountBalances row
    ↓
Return All Monthly Balances for Month
```

## 3. State Diagram

### 3.1 Transaction States

```
                    ┌─────────────────────────────┐
                    │  PLANNED-ORIGIN PENDING     │
                    │  isPlanned=true             │
                    │  origin='planned'           │
                    │  accountId=null             │
                    │  plannedDate=set            │
                    └──────────┬──────────────────┘
                               │ User clicks "Settle"
                               │ Provides: account, date, amount
                               ▼
                    ┌─────────────────────────────┐
                    │  PLANNED-ORIGIN SETTLED     │
                    │  isPlanned=false            │
                    │  origin='planned' (const)   │
                    │  accountId=set              │
                    │  plannedDate=preserved      │
                    │  date=settlement date       │
                    └──────────┬──────────────────┘
                               │
                               └─► Both plannedDate month & settlement date month

┌─────────────────────────────┐
│  MANUAL-ORIGIN ACTUAL       │
│  isPlanned=false            │
│  origin='manual'            │
│  accountId=set (required)   │
│  plannedDate=null           │
│  date=transaction date      │
└─────────────────────────────┘
        │
        └─► Only transaction date month

┌─────────────────────────────┐
│  MANUAL-ORIGIN PENDING      │
│  isPlanned=true             │
│  origin='manual'            │
│  accountId=null             │
│  plannedDate=null           │
└──────────┬──────────────────┘
           │ User clicks "Settle"
           ▼
┌─────────────────────────────┐
│  MANUAL-ORIGIN SETTLED      │
│  isPlanned=false            │
│  origin='manual'            │
│  accountId=set              │
│  plannedDate=null           │
└─────────────────────────────┘
        │
        └─► Only transaction date month
```

## 4. Query Patterns

### 4.1 Get Transactions for Month (with dual-date logic)

**Purpose:** Fetch all transactions belonging to a month

**Query (TypeScript + Drizzle):**
```typescript
const rows = await db
  .select()
  .from(transactions)
  .where(eq(transactions.userId, userId))
  .orderBy(desc(transactions.date));

// Post-process filtering (IN application)
const filtered = rows.filter(row => {
  if (!month || !year) return true;
  
  if (row.origin === 'planned' && row.plannedDate) {
    const pDate = new Date(row.plannedDate);
    const sDate = new Date(row.date);
    const pMatch = pDate.getMonth() + 1 === month && pDate.getFullYear() === year;
    const sMatch = sDate.getMonth() + 1 === month && sDate.getFullYear() === year;
    return pMatch || sMatch;
  }
  
  const d = new Date(row.date);
  return d.getMonth() + 1 === month && d.getFullYear() === year;
});
```

**Why post-process:**
- Dual-date logic hard to express in SQL
- Data volume small enough for in-app filtering
- Clearer logic in application code

### 4.2 Get Account Balances

**Query:**
```typescript
const totalBalance = accounts
  .filter(a => !a.hiddenFromDashboard)
  .reduce((sum, a) => sum + Number(a.initialBalance), 0);

const totalActual = transactions
  .filter(t => !t.isPlanned && t.accountId)
  .reduce((sum, t) => sum + normalize(t), 0);

const currentBalance = totalBalance + totalActual;
```

### 4.3 Get Monthly Planned Totals

**Query:**
```typescript
const plannedIncome = transactions
  .filter(t => {
    if (t.origin !== 'planned') return false;
    if (categoryType.get(t.category) !== 'income') return false;
    
    const anchor = t.plannedDate ?? t.date;
    const d = new Date(anchor);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  })
  .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
```

### 4.4 Get Categories by Type

**Query:**
```typescript
const categories = await db
  .select()
  .from(categories)
  .where(
    and(
      eq(categories.userId, userId),
      eq(categories.type, 'expense')
    )
  );
```

### 4.5 Check Budget vs Actual

**Query:**
```typescript
const budget = await db
  .select()
  .from(budgets)
  .where(
    and(
      eq(budgets.userId, userId),
      eq(budgets.category, category),
      eq(budgets.month, month),
      eq(budgets.year, year)
    )
  );

const actual = transactions
  .filter(t => 
    t.category === category &&
    !t.isPlanned &&
    /* date filtering for month */
  )
  .reduce((sum, t) => sum + Math.abs(normalize(t)), 0);
```

## 5. Multi-Tenancy Model

### 5.1 Clerk Integration

**Auth Model:**
- Clerk handles user authentication
- Each API route calls `auth()` to get `userId`
- 401 error if not authenticated

**User ID:**
- String identifier from Clerk
- Used as tenant key in all tables
- Enforced via `userId` column in every table

### 5.2 Data Isolation

**Every Query Must Include:**
```typescript
eq(table.userId, userId)
```

**Examples:**
```typescript
// ✅ Correct
await db.select().from(accounts).where(eq(accounts.userId, userId));

// ❌ Dangerous (returns ALL users' accounts)
await db.select().from(accounts);
```

### 5.3 Foreign Key References

**Within Same User:**
- Account → Transactions via accountId
- Category → Transactions via category name
- Account → MonthlyAccountBalances via accountId

**Cross-User References:**
- NOT allowed (data isolation enforced)
- Each table checked for userId match

## 6. Indexes & Performance

### 6.1 Unique Indexes

**Budgets:**
```
UNIQUE (userId, category, month, year)
```
→ Prevents duplicate budget for same category/month

**Monthly Profiles:**
```
UNIQUE (userId, month, year)
```
→ One profile per user per month

**Monthly Account Balances:**
```
UNIQUE (userId, accountId, month, year)
```
→ One balance record per account per month

**Categories:**
```
UNIQUE (userId, name, type) [application-enforced]
```
→ No duplicate category name per type per user

### 6.2 Foreign Keys

**Transactions.accountId → Accounts.id**
- ON DELETE SET NULL (preserve transaction history)

**MonthlyAccountBalances.accountId → Accounts.id**
- ON DELETE CASCADE (remove monthly data when account deleted)

## 7. Backup & Data Integrity

### 7.1 Key Preservation Rules

**Never Overwrite `plannedDate`:**
- Comment in update code: "Never overwrite plannedDate — it anchors the transaction to its original planned month."
- Ensures month context preserved across settlement
- Manual override only in data correction scenarios

### 7.2 Transaction History

**Immutability:**
- Created transactions never deleted (except user explicit delete)
- Updates preserve creation context
- accountId set to null on account delete (not transaction delete)

### 7.3 Monthly Snapshots

**Recalculation:**
- On-demand calculation if missing
- Not pre-computed for all history
- Current/future months calculated as needed

## 8. API Error Responses

### 8.1 Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Transaction created |
| 400 | Bad request | Missing required fields |
| 401 | Unauthorized | Not authenticated |
| 404 | Not found | Transaction doesn't exist |
| 500 | Server error | Database failure |

### 8.2 Error Response Format

```json
{
  "error": "Descriptive error message"
}
```

### 8.3 Common Errors

```
401: "Unauthorized"
400: "Missing required fields: amount, category, date"
400: "Account not found"
400: "Only planned transactions can be copied"
404: "Transaction not found"
500: "Failed to create transaction"
```

## 9. Technology Stack

### 9.1 Frontend (Client)
- **Framework:** React 19
- **Build:** Next.js 16 (Turbopack)
- **Styling:** Tailwind CSS 4
- **State:** React hooks (useState, useEffect, useCallback)
- **Lang:** TypeScript 5

### 9.2 Backend (Server)
- **Runtime:** Node.js (via Next.js API routes)
- **Auth:** Clerk (external service)
- **ORM:** Drizzle 0.45
- **Database:** PostgreSQL (Neon)
- **Lang:** TypeScript 5

### 9.3 Deployment
- **Hosting:** Vercel (Next.js optimized)
- **Database:** Neon (PostgreSQL as a service)
- **Auth:** Clerk (managed auth)

## 10. Configuration

### 10.1 Environment Variables

**Required (.env.local):**
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
DATABASE_URL=...
```

### 10.2 Database Migrations

**Using Drizzle Kit:**
```bash
npm run db:push  # Push schema changes
npm run db:studio  # Browse data
```

---

**Document Version:** 1.0  
**Last Updated:** May 25, 2026  
**Scope:** Technical architecture, data flow, and database design
