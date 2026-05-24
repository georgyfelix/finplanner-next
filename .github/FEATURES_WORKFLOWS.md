# FinPlanner - Features & User Workflows

## 1. Dashboard Feature

### 1.1 Purpose & Overview

**Dashboard** is the home page landing view that provides a real-time financial snapshot for the current month. It answers the question: "Where am I financially this month?"

### 1.2 Display Components

#### 1.2.1 Account Summary Card
```
┌─────────────────────────────────────┐
│ Total Visible Accounts: ₹1,50,000   │
└─────────────────────────────────────┘
```
**Calculation:**
```
TotalVisibleBalance = SUM(initialBalance + all settled transactions) 
  for all accounts where hiddenFromDashboard=false
```

**Updates:** Real-time as transactions are added
**Excludes:** Hidden accounts entirely

#### 1.2.2 Monthly Opening Balance
```
┌─────────────────────────────────────┐
│ Monthly Opening: ₹50,000            │
│ (Sum of all account opening balances)
└─────────────────────────────────────┘
```

**Calculation:**
```
Opening = SUM(monthlyAccountBalances.openingBalance)
  for visible accounts in current month

Opening = Previous Month Closing + Planned Income Roll-Forward
```

**When visible:** Shows per-account breakdown option

#### 1.2.3 Planned vs Actual Section
```
┌──────────────────────────────────────────┐
│ PLANNED INCOME          ₹100,000         │
│ - PLANNED EXPENSES      ₹30,000          │
│ - PLANNED SAVINGS       ₹20,000          │
│ = PLANNED NET           ₹50,000          │
│                                          │
│ ACTUAL INCOME           ₹100,000         │
│ - ACTUAL EXPENSES       ₹28,000          │
│ = ACTUAL NET            ₹72,000          │
│                                          │
│ UNPLANNED EXPENSES      ₹2,000           │
│ (Expenses not from planned)              │
└──────────────────────────────────────────┘
```

**Calculations:**
```
PlannedIncome = SUM(transactions where:
  - origin='planned'
  - category.type='income'
  - plannedDate in [current month])

PlannedExpenses = SUM(transactions where:
  - origin='planned'
  - category.type='expense'
  - plannedDate in [current month])

PlannedSavings = SUM(transactions where:
  - origin='planned'
  - category.type='saving'
  - plannedDate in [current month])

ActualNet = ActualIncome - (ActualExpenses + ActualSavings)
```

#### 1.2.4 Projection Summary
```
┌────────────────────────────────────┐
│ Projected Closing    ₹100,000      │
│ Current Total Balance ₹102,000     │
│ Unaccounted          ₹2,000        │
│ (Positive: extra savings!)         │
└────────────────────────────────────┘
```

**Calculations:**
```
ProjectedClosing = Opening + PlannedIncome - (PlannedExpenses + PlannedSavings)

CurrentTotalBalance = SUM(account.initialBalance + settled transactions)

Unaccounted = CurrentTotalBalance - ProjectedClosing
```

**Interpretation:**
- **Positive:** More money than projected (good!)
- **Negative:** Less money than projected (investigate)
- **Zero/Near-zero:** Accurate planning

#### 1.2.5 Recent Actual Transactions
```
┌──────────────────────────────────────┐
│ Date     Category   Amount    Account│
├──────────────────────────────────────┤
│ May 24   Food      -₹500     Salary  │
│ May 23   Fuel      -₹1,500   Salary  │
│ May 20   Salary    +₹100,000 Salary  │
│ May 15   SIP       -₹5,000   Savings │
└──────────────────────────────────────┘
```

**Shows:** Last 10-20 settled transactions for month
**Sorted:** Newest first
**Links:** Click to edit or view details

### 1.3 Hidden Account Behavior

**When Account is Hidden (`hiddenFromDashboard=true`):**
- ❌ NOT counted in total balance
- ❌ NOT shown in account list
- ❌ NOT used in opening/closing calculations
- ✅ Shown on Accounts page
- ✅ Can be unhidden

**Use Cases:**
- Old inactive accounts
- Loan accounts (debt)
- Accounts managed separately
- Temporary exclusion

