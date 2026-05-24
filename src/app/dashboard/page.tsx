import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { accounts, transactions, budgets, monthlyAccountBalances, categories } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getOrCreateUserSettings } from '@/lib/userSettings';
import { formatMoney } from '@/lib/currency';

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const headerStore = await headers();

  const settings = await getOrCreateUserSettings(userId, headerStore.get('accept-language'));

  const [userAccounts, allTransactions, monthBudgets, monthAccountBalances, userCategories] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
    db
      .select()
      .from(monthlyAccountBalances)
      .where(and(eq(monthlyAccountBalances.userId, userId), eq(monthlyAccountBalances.month, month), eq(monthlyAccountBalances.year, year))),
    db.select().from(categories).where(eq(categories.userId, userId)),
  ]);

  // Balance computations
  const actualTxs = allTransactions.filter(t => !t.isPlanned);
  const plannedThisMonth = allTransactions.filter(t => {
    if (!t.isPlanned) return false;
    const d = new Date(t.date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  // Include both pending and settled planned-origin rows for projection stability.
  const allPlannedThisMonth = allTransactions.filter(t => {
    if (t.origin !== 'planned') return false;
    const anchor = t.plannedDate ?? t.date;
    const d = new Date(anchor);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  // Exclude hidden-from-dashboard accounts from dashboard totals.
  const visibleAccounts = userAccounts.filter(acc => !acc.hiddenFromDashboard);
  const totalVisibleBalance = visibleAccounts.reduce((sum, acc) => sum + Number(acc.initialBalance), 0);

  const categoryTypeByName = new Map(userCategories.map(c => [c.name, c.type]));
  const normalizeAmount = (tx: (typeof allTransactions)[number]) => {
    const raw = Number(tx.amount);
    const type = categoryTypeByName.get(tx.category);
    if (type === 'income') return Math.abs(raw);
    if (type === 'expense' || type === 'saving') return -Math.abs(raw);
    return raw;
  };
  const plannedNetThisMonth = plannedThisMonth.reduce((sum, t) => sum + normalizeAmount(t), 0);

  const actualThisMonth = actualTxs.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const unplannedExpenses = actualThisMonth
    .filter(t => t.origin !== 'planned' && normalizeAmount(t) < 0)
    .reduce((sum, t) => sum + Math.abs(normalizeAmount(t)), 0);

  const plannedOutflowThisMonth = allPlannedThisMonth
    .filter(t => {
      const type = categoryTypeByName.get(t.category);
      return type === 'expense' || type === 'saving';
    })
    .reduce((sum, t) => sum + Math.abs(normalizeAmount(t)), 0);

  // Use visible accounts for monthly opening/closing totals as well.
  const visibleAccountIds = new Set(visibleAccounts.map(a => a.id));
  const visibleMonthlyBalances = monthAccountBalances.filter(r => visibleAccountIds.has(r.accountId));
  const totalMonthlyOpening = visibleMonthlyBalances.reduce((sum, r) => sum + Number(r.openingBalance), 0);
  const totalMonthlyClosing = visibleMonthlyBalances.reduce((sum, r) => sum + Number(r.closingBalance), 0);
  // Opening already includes salary credit — only subtract planned outflows.
  const projectedEndOfMonth = totalMonthlyOpening - plannedOutflowThisMonth;

  const recentActual = actualTxs
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-sm text-gray-500">Accounts</p>
          <p className="text-3xl font-bold mt-1">{userAccounts.length}</p>
          <Link href="/dashboard/accounts" className="text-xs text-indigo-600 hover:underline mt-2 inline-block">Manage →</Link>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Balance</p>
          <p className={`text-3xl font-bold mt-1 ${totalVisibleBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {formatMoney(totalVisibleBalance, settings.currency, settings.locale)}
          </p>
          {visibleAccounts.length !== userAccounts.length && (
            <p className="text-xs text-amber-600 mt-2">Hidden accounts are excluded here.</p>
          )}
          <Link href="/dashboard/accounts" className="text-xs text-indigo-600 hover:underline mt-2 inline-block">View accounts →</Link>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-sm text-gray-500">Planned remaining net</p>
          <p className={`text-3xl font-bold mt-1 ${plannedNetThisMonth < 0 ? 'text-red-500' : plannedNetThisMonth > 0 ? 'text-green-600' : 'text-gray-900'}`}>
            {plannedNetThisMonth >= 0 ? '+' : ''}{formatMoney(Math.abs(plannedNetThisMonth), settings.currency, settings.locale)}
          </p>
          <Link href="/dashboard/plan" className="text-xs text-indigo-600 hover:underline mt-2 inline-block">View plan →</Link>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-sm text-gray-500">Projected end of {MONTHS[month - 1]}</p>
          <p className={`text-3xl font-bold mt-1 ${projectedEndOfMonth < 0 ? 'text-red-600' : 'text-green-700'}`}>
            {formatMoney(projectedEndOfMonth, settings.currency, settings.locale)}
          </p>
          <Link href="/dashboard/plan" className="text-xs text-indigo-600 hover:underline mt-2 inline-block">Plan expenses →</Link>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-sm text-gray-500">Unplanned Expenses ({MONTHS[month - 1]})</p>
          <p className="text-3xl font-bold mt-1 text-red-600">
            {formatMoney(unplannedExpenses, settings.currency, settings.locale)}
          </p>
          <p className="text-xs text-gray-400 mt-2">Manual actual expenses not from planned items.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-gray-800">Monthly Roll-Forward</h2>
          <Link href="/dashboard/plan" className="text-sm text-indigo-600 hover:underline">View Monthly Plan →</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            <p className="text-gray-500">Opening (dashboard accounts)</p>
            <p className="font-semibold">{formatMoney(totalMonthlyOpening, settings.currency, settings.locale)}</p>
          </div>
          <div>
            <p className="text-gray-500">Closing (dashboard accounts)</p>
            <p className={`font-semibold ${totalMonthlyClosing < 0 ? 'text-red-600' : 'text-green-700'}`}>
              {formatMoney(totalMonthlyClosing, settings.currency, settings.locale)}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Planned income transactions are used automatically for roll-forward.</p>
      </div>

      {/* Planned vs Budgets */}
      {plannedThisMonth.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-indigo-800">
              {plannedThisMonth.length} planned transaction{plannedThisMonth.length !== 1 ? 's' : ''} in {MONTHS[month - 1]}
            </h2>
            <Link href="/dashboard/plan" className="text-sm text-indigo-600 hover:underline font-medium">Manage plan →</Link>
          </div>
          <ul className="space-y-1">
            {plannedThisMonth.slice(0, 3).map(tx => (
              <li key={tx.id} className="text-sm flex justify-between">
                <span className="text-indigo-700">{tx.category} · {tx.date}</span>
                <span className={normalizeAmount(tx) < 0 ? 'text-red-600 font-medium' : 'text-green-700 font-medium'}>
                  {normalizeAmount(tx) >= 0 ? '+' : ''}{formatMoney(Math.abs(normalizeAmount(tx)), settings.currency, settings.locale)}
                </span>
              </li>
            ))}
            {plannedThisMonth.length > 3 && (
              <li className="text-xs text-indigo-400 mt-1">+{plannedThisMonth.length - 3} more…</li>
            )}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="font-semibold">Recent Transactions</h2>
            <Link href="/dashboard/transactions" className="text-sm text-indigo-600 hover:underline">View all</Link>
          </div>
          {recentActual.length === 0 ? (
            <p className="p-5 text-gray-400 text-sm">No transactions yet.</p>
          ) : (
            <ul className="divide-y">
              {recentActual.map((tx) => (
                <li key={tx.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{tx.category}</p>
                    <p className="text-xs text-gray-400">{tx.date}</p>
                  </div>
                  <span className={`font-semibold text-sm ${normalizeAmount(tx) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {normalizeAmount(tx) >= 0 ? '+' : ''}{formatMoney(Math.abs(normalizeAmount(tx)), settings.currency, settings.locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Active Budgets */}
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="font-semibold">Budgets — {MONTHS[month - 1]} {year}</h2>
            <Link href="/dashboard/budgets" className="text-sm text-indigo-600 hover:underline">Manage</Link>
          </div>
          {monthBudgets.filter(b => b.month === month && b.year === year).length === 0 ? (
            <p className="p-5 text-gray-400 text-sm">No budgets set for this month.</p>
          ) : (
            <ul className="divide-y">
              {monthBudgets.filter(b => b.month === month && b.year === year).map(b => {
                const spent = actualTxs
                  .filter(t => t.category === b.category && new Date(t.date).getMonth() + 1 === month)
                  .reduce((s, t) => s + Math.abs(normalizeAmount(t)), 0);
                const pct = Math.min(100, (spent / Number(b.limit)) * 100);
                return (
                  <li key={b.id} className="p-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{b.category}</span>
                      <span className={spent > Number(b.limit) ? 'text-red-500 font-medium' : 'text-gray-600'}>
                        {formatMoney(spent, settings.currency, settings.locale)} / {formatMoney(Number(b.limit), settings.currency, settings.locale)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-400' : 'bg-indigo-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
