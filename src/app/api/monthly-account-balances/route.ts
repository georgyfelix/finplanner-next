import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, monthlyAccountBalances, transactions, categories } from '@/lib/db/schema';

function parseMonthYear(url: string) {
  const now = new Date();
  const { searchParams } = new URL(url);
  const month = Number(searchParams.get('month') ?? now.getMonth() + 1);
  const year = Number(searchParams.get('year') ?? now.getFullYear());
  return { month, year };
}

function getPreviousMonthYear(month: number, year: number) {
  if (month === 1) return { prevMonth: 12, prevYear: year - 1 };
  return { prevMonth: month - 1, prevYear: year };
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { month, year } = parseMonthYear(req.url);
  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
  const existing = await db
    .select()
    .from(monthlyAccountBalances)
    .where(and(eq(monthlyAccountBalances.userId, userId), eq(monthlyAccountBalances.month, month), eq(monthlyAccountBalances.year, year)));

  const existingByAccount = new Map(existing.map(row => [row.accountId, row]));
  const missingAccounts = userAccounts.filter(acc => !existingByAccount.has(acc.id));
  const currentBalanceByAccount = new Map(userAccounts.map(acc => [acc.id, Number(acc.initialBalance ?? 0)]));

  if (missingAccounts.length > 0) {
    const { prevMonth, prevYear } = getPreviousMonthYear(month, year);
    const previousMonthRows = await db
      .select()
      .from(monthlyAccountBalances)
      .where(
        and(
          eq(monthlyAccountBalances.userId, userId),
          eq(monthlyAccountBalances.month, prevMonth),
          eq(monthlyAccountBalances.year, prevYear)
        )
      );
    const previousClosingByAccount = new Map(previousMonthRows.map(row => [row.accountId, Number(row.closingBalance)]));

    const [userTransactions, userCategories] = await Promise.all([
      db.select().from(transactions).where(eq(transactions.userId, userId)),
      db.select().from(categories).where(eq(categories.userId, userId)),
    ]);
    const categoryTypeByName = new Map(userCategories.map(category => [category.name, category.type]));
    const incomeRollForward = userTransactions
      .filter(transaction => {
        if (transaction.origin !== 'planned') return false;
        if (categoryTypeByName.get(transaction.category) !== 'income') return false;
        const anchor = transaction.plannedDate ?? transaction.date;
        const date = new Date(anchor);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      })
      .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount)), 0);
    const salaryTargetAccountId = [...userAccounts]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]?.id;

    await db.insert(monthlyAccountBalances).values(
      missingAccounts.map(acc => {
        const baseOpening = previousClosingByAccount.get(acc.id) ?? Number(acc.initialBalance ?? 0);
        const opening = baseOpening + (acc.id === salaryTargetAccountId ? incomeRollForward : 0);
        return {
          userId,
          accountId: acc.id,
          month,
          year,
          openingBalance: String(opening),
          closingBalance: String(Number(acc.initialBalance ?? 0)),
        };
      })
    );
  }

  // Keep closing aligned with current account balance only for untouched rows.
  // Once a row is manually edited (updatedAt != createdAt), it is no longer auto-synced.
  const autoSyncRows = existing.filter(row => {
    const untouched = new Date(row.updatedAt).getTime() === new Date(row.createdAt).getTime();
    const current = currentBalanceByAccount.get(row.accountId);
    return untouched && current !== undefined && Number(row.closingBalance) !== current;
  });

  if (autoSyncRows.length > 0) {
    await Promise.all(
      autoSyncRows.map(row =>
        db
          .update(monthlyAccountBalances)
          .set({ closingBalance: String(currentBalanceByAccount.get(row.accountId) ?? row.closingBalance) })
          .where(and(eq(monthlyAccountBalances.id, row.id), eq(monthlyAccountBalances.userId, userId)))
      )
    );
  }

  const rows = await db
    .select()
    .from(monthlyAccountBalances)
    .where(and(eq(monthlyAccountBalances.userId, userId), eq(monthlyAccountBalances.month, month), eq(monthlyAccountBalances.year, year)));

  return NextResponse.json(
    rows.map(row => ({
      ...row,
      accountName: userAccounts.find(acc => acc.id === row.accountId)?.name ?? row.accountId,
    }))
  );
}

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, openingBalance, closingBalance } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  const setValues: Record<string, string | Date> = { updatedAt: new Date() };
  if (openingBalance !== undefined) setValues.openingBalance = String(openingBalance);
  if (closingBalance !== undefined) setValues.closingBalance = String(closingBalance);

  const [updated] = await db
    .update(monthlyAccountBalances)
    .set(setValues)
    .where(and(eq(monthlyAccountBalances.id, id), eq(monthlyAccountBalances.userId, userId)))
    .returning();

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}
