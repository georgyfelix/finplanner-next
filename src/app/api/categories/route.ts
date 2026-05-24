import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { DEFAULT_CATEGORIES } from '@/lib/defaultCategories';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let rows = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(categories.type, categories.name);

  if (rows.length === 0) {
    await db.insert(categories).values(
      DEFAULT_CATEGORIES.map(c => ({
        userId,
        name: c.name,
        type: c.type,
      }))
    );

    rows = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(categories.type, categories.name);
  }

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const existing = await db.select().from(categories).where(eq(categories.userId, userId));
  const keySet = new Set(existing.map(c => `${c.type}::${c.name.toLowerCase()}`));

  // Bulk insert support
  if (Array.isArray(body)) {
    const incoming = body
      .map(c => ({ name: c.name?.trim(), type: c.type ?? 'expense' }))
      .filter(c => c.name);
    const toInsert = incoming.filter(c => !keySet.has(`${c.type}::${c.name!.toLowerCase()}`));

    if (toInsert.length === 0) {
      return NextResponse.json([], { status: 201 });
    }

    const rows = await db
      .insert(categories)
      .values(toInsert.map(c => ({ userId, name: c.name!, type: c.type })))
      .returning();
    return NextResponse.json(rows, { status: 201 });
  }

  const { name, type } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const normalizedName = name.trim();
  const normalizedType = type ?? 'expense';
  if (keySet.has(`${normalizedType}::${normalizedName.toLowerCase()}`)) {
    return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
  }

  const [cat] = await db
    .insert(categories)
    .values({ userId, name: normalizedName, type: normalizedType })
    .returning();
  return NextResponse.json(cat, { status: 201 });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
  return NextResponse.json({ success: true });
}