**Example:**
```
All Accounts:
- Salary: ₹50,000
- Savings: ₹30,000
- Loan: ₹20,000 (hidden)

Dashboard Shows:
- Total: ₹80,000 (excludes Loan)

Accounts Page Shows:
- Salary: ₹50,000 ✓
- Savings: ₹30,000 ✓
- Loan: ₹20,000 ⚠️ (excluded from dashboard)
```

### 1.4 Workflow Examples

#### 1.4.1 Scenario: Starting Month
```
1. Dashboard opens
2. Shows:
   - Opening: ₹50,000 (previous closing)
   - No planned transactions yet
   - Projected: ₹50,000
   - Current: ₹50,000
   - Unaccounted: ₹0
```

#### 1.4.2 Scenario: After Planning
```
1. User plans for May:
   - Salary: +₹100,000
   - Expenses: -₹30,000
   - Savings: -₹20,000

2. Dashboard shows:
   - Opening: ₹50,000
   - Planned: +₹50,000 net
   - Projected: ₹100,000
   - Current: ₹50,000 (no actual transactions yet)
   - Unaccounted: -₹50,000 (more spending needed)
```

#### 1.4.3 Scenario: Mid-Month Transactions
```
1. User settles planned transactions:
   - Salary credited: ₹100,000 ✓
   - Groceries: -₹500

2. Dashboard updates:
   - Actual: +₹99,500 net
   - Current: ₹150,000
   - Projected: ₹100,000
   - Unaccounted: ₹50,000 (ahead of plan)
```

---

## 2. Plan Page Feature

### 2.1 Purpose & Overview

**Plan** page enables month-by-month financial planning with transaction creation, settlement, and projection tracking.

### 2.2 Month Selector

**UI:**
```
┌─────────────────────────────────┐
│ Plan for: [June    ] [2026    ] │
└─────────────────────────────────┘
```

**Behavior:**
- Default: Current month
- Can select any past/future month
- Fetches transactions for that month
- Refetches data on month change

### 2.3 Monthly Roll-Forward Section

**Displays:**
```
┌──────────────────────────────────────┐
│ MONTHLY ROLL-FORWARD                 │
├──────────────────────────────────────┤
│ Account            Opening  Closing  │
├──────────────────────────────────────┤
│ Salary Account     ₹50,000  ₹95,000 │
│ Savings Account    ₹30,000  ₹35,000 │
├──────────────────────────────────────┤
│ Total Opening      ₹80,000           │
│ Total Closing      ₹130,000          │
└──────────────────────────────────────┘
```

**Calculation:**
```
For each account:
  Opening = PreviousClosing + PlannedIncome (salary roll-forward)
  Closing = Opening + PlannedIncome - (PlannedExpenses + PlannedSavings)

Totals = SUM for all visible accounts
```

**Only includes:** Visible accounts (`hiddenFromDashboard=false`)

### 2.4 Pending Planned Items Section

**Displays:**
```
┌──────────────────────────────────────────────────┐
│ PENDING PLANNED ITEMS (June 2026)   [4 pending] │
├──────────────────────────────────────────────────┤
│ Salary           +₹100,000   ✔ Settle  📋 Copy │
│ Groceries        -₹500       ✔ Settle  📋 Copy │
│ Fuel             -₹1,500     ✔ Settle  📋 Copy │
│ Insurance        -₹2,000     ✔ Settle  📋 Copy │
└──────────────────────────────────────────────────┘
```

**Shows:** All planned-origin transactions with `isPlanned=true`
**Sorted:** By planned date
**Actions:**
- **Settle:** Convert to actual with final amount/account/date
- **Copy:** Duplicate across future months
- **Delete:** Remove the planned item

### 2.5 Planned Income/Expenses/Savings Breakdown

