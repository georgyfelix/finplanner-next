import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { inferSettingsFromAcceptLanguage } from '@/lib/currency';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (settings) return NextResponse.json(settings);

  const inferred = inferSettingsFromAcceptLanguage(req.headers.get('accept-language'));
  const [created] = await db
    .insert(userSettings)
    .values({
      userId,
      locale: inferred.locale,
      currency: inferred.currency,
    })
    .returning();

  return NextResponse.json(created);
}

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { currency, locale } = await req.json();
  if (!currency || typeof currency !== 'string') {
    return NextResponse.json({ error: 'Currency is required' }, { status: 400 });
  }

  const [updated] = await db
    .insert(userSettings)
    .values({
      userId,
      currency: currency.toUpperCase(),
      locale: typeof locale === 'string' && locale.trim() ? locale : 'en-US',
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        currency: currency.toUpperCase(),
        locale: typeof locale === 'string' && locale.trim() ? locale : 'en-US',
        updatedAt: new Date(),
      },
    })
    .returning();

  return NextResponse.json(updated);
}
