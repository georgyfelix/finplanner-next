import { pgTable, uuid, text, numeric, boolean, date, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  initialBalance: numeric('initial_balance', { precision: 12, scale: 2 }).default('0').notNull(),
  hiddenFromDashboard: boolean('hidden_from_dashboard').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  // Planned transactions are account-agnostic until they are settled as actual.
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  category: text('category').notNull(),
  date: date('date').notNull(),
  // Preserved original planned date so settling (which changes `date`) doesn't lose the month context.
  plannedDate: date('planned_date'),
  isPlanned: boolean('is_planned').default(false).notNull(),
  // manual: user entered directly, planned: created from monthly planning.
  origin: text('origin').default('manual').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const budgets = pgTable(
  'budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    category: text('category').notNull(),
    limit: numeric('limit', { precision: 12, scale: 2 }).notNull(),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    userCategoryMonthYearUnique: uniqueIndex('budgets_user_category_month_year_uidx').on(
      table.userId,
      table.category,
      table.month,
      table.year
    ),
  })
);

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull().default('expense'), // 'expense' | 'income' | 'saving'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userSettings = pgTable('user_settings', {
  userId: text('user_id').primaryKey(),
  locale: text('locale').default('en-US').notNull(),
  currency: text('currency').default('USD').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const monthlyProfiles = pgTable(
  'monthly_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    startingBalance: numeric('starting_balance', { precision: 12, scale: 2 }).default('0').notNull(),
    monthlyIncome: numeric('monthly_income', { precision: 12, scale: 2 }).default('0').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    userMonthYearUnique: uniqueIndex('monthly_profiles_user_month_year_uidx').on(table.userId, table.month, table.year),
  })
);

export const monthlyAccountBalances = pgTable(
  'monthly_account_balances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    openingBalance: numeric('opening_balance', { precision: 12, scale: 2 }).default('0').notNull(),
    closingBalance: numeric('closing_balance', { precision: 12, scale: 2 }).default('0').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    userAccountMonthYearUnique: uniqueIndex('monthly_account_balances_user_account_month_year_uidx').on(
      table.userId,
      table.accountId,
      table.month,
      table.year
    ),
  })
);
