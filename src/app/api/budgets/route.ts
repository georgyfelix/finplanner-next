import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { budgets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  const year = searchParams.get('year');

  const conditions = [eq(budgets.userId, userId)];
  if (month) conditions.push(eq(budgets.month, Number(month)));
  if (year) conditions.push(eq(budgets.year, Number(year)));

  const rows = await db.select().from(budgets).where(and(...conditions));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { category, limit, month, year } = await req.json();
  if (!category || limit === undefined || !month || !year) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const [budget] = await db
    .insert(budgets)
    .values({ userId, category, limit: String(limit), month, year })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.category, budgets.month, budgets.year],
      set: {
        limit: String(limit),
      },
    })
    .returning();

  return NextResponse.json(budget, { status: 201 });
}

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, limit } = await req.json();
  if (!id || limit === undefined) {
    return NextResponse.json({ error: 'ID and limit are required' }, { status: 400 });
  }

  const [budget] = await db
    .update(budgets)
    .set({ limit: String(limit) })
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
    .returning();

  if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
  return NextResponse.json(budget);
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
  return NextResponse.json({ success: true });
}
