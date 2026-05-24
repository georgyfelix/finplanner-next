import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions, accounts, categories } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId');
  const month = searchParams.get('month');
  const year = searchParams.get('year');

  const conditions = [eq(transactions.userId, userId)];
  if (accountId) conditions.push(eq(transactions.accountId, accountId));

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date));

  const filteredRows = rows.filter(row => {
    if (!month || !year) return true;
    const numMonth = Number(month);
    const numYear = Number(year);
    
    // For planned-origin transactions: show in both planned month and settlement month
    if (row.origin === 'planned' && row.plannedDate) {
      const plannedDate = new Date(row.plannedDate);
      const settlementDate = new Date(row.date);
      const plannedMonthMatch = plannedDate.getMonth() + 1 === numMonth && plannedDate.getFullYear() === numYear;
      const settlementMonthMatch = settlementDate.getMonth() + 1 === numMonth && settlementDate.getFullYear() === numYear;
      return plannedMonthMatch || settlementMonthMatch;
    }
    
    // For other transactions: use actual date
    const date = new Date(row.date);
    return date.getMonth() + 1 === numMonth && date.getFullYear() === numYear;
  });

  const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
  const categoryTypeByName = new Map(userCategories.map(c => [c.name, c.type]));

  const normalizedRows = filteredRows.map(row => {
    const type = categoryTypeByName.get(row.category);
    const numericAmount = Number(row.amount);
    let normalizedAmount = numericAmount;
    if (type === 'income') {
      normalizedAmount = Math.abs(numericAmount);
    } else if (type === 'expense' || type === 'saving') {
      normalizedAmount = -Math.abs(numericAmount);
    }

    return {
      ...row,
      amount: String(normalizedAmount),
    };
  });

  return NextResponse.json(normalizedRows);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { accountId, amount, category, date, isPlanned, origin } = await req.json();
  if (amount === undefined || !category || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const planned = Boolean(isPlanned);

  if (!planned && !accountId) {
    return NextResponse.json({ error: 'Account is required for actual transactions' }, { status: 400 });
  }

  let account = null;
  if (accountId) {
    // Verify the selected account belongs to this user.
    [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const [categoryRow] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.name, category)));

  // Income adds to bank balance. Expense and saving reduce bank balance.
  let normalizedAmount = Number(amount);
  if (categoryRow?.type === 'income') {
    normalizedAmount = Math.abs(Number(amount));
  } else {
    normalizedAmount = -Math.abs(Number(amount));
  }

  const [tx] = await db
    .insert(transactions)
    .values({
      userId,
      accountId: account ? account.id : null,
      amount: String(normalizedAmount),
      category,
      date,
      isPlanned: planned,
      plannedDate: planned ? date : null,
      origin: planned ? 'planned' : origin ?? 'manual',
    })
    .returning();

  return NextResponse.json(tx, { status: 201 });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  return NextResponse.json({ success: true });
}
