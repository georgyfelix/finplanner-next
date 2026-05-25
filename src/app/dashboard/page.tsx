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
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">{MONTHS[month - 1]} {year} Overview</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Accounts</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">{userAccounts.length}</p>
            </div>
            <div className="text-3xl">💰</div>
          </div>
          <Link href="/dashboard/accounts" className="text-xs font-medium text-blue-600 hover:text-blue-700 mt-3 inline-flex items-center gap-1">Manage <span>→</span></Link>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700">Total Balance</p>
              <p className={`text-3xl font-bold mt-2 ${totalVisibleBalance < 0 ? 'text-red-600' : 'text-emerald-900'}`}>
                {formatMoney(totalVisibleBalance, settings.currency, settings.locale)}
              </p>
            </div>
            <div className="text-3xl">🏦</div>
          </div>
          {visibleAccounts.length !== userAccounts.length && (
            <p className="text-xs text-amber-700 mt-2 font-medium">📌 Hidden accounts excluded</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">Planned Net</p>
              <p className={`text-3xl font-bold mt-2 ${plannedNetThisMonth < 0 ? 'text-red-600' : plannedNetThisMonth > 0 ? 'text-green-600' : 'text-slate-900'}`}>
                {plannedNetThisMonth >= 0 ? '+' : ''}{formatMoney(Math.abs(plannedNetThisMonth), settings.currency, settings.locale)}
              </p>
            </div>
            <div className="text-3xl">📊</div>
          </div>
          <Link href="/dashboard/plan" className="text-xs font-medium text-purple-600 hover:text-purple-700 mt-3 inline-flex items-center gap-1">Plan <span>→</span></Link>
        </div>

        <div className={`bg-gradient-to-br rounded-lg border p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between h-full ${projectedEndOfMonth < 0 ? 'from-red-50 to-red-100 border-red-200' : 'from-green-50 to-green-100 border-green-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${projectedEndOfMonth < 0 ? 'text-red-700' : 'text-green-700'}`}>Projected End</p>
              <p className={`text-3xl font-bold mt-2 ${projectedEndOfMonth < 0 ? 'text-red-600' : 'text-green-700'}`}>
                {formatMoney(projectedEndOfMonth, settings.currency, settings.locale)}
              </p>
            </div>
            <div className="text-3xl">{projectedEndOfMonth < 0 ? '⚠️' : '✅'}</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700">Unplanned</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                {formatMoney(unplannedExpenses, settings.currency, settings.locale)}
              </p>
              <p className="text-xs text-orange-600 mt-1">Manual expenses</p>
            </div>
            <div className="text-3xl">🎲</div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">📅 Monthly Roll-Forward</h2>
          <Link href="/dashboard/plan" className="text-sm font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">View Plan <span>→</span></Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-slate-100">
            <p className="text-sm font-medium text-slate-600">Opening Balance</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{formatMoney(totalMonthlyOpening, settings.currency, settings.locale)}</p>
            <p className="text-xs text-slate-500 mt-1">Dashboard accounts</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-100">
            <p className="text-sm font-medium text-slate-600">Projected Closing</p>
            <p className={`text-2xl font-bold mt-2 ${totalMonthlyClosing < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {formatMoney(totalMonthlyClosing, settings.currency, settings.locale)}
            </p>
            <p className="text-xs text-slate-500 mt-1">After planned outflows</p>
          </div>
        </div>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          ℹ️ Income is rolled forward automatically. Outflows are deducted.
        </div>
      </div>

      {/* Planned vs Budgets */}
      {plannedThisMonth.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
              📌 {plannedThisMonth.length} Planned Transaction{plannedThisMonth.length !== 1 ? 's' : ''} in {MONTHS[month - 1]}
            </h2>
            <Link href="/dashboard/plan" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">Edit <span>→</span></Link>
          </div>
          <div className="bg-white rounded-lg divide-y">
            {plannedThisMonth.slice(0, 5).map((tx, idx) => (
              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-indigo-50 transition">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{tx.category}</p>
                  <p className="text-xs text-slate-500">{new Date(tx.date).toLocaleDateString()}</p>
                </div>
                <span className={`font-bold text-lg ${normalizeAmount(tx) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {normalizeAmount(tx) >= 0 ? '+' : '-'}{formatMoney(Math.abs(normalizeAmount(tx)), settings.currency, settings.locale)}
                </span>
              </div>
            ))}
          </div>
          {plannedThisMonth.length > 5 && (
            <p className="text-sm text-indigo-600 font-medium mt-3">+{plannedThisMonth.length - 5} more transactions…</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden min-h-[220px]">
          <div className="p-5 border-b bg-gradient-to-r from-slate-50 to-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">💳 Recent Transactions</h2>
            <Link href="/dashboard/transactions" className="text-sm font-medium text-slate-600 hover:text-slate-900">View all</Link>
          </div>
          {recentActual.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-400 text-sm">No transactions yet. <Link href="/dashboard/transactions" className="text-indigo-600 font-medium hover:underline">Add one →</Link></p>
            </div>
          ) : (
            <div className="divide-y">
              {recentActual.map((tx) => (
                <div key={tx.id} className="p-4 hover:bg-slate-50 transition flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{tx.category}</p>
                    <p className="text-xs text-slate-500">{new Date(tx.date).toLocaleDateString()}</p>
                  </div>
                  <span className={`font-bold text-lg ${normalizeAmount(tx) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {normalizeAmount(tx) >= 0 ? '+' : '-'}{formatMoney(Math.abs(normalizeAmount(tx)), settings.currency, settings.locale)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Budgets */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden min-h-[220px]">
          <div className="p-5 border-b bg-gradient-to-r from-slate-50 to-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">📈 Budgets • {MONTHS[month - 1]} {year}</h2>
            <Link href="/dashboard/budgets" className="text-sm font-medium text-slate-600 hover:text-slate-900">Manage</Link>
          </div>
          {monthBudgets.filter(b => b.month === month && b.year === year).length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-400 text-sm">No budgets set yet. <Link href="/dashboard/budgets" className="text-indigo-600 font-medium hover:underline">Create one →</Link></p>
            </div>
          ) : (
            <div className="divide-y">
              {monthBudgets.filter(b => b.month === month && b.year === year).map(b => {
                const spent = actualTxs
                  .filter(t => t.category === b.category && new Date(t.date).getMonth() + 1 === month)
                  .reduce((s, t) => s + Math.abs(normalizeAmount(t)), 0);
                const pct = Math.min(100, (spent / Number(b.limit)) * 100);
                const isOverBudget = spent > Number(b.limit);
                return (
                  <div key={b.id} className="p-4 hover:bg-slate-50 transition">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-slate-900">{b.category}</span>
                      <span className={`font-bold ${isOverBudget ? 'text-red-600 text-lg' : 'text-slate-700'}`}>
                        {formatMoney(spent, settings.currency, settings.locale)} <span className="text-slate-400 font-normal">/ {formatMoney(Number(b.limit), settings.currency, settings.locale)}</span>
                      </span>
                    </div>
                    <div className={`h-2.5 rounded-full overflow-hidden transition ${pct >= 100 ? 'bg-red-100' : pct >= 80 ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{Math.round(pct)}% spent</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
