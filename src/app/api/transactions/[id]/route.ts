import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { accounts, categories, transactions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const [existingTx] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

  if (!existingTx) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (body.accountId) {
    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, body.accountId), eq(accounts.userId, userId)));
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const updateValues: Record<string, string | boolean | null> = {};
  if (body.isPlanned !== undefined) updateValues.isPlanned = Boolean(body.isPlanned);
  if (body.category !== undefined) updateValues.category = String(body.category);
  if (body.date !== undefined) updateValues.date = String(body.date);
  // Never overwrite plannedDate — it anchors the transaction to its original planned month.
  if (body.accountId !== undefined) updateValues.accountId = body.accountId ? String(body.accountId) : null;

  const resolvedCategory = String(body.category ?? existingTx.category);
  const resolvedAmount = Number(body.amount ?? existingTx.amount);

  const [categoryRow] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.name, resolvedCategory)));

  let normalizedAmount = resolvedAmount;
  if (categoryRow?.type === 'income') {
    normalizedAmount = Math.abs(resolvedAmount);
  } else if (categoryRow?.type === 'expense' || categoryRow?.type === 'saving') {
    normalizedAmount = -Math.abs(resolvedAmount);
  }

  updateValues.amount = String(normalizedAmount);

  if (body.isPlanned === false) {
    updateValues.origin = 'planned';
    if (!('accountId' in updateValues) || !updateValues.accountId) {
      return NextResponse.json({ error: 'Account is required when settling a planned transaction' }, { status: 400 });
    }
  }

  const [tx] = await db
    .update(transactions)
    .set(updateValues)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning();

  return NextResponse.json(tx);
}
