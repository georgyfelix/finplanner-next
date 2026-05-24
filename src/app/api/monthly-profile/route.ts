import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { monthlyProfiles } from '@/lib/db/schema';

function normalizeMonthYear(url: string) {
  const now = new Date();
  const { searchParams } = new URL(url);
  const month = Number(searchParams.get('month') ?? now.getMonth() + 1);
  const year = Number(searchParams.get('year') ?? now.getFullYear());
  return { month, year };
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { month, year } = normalizeMonthYear(req.url);

  const [existing] = await db
    .select()
    .from(monthlyProfiles)
    .where(and(eq(monthlyProfiles.userId, userId), eq(monthlyProfiles.month, month), eq(monthlyProfiles.year, year)));

  if (existing) return NextResponse.json(existing);

  const [created] = await db
    .insert(monthlyProfiles)
    .values({
      userId,
      month,
      year,
      startingBalance: '0',
      monthlyIncome: '0',
    })
    .returning();

  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { month, year, startingBalance, monthlyIncome } = await req.json();
  if (!month || !year) return NextResponse.json({ error: 'Month and year are required' }, { status: 400 });

  const [profile] = await db
    .insert(monthlyProfiles)
    .values({
      userId,
      month: Number(month),
      year: Number(year),
      startingBalance: String(startingBalance ?? 0),
      monthlyIncome: String(monthlyIncome ?? 0),
    })
    .onConflictDoUpdate({
      target: [monthlyProfiles.userId, monthlyProfiles.month, monthlyProfiles.year],
      set: {
        startingBalance: String(startingBalance ?? 0),
        monthlyIncome: String(monthlyIncome ?? 0),
        updatedAt: new Date(),
      },
    })
    .returning();

  return NextResponse.json(profile);
}
