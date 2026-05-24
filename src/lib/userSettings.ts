import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { inferSettingsFromAcceptLanguage } from '@/lib/currency';

export async function getOrCreateUserSettings(userId: string, acceptLanguage?: string | null) {
  const [existing] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (existing) return existing;

  const inferred = inferSettingsFromAcceptLanguage(acceptLanguage);
  const [created] = await db
    .insert(userSettings)
    .values({
      userId,
      locale: inferred.locale,
      currency: inferred.currency,
    })
    .returning();

  return created;
}
