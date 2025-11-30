import { NextRequest, NextResponse } from 'next/server';
import { getMetadataDb } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface SyncSettings {
  yandex_enabled: number;
  yandex_hour: number;
  moysklad_enabled: number;
  moysklad_hour: number;
}

// Get current hour in Moscow timezone
function getMoscowHour(): number {
  const now = new Date();
  const moscowTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  return moscowTime.getHours();
}

export async function GET(request: NextRequest) {
  // Verify secret key for cron security
  const authHeader = request.headers.get('authorization');
  const expectedKey = process.env.CRON_SECRET;

  if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getMetadataDb();
  const settings = db.prepare(`
    SELECT yandex_enabled, yandex_hour, moysklad_enabled, moysklad_hour
    FROM sync_settings WHERE id = 1
  `).get() as SyncSettings | undefined;

  if (!settings) {
    return NextResponse.json({ message: 'No sync settings found' });
  }

  const currentMoscowHour = getMoscowHour();
  const results: { yandex?: string; moysklad?: string } = {};

  // Check Yandex Direct sync
  if (settings.yandex_enabled && currentMoscowHour === settings.yandex_hour) {
    try {
      console.log('[Scheduled Sync] Starting Yandex Direct sync...');
      const { stdout, stderr } = await execAsync(
        'npx tsx /app/scripts/import-data.ts 180 30',
        {
          cwd: '/app',
          env: {
            ...process.env,
            NODE_ENV: 'production',
          },
          timeout: 600000, // 10 minutes
        }
      );
      results.yandex = 'success';
      console.log('[Scheduled Sync] Yandex Direct sync completed:', stdout);
      if (stderr) console.error('[Scheduled Sync] Yandex stderr:', stderr);
    } catch (error) {
      results.yandex = `error: ${error instanceof Error ? error.message : 'unknown'}`;
      console.error('[Scheduled Sync] Yandex Direct sync failed:', error);
    }
  }

  // Check MoySklad sync
  if (settings.moysklad_enabled && currentMoscowHour === settings.moysklad_hour) {
    try {
      console.log('[Scheduled Sync] Starting MoySklad sync...');
      const { stdout, stderr } = await execAsync(
        'npx tsx /app/scripts/sync-orders.ts 1000',
        {
          cwd: '/app',
          env: {
            ...process.env,
            NODE_ENV: 'production',
          },
          timeout: 300000, // 5 minutes
        }
      );
      results.moysklad = 'success';
      console.log('[Scheduled Sync] MoySklad sync completed:', stdout);
      if (stderr) console.error('[Scheduled Sync] MoySklad stderr:', stderr);
    } catch (error) {
      results.moysklad = `error: ${error instanceof Error ? error.message : 'unknown'}`;
      console.error('[Scheduled Sync] MoySklad sync failed:', error);
    }
  }

  return NextResponse.json({
    message: 'Scheduled sync check completed',
    currentMoscowHour,
    settings: {
      yandex: { enabled: !!settings.yandex_enabled, hour: settings.yandex_hour },
      moysklad: { enabled: !!settings.moysklad_enabled, hour: settings.moysklad_hour },
    },
    results,
  });
}