**Displays:**
```
┌────────────────────────────────────┐
│ PLANNED INCOME        ₹100,000     │
│ └─ Salary: ₹100,000                │
│                                    │
│ PLANNED EXPENSES      ₹2,000       │
│ └─ Groceries: ₹500                 │
│ └─ Fuel: ₹1,500                    │
│                                    │
│ PLANNED SAVINGS       ₹0           │
│                                    │
│ PLANNED OUTFLOW       ₹2,000       │
│ NET PLANNED           ₹98,000      │
│                                    │
│ Opening Balance       ₹80,000      │
│ + Net Planned         ₹98,000      │
│ = Projected Closing   ₹178,000     │
└────────────────────────────────────┘
```

**Note:** Includes ALL planned-origin transactions (pending + settled)

### 2.6 Actual Transactions Section

**Displays:**
```
┌─────────────────────────────────────┐
│ ACTUAL TRANSACTIONS (June 2026)     │
├─────────────────────────────────────┤
│ Salary (settled from plan)  ₹100,000
│ ATM withdrawal              -₹2,000 │
│ Bonus (manual entry)        ₹15,000 │
└─────────────────────────────────────┘
```

**Shows:**
- Settled planned transactions
- Manual actual transactions
- NOT planned pending items

### 2.7 Add Planned Transaction Form

**UI:**
```
┌──────────────────────────────────────┐
│ ADD PLANNED TRANSACTION              │
├──────────────────────────────────────┤
│ Category:      [Salary        ▼]    │
│ Amount:        [₹_________]          │
│ Planned Date:  [2026-06-01  ]        │
│ [Create] [Cancel]                    │
└──────────────────────────────────────┘
```

**Workflow:**
1. Select category (income/expense/saving)
2. Enter amount
3. Set planned date
4. Click Create
5. Transaction added to pending list
6. Becomes settleable

### 2.8 Settle Planned Transaction Workflow

**Trigger:** User clicks "✔ Settle"

**Modal Opens:**
```
┌─────────────────────────────────────┐
│ SETTLE PLANNED TRANSACTION          │
├─────────────────────────────────────┤
│ Original Plan: Salary ₹100,000      │
│                                     │
│ Account:    [Salary Account  ▼]    │
│ Amount:     [₹100000]               │
│ Category:   [Salary        ▼]      │
│ Date:       [2026-06-01  ]          │
│                                     │
│ [Cancel] [Save Actual]              │
└─────────────────────────────────────┘
```

**Key Behavior:**
- `plannedDate` NOT shown/editable
- **Preserved internally** (critical!)
- Other fields can change

**On Submit:**
- `isPlanned` → `false`
- `accountId` → selected account
- `amount` → entered amount (may differ)
- `date` → settlement date (may differ)
- `plannedDate` → unchanged

**Visibility After:**
- Now appears in "Actual Transactions"
- Still appears in "Planned Income" totals
- Counts in both planned AND settlement month

### 2.9 Delete Planned Transaction

**Confirmation Modal:**
```
┌─────────────────────────────────────┐
│ ⚠ Delete planned transaction?       │
│ This cannot be undone.              │
│ [Cancel] [Delete]                   │
└─────────────────────────────────────┘
```

**Result:** Transaction permanently removed
**Note:** If settled, data preserved in history

---

## 3. Transactions Page Feature

### 3.1 Purpose & Overview

**Transactions** page provides complete transaction management with monthly filtering, recurring setup, and settlement.

### 3.2 Month Selector with Default

**UI:**
```
┌─────────────────────────────────┐
│ Month: [May      ] Year: [2026 ]│
└─────────────────────────────────┘
```

**Behavior:**
- Default: Current month
- Filters all lists to selected month
- Date range: Full month (1st to last day)

### 3.3 Pending Planned Items List

**Displays:**
```
┌────────────────────────────────────────────┐
│ PENDING PLANNED ITEMS (May 2026) [3 items]│
├────────────────────────────────────────────┤
│ Salary                ₹100,000             │
│ Planned: 2026-05-01   📋 Copy  ✔ Settle   │
│                                            │
│ Groceries (Recurring)  -₹500               │
│ Planned: 2026-05-10    📋 Copy  ✔ Settle   │
│                                            │
│ Insurance EMI          -₹2,000             │
│ Planned: 2026-05-15    📋 Copy  ✔ Settle   │
└────────────────────────────────────────────┘
```

