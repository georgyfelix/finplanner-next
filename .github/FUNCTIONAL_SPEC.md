# FinPlanner - Functional Specification

## 1. Application Overview

**FinPlanner** is a personal finance management and planning application that enables users to:
- Track actual bank accounts and their balances
- Plan monthly income, expenses, and savings
- Record actual transactions and settle planned ones
- Budget by category with monthly limits
- Project monthly financial outcomes
- Handle recurring transactions across multiple months
- Manage multiple accounts with visibility controls

**Core Philosophy:**
- Separation of **planned** (forecasted) vs **actual** (realized) transactions
- Month-based financial planning with cross-month transaction support
- Account-level balance tracking with monthly snapshots
- Category-based budgeting with type classification (income/expense/saving)

---

## 2. Data Model

### 2.1 Accounts
```
{
  id: UUID (primary key)
  userId: string (multi-tenancy)
  name: string (e.g., "Salary Account", "Savings Account")
  initialBalance: decimal (INR, precision 12,2)
  hiddenFromDashboard: boolean (default: false)
  createdAt: timestamp
}
```

**Purpose:** Represents user's bank accounts, wallets, or financial repositories
**Rules:**
- Each user can have multiple accounts
- `initialBalance` serves as the account's starting point
- `hiddenFromDashboard` hides account from dashboard totals but keeps it visible on Accounts page
- All dashboard calculations (total balance, monthly summaries) exclude hidden accounts
- Accounts page always shows ALL accounts with toggle to hide/show

### 2.2 Transactions
```
{
  id: UUID (primary key)
  userId: string
  accountId: UUID | null (nullable for planned until settlement)
  amount: decimal (precision 12,2)
  category: string (must exist in categories table)
  date: date (settlement date or planned date if isPlanned=true)
  plannedDate: date | null (original planned month anchor)
  isPlanned: boolean (true=pending, false=settled/actual)
  origin: 'planned' | 'manual' (where transaction was created)
  createdAt: timestamp
}
```

**Purpose:** Records all financial movements
**Key Concepts:**

- **Dual-Date System:**
  - `date`: When transaction physically occurred (settlement date)
  - `plannedDate`: When transaction was originally planned to occur
  - For planned-origin transactions: Use `plannedDate ?? date` for month belonging
  - Allows salary credited on last day of April to still belong to May planning

- **Transaction Lifecycle:**
  1. Created as planned (`isPlanned=true`, `origin='planned'`, `accountId=null`)
  2. Settled later with actual amount/account/date (`isPlanned=false`, `accountId` populated)
  3. `plannedDate` preserved throughout to maintain month context

- **Transaction Types:**
  - **Planned-origin pending:** Shows in "Pending Planned Items"
  - **Planned-origin settled:** Appears in both planned month AND settlement month
  - **Manual actual:** Created directly as actual transaction
  - **Manual pending:** Allows users to plan non-categorized actions

### 2.3 Categories
```
{
  id: UUID
  userId: string
  name: string (unique per user within type)
  type: 'expense' | 'income' | 'saving'
  createdAt: timestamp
}
```

**Default Categories:**
- **Income:** Salary
- **Expenses:** Food, Fuel, Medical, Travel/Tickets, EMI, Credit Card, Misc.
- **Savings:** SIP, Stock, Gold, Post Office RD

**Auto-initialization:** When user first accesses categories, defaults are auto-created
**Purpose:** Classify transactions for budgeting and reporting

### 2.4 Budgets
```
{
  id: UUID
  userId: string
  category: string
  limit: decimal (precision 12,2)
  month: integer (1-12)
  year: integer (YYYY)
  createdAt: timestamp
  unique constraint: (userId, category, month, year)
}
```

**Purpose:** Set spending limits per category per month
**Rules:**
- One budget per category per month (enforced via unique index)
- Limits apply to actual transactions in that month
- Used to track budget vs actuals

