import { NextRequest, NextResponse } from 'next/server';
import { getMetadataDb } from '@/lib/db';

interface SyncSettings {
  yandex_enabled: number;
  yandex_hour: number;
  moysklad_enabled: number;
  moysklad_hour: number;
  updated_at: string;
}

export async function GET() {
  const db = getMetadataDb();

  const settings = db.prepare(`
    SELECT yandex_enabled, yandex_hour, moysklad_enabled, moysklad_hour, updated_at
    FROM sync_settings WHERE id = 1
  `).get() as SyncSettings | undefined;

  if (!settings) {
    return NextResponse.json({
      yandex_enabled: false,
      yandex_hour: 6,
      moysklad_enabled: false,
      moysklad_hour: 7,
    });
  }

  return NextResponse.json({
    yandex_enabled: !!settings.yandex_enabled,
    yandex_hour: settings.yandex_hour,
    moysklad_enabled: !!settings.moysklad_enabled,
    moysklad_hour: settings.moysklad_hour,
    updated_at: settings.updated_at,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { yandex_enabled, yandex_hour, moysklad_enabled, moysklad_hour } = body;

  const db = getMetadataDb();

  db.prepare(`
    UPDATE sync_settings SET
      yandex_enabled = ?,
      yandex_hour = ?,
      moysklad_enabled = ?,
      moysklad_hour = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(
    yandex_enabled ? 1 : 0,
    yandex_hour ?? 6,
    moysklad_enabled ? 1 : 0,
    moysklad_hour ?? 7
  );

  return NextResponse.json({ success: true });
}