**Actions Available:**
- **📋 Copy:** Duplicate across 1-60 months
- **✔ Settle:** Convert to actual with account/date
- **🗑 Delete:** Remove planned item

### 3.4 Copy Recurring Transaction Workflow

**Trigger:** User clicks "📋 Copy" button

**Modal Opens:**
```
┌─────────────────────────────────┐
│ 📋 COPY ACROSS MONTHS           │
├─────────────────────────────────┤
│ How many months ahead?          │
│                                 │
│ [−] [12        ] [+]            │
│ Range: 1-60 months              │
│                                 │
│ [Cancel] [Create Copies]        │
└─────────────────────────────────┘
```

**Workflow:**
1. User enters number (1-60)
2. Clicks "Create Copies"
3. API creates transactions for next N months
4. Each copy:
   - Gets unique `plannedDate` for target month
   - Amount preserved
   - Category preserved
   - Independent from original
5. Skips past/today dates automatically
6. Result appears in Pending list

**Example:**
```
Create on May 15, copy insurance EMI across 12 months:
System creates:
- Jun 15 (settles as 2026-06-01 to 2026-06-30)
- Jul 15 (settles as 2026-07-01 to 2026-07-31)
- ...
- May 15 2027

Each can be settled independently:
- Jun: Actually paid June 20 (different date, same month)
- Jul: Actually paid August 5 (different month)
  → Appears in BOTH July AND August
```

**Important:** Changes to one copy don't affect others

### 3.5 Budget Categories Quick-Add

**Displays:**
```
┌──────────────────────────────────────┐
│ BUDGET CATEGORIES (May 2026)         │
├──────────────────────────────────────┤
│ Food Limit: ₹8,000   [⤴ Use in form]│
│ Fuel Limit: ₹3,000   [⤴ Use in form]│
│ Travel Limit: ₹2,000 [⤴ Use in form]│
└──────────────────────────────────────┘
```

**Purpose:** Quick buttons to log expenses for budgeted categories
**Behavior:** Clicking pre-fills category in form below

### 3.6 Add Transaction Form

**UI:**
```
┌─────────────────────────────────────┐
│ ADD TRANSACTION                     │
├─────────────────────────────────────┤
│ ☑ Planned  (toggle checkbox)        │
│                                     │
│ Account:    [Salary Account  ▼]*   │
│ Category:   [Food           ▼]    │
│ Amount:     [₹___________]          │
│ Date:       [2026-05-25   ]         │
│                                     │
│ [Create]                            │
│ * Required for actual only          │
└─────────────────────────────────────┘
```

**Behavior:**
- Check "Planned" → Account becomes optional
- Uncheck → Account required
- Amount > 0, date valid
- Category selected

**On Submit:**
- If planned: Added to pending list
- If actual: Added to actual transactions immediately

### 3.7 Edit Transaction Modal

**Shows:**
```
┌──────────────────────────────────────┐
│ EDIT TRANSACTION                    │
├──────────────────────────────────────┤
│ Account:    [Salary Account  ▼]    │
│ Amount:     [500            ]       │
│ Category:   [Food           ▼]    │
│ Date:       [2026-05-25   ]         │
│                                     │
│ [Cancel] [Save Changes]             │
└──────────────────────────────────────┘
```

**Fields:**
- Account (if actual)
- Amount
- Category
- Date

**Note:** `plannedDate` never shown/edited (preserved)

### 3.8 Actual Transactions List

**Displays:**
```
┌────────────────────────────────────────────┐
│ ACTUAL TRANSACTIONS (May 2026) [15 items]  │
├────────────────────────────────────────────┤
│ May 25  Food        -₹500    Salary   ✎ 🗑│
│ May 24  Travel      -₹800    Salary   ✎ 🗑│
│ May 20  Salary      +₹100k   Salary   ✎ 🗑│
│ May 15  SIP         -₹5,000  Savings  ✎ 🗑│
└────────────────────────────────────────────┘
```

**Sorted:** Newest first
**Actions:** Edit (✎) or Delete (🗑)
**Color coded:**
- Green: Income/Savings
- Red: Expenses