### 2.5 User Settings
```
{
  userId: string (primary key)
  locale: string (e.g., 'en-US', default: 'en-US')
  currency: string (e.g., 'INR', 'USD', default: 'USD')
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Purpose:** User preferences for display and formatting

### 2.6 Monthly Account Balances (Cached State)
```
{
  id: UUID
  userId: string
  accountId: UUID (foreign key to accounts)
  month: integer (1-12)
  year: integer (YYYY)
  openingBalance: decimal (balance at month start)
  closingBalance: decimal (balance at month end)
  createdAt: timestamp
  updatedAt: timestamp
  unique constraint: (userId, accountId, month, year)
}
```

**Purpose:** Pre-calculated monthly snapshots for performance
**Auto-generated:** Created on-demand when dashboard fetches current month
**Roll-forward Logic:**
1. Opening balance = previous month's closing balance
2. Add planned income for current month
3. Minus planned expenses/savings for current month
4. Result = projected closing balance

**Salary Roll-forward:** 
- Income transactions from planned-origin for the month are summed
- Added to opening balance of first (primary) account
- Allows salary credited mid/end month to flow into current month planning

### 2.7 Monthly Profiles (Legacy)
```
{
  id: UUID
  userId: string
  month: integer
  year: integer
  startingBalance: decimal
  monthlyIncome: decimal
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Status:** DEPRECATED (replaced by transaction-based roll-forward)
**Note:** Still in schema but no longer used; planned income now calculated from planned transactions

---

## 3. Core Features

### 3.1 Dashboard
**Purpose:** Real-time financial overview for current month

**Displays:**
- **Account Summary:** Total visible account balances
- **Monthly Opening Balance:** Sum of all visible account monthly opening balances
- **Planned vs Actual:** Comparison of planned net vs actual net for month
- **Unplanned Expenses:** Manual expenses not from planned origin
- **Projected Closing:** Opening + planned income - planned outflows
- **Unaccounted Amount:** (Current total balance) - (Projected closing)
- **Recent Transactions:** List of latest actual transactions

**Filtering:**
- Only visible accounts (where `hiddenFromDashboard=false`)
- Planned transactions: Use `plannedDate ?? date` for month membership
- Current month and year by default

**Key Calculations:**
```
Opening Balance = SUM(monthlyAccountBalances.openingBalance) for visible accounts
Planned Income = SUM(planned-origin transactions with category type='income' for month)
Planned Expenses = SUM(planned-origin with type='expense') 
Planned Savings = SUM(planned-origin with type='saving')
Planned Outflow = Planned Expenses + Planned Savings
Projected Closing = Opening + Planned Income - Planned Outflow
Unaccounted = (Current Visible Balance) - (Projected Closing)
```

### 3.2 Plan Page (Monthly Planning)
**Purpose:** Detailed month-by-month financial planning

**Sections:**
1. **Month Selector:** Choose any month/year to plan
2. **Monthly Roll-Forward Card:** Shows opening/closing by account
3. **Pending Planned Items:** Transactions to be settled
4. **Planned Income/Expenses/Savings:** Breakdown of all planned items
5. **Actual Transactions:** Already settled
6. **Projection Summary:** Income - Outflow = Net cash flow

**Workflows:**
- **Plan Transaction:** Create planned income/expense/saving
- **Settle Transaction:** Convert planned to actual with final amount/account/date
  - Preserves `plannedDate` to maintain month context
- **Edit/Delete:** Modify or remove transactions

**Key Difference from Dashboard:**
- Can plan for past/future months (not just current)
- Shows ALL transactions for selected month
- Includes both visible AND hidden account projections? **No:** Uses only visible accounts for projections

### 3.3 Transactions Page
**Purpose:** Complete transaction history with month-based filtering

**Displays:**
- **Month Selector:** Navigate by month/year
- **Pending Planned Items:** Transactions waiting to settle
- **Budget Categories:** Quick buttons to log expense for budgeted categories
- **Transaction Form:** Add actual or planned transactions
- **Actual Transactions:** Settled transactions for the month
- **Edit/Delete UI:** Modify or remove transactions

**Key Features:**
- **Copy Recurring:** Duplicate planned transaction across future months (1-60 months range)
  - Skips past/today dates
  - Each copy gets unique `plannedDate` for its target month
  - Only for `origin='planned'` transactions
- **Month-aware Filtering:** Shows transactions from both planned AND settlement months

### 3.4 Accounts Page
**Purpose:** Account management with balance tracking

**Displays:**
- **All Accounts:** Even hidden ones
- **Monthly Balances:** Opening/closing for current month per account
- **Account Actions:**
  - Edit name and initial balance
  - Toggle `hiddenFromDashboard` (🙈 / 👁 icons)
  - Delete account
  - View monthly breakdown

**Special Behaviors:**
- Hidden accounts don't affect dashboard totals
- Dashboard still shows "Accounts" as navigation item for visibility management
- Monthly balances computed for visible accounts only

### 3.5 Budgets Page
**Purpose:** Spending limits per category per month

**Displays:**
- **Month Selector:** Choose budget month
- **Category Budgets:** List of limits by category
- **Actual vs Budget:** Shows what's been spent vs limit

**Workflows:**
- **Create Budget:** Set limit for category/month
- **Edit/Delete Budget:** Modify limits
- **Progress Bars:** Visual representation of budget usage

### 3.6 Categories Page
**Purpose:** Transaction category management

**Displays:**
- **Expense Categories:** For purchases/outflows
- **Income Categories:** For salary/inflows
- **Saving Categories:** For investments/allocations

**Workflows:**
- **Create Custom Category:** Add user-specific categories
- **Add Suggested:** Bulk add recommended categories
- **Delete Unused:** Remove categories
- **Auto-init:** On first load, populates with defaults

---

## 4. Transaction Lifecycle & Workflows

### 4.1 Planned Transaction Journey

**State Transitions:**
```
1. Created (Plan Page)
   - isPlanned=true, origin='planned', accountId=null
   - amount=estimated, category=selected
   - date=planned date, plannedDate=null (set same as date)
   
2. Pending (shows in "Pending Planned Items")
   - Appears on Plan & Transactions pages
   - Can be settled or deleted
   
3. Settled (User clicks "Settle")
   - isPlanned→false, accountId→selected account
   - amount→actual amount (may differ)
   - date→actual settlement date
   - plannedDate→PRESERVED (unchanged!)
   
4. Completed (shows in actual transactions)
   - Now affects account balance
   - Counted in actual amounts
   - Still tracked with originalplanned month
```

**Visibility Across Months:**
- Pending: Shows in planned month only
- Settled: Shows in BOTH planned month AND settlement month
  - Example: Planned May salary on Apr 30 → appears in Apr AND May

### 4.2 Manual Actual Transaction Journey

**State Transitions:**
```
1. Created (Transactions Page - "Add Actual")
   - isPlanned=false, origin='manual', accountId=required
   - Immediately settled with account assignment
   
2. Recorded (affects balance immediately)
   - Counted in actual totals for transaction date month
   - Does NOT appear in multiple months
```

### 4.3 Recurring Transaction Setup

**Purpose:** Handle monthly recurring expenses/income (insurance, salary, etc.)

**Workflow:**
1. Create planned transaction for first month
2. Click "📋 Copy" button
3. Select number of months (1-60)
4. System creates copies:
   - Each copy gets unique `plannedDate` for its target month
   - Amount preserved
   - Category preserved
   - Skips past/today dates automatically
   - Each copy is independent (settling one doesn't affect copies)

**Example:**
```
Create insurance premium for June 1
Copy across 12 months
System creates:
- Jul 1 (plannedDate=2026-07-01)
- Aug 1 (plannedDate=2026-08-01)
- ...
- Jun 1 2027 (plannedDate=2027-06-01)
Each can be settled independently with actual dates/amounts
```

---

## 5. Calculations & Financial Formulas

### 5.1 Amount Normalization

**Rule:** All amounts normalized by category type
```typescript
function normalize(tx: Transaction): number {
  const raw = Number(tx.amount);
  const categoryType = typeByName.get(tx.category);
  
  if (categoryType === 'income')
    return Math.abs(raw);  // Always positive
  if (categoryType === 'expense' || 'saving')
    return -Math.abs(raw); // Always negative
  return raw;
}
```

**Rationale:**
- Income adds to balance (positive)
- Expense/Saving removes from balance (negative)
- When stored, amounts stored as raw values
- Normalized for calculations only

### 5.2 Monthly Opening Balance

**Formula:**
```
Opening[month] = Closing[month-1] + RollforwardIncome
```

**Where:**
- Closing[month-1] = previous month's closing balance
- RollforwardIncome = SUM(planned-origin transactions where category.type='income' for month)

**Purpose:** Accounts for salary credited early/late but still belonging to planned month

**Example:**
```
May closing balance: ₹50,000
June salary (actually credited May 30): ₹100,000
  - Planned for June (plannedDate=2026-06-01)
  - Actually credited May 30 (date=2026-05-30)
  
June opening = ₹50,000 + ₹100,000 = ₹150,000
(Income transaction counted in BOTH May actuals AND June projections)
```

### 5.3 Monthly Closing Balance (Projection)

**Formula:**
```
ProjectedClosing = Opening + PlannedIncome - PlannedOutflow
```

**Where:**
- PlannedIncome = SUM(planned-origin transactions with type='income')
- PlannedOutflow = SUM(planned-origin with type='expense') + SUM(planned-origin with type='saving')

**Includes:**
- Both settled and pending planned transactions
- Only transactions with `origin='planned'`
- Uses `plannedDate ?? date` for month membership

### 5.4 Actual Monthly Net

**Formula:**
```
ActualNet = ActualIncome - ActualExpenses
```

**Where:**
- ActualIncome = SUM(settled transactions where type='income')
- ActualExpenses = SUM(settled transactions where type='expense' OR type='saving')

### 5.5 Planned vs Actual Variance

**Formula:**
```
Variance = Planned - Actual
Unplanned Expenses = Actual Expenses not from planned-origin
```

**Purpose:** Identify budget overruns and spontaneous spending

### 5.6 Account Balance Calculations

**Current Balance:**
```
CurrentBalance[account] = InitialBalance + AllSettledTransactions[account]
```

**Visible Accounts Total:**
```
TotalVisibleBalance = SUM(CurrentBalance[account] for account in visibleAccounts)
```

**Dashboard Projection:**
```
Unaccounted = TotalVisibleBalance - ProjectedClosing
```

**Positive unaccounted:** More money than expected (good news)
**Negative unaccounted:** Less money than expected (investigation needed)

---

## 6. Month-Based Filtering Logic

### 6.1 Transaction Month Membership

**For Planned-Origin Transactions (where plannedDate exists):**
```
transactionBelongsToMonth(tx) = 
  (plannedDate month/year matches selected month) OR (settlement date month/year matches selected month)
```

**Example:**
```
Transaction: planned for May, settled in June
- Selecting May: ✅ shows (plannedDate matches)
- Selecting June: ✅ shows (settlement date matches)
```

**For Manual Transactions:**
```
transactionBelongsToMonth(tx) = (settlement date month/year matches selected month)
```

**No cross-month appearance for manual transactions**

### 6.2 Dashboard & Plan Month Filtering

- **Dashboard:** Always current month
- **Plan:** User-selected month
- Both use identical filtering logic
- Planned transactions appear in multiple months if applicable

### 6.3 Query Parameter Support

**API endpoint:** `/api/transactions?month=M&year=Y`

**Behavior:**
- If month/year not provided: Return all transactions
- Transactions page: Defaults to current month
- Plan page: User selects month via UI

---

## 7. Account Visibility System

### 7.1 Hidden Accounts Behavior

**When `hiddenFromDashboard=true`:**
- ❌ NOT included in dashboard total balance
- ❌ NOT included in dashboard opening/closing
- ❌ NOT included in monthly roll-forward calculations
- ✅ Still visible on Accounts page
- ✅ Can be unhidden with toggle
- ✅ Still fully functional for transaction recording

**Use Cases:**
- Old accounts no longer in use
- Loans/debts (exclude from "cash in hand")
- Managed separately from daily operations

### 7.2 Account Lists by Page

| Page | Visible Accounts | Hidden Accounts |
|------|------------------|-----------------|
| Dashboard | ✅ | ❌ |
| Plan | ✅ for projections | ❌ |
| Accounts | ✅ with total | ✅ with status |
| Transactions | N/A (not listed) | N/A |

### 7.3 Toggle UI

**Accounts Page:**
```
For each account:
  [Account Name] [Balance]
  Button: "🙈 Exclude from dashboards" OR "👁 Include in dashboards"
  When hidden: ⚠️ badge showing "Excluded from dashboard"
```

---

## 8. Global Loading & Asynchronous Behavior

### 8.1 GlobalLoaderProvider

**Purpose:** Unified loading indicator for all network operations

**Tracks:**
- All `window.fetch()` calls globally
- Route transitions (pathname changes)
- Auto-shows modal overlay during activity
- 120ms debounce to prevent flicker

**User Experience:**
- Automatic, no per-page configuration needed
- Consistent across entire app
- Prevents double-clicks and premature navigation

### 8.2 ConfirmModal Component

**Purpose:** Consistent confirmation dialogs

**Used For:**
- Delete operations (accounts, transactions, budgets, categories)
- Bulk operations (add suggested categories)
- Destructive actions requiring confirmation

**Tones:**
- `tone='danger'`: Red button, warning icon (for delete)
- `tone='primary'`: Blue button (for confirmations)

---

## 9. User Settings & Localization

### 9.1 Supported Settings

**Locale:**
- Affects number/date formatting
- Default: 'en-US'

**Currency:**
- Used for formatting display
- Default: 'USD'
- Supported: 'INR', 'USD', 'EUR', etc.

**Auto-creation:**
- User settings created on first dashboard load
- Defaults based on browser language/locale

### 9.2 Formatting Functions

**Currency Formatting:**
```typescript
formatMoney(amount: number, settings): string
// Returns: "₹1,00,000.00" or "$100,000.00" based on currency
```

---

## 10. API Endpoints Overview

### 10.1 Transactions

**GET /api/transactions**
- Query params: `?month=M&year=Y` (optional)
- Returns: Transaction[] with filtering applied
- Applies month filtering logic if params provided

**POST /api/transactions**
- Body: `{ accountId?, amount, category, date, isPlanned?, origin? }`
- Returns: Created transaction
- Validates account ownership, category existence

**PATCH /api/transactions/[id]**
- Body: `{ accountId?, amount, category, date }`
- Returns: Updated transaction
- Preserves `plannedDate` always
- Comment: "Never overwrite plannedDate — it anchors the transaction to its original planned month."

**DELETE /api/transactions**
- Body: `{ id }`
- Deletes transaction

**POST /api/transactions/copy**
- Body: `{ transactionId, numMonths (1-60) }`
- Returns: `{ copied: number, copies: Transaction[] }`
- Only for `origin='planned'` transactions
- Skips past/today dates

### 10.2 Accounts

**GET /api/accounts**
- Returns: Account[] for user
- Includes hidden accounts

**POST /api/accounts**
- Body: `{ name, initialBalance? }`
- Creates new account

**PATCH /api/accounts/[id]**
- Body: `{ name?, initialBalance?, hiddenFromDashboard? }`
- Updates account

**DELETE /api/accounts**
- Body: `{ id }`
- Cascades to associated transactions (set accountId=null)

### 10.3 Categories

**GET /api/categories**
- Returns: Category[] for user
- Auto-initializes with defaults if empty

**POST /api/categories**
- Body: `{ name, type }` OR `[{ name, type }, ...]` (bulk)
- Creates categories
- Checks for duplicates

**DELETE /api/categories**
- Body: `{ id }`
- Soft-deletes only if not used in transactions

### 10.4 Budgets

**GET /api/budgets**
- Query params: `?month=M&year=Y` (required)
- Returns: Budget[] for month

**POST /api/budgets**
- Body: `{ category, limit, month, year }`
- Creates/updates budget for category/month

**DELETE /api/budgets**
- Body: `{ id }`
- Removes budget

### 10.5 Monthly Account Balances

**GET /api/monthly-account-balances**
- Query params: `?month=M&year=Y` (required)
- Returns: MonthlyAccountBalance[]
- Auto-creates missing entries via roll-forward logic

### 10.6 User Settings

**GET /api/user-settings**
- Returns: UserSettings (current user)

**PATCH /api/user-settings**
- Body: `{ locale?, currency? }`
- Updates settings

---

## 11. Workflows & User Stories

### 11.1 Monthly Planning Workflow

```
1. User opens Plan page for June
2. Views opening balance (May closing + Jun salary roll-forward)
3. Creates planned transactions:
   - Salary: ₹100,000 (income)
   - Expenses: ₹30,000 (food, travel, etc.)
   - Savings: ₹20,000 (SIP, stocks)
4. System shows projection:
   - Opening: ₹50,000
   - Income: ₹100,000
   - Outflow: ₹50,000
   - Projected: ₹100,000
5. Throughout month, user settles transactions as they occur
6. Next month, June closing becomes July opening
```

### 11.2 Actual Transaction Recording

```
1. User makes purchase (₹500 for groceries)
2. Opens Transactions page
3. Selects current month
4. Clicks "Add Transaction":
   - Account: "Salary Account"
   - Category: "Food"
   - Amount: 500
   - Date: today
   - Type: Actual
5. Transaction recorded immediately
6. Visible in Recent Transactions on Dashboard
7. Counted in month totals
```

### 11.3 Recurring Expense Setup

```
1. User creates insurance EMI: ₹5,000 on 5th of each month
2. Plans for June 5
3. Clicks "📋 Copy" → Selects 12 months
4. System creates copies for Jul-Jun next year
5. Each month:
   - Sees pending transaction on 5th
   - Clicks "Settle" with actual amount/account/date
   - Settles independently
6. Can modify or delete any copy without affecting others
```

### 11.4 Budget Tracking

```
1. User sets June Food budget: ₹8,000
2. Makes purchases: ₹2,000, ₹3,000, ₹1,500
3. Budgets page shows:
   - Category: Food
   - Budget: ₹8,000
   - Spent: ₹6,500
   - Remaining: ₹1,500
4. If overspends, dashboard shows "Unplanned Expenses"
```

### 11.5 Account Management

```
1. User has 3 accounts: Salary, Savings, Old
2. Opens Accounts page
3. Sees all balances with monthly breakdowns
4. Clicks "🙈 Exclude" on Old account
5. Dashboard updates:
   - Old account balance not counted
   - Opening/closing recalculated for visible only
   - Plan projections updated
6. Old account still shows on Accounts page for reference
```

---

## 12. Edge Cases & Special Behaviors

### 12.1 Salary Credited Early/Late

**Scenario:** Monthly salary usually credited on last day of month, but sometimes mid-month

**Solution:** `plannedDate` anchoring
- Plan salary for intended month (May 1)
- Actually credited April 30
- Salary appears in April settlement month AND May projection
- Both amounts accurate in respective months

### 12.2 Settling Planned Transaction with Different Date

**Scenario:** Plan expense for June 15, actually occurs June 20

**Behavior:**
- `plannedDate` stays as June 15 (unchanged)
- `date` updates to June 20
- Transaction still appears in June (both dates in same month)
- If settled July 5:
  - Appears in June (plannedDate) AND July (settlement date)

### 12.3 Deleting Account

**Cascade:** 
- All associated transactions get `accountId=null`
- Transactions preserved, just unlinked from account
- Balances recalculated

### 12.4 Empty Month

- Opening = previous closing
- No planned transactions
- Projection = opening (unchanged)
- No actual transactions
- Monthly page shows "No transactions for this month"

### 12.5 No Categories

- Dashboard shows error: "No categories — add some in Categories"
- Form inputs disabled
- First load auto-initializes defaults

### 12.6 Year Boundary

**Dec → Jan:**
- Month value wraps: Dec (12) → Jan (1)
- Year increments automatically
- Roll-forward calculates correctly across year boundary

**Copy across year boundary:**
- 12-month copy in June creates entries through May next year
- Handles year increment correctly

---

## 13. Validation Rules

### 13.1 Transaction Creation

- **Amount:** Required, must be > 0
- **Category:** Required, must exist for user
- **Date:** Required, must be valid date
- **Account (for actual):** Required, must belong to user
- **Account (for planned):** Optional until settlement

### 13.2 Budget Creation

- **Category:** Required, must exist
- **Limit:** Required, must be > 0
- **Month/Year:** Required, valid range (1-12, YYYY)
- **Uniqueness:** Only one budget per category per month

### 13.3 Account Creation

- **Name:** Required, non-empty string
- **InitialBalance:** Optional, defaults to 0
- **Uniqueness:** No enforced (user can have duplicate names)

### 13.4 Category Creation

- **Name:** Required, non-empty string
- **Type:** Required, must be 'expense' | 'income' | 'saving'
- **Uniqueness:** No duplicate type::name for user

---

## 14. Performance Considerations

### 14.1 Data Fetching

**Dashboard:**
- Single month (current)
- Fetches: accounts, categories, transactions, monthlyAccountBalances, budgets
- ~1000s transactions manageable
- Filters applied server-side

**Plan Page:**
- User-selected month
- Fetches: accounts, categories, transactions, monthlyAccountBalances
- Refetches on month change

**Transactions Page:**
- Current month by default
- Filters: month/year query params applied server-side

### 14.2 Caching

**Monthly Account Balances:**
- Pre-calculated and stored in DB
- Queried not calculated on-demand
- Updated on-demand if missing

**Categories:**
- Fetched once per session
- Reasonable size (< 100 usually)

### 14.3 Bulk Operations

**Copy Transactions:**
- Bulk insert all copies in single query
- Returns count created
- Efficient for 12-60 copies

**Add Suggested Categories:**
- Bulk insert in single query
- Checks for duplicates before insert

---

## 15. Error Handling

### 15.1 Auth Errors

**401 Unauthorized:**
- All endpoints return 401 if not authenticated
- Redirects to login
- Clerk handles session management

### 15.2 Validation Errors

**400 Bad Request:**
- Missing required fields
- Invalid values (negative amounts, invalid dates)
- Non-existent resources accessed

**Example:**
```json
{ "error": "Missing required fields: accountId for actual transaction" }
```

### 15.3 JSON Parsing Errors

**Handle empty response bodies:**
```typescript
async function readJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}
```

### 15.4 Not Found Errors

**404 Not Found:**
- Account doesn't exist
- Transaction doesn't exist
- Category doesn't exist

### 15.5 Server Errors

**500 Server Error:**
- Database connection failures
- Unexpected errors during processing

---

## 16. Summary of Key Behaviors

| Feature | Behavior | Notes |
|---------|----------|-------|
| Planned Transaction | Settles with actual amount/date, preserves plannedDate | Cross-month visibility |
| Manual Transaction | Recorded immediately with account | Single month only |
| Recurring Setup | Copy across 1-60 months | Each independent |
| Hidden Accounts | Excluded from dashboard totals | Visible on Accounts page |
| Month Filtering | Planned uses dual-date logic | Manual uses settlement date only |
| Opening Balance | Previous closing + planned income | Salary roll-forward |
| Closing Projection | Opening + income - outflow | Stable across settlement status |
| Amount Normalization | Income=+, Expense/Saving=- | Applied during calculation |
| Global Loader | Auto-tracks all fetches | 120ms debounce |
| Settings | Locale + currency per user | Auto-initialized |
| Categories | Auto-init with defaults | Bulk add supported |

---

**Document Version:** 1.0  
**Last Updated:** May 25, 2026  
**Scope:** Complete functional specification for FinPlanner Next.js application
