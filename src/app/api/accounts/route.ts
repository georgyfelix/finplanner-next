import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { accounts, transactions, categories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
  const result = userAccounts.map(acc => ({
    ...acc,
    currentBalance: Number(acc.initialBalance),
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, initialBalance, hiddenFromDashboard } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const [account] = await db
    .insert(accounts)
    .values({
      userId,
      name: name.trim(),
      initialBalance: String(initialBalance ?? 0),
      hiddenFromDashboard: Boolean(hiddenFromDashboard),
    })
    .returning();
  return NextResponse.json(account, { status: 201 });
}

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, name, initialBalance, hiddenFromDashboard } = await req.json();
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  const values: Record<string, string | boolean> = {};
  if (name !== undefined) values.name = name.trim();
  if (initialBalance !== undefined) values.initialBalance = String(initialBalance);
  if (hiddenFromDashboard !== undefined) values.hiddenFromDashboard = Boolean(hiddenFromDashboard);

  const [account] = await db
    .update(accounts)
    .set(values)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning();
  return NextResponse.json(account);
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  return NextResponse.json({ success: true });
}