---

## 4. Accounts Page Feature

### 4.1 Purpose & Overview

**Accounts** page enables account creation, management, and visibility control.

### 4.2 Account List with Balances

**Displays:**
```
┌──────────────────────────────────────────────────┐
│ ACCOUNTS                                         │
├──────────────────────────────────────────────────┤
│ Salary Account                    ₹50,000       │
│ Opening (May): ₹25,000  Closing: ₹50,000        │
│ [✎ Edit] [🙈 Exclude from dashboards] [🗑 Delete]
│                                                  │
│ Savings Account                   ₹30,000       │
│ Opening (May): ₹28,000  Closing: ₹30,000        │
│ [✎ Edit] [👁 Include in dashboards] [🗑 Delete] │
│ (⚠️ Excluded from dashboard)                     │
│                                                  │
│ Old Account (Hidden)              ₹10,000       │
│ [✎ Edit] [👁 Include in dashboards] [🗑 Delete] │
└──────────────────────────────────────────────────┘
```

**Displays:**
- Account name
- Current balance
- Monthly opening/closing
- Toggle button
- Edit/Delete buttons
- Status indicator if hidden

### 4.3 Hidden Account Toggle

**For Visible Account:**
```
[🙈 Exclude from dashboards]
```
**Click** → `hiddenFromDashboard=true` → Excluded

**For Hidden Account:**
```
[👁 Include in dashboards]
```
**Click** → `hiddenFromDashboard=false` → Included

**With Warning Badge:**
```
Old Account                          ₹10,000
⚠️ Excluded from dashboard
[👁 Include in dashboards]
```

### 4.4 Edit Account Modal

**UI:**
```
┌───────────────────────────────────┐
│ EDIT ACCOUNT                      │
├───────────────────────────────────┤
│ Account Name: [Salary Account   ]│
│ Initial Balance: [₹50000        ]│
│ ☐ Exclude from dashboards       │
│                                   │
│ [Cancel] [Save Changes]           │
└───────────────────────────────────┘
```

**Fields:**
- Name (editable)
- Initial balance (can adjust)
- Hide toggle

**Behavior:**
- Changes immediate
- Dashboard recalculates on save
- Monthly balances invalidated (recalc on next load)

### 4.5 Delete Account Workflow

**Confirmation:**
```
┌──────────────────────────────────┐
│ ⚠ Delete account?               │
│ Associated transactions preserved│
│ (unlinked from account)         │
│ [Cancel] [Delete]               │
└──────────────────────────────────┘
```

**On Delete:**
- Account removed
- Associated transactions get `accountId=null`
- Balances recalculated
- Dashboard updated

### 4.6 Monthly Account Breakdown

**Shows per Account:**
```
Salary Account - Monthly Breakdown
May 2026
  Opening: ₹25,000 (from April closing)
  Transactions:
    + ₹100,000 (Salary)
    - ₹500 (Groceries)
    - ₹1,500 (Fuel)
  Closing: ₹123,000
```

**Shows:** Detailed month-by-month for 12 months (current + future)

---

## 5. Categories Page Feature

### 5.1 Purpose & Overview

**Categories** page enables transaction classification and budget setup.

### 5.2 Category List by Type

**Displays:**
```
┌─────────────────────────────────────┐
│ EXPENSES                            │
├─────────────────────────────────────┤
│ Food              [✎ Edit] [🗑 Delete]
│ Fuel              [✎ Edit] [🗑 Delete]
│ Medical           [✎ Edit] [🗑 Delete]
│                                     │
│ INCOME                              │
├─────────────────────────────────────┤
│ Salary            [✎ Edit] [🗑 Delete]
│ Bonus             [✎ Edit] [🗑 Delete]
│                                     │
│ SAVINGS                             │
├─────────────────────────────────────┤
│ SIP               [✎ Edit] [🗑 Delete]
│ Stock Investment  [✎ Edit] [🗑 Delete]
└─────────────────────────────────────┘
```

**Grouped by:** Category type

### 5.3 Add Category Form

