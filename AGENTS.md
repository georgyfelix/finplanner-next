# FinPlanner - Antigravity Agent Guidelines

This workspace is a personal finance management application called **FinPlanner**. This file provides instructions, architecture references, and core coding patterns for AI agents (like Antigravity) working on this codebase.

## 1. Project Context & Documentation

Full architectural specifications, user flows, and features are stored in the [.github](file:///e:/Georgy/Code/Finplanner/finplanner-next/.github) directory. Refer to them for deep-dives:
*   [Copilot/Agent Instructions](file:///e:/Georgy/Code/Finplanner/finplanner-next/.github/copilot-instructions.md) - Contains extensive coding rules, schemas, and API design patterns.
*   [Architecture Details](file:///e:/Georgy/Code/Finplanner/finplanner-next/.github/ARCHITECTURE.md) - Contains Entity Relationship Diagrams (ERD), data flow architecture, state diagrams, and multi-tenancy guides.
*   [Features & Workflows](file:///e:/Georgy/Code/Finplanner/finplanner-next/.github/FEATURES_WORKFLOWS.md) - Details features like Dashboard, Planning page, Transaction listing, Accounts visibility, Categories, and Budgets.
*   [Functional Specifications](file:///e:/Georgy/Code/Finplanner/finplanner-next/.github/FUNCTIONAL_SPEC.md) - Detailed breakdown of user interface behaviors and validation logic.

---

## 2. Core Coding Rules & Guidelines

When modifying this application, you **MUST** adhere to these architectural standards:

### 2.1 Transaction Lifecycle & Month Anchors
Transactions have a dual-date lifecycle representing planned-vs-actual states:
*   **Planned Date (`plannedDate`):** Anchors a transaction to its intended financial month.
*   **Actual Date (`date`):** The date the transaction actually occurred/settled.
*   ⚠️ **CRITICAL:** When settling a planned transaction, **NEVER overwrite or discard `plannedDate`**. It must be preserved to anchor the transaction to its original planning month.
*   **Dual-Month Listing:** Settled planned transactions appear in BOTH their planned month AND their settlement month. Manual (non-planned) transactions only filter by their actual `date`.

### 2.2 Account Visibility & Dashboard Calculations
*   Accounts can be excluded from dashboards using `hiddenFromDashboard: boolean`.
*   **Dashboard Calculations:** Always exclude hidden accounts (`userAccounts.filter(acc => !acc.hiddenFromDashboard)`) from opening/closing balances, projections, and summaries.
*   **Accounts Page:** Show all accounts (including hidden ones) with a toggle UI to hide/unhide them.

### 2.3 Amount Normalization
*   Amounts are normalized according to category type:
    *   **Income:** Always positive.
    *   **Expense / Saving:** Always negative.
*   Store actual category mappings in an $O(1)$ lookup Map.

### 2.4 API Patterns & Clerk Authentication
*   **Clerk Integration:** Every API route must call `auth()` to extract `userId`. If `userId` is missing, return a `401 Unauthorized` response immediately before any database query.
*   **Data Isolation:** Every Drizzle ORM query must be scoped to the authenticated user using `eq(table.userId, userId)`.
*   **JSON Response Handling:** Handle empty response bodies gracefully using the `readJsonOrThrow<T>` helper pattern to avoid parsing errors.

---

## 3. Technology Stack Reference

*   **Framework:** Next.js 16.2.6 (Turbopack) / React 19
*   **Styling:** Tailwind CSS 4 (PostCSS-based, no utility prefixes needed)
*   **Database:** PostgreSQL (via Neon) and Drizzle ORM 0.45
*   **Authentication:** Clerk
