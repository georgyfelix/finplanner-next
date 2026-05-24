import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions, accounts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { transactionId, numMonths } = await req.json();
  if (!transactionId || !numMonths || numMonths < 1 || numMonths > 60) {
    return NextResponse.json({ error: 'Invalid transactionId or numMonths (1-60)' }, { status: 400 });
  }

  // Get the original transaction
  const [originalTx] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));

  if (!originalTx) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  // Only allow copying planned-origin transactions
  if (originalTx.origin !== 'planned') {
    return NextResponse.json({ error: 'Only planned transactions can be copied' }, { status: 400 });
  }

  // Use plannedDate as the anchor, or fall back to date
  const anchorDate = new Date(originalTx.plannedDate || originalTx.date);
  const anchorDay = anchorDate.getDate();
  const anchorMonth = anchorDate.getMonth();
  const anchorYear = anchorDate.getFullYear();

  const copies = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Generate copies for the next numMonths
  for (let i = 1; i <= numMonths; i++) {
    let newMonth = anchorMonth + i;
    let newYear = anchorYear;

    // Handle year rollover
    while (newMonth > 11) {
      newMonth -= 12;
      newYear += 1;
    }

    // Calculate the day for this month (handle end-of-month cases)
    const daysInMonth = new Date(newYear, newMonth + 1, 0).getDate();
    const day = Math.min(anchorDay, daysInMonth);

    const copyDate = new Date(newYear, newMonth, day);
    copyDate.setHours(0, 0, 0, 0);

    // Skip if the copy date is in the past or today (only create for future months)
    if (copyDate < now) {
      continue;
    }

    const copyPlannedDate = copyDate.toISOString().slice(0, 10);

    copies.push({
      userId,
      accountId: originalTx.accountId,
      amount: originalTx.amount,
      category: originalTx.category,
      date: copyPlannedDate, // For planned transactions, date == plannedDate initially
      plannedDate: copyPlannedDate,
      isPlanned: true,
      origin: 'planned',
    });
  }

  // Bulk insert all copies
  if (copies.length > 0) {
    await db.insert(transactions).values(copies);
  }

  return NextResponse.json({ copied: copies.length, copies });
}