**UI:**
```
┌──────────────────────────────────────┐
│ ADD CATEGORY                         │
├──────────────────────────────────────┤
│ Name: [_______________]              │
│ Type: [Expense  ▼]                  │
│       └─ Expense                     │
│       └─ Income                      │
│       └─ Saving                      │
│                                      │
│ [Add Category]                       │
└──────────────────────────────────────┘
```

**Validation:**
- Name required
- Type required
- No duplicate (name + type) per user

### 5.4 Add Suggested Categories

**Shows:**
```
┌──────────────────────────────────────┐
│ SUGGESTED CATEGORIES [+ Add All (15)]│
├──────────────────────────────────────┤
│ ☐ KSFE 8000x100 (Savings)            │
│ ☐ KSFE 3000x50 (Savings)             │
│ ☐ LIC (Savings)                      │
│ ☐ Travel Savings (Savings)           │
│ ☐ EMI Scooter (Expenses)             │
│ ☐ Liya (Expenses)                    │
│ ☐ Appa (Expenses)                    │
│ ☐ Amma (Expenses)                    │
│ ☐ Netflix (Expenses)                 │
│ ☐ Spotify (Expenses)                 │
│                                      │
│ [+ Add All] [Cancel]                │
└──────────────────────────────────────┘
```

**"Add All" Workflow:**
1. Shows confirmation
2. Bulk-adds all suggested categories
3. Skips duplicates
4. Category list refreshes

### 5.5 Auto-Initialization

**First Load:**
- If no categories exist
- Auto-create default categories:
  - Income: Salary
  - Expenses: Food, Fuel, Medical, Travel, EMI, Credit Card, Misc
  - Savings: SIP, Stock, Gold, Post Office RD

---

## 6. Budgets Page Feature

### 6.1 Purpose & Overview

**Budgets** page enables monthly spending limits per category.

### 6.2 Budget Setup

**UI:**
```
┌────────────────────────────────────────┐
│ SET BUDGET FOR MAY 2026                │
├────────────────────────────────────────┤
│ Category: [Food            ▼]         │
│ Budget Limit: [₹8000      ]            │
│                                        │
│ [Set Budget]                           │
└────────────────────────────────────────┘
```

**Workflow:**
1. Select category
2. Enter limit
3. Click "Set Budget"
4. Creates or updates budget

### 6.3 Budget vs Actual Display

**Shows per Month:**
```
┌────────────────────────────────────────┐
│ MAY 2026 BUDGETS                       │
├────────────────────────────────────────┤
│ Food       Budget: ₹8,000              │
│            Spent:  ₹3,500              │
│            ▓▓▓░░░░░░░░░  43.75%       │
│            Remaining: ₹4,500           │
│                                        │
│ Fuel       Budget: ₹3,000              │
│            Spent:  ₹3,200              │
│            ▓▓▓▓░░░░░░░░  106.67% ⚠️   │
│            Over by: ₹200               │
│                                        │
│ Medical    Budget: ₹1,500              │
│            Spent:  ₹0                  │
│            ░░░░░░░░░░░░  0%           │
│            Remaining: ₹1,500           │
└────────────────────────────────────────┘
```

**Visualization:**
- Progress bar
- % spent
- Warning if over budget (⚠️)

### 6.4 Edit/Delete Budget

**Edit Modal:**
```
┌────────────────────────────────────────┐
│ EDIT BUDGET                            │
├────────────────────────────────────────┤
│ Category: Food (May 2026)              │
│ New Limit: [₹8000      ]               │
│                                        │
│ [Cancel] [Save Changes]                │
└────────────────────────────────────────┘
```

**Delete Confirmation:**
```
┌────────────────────────────────────────┐
│ ⚠ Delete budget?                      │
│ This only removes the limit, not the  │
│ transactions.                          │
│ [Cancel] [Delete]                      │
└────────────────────────────────────────┘
```

---

## 7. User Settings Feature

### 7.1 Purpose

**Settings** enables user preferences for display format and currency.

### 7.2 Display

