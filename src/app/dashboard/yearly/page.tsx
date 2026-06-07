'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUserSettings } from '@/lib/useUserSettings';

type Transaction = {
  id: string;
  accountId: string | null;
  amount: string;
  category: string;
  date: string;
  plannedDate: string | null;
  isPlanned: boolean;
  origin: string;
};

type Category = { id: string; name: string; type: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function YearlyPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { formatMoney } = useUserSettings();

  const loadAll = useCallback(async () => {
    const [catRes, txRes] = await Promise.all([
      fetch('/api/categories'),
      fetch('/api/transactions'),
    ]);
    const catRows = await catRes.json();
    const txs = await txRes.json();
    setCategories(catRows);
    setTransactions(txs);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const categoryTypeByName = new Map(categories.map(c => [c.name, c.type]));
  
  // Filter ONLY settled transactions
  const yearTxs = transactions.filter(t => {
    if (t.isPlanned) return false;
    return new Date(t.date).getFullYear() === year;
  });

  // Calculate month by month data
  const monthlyData = MONTHS.map((m, index) => {
    const month = index + 1;
    const monthTxs = yearTxs.filter(t => new Date(t.date).getMonth() + 1 === month);
    
    const income = monthTxs
      .filter(t => categoryTypeByName.get(t.category) === 'income')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
      
    const expense = monthTxs
      .filter(t => categoryTypeByName.get(t.category) === 'expense')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
      
    const saving = monthTxs
      .filter(t => categoryTypeByName.get(t.category) === 'saving')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
      
    const net = income - expense - saving;
    
    return { month: m, income, expense, saving, net, txCount: monthTxs.length };
  });

  const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
  const totalExpense = monthlyData.reduce((sum, m) => sum + m.expense, 0);
  const totalSaving = monthlyData.reduce((sum, m) => sum + m.saving, 0);
  const totalNet = totalIncome - totalExpense - totalSaving;

  return (
    <div className="space-y-6">
      <div className="bg-background rounded-xl border p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Yearly Summary</h1>
            <p className="text-sm text-muted mt-1">
              Month-by-month breakdown of your actual income, expenses, and savings.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted font-medium">Year:</p>
            <input
              type="number"
              className="border border-border rounded-lg px-3 py-1.5 text-sm w-24 bg-background-elevated focus:outline-none focus:ring-2 focus:ring-primary"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-background-elevated rounded-xl border border-border p-4 shadow-sm">
          <p className="text-sm font-medium text-muted">YTD Income</p>
          <p className="text-xl font-bold text-green-600 mt-1">+{formatMoney(totalIncome)}</p>
        </div>
        <div className="bg-background-elevated rounded-xl border border-border p-4 shadow-sm">
          <p className="text-sm font-medium text-muted">YTD Expenses</p>
          <p className="text-xl font-bold text-red-500 mt-1">-{formatMoney(totalExpense)}</p>
        </div>
        <div className="bg-background-elevated rounded-xl border border-border p-4 shadow-sm">
          <p className="text-sm font-medium text-muted">YTD Savings</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{formatMoney(totalSaving)}</p>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50 p-4 shadow-sm">
          <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">YTD Net</p>
          <p className={`text-xl font-bold mt-1 ${totalNet >= 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-red-600 dark:text-red-400'}`}>
            {totalNet >= 0 ? '+' : ''}{formatMoney(totalNet)}
          </p>
        </div>
      </div>

      <div className="bg-background rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background-elevated border-b text-muted">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Month</th>
                <th className="text-right px-4 py-3 font-medium">Income</th>
                <th className="text-right px-4 py-3 font-medium">Expenses</th>
                <th className="text-right px-4 py-3 font-medium">Savings</th>
                <th className="text-right px-4 py-3 font-medium">Net Surplus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {monthlyData.map(row => (
                <tr key={row.month} className="hover:bg-background-elevated transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                    {row.month}
                    {row.txCount === 0 && <span className="text-[10px] bg-muted/20 text-muted px-1.5 py-0.5 rounded-sm">No Data</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">
                    {row.income > 0 ? `+${formatMoney(row.income)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-red-500">
                    {row.expense > 0 ? `-${formatMoney(row.expense)}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600">
                    {row.saving > 0 ? formatMoney(row.saving) : '-'}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${row.net > 0 ? 'text-green-600' : row.net < 0 ? 'text-red-500' : 'text-muted'}`}>
                    {row.net === 0 ? '-' : `${row.net > 0 ? '+' : ''}${formatMoney(row.net)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