**UI:**
```
┌────────────────────────────────────┐
│ USER SETTINGS                      │
├────────────────────────────────────┤
│ Locale: [en-US      ▼]             │
│ Currency: [INR      ▼]             │
│                                    │
│ Preview: ₹1,00,000.00              │
│                                    │
│ [Save Settings]                    │
└────────────────────────────────────┘
```

**Supported Locales:**
- en-US (English)
- en-IN (Indian English)

**Supported Currencies:**
- INR (₹)
- USD ($)
- EUR (€)

### 7.3 Auto-Creation

**First Load:**
- Browser language detected
- Settings auto-created if missing
- Default: en-US, USD

### 7.4 Format Examples

**INR Currency:**
- Amount: 1000000
- Display: ₹10,00,000.00 (Indian style with commas)

**USD Currency:**
- Amount: 1000000
- Display: $1,000,000.00 (Western style)

---

## 8. Global Loader Feature

### 8.1 Purpose

**GlobalLoaderProvider** provides unified loading feedback for all async operations.

### 8.2 Display

**During Loading:**
```
┌──────────────────────────┐
│  ⏳ Loading...           │
│  (spinner animation)     │
└──────────────────────────┘
(Dark overlay covers entire page)
```

### 8.3 Tracking

**Tracks:**
- All `window.fetch()` calls globally
- Route transitions (pathname changes)
- Shows modal overlay when active

**Debounce:**
- 120ms delay before showing
- Prevents flicker on quick operations
- Better UX for fast responses

### 8.4 Auto-Hide

**Hides when:**
- All fetch calls complete
- Route transition completes
- No active requests remain

---

## 9. Confirmation Modal Feature

### 9.1 Purpose

**ConfirmModal** provides consistent confirmation dialogs for destructive actions.

### 9.2 Display

**Danger Tone (Delete):**
```
┌────────────────────────────────┐
│ ⚠ Delete transaction?          │
│ This cannot be undone.         │
│ [Cancel] [Delete]              │
│          (red button)           │
└────────────────────────────────┘
```

**Primary Tone (Confirm):**
```
┌────────────────────────────────┐
│ Create multiple categories?    │
│ Add 15 suggested categories?   │
│ [Cancel] [Add All]             │
│          (blue button)          │
└────────────────────────────────┘
```

### 9.3 Usage

**Used For:**
- Delete account
- Delete transaction
- Delete budget
- Delete category
- Delete planned item
- Bulk add categories

---

## 10. Cross-Feature Interactions

### 10.1 Transaction Creation → Dashboard Update

```
User adds transaction (Plan page)
  ↓
POST /api/transactions
  ↓
Database: Transaction created
  ↓
Component: loadAll() called
  ↓
Fetches:
  - accounts
  - transactions
  - monthlyAccountBalances
  - categories
  ↓
Calculations:
  - Total balance recalculated
  - Monthly totals updated
  - Projections recomputed
  ↓
UI: Dashboard shows updated values
```

### 10.2 Account Hide/Show → Dashboard Recalc

```
User toggles "Exclude from dashboards"
  ↓
PATCH /api/accounts/[id] (hiddenFromDashboard toggled)
  ↓
Dashboard: Filter updated
  ↓
Calculations:
  - Visible accounts recalculated
  - Total balance excluding hidden
  - Opening/closing excluding hidden
  ↓
UI: Dashboard totals updated
```

### 10.3 Budget Set → Transactions Page Shows

```
User sets food budget ₹8,000 for May
  ↓
POST /api/budgets
  ↓
Transactions page: Fetches budgets
  ↓
Shows in "Budget Categories" section
  ↓
User clicks [⤴ Use in form]
  ↓
Form pre-filled with "Food" category
```

### 10.4 Month Change → All Pages Refetch

```
User selects June (from May) in Plan page
  ↓
setMonth(6) state updated
  ↓
useEffect dependency triggers
  ↓
loadAll() called with new month
  ↓
Fetches:
  - transactions (with ?month=6&year=2026)
  - monthlyAccountBalances (for June)
  - budgets (for June)
  ↓
UI: All displays updated for June
```

---

**Document Version:** 1.0  
**Last Updated:** May 25, 2026  
**Scope:** Complete feature descriptions and user workflows
